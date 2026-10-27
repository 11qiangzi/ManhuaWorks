-- 006_align_billing_plans.sql
-- P0-2: Align billing system between frontend and backend
--
-- 变更内容：
--   1) subscriptions.plan CHECK 约束：('free','pro','team') → ('free','basic','pro','enterprise')
--   2) quotas 表：新增 monthly_episodes / used_episodes 列（统一"次"计量）
--      旧列 (monthly_tokens/images/videos) 保留但弃用，不再写入
--   3) 已有 team 订阅迁移至 enterprise
--
-- 执行顺序：在 001_init.sql 之后执行

-- ============================================================
-- 1) subscriptions: 放宽 CHECK 约束
-- ============================================================

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS chk_subs_plan;

ALTER TABLE subscriptions ADD CONSTRAINT chk_subs_plan
  CHECK (plan IN ('free', 'basic', 'pro', 'enterprise'));

-- 将历史 team 订阅迁移至 enterprise
UPDATE subscriptions SET plan = 'enterprise' WHERE plan = 'team';

-- ============================================================
-- 2) quotas: 新增 episodes 列
-- ============================================================

-- 新增 monthly_episodes（默认 9 次/月，对应 free 档）
ALTER TABLE quotas
  ADD COLUMN IF NOT EXISTS monthly_episodes INTEGER NOT NULL DEFAULT 9;

-- 新增 used_episodes（默认 0）
ALTER TABLE quotas
  ADD COLUMN IF NOT EXISTS used_episodes INTEGER NOT NULL DEFAULT 0;

-- 按旧 tokens 配额粗略映射（仅做存量迁移参考，新逻辑完全使用 episodes）
-- 假设 1 次 ≈ 100,000 tokens，则 monthly_tokens / 100000 = 大致 episodes
-- 实际生产中由 subscriptionService.upsert 按 plan 重新设置
UPDATE quotas SET monthly_episodes =
  CASE
    WHEN monthly_tokens >= 50_000_000 THEN -1   -- enterprise 无限制
    WHEN monthly_tokens >= 10_000_000 THEN 280  -- pro
    WHEN monthly_tokens >= 1_000_000  THEN 50   -- basic
    ELSE 9                                       -- free
  END
WHERE monthly_episodes = 9; -- 只更新还没被设置过的行

-- ============================================================
-- 3) 弃用旧列（不删除，仅注释标记）
-- ============================================================
COMMENT ON COLUMN quotas.monthly_tokens IS 'DEPRECATED: use monthly_episodes instead';
COMMENT ON COLUMN quotas.used_tokens    IS 'DEPRECATED: use used_episodes instead';
COMMENT ON COLUMN quotas.monthly_images IS 'DEPRECATED: use monthly_episodes instead';
COMMENT ON COLUMN quotas.used_images    IS 'DEPRECATED: use used_episodes instead';
COMMENT ON COLUMN quotas.monthly_videos IS 'DEPRECATED: use monthly_episodes instead';
COMMENT ON COLUMN quotas.used_videos    IS 'DEPRECATED: use used_episodes instead';
