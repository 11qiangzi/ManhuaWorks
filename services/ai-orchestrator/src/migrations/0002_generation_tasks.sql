-- ManhuaWorks ai-orchestrator migration
-- Version: 0002
-- Scope: generation_tasks
-- Usage:
--   psql $DATABASE_URL -f services/ai-orchestrator/src/migrations/0002_generation_tasks.sql
--
-- Notes:
--   1. gen_random_uuid() requires PostgreSQL 13+
--   2. If rolling back, create a down migration to DROP TABLE generation_tasks
--   3. Depends on core schema (user_id references)

BEGIN;

-- ==================================================================
-- Table: generation_tasks
-- Unified task tracking for all AI generation (image/video/audio/tts)
-- ==================================================================

CREATE TABLE IF NOT EXISTS generation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,

  -- Task definition
  task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('image', 'video', 'audio', 'tts')),
  provider VARCHAR(30) NOT NULL CHECK (provider IN ('seedream', 'seedance', 'minimax', 'volcengine', 'suno', 'openai')),
  model VARCHAR(50),

  -- Request (immutable after creation)
  prompt TEXT NOT NULL,
  craft_prompt JSONB,  -- { context, reference, action, framing, timing }
  reference_images JSONB,  -- [{ url, role }]
  parameters JSONB NOT NULL DEFAULT '{}',  -- { duration, ratio, resolution, seed, ... }

  -- Dedup
  request_hash VARCHAR(64) NOT NULL,  -- SHA256(prompt + params + user_id)

  -- Provider task tracking
  provider_task_id VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'expired', 'cancelled')),
  progress INTEGER DEFAULT 0,  -- 0-100
  error_message TEXT,
  error_code VARCHAR(50),

  -- Results (filled on success)
  result_url TEXT,  -- temporary provider URL
  result_stored_url TEXT,  -- our permanent storage URL
  result_metadata JSONB,  -- { width, height, duration, fps, file_size, ... }
  last_frame_url TEXT,  -- for video: last frame image (used for shot chaining)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- provider URL expiry (usually 24h after completion)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dedup: same request_hash can only have one active task
CREATE UNIQUE INDEX IF NOT EXISTS idx_gen_tasks_hash
  ON generation_tasks(request_hash)
  WHERE status IN ('queued', 'running', 'succeeded');

-- User task history (most recent first)
CREATE INDEX IF NOT EXISTS idx_gen_tasks_user
  ON generation_tasks(user_id, created_at DESC);

-- Project-scoped queries
CREATE INDEX IF NOT EXISTS idx_gen_tasks_project
  ON generation_tasks(project_id)
  WHERE project_id IS NOT NULL;

-- Active task polling (for background poller)
CREATE INDEX IF NOT EXISTS idx_gen_tasks_status
  ON generation_tasks(status)
  WHERE status IN ('queued', 'running');

-- ==================================================================
-- updated_at auto-update trigger
-- ==================================================================
CREATE OR REPLACE FUNCTION set_gen_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generation_tasks_updated_at ON generation_tasks;
CREATE TRIGGER trg_generation_tasks_updated_at
  BEFORE UPDATE ON generation_tasks
  FOR EACH ROW EXECUTE FUNCTION set_gen_tasks_updated_at();

COMMIT;

-- ==================================================================
-- Verification
-- ==================================================================
-- \d generation_tasks
