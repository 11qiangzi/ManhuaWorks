-- ManhuaWorks 数据库迁移 - 核心表（不含 pgvector）
-- 2026-06-08 谢擎
-- 拆分自 docs/database/migrations/001_init.sql
-- 原因：pgvector 扩展在本机 PostgreSQL 16 未安装
-- 拆出 role_vectors 到 001b_vector.sql，待扩展安装后跑

-- 启用可用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(50),
    avatar_url TEXT,
    role SMALLINT NOT NULL DEFAULT 1,
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_users_role CHECK (role BETWEEN 1 AND 5),
    CONSTRAINT chk_users_status CHECK (status IN (0, 1))
);

CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);

-- 2. subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(20) NOT NULL DEFAULT 'free',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_subs_plan CHECK (plan IN ('free', 'pro', 'team'))
);

-- 3. quotas
CREATE TABLE quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    monthly_tokens INTEGER NOT NULL DEFAULT 100000,
    used_tokens INTEGER NOT NULL DEFAULT 0,
    monthly_images INTEGER NOT NULL DEFAULT 50,
    used_images INTEGER NOT NULL DEFAULT 0,
    monthly_videos INTEGER NOT NULL DEFAULT 10,
    used_videos INTEGER NOT NULL DEFAULT 0,
    reset_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month')
);

-- 4. projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    art_style VARCHAR(50),
    story_type VARCHAR(50),
    cover_url TEXT,
    status SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_projects_status CHECK (status BETWEEN 0 AND 3)
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- 5. api_keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    key_alias VARCHAR(50) NOT NULL,
    key_encrypted BYTEA NOT NULL,
    key_iv BYTEA NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_keys_provider CHECK (provider IN ('minimax', 'deepseek', 'zhipu', 'volcengine'))
);

CREATE UNIQUE INDEX idx_api_keys_user_provider_alias ON api_keys(user_id, provider, key_alias);

-- 6. api_call_logs
CREATE TABLE api_call_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    call_type VARCHAR(20) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 0,
    error_msg TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_call_type CHECK (call_type IN ('text', 'image', 'video', 'embed')),
    CONSTRAINT chk_call_status CHECK (status IN (0, 1))
);

CREATE INDEX idx_api_logs_user_created ON api_call_logs(user_id, created_at DESC);
CREATE INDEX idx_api_logs_project ON api_call_logs(project_id);
CREATE INDEX idx_api_logs_status ON api_call_logs(status);

-- updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
