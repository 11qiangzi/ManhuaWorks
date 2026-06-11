# ManhuaWorks ai-keys-service

> BYOK（Bring Your Own Key）加密存储服务
>2026-06-07 W2交付（谢擎）

##职责

把 BYOK 功能从 user-service拆出来，独立成一个微服务：

- **AES-256-GCM加密**：用户 API key 入库前加密，落库不存明文
- **HKDF-SHA256派生**：每个用户的每个 provider都有独立 derived key，即使全局 `MASTER_KEY`泄露，单个用户的 key 也无法被批量解密
- **CRUD**：增 /查 /改 /删自己的 key
- **Validate**：调一次 provider API探活，更新 `last_used_at` / `last_error`
- **Rotation**：每6 小时巡检一次，30 天提醒、90 天硬过期
- **Audit**：所有写操作落 `api_key_audits` 表，可追责
- **JWT鉴权**：与 user-service 共用 `JWT_SECRET`，HS256

不包含：实际调用 LLM（由 ai-orchestrator接管）、计费逻辑（由 billing-service）、API Gateway。

##端口

- **8083**（容器内 +宿主侧一致）
- docker-compose 已映射 `8083:8083`

## 技术栈

- **Hono4.x** + **@hono/node-server** — 与 user-service 一致
- **Drizzle ORM0.36** + **postgres-js** — TypeScript-first ORM
- **jose** — JWT验证（HS256）
- **Node.js 内置 `crypto`** — AES-256-GCM + HKDF-SHA256，无第三方依赖
- **zod** — 请求体验证
- TypeScript5.7 + ESM

##目录结构

```
services/ai-keys-service/
├── Dockerfile
├── package.json
├── tsconfig.json
├── README.md
└── src/
 ├── index.ts # Hono入口 +启动 +优雅停机
 ├── config.ts # 环境变量 + fail-fast
 ├── crypto/
 │ ├── aes.ts # AES-256-GCM 加解密
 │ └── key-derivation.ts # HKDF-SHA256派生 user-specific key
 ├── db/
 │ ├── schema.ts # user_api_keys + api_key_audits
 │ ├── client.ts # Drizzle 单例
 │ └── migrations/
 │ └──0002_ai_keys.sql # 建表 +索引 +触发器
 ├── middleware/
 │ └── auth.ts # JWT鉴权
 └── keys/
 ├── routes.ts # CRUD + validate + rotate
 ├── validator.ts # Provider API探活
 ├── rotation.ts #30天提醒 + cron
 └── audit.ts # 操作审计
```

## 环境变量

|名称 | 默认 | 说明 |
|------|------|------|
| `PORT` | `8083` |监听端口 |
| `DATABASE_URL` | `postgresql://mhw:mhw_dev_only@localhost:5432/manhuaworks` | PG 连接串 |
| `MASTER_KEY` | `dev_master_key_change_me_in_production_32bytes!!` | **必改**：32字节 base64/hex |
| `HKDF_SALT` | `manhuaworks-byok-salt-v1` | HKDF salt，换了就等于重加密 |
| `HKDF_INFO` | `user-api-key-encryption` | HKDF info 前缀 |
| `JWT_SECRET` | `change_me_in_production` | 与 user-service共享 |
| `JWT_ISSUER` | `manhuaworks` | |
| `JWT_AUDIENCE` | `manhuaworks-api` | |
| `KEY_AGE_WARN_DAYS` | `30` |提醒阈值 |
| `KEY_AGE_HARD_DAYS` | `90` |硬过期阈值 |
| `VALIDATE_TIMEOUT_MS` | `8000` | Provider API探活超时 |
| `ROTATION_CHECK_INTERVAL_SEC` | `21600` | Rotation cron周期（6h） |
| `NODE_ENV` | `development` | dev / production |

### MASTER_KEY 生成

生产环境必须生成强随机32字节：

```bash
# base64 (推荐)
openssl rand -base6432
# hex
openssl rand -hex32
```

把输出塞到 `MASTER_KEY` 环境变量即可。

##启动

```bash
# 安装依赖
pnpm install

#跑迁移（PG库需先有）
psql $DATABASE_URL -f src/db/migrations/0002_ai_keys.sql

# 开发
pnpm dev

# 构建 +跑
pnpm build
pnpm start

#容器
docker compose -f../../infrastructure/docker-compose.yml up -d ai-keys-service
```

## 主要 API

所有路由（除 `/health`）都需要 `Authorization: Bearer <token>`。

### CRUD

```http
POST /v1/keys
 { "provider": "openai", "api_key": "sk-...", "alias": "production" }
 → { id, provider, api_key_hint, created }

GET /v1/keys
 → [{ id, provider, api_key_hint, age_days, needs_rotation, ... }]

GET /v1/keys/:id
 → { id, provider, api_key_hint, last_used_at, last_error, ... }

PATCH /v1/keys/:id
 { "api_key": "sk-new...", "alias": "rotated" }
 → { id, api_key_hint }

DELETE /v1/keys/:id
 → { id, deleted: true }
```

###验证 +轮换

```http
POST /v1/keys/:id/validate
 →调一次 provider API，返回 { ok, latency_ms, error? }

POST /v1/keys/:id/rotate
 →标记已轮换（清 last_error，touch updated_at）
```

##加密协议

###派生

```
derivedKey = HKDF-SHA256(
 ikm = MASTER_KEY,
 salt = HKDF_SALT,
 info = `${HKDF_INFO}:${userId}:${provider}`,
 L =32 // bytes
)
```

###加密

```
iv = random(12) // GCM 推荐
cipher = AES-256-GCM(derivedKey, iv)
ct = cipher.update(plaintext) + cipher.final()
tag = cipher.getAuthTag() //16 bytes
packed = iv || tag || ct // base64编码
```

###存储

`user_api_keys.api_key_encrypted`字段（BYTEA）存 base64 解码后的字节。
`api_key_hint`字段（VARCHAR64）存 `sk-***xyz` 这种 UI友好的提示。

### 安全特性

- **永不返回明文**：所有 GET 接口只回 `api_key_hint`
- **HKDF隔离**：单 user 单 provider独立 derived key，MASTER_KEY泄露 ≠ 所有用户泄露
- **Auth tag校验**：解密时 GCM 自动校验完整性，被篡改的数据直接抛错
- **审计**：所有写操作（create / update / delete / validate / rotate）都落 `api_key_audits`
- **Rotation cron**：自动巡检过期 key，不强制轮换（用户决定），只提醒 +标记

## Rotation策略

启动时拉一个 `setInterval`（默认6h）：

-扫描 `updated_at < NOW() -30d` 的 key →写一条 `rotate` audit（needs_rotation=true）
-扫描 `updated_at < NOW() -90d` 的 key → 更新 `last_error = key_expired_age_Xd_please_rotate`，写 audit（hard_expired=true）

前端可读 `GET /v1/keys` 看 `age_days` / `needs_rotation` / `hard_expired`字段提示用户。

## 与 user-service 的关系

- user-service W1 也有一张 `api_keys` 表（早期草稿）
- 本服务独立建 `user_api_keys`，W3 数据迁移脚本可一并处理
-鉴权：共用 JWT_SECRET，前端用同一 token即可

##已知限制（W2）

- 没接 rate-limit：高频 validate 可能打爆 provider quota。W2.1 加 `@hono/rate-limit`。
- 没接 OpenTelemetry：日志走 console。W3 接 OTLP。
- Validator探测网络失败 ≠ key失效：失败只更新 `last_error`，不删 key。
- rotation 只读 `updated_at`：如果用户从来不 PATCH 就一直不"轮换"。生产环境应发邮件 /站内信提醒（由 notification-service接管）。

##交接清单（W2-D1 → W2-D7）

- [x] package.json / tsconfig.json / Dockerfile / README
- [x] AES-256-GCM 加解密（`crypto/aes.ts`）
- [x] HKDF-SHA256 user-specific key派生（`crypto/key-derivation.ts`）
- [x] Drizzle schema：user_api_keys（9字段）+ api_key_audits
- [x] SQL迁移：建表 +索引 + updated_at触发器
- [x] JWT鉴权中间件
- [x] CRUD路由 + validate + rotate
- [x] Provider validator（openai/anthropic/google/azure_openai/stability/deepseek/qwen/siliconflow）
- [x] Rotation cron（30 天提醒 +90 天硬过期）
- [x] 操作审计（fire-and-forget）
- [x] 优雅停机（SIGINT/SIGTERM）
- [x] TypeScript 类型检查通过

— 谢擎 @2026-06-07
