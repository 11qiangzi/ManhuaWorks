-- ============================================================
-- 派单 17: BYOK 架构落地 — user_api_keys 表 + rate_limit_counters (谢擎, 2026-06-16)
-- ============================================================
-- 目标: 用户自带 API Key, 自己选模型, 1 年后商业化再说 (梁总 Q3D 拍板)
-- 落地路径映射: 原派单写 D:\qianjigongfang\migrations\0002_byok.sql (Cloudflare D1),
--              实际项目用 PostgreSQL + Drizzle ORM, 路径统一到 db/migrations/
-- 字段名修正: id 是 uuid (PG) 不是 INTEGER (D1 文档), nickname 对齐 alias 字段
-- ============================================================

BEGIN;

-- ─── user_api_keys: 用户 BYOK 加密存储 ─────────────────────────

CREATE TABLE IF NOT EXISTS user_api_keys (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- provider 类型 (从原 5 扩展到派单 17 要求的 6 个)
  provider           VARCHAR(50) NOT NULL,  -- 'deepseek' / 'openai' / 'replicate' / 'qianwen' / 'zhipu' / 'fal'

  -- 加密存储 (AES-256-GCM, 加密服务见 services/user-service/src/services/crypto.ts)
  api_key_encrypted  JSONB NOT NULL,        -- EncryptedPayload { iv, authTag, ciphertext, algorithm, version }
  base_url           VARCHAR(500),          -- 用户自定义 BaseURL (Q4=C, OpenAI 兼容)

  -- 用户可见元数据
  nickname           VARCHAR(100) NOT NULL, -- 用户给 key 起名 ("我的主 DeepSeek")
  is_default         SMALLINT NOT NULL DEFAULT 0,  -- 是否默认 key (0/1)

  -- 跟踪
  last_used_at       TIMESTAMPTZ,
  last_test_at       TIMESTAMPTZ,
  last_test_status   VARCHAR(20),           -- 'ok' / 'invalid' / 'rate_limited'

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, provider, nickname)
);

COMMENT ON TABLE user_api_keys IS 'BYOK 用户自带 API Key — 加密存储, 1 年后商业化时切到平台配额';
COMMENT ON COLUMN user_api_keys.api_key_encrypted IS 'AES-256-GCM 加密结果 (iv+authTag+ciphertext), masterKey 在 Cloudflare Workers Secrets / env BYOK_MASTER_KEY';
COMMENT ON COLUMN user_api_keys.base_url IS '用户自定义 BaseURL, 派单 17 Q4=C, 用于 OpenAI 兼容代理';
COMMENT ON COLUMN user_api_keys.is_default IS '同 provider 多 key 时, 默认用哪个 (派单 17 PATCH 设默认)';
COMMENT ON COLUMN user_api_keys.last_test_status IS 'ok / invalid / rate_limited — POST /:id/test 调用结果';

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id
  ON user_api_keys (user_id);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_provider
  ON user_api_keys (user_id, provider);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_default
  ON user_api_keys (user_id, provider, is_default)
  WHERE is_default = 1;

-- ─── rate_limit_counters: 限流计数 (派单 17 限流 60次/小时/key) ──

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  id              BIGSERIAL PRIMARY KEY,
  scope           VARCHAR(100) NOT NULL,        -- 'byok_key:<key_id>' 或 'user:<user_id>'
  window_start    TIMESTAMPTZ NOT NULL,          -- 1 小时窗口起点
  request_count   INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (scope, window_start)
);

COMMENT ON TABLE rate_limit_counters IS 'BYOK 限流计数器 — 每 key 1 小时 60 次, D1/PG 计数';
COMMENT ON COLUMN rate_limit_counters.scope IS '限流作用域 — byok_key:<id> 限单 key, user:<id> 限总用户';
COMMENT ON COLUMN rate_limit_counters.window_start IS '整点小时 (向下取整), 1 小时窗口';

CREATE INDEX IF NOT EXISTS idx_rate_limit_scope_window
  ON rate_limit_counters (scope, window_start DESC);

COMMIT;

-- ============================================================
-- 回滚脚本 (如需):
--   DROP TABLE IF EXISTS rate_limit_counters;
--   DROP TABLE IF EXISTS user_api_keys;
-- ============================================================
