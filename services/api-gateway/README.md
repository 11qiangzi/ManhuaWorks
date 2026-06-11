# ManhuaWorks API Gateway

> 统一 API 网关 · Hono + JWT + Redis 限流 · 5 级 RBAC

负责：路由转发、JWT 鉴权、5 级 RBAC、Redis 限流、5 个后台 readiness 探针、流量统一入口。

---

## 1. 启动方式

### 1.1 本地开发（推荐）

```bash
# 1. 确认根目录 workspace 能解析本包
cd D:\ManhuaWorks
pnpm install

# 2. 启动本服务（watch 模式）
pnpm --filter @manhuaworks/api-gateway dev
#   = tsx watch src/index.ts
```

启动后默认监听 `0.0.0.0:8080`，日志示例：

```
[gateway] listening on http://0.0.0.0:8080  env=development
[gateway] readiness targets: postgres, redis, user-service, project-service, billing-service
```

### 1.2 Docker（与 `infrastructure/docker-compose.yml` 配合）

```bash
cd D:\ManhuaWorks
docker compose -f infrastructure/docker-compose.yml up -d api-gateway
```

> Dockerfile 在 `services/api-gateway/Dockerfile`，多阶段构建，最终镜像 ~150MB。

### 1.3 单测 / 类型检查

```bash
pnpm --filter @manhuaworks/api-gateway typecheck
pnpm --filter @manhuaworks/api-gateway build
```

---

## 2. 路由总览

| 方法 | 路径 | 鉴权 | 说明 |
|:-----|:-----|:-----|:----|
| GET  | `/health` | 无 | Liveness，进程在就行 |
| GET  | `/ready`  | 无 | Readiness，**5 个后台探针全过才 200** |
| POST | `/dev/token` | 仅 `NODE_ENV !== 'production'` | 本地签发 JWT 方便调试 |
| GET  | `/v1/admin/ping` | `L3+` | RBAC 演示路由 |
| ALL  | `/v1/users/*`     | 已登录 | 代理到 `user-service`（默认 8081） |
| ALL  | `/v1/projects/*`  | 已登录 | 代理到 `project-service`（默认 8082） |
| ALL  | `/v1/billing/*`   | 已登录 | 代理到 `billing-service`（默认 8083） |
| ALL  | `/v1/ai/*`        | 已登录 | 代理到 `ai-orchestrator`（默认 8084） |

---

## 3. Readiness 5 个探针

`GET /ready` 并发检查 5 个后台依赖：

| 名称 | 类型 | 默认地址 | 超时 |
|:-----|:-----|:---------|:----|
| postgres      | postgres | `postgresql://mhw:mhw_dev_only@localhost:5432/manhuaworks` | 1500ms |
| redis         | redis    | `redis://localhost:6379` | 1000ms |
| user-service  | http     | `http://localhost:8081/health` | 1500ms |
| project-service | http   | `http://localhost:8082/health` | 1500ms |
| billing-service | http    | `http://localhost:8083/health` | 1500ms |

> ai-orchestrator 是计算密集型，启动慢且可能长时间处于「忙碌」状态，
> 它的 readiness 由自己 `/health` 暴露，本网关不绑死。

**全部 ok → 200 + `status: "ready"`**；任一失败 → **503 + `status: "not_ready"`**，body 给出每项耗时与原因。

---

## 4. 5 级 RBAC

定义在 `src/config.ts` 的 `ROLE_BIT`：

| 级别 | 位 | 名称 | 典型场景 |
|:-----|:--|:-----|:--------|
| L1 | 1 | 创作端-普通创作者 | 注册用户，只能改自己作品 |
| L2 | 2 | 创作端-重度创作者 | 重度创作者，可组队、可发布 |
| L3 | 4 | 业务后台-运营/客服/审核 | ops 门户，处理工单、审核 |
| L4 | 8 | 业务后台-产品/超管 | ops 门户超管，配置调整 |
| L5 | 16 | 平台后台-技术/运维 | admin 门户，部署 / 监控 |

**位掩码比较**：`hasAtLeast(userRole, minRole)` 检查 `userRole >= minRole`。

业务路由声明：`app.get('/admin/xxx', requireAuth, requireRole('L3'), handler)`

---

## 5. 限流

`X-RateLimit-*` 头每次响应都返回（限流生效的前提下）：

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 42
X-RateLimit-Window: 60s
X-RateLimit-Bucket: global
```

- **默认 60s 窗口，120 次 / identity**（identity = 已登录用 `sub`，否则用 IP）
- Redis 故障时 **fail-open**（放行 + warn），可通过 `rateLimit({ strict: true })` 切换为 fail-closed

---

## 6. 环境变量

| 变量 | 默认 | 说明 |
|:-----|:-----|:----|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `PORT` | `8080` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `JWT_SECRET` | `change_me_in_production` | **生产必须改** |
| `JWT_ISSUER` | `manhuaworks` | iss 声明 |
| `JWT_AUDIENCE` | `manhuaworks-gateway` | aud 声明 |
| `JWT_ALGORITHM` | `HS256` | `HS256` / `HS384` / `HS512` |
| `RATE_LIMIT_WINDOW_MS` | `60000` | 限流窗口（毫秒） |
| `RATE_LIMIT_MAX` | `120` | 窗口内最大请求数 |
| `CORS_ORIGIN` | `*` | 允许的 Origin |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `REDIS_URL` | `redis://localhost:6379` | Redis 连接串 |
| `USER_SERVICE_URL` | `http://localhost:8081` | user-service 上游 |
| `PROJECT_SERVICE_URL` | `http://localhost:8082` | project-service 上游 |
| `BILLING_SERVICE_URL` | `http://localhost:8083` | billing-service 上游 |
| `AI_ORCHESTRATOR_URL` | `http://localhost:8084` | ai-orchestrator 上游 |
| `READINESS_POSTGRES_URL` | `postgresql://mhw:mhw_dev_only@localhost:5432/manhuaworks` | postgres 探针 |
| `READINESS_REDIS_URL` | `redis://localhost:6379` | redis 探针 |
| `READINESS_USER_SERVICE_URL` | `http://localhost:8081/health` | user-service 探针 |
| `READINESS_PROJECT_SERVICE_URL` | `http://localhost:8082/health` | project-service 探针 |
| `READINESS_BILLING_SERVICE_URL` | `http://localhost:8083/health` | billing-service 探针 |

---

## 7. 目录结构

```
services/api-gateway/
├── package.json
├── tsconfig.json
├── Dockerfile
├── README.md
└── src/
    ├── index.ts                 # Hono 入口
    ├── config.ts                # 环境变量 + 默认值 + 5 级 RBAC 位
    ├── redis.ts                 # Redis 单例
    ├── routes/
    │   └── health.ts            # /health + /ready（5 探针）
    └── middleware/
        ├── auth.ts              # JWT + 5 级 RBAC
        └── ratelimit.ts         # Redis 滑动窗口限流
```

---

## 8. 一句话验收

```bash
cd D:\ManhuaWorks
pnpm install
pnpm --filter @manhuaworks/api-gateway dev
# 另开一个 shell：
curl http://localhost:8080/health
curl http://localhost:8080/ready
curl -X POST http://localhost:8080/dev/token -H "Content-Type: application/json" -d '{"sub":"u1","role":"L3"}'
curl -H "Authorization: Bearer <上面拿到的 token>" http://localhost:8080/v1/admin/ping
```
