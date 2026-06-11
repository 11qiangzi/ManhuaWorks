-- ============================================================
-- 派单 48: 后端统一化 — 计费幂等 + 系统设置表 (谢擎, 2026-06-10)
-- ============================================================
-- billing-service: dedup_events 表 (事件去重, 防止重复扣费)
-- user-service: system_settings 表 (配置中心)
-- ============================================================

BEGIN;

-- ─── billing-service: dedup_events (事件幂等) ─────────────────

CREATE TABLE IF NOT EXISTS dedup_events (
  event_id   VARCHAR(255) PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE dedup_events IS '事件去重表 — 防止 Redis Pub-Sub 重复消费导致多次扣费';
COMMENT ON COLUMN dedup_events.event_id IS '事件唯一ID (如 workflow.run.completed:{runId} 或 ai.task.completed:{taskId})';

-- 自动清理 7 天前的记录
CREATE INDEX IF NOT EXISTS idx_dedup_events_processed_at
  ON dedup_events (processed_at DESC);

-- ─── user-service: system_settings (配置中心) ─────────────────

CREATE TABLE IF NOT EXISTS system_settings (
  key        VARCHAR(255) PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);

COMMENT ON TABLE system_settings IS '系统配置表 — 全局开关、阈值、功能标志';
COMMENT ON COLUMN system_settings.key IS '配置键 (如 site.maintenance_mode, feature.ai_generation)';
COMMENT ON COLUMN system_settings.value IS '配置值 (JSONB，支持任意结构)';

-- ─── user-service: deploy_history (部署记录) ──────────────────

CREATE TABLE IF NOT EXISTS deploy_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service       VARCHAR(100) NOT NULL,
  branch        VARCHAR(100) NOT NULL,
  tag           VARCHAR(100),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  triggered_by  UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ
);

COMMENT ON TABLE deploy_history IS '部署历史 — CI/CD 触发记录';
COMMENT ON COLUMN deploy_history.status IS 'pending | running | success | failed | rolled_back';

CREATE INDEX IF NOT EXISTS idx_deploy_history_service
  ON deploy_history (service, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deploy_history_status
  ON deploy_history (status);

COMMIT;
