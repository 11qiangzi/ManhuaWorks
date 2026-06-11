-- ManhuaWorks collab-service 数据库初始化
-- 目标库: collab
-- 2026-06-08 陆流光
--
-- 用法（在 collab 库中执行）:
--   psql "postgres://mhw:mhw_dev_password_2026@127.0.0.1:5432/collab" -f init_collab.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. comments
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    author_id UUID NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id UUID,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    mentions UUID[] NOT NULL DEFAULT '{}',
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_comments_target_type CHECK (target_type IN ('project', 'panel', 'script', 'asset', 'general'))
);

CREATE INDEX IF NOT EXISTS idx_comments_project_created ON comments(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_mentions ON comments USING GIN (mentions);
CREATE INDEX IF NOT EXISTS idx_comments_resolved ON comments(project_id, resolved) WHERE resolved = FALSE;

-- 2. presence_heartbeats (审计抽样)
CREATE TABLE IF NOT EXISTS presence_heartbeats (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    project_id UUID,
    status VARCHAR(10) NOT NULL,
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_presence_status CHECK (status IN ('online', 'away', 'offline'))
);

CREATE INDEX IF NOT EXISTS idx_presence_heartbeats_user ON presence_heartbeats(user_id, last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_presence_heartbeats_project ON presence_heartbeats(project_id, last_heartbeat_at DESC);

-- 3. activities
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    actor_id UUID NOT NULL,
    type VARCHAR(40) NOT NULL,
    target_type VARCHAR(40),
    target_id UUID,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_project_created ON activities(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_actor ON activities(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type, created_at DESC);

-- 4. notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type VARCHAR(40) NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'in_app',
    status VARCHAR(10) NOT NULL DEFAULT 'unread',
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    project_id UUID,
    actor_id UUID,
    link TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notif_channel CHECK (channel IN ('in_app', 'email', 'webhook')),
    CONSTRAINT chk_notif_status CHECK (status IN ('unread', 'read', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_notif_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON notifications(user_id) WHERE status = 'unread';
CREATE INDEX IF NOT EXISTS idx_notif_project ON notifications(project_id, created_at DESC);

-- 5. realtime_sessions
CREATE TABLE IF NOT EXISTS realtime_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    project_id UUID,
    client_id VARCHAR(64) NOT NULL,
    ip VARCHAR(64),
    user_agent TEXT,
    status VARCHAR(10) NOT NULL DEFAULT 'active',
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    close_reason TEXT,
    CONSTRAINT chk_session_status CHECK (status IN ('active', 'closed', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_session_user ON realtime_sessions(user_id, connected_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_status_ping ON realtime_sessions(status, last_ping_at);
CREATE INDEX IF NOT EXISTS idx_session_project ON realtime_sessions(project_id, connected_at DESC);

-- updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comments_updated_at ON comments;
CREATE TRIGGER trg_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
