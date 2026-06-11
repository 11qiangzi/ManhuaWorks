-- =============================================================
-- P2 admin/ops 新增表迁移 (派单 48 — 谢擎 2026-06-10)
-- 为 user-service admin/ops 新增端点提供数据表
-- =============================================================

-- 1. 告警表 (alerts) — ops alerts 端点
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service VARCHAR(50) NOT NULL DEFAULT 'system',
    level VARCHAR(10) NOT NULL DEFAULT 'info',
    title VARCHAR(200) NOT NULL,
    detail TEXT,
    resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT chk_alerts_level CHECK (level IN ('error', 'warn', 'info'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_level ON alerts(level, resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_service ON alerts(service);

-- 2. 事件表 (incidents) — ops incidents 端点
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    severity VARCHAR(10) NOT NULL DEFAULT 'minor',
    status VARCHAR(10) NOT NULL DEFAULT 'open',
    service VARCHAR(50) NOT NULL DEFAULT 'system',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT chk_incidents_severity CHECK (severity IN ('critical', 'major', 'minor')),
    CONSTRAINT chk_incidents_status CHECK (status IN ('open', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity, status);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_service ON incidents(service);

-- 3. system_settings 表确保存在 (admin settings 端点使用)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 插入默认系统设置
INSERT INTO system_settings (key, value) VALUES
    ('ai.provider', '"openai"'::jsonb),
    ('ai.fallback', '"deepseek"'::jsonb),
    ('ai.daily_quota', '50000'::jsonb),
    ('ai.timeout_ms', '30000'::jsonb),
    ('payment.provider', '"wechat"'::jsonb),
    ('payment.sandbox', 'true'::jsonb),
    ('payment.tax_rate', '0.06'::jsonb),
    ('payment.currency', '"CNY"'::jsonb),
    ('email.smtp', '"smtp.example.com"'::jsonb),
    ('email.port', '465'::jsonb),
    ('email.from', '"no-reply@manhuaworks.io"'::jsonb),
    ('email.ssl', 'true'::jsonb),
    ('storage.driver', '"s3"'::jsonb),
    ('storage.bucket', '"mhw-prod"'::jsonb),
    ('storage.cdn', '"cdn.example.com"'::jsonb),
    ('storage.max_upload_mb', '50'::jsonb),
    ('ratelimit.rps', '100'::jsonb),
    ('ratelimit.burst', '200'::jsonb),
    ('ratelimit.per_user', '10'::jsonb),
    ('ratelimit.window_sec', '60'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. 插入几条种子告警 (便于前端调试)
INSERT INTO alerts (service, level, title, detail, resolved)
SELECT 'ai-orchestrator', 'error', 'AI orchestrator 5xx 突增',
       '近 10 分钟错误率 12.4%，已超阈值', false
WHERE NOT EXISTS (SELECT 1 FROM alerts WHERE title = 'AI orchestrator 5xx 突增');

INSERT INTO alerts (service, level, title, detail, resolved)
SELECT 'billing-service', 'warn', '支付回调延迟',
       '微信支付回调平均延迟 6.2s', false
WHERE NOT EXISTS (SELECT 1 FROM alerts WHERE title = '支付回调延迟');

INSERT INTO alerts (service, level, title, detail, resolved)
SELECT 'user-service', 'info', '新功能上线',
       'Studio V2 模型选择器已发布', true
WHERE NOT EXISTS (SELECT 1 FROM alerts WHERE title = '新功能上线');

-- 6. 插入种子事件 (便于前端调试)
INSERT INTO incidents (title, severity, status, service, description)
SELECT 'API 网关间歇性超时', 'major', 'open', 'api-gateway',
       '过去1小时内观察到 3 次 504 响应，正在排查上游连接池'
WHERE NOT EXISTS (SELECT 1 FROM incidents WHERE title = 'API 网关间歇性超时');

INSERT INTO incidents (title, severity, status, service, description)
SELECT '用户注册邮件发送失败', 'minor', 'open', 'user-service',
       'SMTP 连接超时，已切换到备用邮件服务'
WHERE NOT EXISTS (SELECT 1 FROM incidents WHERE title = '用户注册邮件发送失败');

INSERT INTO incidents (title, severity, status, service, description, resolved_at)
SELECT '数据库连接池耗尽', 'critical', 'resolved', 'user-service',
       '连接池从 20 扩容到 50，已恢复正常',
       NOW() - INTERVAL '2 hours'
WHERE NOT EXISTS (SELECT 1 FROM incidents WHERE title = '数据库连接池耗尽');
