# ManhuaWorks 链路追踪 (OpenTelemetry) 运维手册

> L2 task 14 — 全链路串联：4 前端 → api-gateway → 4 后端 → PG/Redis → monitor

## 1. 架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│  浏览器 (RUM)                                                             │
│  web / studio / admin-portal / user-portal                                │
│  - 浏览器端 OTel SDK + OTLP HTTP Exporter                                 │
│  - traceparent 头自动注入 fetch/XHR                                       │
│  - 路由切换 / 文档加载 自动 span                                          │
└─────────────────────────────┬────────────────────────────────────────────┘
                              │ HTTP (携带 traceparent)
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  api-gateway (Hono)                                                       │
│  - traceMiddleware 读入 W3C traceparent → active context                 │
│  - 响应头写 X-Trace-Id + traceparent                                       │
│  - 转发到 4 业务后端（fetch 自动 inject traceparent）                      │
└──────┬───────────┬───────────┬───────────┬──────────────────────────────┘
       │           │           │           │
       ▼           ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ user-    │ │ project- │ │ billing- │ │ collab-  │
│ service  │ │ service  │ │ service  │ │ service  │
│ :8081    │ │ :8089    │ │ :8090    │ │ :8085    │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │            │
     ▼            ▼            ▼            ▼
┌──────────────────────────────────────────────┐
│  postgres :5432  +  redis :6379              │
│  (pg / ioredis instrumentation 自动 span)     │
└──────────────────────────────────────────────┘
                              ▲
                              │ (scrape metrics)
                              │
                         ┌────┴────┐
                         │ monitor │ :8092
                         │  - monitor.scrape span
                         │  - monitor.db.query span
                         └────┬────┘
                              │ OTLP HTTP
                              ▼
                    ┌────────────────────┐
                    │ Jaeger all-in-one  │
                    │  :16686 UI         │
                    │  :4318 OTLP HTTP   │
                    └────────────────────┘
```

## 2. 关键文件清单

| 文件 | 作用 |
|------|------|
| `packages/logger/src/tracer.ts` | OTel SDK 启动 + W3C Propagator + `initTelemetry` |
| `packages/logger/src/middleware.ts` | Express 中间件：`httpLoggerMiddleware` 强制读 traceparent / 写 X-Trace-Id 响应头 |
| `services/api-gateway/src/telemetry.ts` | gateway OTel 启动 |
| `services/api-gateway/src/middleware/trace.ts` | Hono 中间件：`traceMiddleware` + `traceHeaders` helper |
| `services/api-gateway/src/index.ts` | 顶部 `import './telemetry'` + 挂载 `traceMiddleware` + 用 `traceHeaders(headers)` 给 fetch 注入 traceparent |
| `services/{user,project,billing,collab}-service/src/telemetry.ts` | 4 业务后端 OTel 启动（`service.name` 不同）|
| `services/{user,project,billing,collab}-service/src/index.ts` | 顶部 `import './telemetry'` |
| `services/monitor/src/telemetry.ts` | monitor OTel 启动 |
| `services/monitor/src/index.ts` | 顶部 `import './telemetry'` |
| `services/monitor/src/collectors/metricsScraper.ts` | 每次抓取加 `monitor.scrape` span |
| `services/monitor/src/collectors/dbStats.ts` | 每次 PG 查询加 `monitor.db.query` span |
| `apps/{web,studio,admin-portal,user-portal}/src/telemetry.ts` | 4 前端 RUM（Web SDK + OTLP HTTP） |
| `packages/api-client/src/http.ts` | fetch wrapper 注入 traceparent + X-Trace-Id |
| `infrastructure/jaeger/docker-compose.yml` | Jaeger all-in-one |
| `infrastructure/docker-compose.monitor.yml` | 追加 jaeger 服务 + 给 monitor 注入 OTLP env |
| `tests/e2e/trace-test.sh` / `.ps1` / `trace-test-noop.sh` | 端到端验证 |

## 3. 环境变量

| 变量 | 默认 | 用途 |
|------|------|------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP 接入点（容器内用 `http://jaeger:4318`） |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` | 我们用 HTTP/protobuf（不是 gRPC） |
| `OTEL_SERVICE_NAME` | 业务 service 名 | `service.name` 资源属性 |
| `OTEL_TRACES_ENABLED` | `true` | 关掉就完全 noop |
| `OTEL_PROPAGATORS` | `tracecontext,baggage` | W3C 标准（默认就是） |
| `OTEL_RESOURCE_ATTRIBUTES` | 空 | 自定义资源属性，如 `deployment.environment=production` |

**前端额外变量**（Vite）：
- `VITE_OTEL_EXPORTER_OTLP_ENDPOINT`：默认 `http://localhost:4318/v1/traces`
- `VITE_OTEL_SERVICE_NAME`：默认 `web` / `studio` / `admin-portal` / `user-portal`
- `VITE_OTEL_TRACES_ENABLED`：默认 `true`

## 4. 启动顺序

### 4.1 开发机（无 Docker）

```bash
# 1) 启动 Jaeger（一次性，单独一个 compose）
cd D:\ManhuaWorks\infrastructure\jaeger
docker compose up -d

# 2) 各业务后端
cd D:\ManhuaWorks
pnpm dev
# 所有 service 自动 init OTel，发到 http://localhost:4318
```

### 4.2 完整 Docker stack

```bash
cd D:\ManhuaWorks\infrastructure
docker compose -f docker-compose.monitor.yml up -d
# 包含 prometheus + grafana + alertmanager + monitor + jaeger
```

## 5. 看 Jaeger UI

1. 浏览器打开 `http://localhost:16686`
2. Service 下拉框选：
   - `api-gateway`
   - `user-service` / `project-service` / `billing-service` / `collab-service`
   - `monitor`
   - `web` / `studio` / `admin-portal` / `user-portal`
3. 点 **Find Traces**
4. 点任一 trace → 看瀑布图：
   - 顶层 span = 入口（前端 `route.change` / gateway `HTTP GET`）
   - 中间 span = 4 业务后端 `HTTP GET` → `pg.query` / `redis.set` / 业务 span
   - 末尾 span = 业务完成

## 6. 真实 trace 路径示例

**场景**：用户在 web 端点「我的项目列表」

```
[web]  route.change → /projects                    (parent: page load)
   └─ [web]  HTTP GET http://localhost:8080/v1/projects
       └─ [api-gateway]  HTTP GET /v1/projects     (parent: 上一行)
           ├─ [api-gateway]  redis.incr rl:global:u:usr_xxx  (限流)
           └─ [api-gateway]  HTTP GET http://user-service:8081/v1/users/me
               └─ [user-service]  HTTP GET /v1/users/me      (parent: 上一行)
                   ├─ [user-service]  pg.query SELECT ... FROM users
                   └─ [user-service]  pg.query SELECT ... FROM sessions
       └─ [api-gateway]  HTTP GET http://project-service:8082/v1/projects
           └─ [project-service]  HTTP GET /v1/projects       (parent: 上一行)
               └─ [project-service]  pg.query SELECT ... FROM projects WHERE user_id = ...
                   └─ [project-service]  pg.query SELECT ... FROM project_members
```

**全部 6 个 span 共享同一个 `traceId`**（32 字符 hex），点 Jaeger 顶部的 traceId 链接即可串起来看。

## 7. 调试技巧

### 7.1 看不到 trace？

按下面顺序检查：

1. **OTLP endpoint 拼对了吗？**
   ```bash
   curl -X POST http://localhost:4318/v1/traces -d 'proto payload'
   ```
   容器内：endpoint 必须是 `http://jaeger:4318`（带服务名），不是 `localhost:4318`。
2. **Jaeger 起来了吗？**
   ```bash
   docker ps | grep jaeger
   curl http://localhost:16686/
   ```
3. **`OTEL_TRACES_ENABLED` 没被设成 `false` 吧？**
4. **环境变量拼写**：用 `OTEL_EXPORTER_OTLP_ENDPOINT`，不是 `OTEL_ENDPOINT`。
5. **网络：服务容器和 jaeger 容器在同一个 docker network 吗？**
   ```bash
   docker network inspect mhw-net
   ```

### 7.2 traceId 找不到？

每个业务后端的 access log 里都打了 `traceId` / `spanId` 字段，搜日志：

```bash
grep "traceId" logs/*.log | tail -20
```

### 7.3 太多 span？

`@opentelemetry/instrumentation-fs` 默认开启（4MB 启动期 module load），可以关掉：

```typescript
// services/X/src/telemetry.ts
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
void initTelemetry({
  service: 'X',
  instrumentations: getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-fs': { enabled: false },
  }),
});
```

### 7.4 怎么把 traceId 带回前端？

后端 → 响应头 `X-Trace-Id`，前端 `api-client/http.ts` 自动从 fetch Response 取，并 console.log 出来（开发期）。生产期可以把它打印到 Sentry / DataDog。

## 8. 验证脚本

| 脚本 | 用途 |
|------|------|
| `tests/e2e/trace-test.sh` | 跑 auth + project + collab 全流程，输出 traceId 列表 + Jaeger 验证 |
| `tests/e2e/trace-test.ps1` | Windows 版 |
| `tests/e2e/trace-test-noop.sh` | 无 docker / 无 jaeger 时跑：只验证 6 个 telemetry.ts 编译 + traceparent 注入格式正确 |

```bash
# dry-run（推荐 CI）
bash tests/e2e/trace-test-noop.sh

# 真跑（需 jaeger + 4 后端 + gateway + monitor 都在）
bash tests/e2e/trace-test.sh
```

## 9. 协议标准

- **OTLP HTTP/protobuf**（不是 gRPC）—— 端口 4318
- **W3C Trace Context** —— `traceparent: 00-<32hex>-<16hex>-<2hex>`
- **W3C Baggage** —— `baggage: k=v,k2=v2`
- **Resource 属性**：`service.name` / `service.version` / `deployment.environment`

## 10. 关联任务

- L2 task 11 — `packages/logger` 写了 SDK 初始化（已串联）
- L2 task 14 — **本任务**：6 个后端 + 4 个前端 + api-gateway + monitor + Jaeger 全链路
- L3+ — 可以接 Tempo 替代 Jaeger（OTLP HTTP 协议相同，只换 endpoint）
