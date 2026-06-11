-- ManhuaWorks ai-keys-service迁移脚本
-- 版本：0002
--范围：user_api_keys + api_key_audits
--适用：W2交付（Drizzle schema 对应）
--
-- 用法：
-- psql $DATABASE_URL -f services/ai-keys-service/src/db/migrations/0002_ai_keys.sql
--
-- 注意：
--1. uuid_generate_v4() 需要 uuid-ossp扩展（user-service001_init 已启用）
--2. 本服务独立部署时，如果和 user-service共用一个库，需要先确认001_init 已跑
--3. 如果需要回滚：0002_ai_keys_down.sql（另存）

BEGIN;

-- ════════════════════════════════════════════════════════════
-- Enums
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
 IF NOT EXISTS (SELECT1 FROM pg_type WHERE typname ='ai_provider') THEN
 CREATE TYPE ai_provider AS ENUM (
 'openai',
 'anthropic',
 'google',
 'azure_openai',
 'stability',
 'midjourney',
 'runway',
 'replicate',
 'siliconflow',
 'deepseek',
 'qwen',
 'other'
 );
 END IF;
END$$;

DO $$
BEGIN
 IF NOT EXISTS (SELECT1 FROM pg_type WHERE typname ='audit_action') THEN
 CREATE TYPE audit_action AS ENUM (
 'create',
 'read',
 'update',
 'delete',
 'validate',
 'rotate'
 );
 END IF;
END$$;

-- ════════════════════════════════════════════════════════════
--1. user_api_keys（BYOK加密存储）
--字段：9 个（任务要求）
-- id / user_id / provider / api_key_encrypted
-- api_key_hint / last_used_at / last_error / created_at / updated_at
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_api_keys (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 user_id UUID NOT NULL,
 provider VARCHAR(50) NOT NULL,
 api_key_encrypted BYTEA NOT NULL, -- base64(IV||TAG||CT) 解码后存
 api_key_hint VARCHAR(64) NOT NULL, -- UI展示用：sk-***xyz
 last_used_at TIMESTAMPTZ,
 last_error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--索引：user_id（用户查自己的 keys）
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id
 ON user_api_keys(user_id);

--索引：provider（统计 /批量操作）
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider
 ON user_api_keys(provider);

--唯一索引：同一用户同一 provider只能有一条（重插时走 PATCH路径）
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_api_keys_user_provider
 ON user_api_keys(user_id, provider);

--索引：updated_at（rotation cron巡检过期的 key）
CREATE INDEX IF NOT EXISTS idx_user_api_keys_updated_at
 ON user_api_keys(updated_at);

-- ════════════════════════════════════════════════════════════
--2. api_key_audits（操作审计）
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS api_key_audits (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 user_id UUID NOT NULL,
 api_key_id UUID, -- 可空（删除时 key已没了）
 action VARCHAR(20) NOT NULL, -- create/read/update/delete/validate/rotate
 provider VARCHAR(50),
 ip VARCHAR(64),
 user_agent TEXT,
 detail TEXT, -- JSON
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_key_audits_user_id
 ON api_key_audits(user_id);

CREATE INDEX IF NOT EXISTS idx_api_key_audits_api_key_id
 ON api_key_audits(api_key_id);

CREATE INDEX IF NOT EXISTS idx_api_key_audits_action
 ON api_key_audits(action);

CREATE INDEX IF NOT EXISTS idx_api_key_audits_created_at
 ON api_key_audits(created_at);

-- ════════════════════════════════════════════════════════════
-- updated_at 自动更新触发器
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
 NEW.updated_at = NOW();
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_api_keys_updated_at ON user_api_keys;
CREATE TRIGGER trg_user_api_keys_updated_at
 BEFORE UPDATE ON user_api_keys
 FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- ════════════════════════════════════════════════════════════
--校验
-- ════════════════════════════════════════════════════════════
-- \d user_api_keys
-- \d api_key_audits
