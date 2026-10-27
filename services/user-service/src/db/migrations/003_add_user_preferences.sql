-- Migration: add preferences column to users table
-- P2 A4: 用户偏好API — mangaEditorMode 等
-- 谢擎 2026-06-21

-- 如果 preferences 列不存在则添加
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 为已有用户补默认值
UPDATE users SET preferences = '{}'::jsonb WHERE preferences IS NULL;
