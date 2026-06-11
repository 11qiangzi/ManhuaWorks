# ManhuaWorks 启动顺序清单（11 服务）

> 钟帧：2026-06-08 L2 任务 13
> 状态：已 4 业务后端真实启动验证（user/project/billing/collab），前 4 是业务网关，剩下 7 个为辅助服务

## 启动顺序（自下而上）

| 序 | 服务 | 端口 | 启动命令 | 前置依赖 | 验证 |
|----|------|------|----------|----------|------|
| 1 | **PostgreSQL 16** | 5432 | 服务管理/已运行 | — | `psql -c "SELECT 1"` |
| 2 | **Redis 7** | 6379 | 服务管理/已运行（collab 需要） | — | `redis-cli ping` |
| 3 | `migrate.ps1` | — | `pwsh D:\ManhuaWorks\db\migrate.ps1` | Postgres | 13 张表 `\dt` 可见 |
| 4 | `user-service` | 8088 | `cd services/user-service && pnpm tsx src/index.ts` | Postgres + DB | `curl :8088/api/v1/health` |
| 5 | `project-service` | 8089 | `cd services/project-service && pnpm tsx src/index.ts` | Postgres + user-service | `curl :8089/api/v1/health` |
| 6 | `billing-service` | 8090 | `cd services/billing-service && pnpm tsx src/index.ts` | Postgres + user-service | `curl :8090/api/v1/health` |
| 7 | `collab-service` | 8091 | `cd services/collab-service && pnpm tsx src/index.ts` | Postgres+Redis+user-service | `curl :8091/api/v1/health` + WS `:8091/ws` |
| 8 | `api-gateway` | 8080 | `cd services/api-gateway && pnpm start` | 4 业务后端 | `curl :8080/health` |
| 9 | `asset-service` | 8082 | `cd services/asset-service && pnpm start` | api-gateway | 略 |
| 10 | `ai-keys-service` | 8083 | `cd services/ai-keys-service && pnpm start` | api-gateway | 略 |
| 11 | `monitor` | 9090 | `cd services/monitor && pnpm start` | 4 业务后端 + Prometheus | 略 |

## 验证脚本

- `tests/e2e/scripts/run-all.ps1` — 一键跑 4 个 e2e（auth/project/billing/collab）
- `tests/e2e/smoke-test.ps1` — 一键 curl 4 后端 /health
- `tests/e2e/scripts/smoke-test.sh` — bash 版

## 启动日志

- 全部 stdout/stderr 写入 `D:\ManhuaWorks\tests\e2e\logs\<service>.startup.log`

## 故障回滚

服务异常 → `Get-Process | Where-Object {$_.Name -like "node*"} | Stop-Process -Force` 重启
