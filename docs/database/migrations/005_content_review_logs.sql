-- 005_content_review_logs.sql
-- 派单 32: 内容审核表 + 系统日志表 (配合 41 HTML admin/content + admin/logs + ops/logs)
-- 谢擎 2026-06-10

-- 1. 内容审核表 (admin-content 页面)
CREATE TABLE IF NOT EXISTS content_review (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  username      TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',
  type          TEXT NOT NULL DEFAULT 'image',  -- image, video, text, model
  status        TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  flag_reason   TEXT,
  thumbnail_url TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 系统日志表 (admin-logs + ops-logs 页面)
CREATE TABLE IF NOT EXISTS system_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service    TEXT NOT NULL DEFAULT 'user-service',
  level      TEXT NOT NULL DEFAULT 'INFO',  -- INFO, WARN, ERROR, DEBUG
  message    TEXT NOT NULL DEFAULT '',
  user_id    UUID,
  ip_address TEXT,
  detail     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_review_status ON content_review(status);
CREATE INDEX IF NOT EXISTS idx_content_review_created ON content_review(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_service ON system_logs(service);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);
