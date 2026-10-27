-- =============================================================================
-- Migration: 002_update_plans.sql
-- 千机工坊 · P0-2 计费对齐
-- 日期：2026-06-20
-- =============================================================================
-- 问题：subscriptions 表的 CHECK 约束只接受 ('free','pro','team')
--       但 plans.ts 和前端 PricingView 已是 4 套餐：free/basic/pro/enterprise
-- 修正：删旧约束 → 建新约束 → 补 basic 和 enterprise 历史数据
-- =============================================================================

BEGIN;

-- 1) 删除旧的 CHECK 约束
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS chk_subs_plan;

-- 2) 添加新的 CHECK 约束（4 套餐）
ALTER TABLE subscriptions
  ADD CONSTRAINT chk_subs_plan CHECK (plan IN ('free', 'basic', 'pro', 'enterprise'));

-- 3) 将旧的 'team' 套餐用户迁移到 'enterprise'（语义等价）
UPDATE subscriptions SET plan = 'enterprise' WHERE plan = 'team';

COMMIT;
