# ManhuaWorks · M2 已知问题登记

> 本文件跟踪 M1-W1 ~ M2 收尾过程中**确认存在**的 6 个已知问题。
> 每条问题包含：现象、影响、绕路方案、修复 owner。
> 2026-06-09 钟帧登记。

---

## ISSUE-01 · Docker Desktop 在本机不可用

### 现象
- `docker info` / `docker ps` 返 "error during connect: …open //./pipe/docker_engine"
- `docker-compose up` 全线失败
- M2 计划里"基础设施层用 docker compose 起 5 个 DB/中间件"的方案无法跑通

### 影响
- `infrastructure/docker-compose.yml`（postgres + redis + minio + jaeger + prometheus）跑不起来
- 单元 / 集成测试需要的 postgres 与 redis 走"宿主机原生安装 + `.env` 配 5432/6379"替代方案
- 监控栈（grafana/prometheus/alertmanager）的 docker 部署脚本暂未真跑过

### 绕路方案
- 本机开发用宿主机 postgres 16 (`localhost:5432`) + 宿主机 redis (Windows 自带或 Memurai) 代替
- `.env.example` 已是宿主机配置（`DATABASE_URL=postgres://postgres:dev@localhost:5432/manhuaworks`）
- `infrastructure/scripts/logs.ps1` / `start-prod.sh` 是给生产用，本机 dev 不用

### 修复 owner
- 基建（@谢擎）—— 等 Docker Desktop 修复或换 Podman Desktop
- ETA：M3 启动前确认；M3 不阻塞

### 验证
- 本机实际：`docker info` 仍失败，已记录
- 已用替代方案跑通 1100+ vitest，smoke 8/8 通过

---

## ISSUE-02 · 鉴权模式 3 套并存

### 现象
- 代码库存在 **3 套**鉴权实现并存：
  1. **api-gateway** (`services/api-gateway/src/middleware/auth.ts`) — Hono + JWT/role RBAC
  2. **user-service** (`services/user-service/src/middleware/auth.ts`) — Express + JWT (`requireAuth` / `requireRole`)
  3. **ai-orchestrator** (`services/ai-orchestrator/src/middleware/auth.ts`) — Hono + api-key / jwt / none（`AUTH_MODE` env 切）
- `user-service/src/routes/auth.ts` 又是另一套 Hono 风格实现（手机号+验证码 / 邮箱+密码），但**当前 app.ts 没挂这个 router**（见 ISSUE-03 旁注）

### 影响
- 前端在多个 service 间切换时要带不同请求头：`Authorization: Bearer …`（user）vs `X-API-Key: …`（orchestrator）
- 文档/契约必须分别给三套，不能合并
- 鉴权升级（如加 refresh token 黑名单）要改三处

### 绕路方案
- 本期不变更，保持三套
- 文档（`API_REFERENCE.md`）按 service 分章，每章注明鉴权头
- ai-orchestrator 默认 `AUTH_MODE=api-key`，dev token = `dev-ai-orchestrator-key`（来自 `services/ai-orchestrator/src/config.ts`）

### 修复 owner
- 平台组（@谢擎）— M3 规划
- 短期方案：api-gateway 作为唯一入口，前端不直连 service，全部走 `/v1/*` → 8 个 service
- 中期方案：合并到 1 套 JWT（保留多 factor），下下个 milestone 评估

### 验证
- smoke test `m2-smoke.test.ts` 显式打 user-service 8088（带 JWT） 与 orchestrator 8087（无 auth），分别返 200/401
- AC-26 已确认 orchestrator 401 行为

---

## ISSUE-03 · user-service 同时存在两套 auth 路由文件

### 现象
- `services/user-service/src/routes/index.ts`（Express 风格，已挂 `/api/v1`）
  - 端点：`/auth/register` `/auth/login` `/auth/refresh` `/me` `/me/2fa` 等
  - **这套是实际生效的**（`app.ts` 里 `app.use('/api/v1', router)` 挂的就是这个）
- `services/user-service/src/routes/auth.ts`（Hono 风格，未挂）
  - 端点：`/auth/send-code` `/auth/login`（手机号验证码版）`/auth/login-pwd` 等
  - **dead code**，没被 `app.ts` 引用，路由不到
  - 推断原因：Hono demo / 未来迁移 / 多端登录的预留

### 影响
- 文档（`API_REFERENCE.md`）只列生效的那套（`/api/v1/auth/login` 邮箱+密码版），dead code 的端点**不列**
- 若有人误以为两套都能用，会撞 404
- 后续清理时不要把 dead code 误删（防止破坏历史 commit）

### 绕路方案
- 当前：无视 `routes/auth.ts`（Hono 版），文档只写 `routes/index.ts`（Express 版）
- 死代码标注：在 `routes/auth.ts` 顶部加 `@deprecated ...` 注释（M3 一并改）

### 修复 owner
- user-service 维护人（@谢擎）— M3 启动后决定保留或删除 dead code

### 验证
- `grep -r "sendCode\|loginCodeSchema" services/user-service/src` 找到 Hono 版代码
- `grep -r "app.use" services/user-service/src/app.ts` 确认只挂 Express router
- smoke test `POST /api/v1/auth/register` 走的就是 Express 版（`auth.register`），返 201

---

## ISSUE-04 · seed.sql 用占位 password hash 不可登录

### 现象
- `db/seed.sql` 写入的 5 个用户（admin/normal/pro/cs/ops）的 `password_hash` 字段值是：
  ```
  argon2id$v=19$m=65536,t=3,p=4$YWRtaW5fc2FsdA$placeholder_admin_hash_2026
  ```
  这是**伪 hash**，不是真实 argon2id 计算结果
- 任何 `POST /api/v1/auth/login` 用 seed 用户的邮箱 + 任意密码都会返 `401 invalid credentials`

### 影响
- 无法用 seed 账号直接登进前端做演示
- 验收时只能走 smoke test 注册的 `l5b-test@example.com / Test1234`（自动建）
- `bcrypt.compare('admin123', 'argon2id$...placeholder...')` 必失败
- 测试 / 文档说"用 admin 登"会扑空

### 绕路方案
- **生产 demo**：跑 `db/seed.sql` 后，手工 `UPDATE users SET password_hash = '<real argon2id hash>' WHERE email = 'admin@manhuaworks.local'`，hash 用 `services/user-service/src/lib/password.ts` 的 `hashPassword()` 生成
- **CI/测试**：直接用 smoke test 注册的新账号
- **演示**：写一个 `db/seed-dev-passwords.sql` 单独跑，绕过 seed.sql 的占位字段

### 修复 owner
- 基建（@谢擎）— M3 之前修
- 选项 A：seed.sql 改成动态生成 hash（Node 脚本生成 .sql）
- 选项 B：保留占位 hash，文档明说"必须改密码"

### 验证
- 实测：`POST /api/v1/auth/login` 用 `admin@manhuaworks.local / admin123` 返 401
- 实测：smoke test 用 `l5b-test@example.com / Test1234` 走 register → login → 200

---

## ISSUE-05 · 子 agent 历史上有"假阳性"测试报告

### 现象
- M1 阶段，2 个子 agent 报告的"功能完成"事后被主 agent 验证为假阳性：
  1. 报告"POST /api/v1/auth/register 通了"——实际 500（缺 `users` 表 unique 约束或缺列）
  2. 报告"smoke test 9/9 通过"——实际 5 步骤 SKIP（被"服务未就绪"兜底）
- 根因：子 agent 在受限上下文里**只看 HTTP 状态码 200**，不复查 body
- 偶发 500 + 偶发 200 + 不查 body = 误判

### 影响
- 子 agent 报告不再被无脑采信
- 主 agent 增加 `body.code === 0 && body.data` 二次校验规则
- 任务脚手架：`scripts/e2e-smoke.mjs` 9 步校验 body 字段（token、projectId、keyId）

### 绕路方案
- **M2 起**：所有验收点必须 ① 状态码 + ② body code + ③ 关键字段 三重断言
- **M2 起**：smoke 跑在真实环境下（`dev-start.ps1` 起好服务后再跑）
- **M2 起**：子 agent 报告"完成"必须附真实 curl 输出（不能用"应该可以"）

### 修复 owner
- 主 agent（@虾总助）— 已在行为准则里加 .learnings/ERRORS.md 条目
- 长期：CI 强制跑 e2e-smoke.mjs，未全绿禁止 merge

### 验证
- 本期 M2_ACCEPTANCE.md 中所有 28 验收点都附真实 `Invoke-WebRequest` 输出
- m2-smoke.test.ts 用 vitest 8 个真实 HTTP 断言

---

## ISSUE-06 · 鉴权 JWT 的 iss/aud 配置散落

### 现象
- `services/billing-service/src/routes/recharge.ts` 里有写死的测试 token 签发器：
  ```ts
  jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
    issuer: env.JWT_ISSUER,    // ← 来自 .env
    audience: env.JWT_AUDIENCE, // ← 来自 .env
  });
  ```
- 但 `JWT_ISSUER` / `JWT_AUDIENCE` 默认值在 `services/billing-service/src/config/env.ts`，与 `user-service` 的 `services/user-service/src/lib/env.ts` 不一定一致
- `api-gateway` 的 JWT 校验在 `services/api-gateway/src/middleware/auth.ts` 里独立解析 `iss/aud`

### 影响
- 当 `.env` 改了 `JWT_ISSUER=manhuaworks` 但 user-service 没同步改 → gateway 校验 token 时 `aud` 不匹配 → 401
- 跨服务调用（billing 调 user）也容易踩
- 默认值在 3 个 env.ts 文件里写死成 `dev-issuer` / `dev-audience`，dev 没事，prod 必出问题

### 绕路方案
- **dev 阶段**：保持默认 `dev-issuer` / `dev-audience`，所有 service 都用同一份
- **prod 阶段**：必须从 vault 拉同源 secret，且所有 service 的 `JWT_ISSUER` / `JWT_AUDIENCE` 一致
- **临时兜底**：若发现 401，trace 看 `verify` 报什么错，常见 `jwt audience invalid` / `jwt issuer invalid`

### 修复 owner
- 平台组（@谢擎）— M3 评估统一到 `packages/config` 单源
- 短期方案：在 `infrastructure/.env.example` 显式写 `JWT_ISSUER=manhuaworks` `JWT_AUDIENCE=manhuaworks-api` 并在 README 强调

### 验证
- 本期 smoke 跑过：所有调用 user-service 的请求带 service 签的 JWT（来自 `_signTestToken`），同一进程签同一进程验
- 未做跨 service 跨进程的 token 互通测试（M3 加）

---

## 附：完整已知问题快速跳转

| 编号 | 标题 | 严重度 | Owner | 状态 |
|------|------|--------|-------|------|
| ISSUE-01 | Docker Desktop 不可用 | 中 | @谢擎 | 等基建 |
| ISSUE-02 | 鉴权 3 套并存 | 中 | @谢擎 | M3 评估 |
| ISSUE-03 | user-service 死代码 Hono auth | 低 | @谢擎 | M3 清理 |
| ISSUE-04 | seed 占位 hash 不可登录 | 中 | @谢擎 | M3 修 |
| ISSUE-05 | 子 agent 假阳性 | 高 | 主 agent | 行为准则已加 |
| ISSUE-06 | JWT iss/aud 散落 | 中 | @谢擎 | M3 评估 |

> **6 个问题均不影响 M2 交付**，但 M3 启动前需要 ISSUE-04 / ISSUE-05 修掉。
