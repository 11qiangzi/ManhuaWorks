# ManhuaWorks API Reference

> 4 service + 1 orchestrator 全端点速查表 (真后端契约, 严禁编)
>
> **鉴权**: HS256 JWT (user-service 签发), 7d TTL
> **header**: `Authorization: Bearer <access_token>`
> **base URL**: 
> - user-service: `http://127.0.0.1:8088/api/v1`
> - project-service: `http://127.0.0.1:8089/api/v1` (未启)
> - billing-service: `http://127.0.0.1:8090/api/v1`
> - collab-service: `http://127.0.0.1:8091/api/v1` (未启)
> - ai-orchestrator: `http://127.0.0.1:8087`
> - **ai-orchestrator 用 `x-api-key: dev-ai-orchestrator-key` 头 (不是 JWT!)**
>
> **凭据**: `l5b-test@example.com / Test1234` (烟测自注册, 重复跑拿 409 然后改走 login)

---

## 1. user-service:8088 (鉴权 + 用户 + api-key)

### 1.1 Auth

#### POST /auth/register
注册新用户
```bash
curl -X POST http://127.0.0.1:8088/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","password":"Test1234","displayName":"新用户"}'
```
响应 (201):
```json
{ "code": 0, "message": "registered", "data": { "userId": "uuid", "accessToken": "eyJ..." } }
```

#### POST /auth/login
登录
```bash
curl -X POST http://127.0.0.1:8088/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"l5b-test@example.com","password":"Test1234"}'
```
响应 (200):
```json
{ "code": 0, "message": "ok", "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." } }
```

#### POST /auth/refresh
刷新 access_token
```bash
curl -X POST http://127.0.0.1:8088/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh>"}'
```

#### POST /auth/logout
登出 (清 session)
```bash
curl -X POST http://127.0.0.1:8088/api/v1/auth/logout \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh>"}'
```

### 1.2 用户自身

#### GET /me
当前用户
```bash
curl http://127.0.0.1:8088/api/v1/me -H "Authorization: Bearer <token>"
```

#### PATCH /me
更新 (display_name, avatar_url)
```bash
curl -X PATCH http://127.0.0.1:8088/api/v1/me \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"displayName":"改名"}'
```

#### POST /me/password
改密码
```bash
curl -X POST http://127.0.0.1:8088/api/v1/me/password \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"oldPassword":"Test1234","newPassword":"New12345"}'
```

#### GET /me/2fa / POST /me/2fa/enable / POST /me/2fa/confirm / POST /me/2fa/disable
2FA 生命周期

### 1.3 用户管理 (admin)

| 端点 | 权限 | 说明 |
|---|---|---|
| GET /users | admin | 分页列表 (query: page, pageSize) |
| GET /users/:id | login | 单个用户 |
| PATCH /users/:id | admin | 后台改 |
| DELETE /users/:id | superadmin | 真删 |

### 1.4 BYOK (api-key)

**路径**: `/api/v1/user/api-keys` (L4-A 修复后真实路径, 不是 `/v1/keys`)

#### POST /user/api-keys
新增 key
```bash
curl -X POST http://127.0.0.1:8088/api/v1/user/api-keys \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"provider":"deepseek","apiKey":"sk-..."}'
```
**provider 枚举**: `openai / anthropic / google / deepseek / minimax`
响应 (201):
```json
{ "code":0, "message":"created", "data":{"id":"uuid","provider":"deepseek","keyLast4":"1234","status":"active"} }
```

#### GET /user/api-keys
列表 (无明文, 只 keyLast4)
```bash
curl http://127.0.0.1:8088/api/v1/user/api-keys \
  -H "Authorization: Bearer <token>"
```

#### DELETE /user/api-keys/:id
软删 (status=revoked)
```bash
curl -X DELETE http://127.0.0.1:8088/api/v1/user/api-keys/<id> \
  -H "Authorization: Bearer <token>"
```

#### GET /user/api-keys/:id/reveal
**一次性显示明文** (前端只在用户主动点"显示"按钮时调)
```bash
curl http://127.0.0.1:8088/api/v1/user/api-keys/<id>/reveal \
  -H "Authorization: Bearer <token>"
```
响应:
```json
{ "code":0, "message":"ok", "data":{ "apiKey":"sk-明文" } }
```

---

## 2. billing-service:8090 (订阅 + 充值 + 订单)

### 2.1 健康

#### GET /billing/health
```bash
curl http://127.0.0.1:8090/api/v1/billing/health
```
响应:
```json
{ "code":0, "message":"ok", "data":{ "status":"healthy" } }
```

### 2.2 订阅

| 端点 | 说明 |
|---|---|
| GET /subscriptions | 当前用户订阅 |
| POST /subscriptions | 创建/升档 |
| PATCH /subscriptions | 续期/降档 |
| DELETE /subscriptions | 取消 |

### 2.3 订单

| 端点 | 说明 |
|---|---|
| GET /orders | 我的订单 |
| GET /orders/:id | 订单详情 |
| POST /orders/webhook | 支付回调 (内部) |

### 2.4 充值 (L5-D 真实)

#### POST /billing/recharge
**5 步流程**: 校验 user → 建 invoice (issued) → mock 支付 (sleep 100ms, 95% 成功) → 建 payment → 更新余额
```bash
curl -X POST http://127.0.0.1:8090/api/v1/billing/recharge \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"userId":"<self-uuid>","amount":50,"currency":"USD"}'
```
**业务规则**: 不能给别的 user 充 (`cannot recharge for another user`, 403)
响应 (200):
```json
{ "code":0, "message":"ok", "data":{
  "ok":true,
  "invoice":{"invoiceNo":"INV-20260609-XXXXXX","status":"paid"},
  "payment":{"transactionId":"MOCK-...","status":"success","amountCents":5000},
  "balance":{"balanceCents":<累加后>,"currency":"USD"}
}}
```

#### GET /billing/balance
```bash
curl http://127.0.0.1:8090/api/v1/billing/balance \
  -H "Authorization: Bearer <token>"
```
响应:
```json
{ "code":0, "message":"ok", "data":{ "balanceCents":50000,"currency":"CNY" } }
```

#### GET /billing/invoices
```bash
curl http://127.0.0.1:8090/api/v1/billing/invoices \
  -H "Authorization: Bearer <token>"
```
响应:
```json
{ "code":0, "message":"ok", "data":{ "items":[
  { "invoiceNo":"INV-...","amountCents":5000,"currency":"USD","status":"paid","createdAt":"2026-..." }
] } }
```

### 2.5 其他

| 端点 | 说明 |
|---|---|
| GET /invoices | 发票列表 |
| GET /payment/:id | 支付详情 |
| GET /quota | 配额 |
| POST /refunds | 退款申请 |
| GET /billing/cost-logs | 成本日志 |

---

## 3. ai-orchestrator:8087 (AI 任务编排)

**⚠️ 鉴权用 `x-api-key: dev-ai-orchestrator-key` 头 (不是 JWT Bearer!)**

### 3.1 健康

#### GET /health
```bash
curl http://127.0.0.1:8087/health
```
响应 (200 依赖服务全起 / 503 部分 down):
```json
{ "status":"degraded", "deps":{ "aiRouter":"down","workflow":"down" } }
```

### 3.2 任务

#### POST /v1/orchestrator/jobs
提交 AI 任务
```bash
curl -X POST http://127.0.0.1:8087/v1/orchestrator/jobs \
  -H "x-api-key: dev-ai-orchestrator-key" -H "Content-Type: application/json" \
  -d '{"type":"image-gen","payload":{"prompt":"a cat"},"projectId":"<uuid>"}'
```
响应 (201):
```json
{ "jobId":"uuid","status":"queued","type":"image-gen","createdAt":"2026-..." }
```

#### GET /v1/orchestrator/jobs/:id
查任务
```bash
curl http://127.0.0.1:8087/v1/orchestrator/jobs/<jobId> \
  -H "x-api-key: dev-ai-orchestrator-key"
```

**已知**: server 重启 job 丢 (in-memory 存储), 需持久化时换 Redis/DB

---

## 4. project-service:8089 (未启)

预留: 项目 CRUD / 角色 / 场景 / 脚本 / 资产

---

## 5. collab-service:8091 (未启)

预留: 协作会话 / 评论 / 实时同步

---

## 6. 错误码

| HTTP | 含义 |
|---|---|
| 200 | 成功 |
| 201 | 创建 |
| 400 | 参数错 (zod 校验失败) |
| 401 | 鉴权失败 (无 token / 错 token / audience invalid) |
| 403 | 权限不足 (admin only / cannot recharge for another) |
| 404 | 资源不存在 |
| 409 | 冲突 (重复注册) |
| 500 | 服务器错 |

业务响应格式:
```json
{ "code": <int>, "message": "<str>", "data": <any>, "detail": "<可选>" }
```
`code=0` 成功, 其他失败

---

## 7. 跨服务 JWT 注意

- user-service 签的 token 给 billing-service 验证: **billing 已放宽 iss/aud** 校验 (不强制)
- 业务校验只看 `typ: "access"` + HS256 + 共享 JWT_SECRET
- ai-orchestrator 不用 JWT, 用 `x-api-key` 头 (与 billing 区分)

---

## 8. 烟测

8 集成冒烟跑法:
```bash
cd D:\ManhuaWorks
npx vitest run tests/integration/m2-smoke.test.ts --reporter=basic
```
应见 `Tests  8 passed`

---

## 9. 速查表

| 服 | 端点数 | 端点 |
|---|---|---|
| user-service:8088 | 23 | auth×10 + me×8 + users×4 + api-key×4 (含 reveal) |
| billing-service:8090 | 12+ | health + sub + order + invoice + payment + quota + refund + cost-log + recharge×3 |
| ai-orchestrator:8087 | 3 | health + jobs POST + jobs GET |
| project-service:8089 | TBD | 预留 |
| collab-service:8091 | TBD | 预留 |
