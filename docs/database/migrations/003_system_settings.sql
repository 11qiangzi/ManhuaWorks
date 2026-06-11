-- Migration 003: System Settings
-- Database: manhuaworks
-- Date: 2026-06-10
-- Engineer: 谢擎

BEGIN;

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Insert default settings
INSERT INTO system_settings (key, value) VALUES
  ('site_name', '"ManhuaWorks"'),
  ('max_team_size', '50'),
  ('default_quota_tokens', '100000'),
  ('default_quota_images', '50'),
  ('registration_open', 'true'),
  ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

COMMIT;
