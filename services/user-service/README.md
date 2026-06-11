# user-service

ManhuaWorks 用户服务：注册 / 登录 / JWT / 邮箱验证 / 密码重置 / 2FA / 用户 CRUD。

- **栈**：Express + TypeScript (strict) + Zod + pg + jsonwebtoken + bcrypt + otplib + vitest
- **端口**：8088
- **DB**：postgres manhuaworks（共享，遵循 `001_init.sql` / `003_user_service_support.sql`）
- **架构**：MVC + 仓储 + 服务层

## 目录

```
user-service/
├── package.json
├── tsconfig.json
├── .env / .env.example
├── Dockerfile
├── src/
│   ├── index.ts                 # 启动入口
│   ├── app.ts                   # express app
│   ├── config/
│   │   ├── db.ts                # pg pool
│   │   ├── jwt.ts               # sign/verify + 黑名单
│   │   └── logger.ts            # pino
│   ├── middleware/
│   │   ├── auth.ts              # requireAuth / requireRole
│   │   ├── error.ts             # 统一错误
│   │   └── validate.ts          # zod 校验
│   ├── models/                  # 类型/枚举 (严格对齐 DB)
│   ├── repositories/            # 纯 SQL CRUD
│   ├── services/                # 业务
│   │   ├── authService.ts
│   │   ├── userService.ts
│   │   ├── emailService.ts
│   │   └── twoFactorService.ts
│   ├── controllers/             # 路由 handler
│   ├── routes/index.ts
│   └── utils/
│       ├── password.ts
│       ├── otp.ts
│       └── errors.ts
└── tests/
    └── auth.test.ts             # vitest 集成测试
```

## 数据库依赖

需要在 `manhuaworks` 库里跑：

1. `001_init.sql`（基础 6 表 + vector 扩展）
2. `003_user_service_support.sql`（新增 `sessions` / `verifications` / `audit_logs` + `users` 2FA 字段）

```powershell
$env:PGPASSWORD='mhw_dev_password_2026'
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U mhw -d manhuaworks `
  -v ON_ERROR_STOP=1 -f "D:\ManhuaWorks\docs\database\migrations\001_init.sql"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U mhw -d manhuaworks `
  -v ON_ERROR_STOP=1 -f "D:\ManhuaWorks\docs\database\migrations\003_user_service_support.sql"
```

## 安装 / 启动

```bash
npm install
npm run dev          # tsx watch 开发
npm run build        # tsc 编译
npm start            # node dist/src/index.js
npm test             # vitest
```

## 配置（.env）

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | 8088 | HTTP 端口 |
| `DATABASE_URL` | — | postgres 连接串 |
| `DATABASE_POOL_MAX` | 10 | pg pool 上限 |
| `JWT_SECRET` | — | 至少 32 字符 |
| `JWT_ACCESS_TTL` | 7d | access 过期 |
| `JWT_REFRESH_TTL` | 30d | refresh 过期 |
| `BCRYPT_COST` | 12 | bcrypt 强度 |
| `EMAIL_VERIFY_TTL_HOURS` | 24 | 邮箱验证 token TTL |
| `PASSWORD_RESET_TTL_HOURS` | 1 | 密码重置 token TTL |
| `TOTP_ISSUER` | ManhuaWorks | 2FA otpauth issuer |
| `EMAIL_MOCK_LOG` | true | mock 邮件是否打日志 |

## API

base path：`/api/v1`

### Health
- `GET /health` — `{ code, message, data: { service, db, uptime_sec, ... } }`

### Auth（无需登录）
- `POST /auth/register` — body `{ email?, phone?, password, display_name? }` → 201 + tokens
- `POST /auth/login` — body `{ email?, phone?, password, totp? }` → 200 + tokens
- `POST /auth/refresh` — body `{ refresh_token }` → 200 + 新 tokens（旋转 refresh）
- `POST /auth/verify-email` — body `{ token }` → 200
- `POST /auth/forgot-password` — body `{ email }` → 200（防枚举）
- `POST /auth/reset-password` — body `{ token, new_password }` → 200
- `POST /auth/verify-2fa` — body `{ user_id, totp }` → 200 + tokens（开启 2FA 后登录第二步）

### Auth（需登录）
- `POST /auth/logout` — body `{ refresh_token }` → 200
- `POST /auth/logout-all` — → 200（撤销该用户所有 session）

### Me
- `GET /me`
- `PATCH /me` — body `{ display_name?, avatar_url? }`
- `POST /me/password` — body `{ old_password, new_password }`
- `GET /me/2fa` — 当前 2FA 状态
- `POST /me/2fa/enable` — 初始化，返回 `{ secret, otpauth_url, qr_data_url }`
- `POST /me/2fa/confirm` — body `{ totp }` → 启用 + 10 个备用码
- `POST /me/2fa/disable` — body `{ totp }` → 关闭

### Users (admin)
- `GET /users?limit=20&offset=0` — role ≥ 4
- `GET /users/:id` — 任意登录用户
- `PATCH /users/:id` — role ≥ 4
- `DELETE /users/:id` — role = 5

## 响应格式

成功：
```json
{ "code": 0, "message": "ok", "data": ... }
```
失败：
```json
{ "code": "bad_request|unauthorized|forbidden|not_found|conflict|too_many_requests|internal_error",
  "message": "human readable",
  "details": ...  // 可选
}
```

## Token 策略

- **access** (Bearer)：HS256，7d，payload `{ sub, email, role, typ: 'access' }`
- **refresh**：HS256，30d，payload `{ sub, jti (session_id), typ: 'refresh' }`
- refresh 旋转：`/auth/refresh` 成功后旧 session 立即 revoke
- 黑名单：sessions.revoked_at (NULL = 有效)

## 2FA 流程

1. `POST /me/2fa/enable` → secret + qrcode
2. 扫码 → 用 Authenticator APP 拿到 6 位 TOTP
3. `POST /me/2fa/confirm` 校验后 2FA 启用，返回 10 个一次性备用码
4. 下次登录：`/auth/login` 仍然给 tokens（目前实现：登录不强制 2FA；强流程请走 `POST /auth/verify-2fa`）

## 审计

`audit_logs` 记录：`register / login / login_failed / logout / password_change / password_reset_* / email_verify_* / 2fa_* / profile_update / avatar_update`。

## 测试

`tests/auth.test.ts` 覆盖：health / register / login / me / refresh / 403 / 401 / 重复注册 / forgot & reset 错误路径 / 2FA 完整流程。
