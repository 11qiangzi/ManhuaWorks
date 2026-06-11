-- ============================================================
-- 派单 48: 后端统一化 — DB 索引 migration (谢擎, 2026-06-10)
-- ============================================================
-- 目标: 解决 P1-2 "DB 查询无索引覆盖高频字段" 问题
-- 服务: user-service / project-service / billing-service
-- 索引策略: 高频查询字段建索引 → 目标 <20ms/query
-- ============================================================

BEGIN;

-- ─── user-service: users 表高频索引 ───────────────────────────

-- 邮箱唯一索引 (登录查询 + 注册去重)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users (email)
  WHERE email IS NOT NULL AND email != '';

-- 角色索引 (admin 用户列表查询)
CREATE INDEX IF NOT EXISTS idx_users_role
  ON users (role);

-- 创建时间索引 (用户列表排序)
CREATE INDEX IF NOT EXISTS idx_users_created_at
  ON users (created_at DESC);

-- 状态索引 (is_active 过滤)
CREATE INDEX IF NOT EXISTS idx_users_is_active
  ON users (is_active)
  WHERE is_active = true;

-- ─── user-service: sessions 表索引 ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_revoked
  ON sessions (revoked_at)
  WHERE revoked_at IS NOT NULL;

-- ─── user-service: audit_logs 表索引 ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs (created_at DESC);

-- ─── project-service: projects 表高频索引 ─────────────────────

-- user_id索引 (按用户查项目列表—最高频查询)
CREATE INDEX IF NOT EXISTS idx_projects_user_id
  ON projects (user_id);

-- status索引 (按状态过滤 active/archived/trashed)
CREATE INDEX IF NOT EXISTS idx_projects_status
  ON projects (status);

-- 复合索引 (用户+状态+时间 — 项目列表核心查询)
CREATE INDEX IF NOT EXISTS idx_projects_user_status_created
  ON projects (user_id, status, created_at DESC);

-- ─── project-service: shots 表索引 ────────────────────────────

-- project_id + sort_order (分镜列表核心查询)
CREATE INDEX IF NOT EXISTS idx_shots_project_sort
  ON shots (project_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_shots_created_at
  ON shots (created_at DESC);

-- ─── project-service: scenes 表索引 ───────────────────────────

CREATE INDEX IF NOT EXISTS idx_scenes_project_id
  ON scenes (project_id);

CREATE INDEX IF NOT EXISTS idx_scenes_created_at
  ON scenes (created_at DESC);

-- ─── project-service: characters 表索引 ───────────────────────

CREATE INDEX IF NOT EXISTS idx_characters_project_id
  ON characters (project_id);

-- ─── billing-service: invoices 表高频索引 ─────────────────────

CREATE INDEX IF NOT EXISTS idx_invoices_user_id
  ON invoices (user_id);

CREATE INDEX IF NOT EXISTS idx_invoices_user_created
  ON invoices (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON invoices (status);

-- ─── billing-service: cost_logs 表索引 ────────────────────────

CREATE INDEX IF NOT EXISTS idx_cost_logs_user_id
  ON cost_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_cost_logs_user_created
  ON cost_logs (user_id, created_at DESC);

-- ─── billing-service: payments 表索引 ─────────────────────────

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id
  ON payments (invoice_id);

-- ─── billing-service: refunds 表索引 ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_refunds_user_id
  ON refunds (user_id);

CREATE INDEX IF NOT EXISTS idx_refunds_status
  ON refunds (status);

-- ─── billing-service: subscriptions 表索引 ────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON subscriptions (user_id);

-- ─── collab-service: teams 表索引 ─────────────────────────────

CREATE INDEX IF NOT EXISTS idx_teams_owner_id
  ON teams (owner_id);

-- ─── 验证: 执行 EXPLAIN ANALYZE 确认索引生效 ───────────────────
-- (以下语句执行后应显示 Index Scan 而非 Seq Scan)
-- EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
-- EXPLAIN ANALYZE SELECT * FROM projects WHERE user_id = 'xxx' AND status = 'active' ORDER BY created_at DESC LIMIT 20;
-- EXPLAIN ANALYZE SELECT * FROM invoices WHERE user_id = 'xxx' ORDER BY created_at DESC LIMIT 20;

COMMIT;

-- ============================================================
-- 回滚脚本 (如需):
--   DROP INDEX IF EXISTS idx_users_email;
--   DROP INDEX IF EXISTS idx_users_role;
--   ... (按需删除)
-- ============================================================
