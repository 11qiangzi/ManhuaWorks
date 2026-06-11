# ManhuaWorks 运维手册

> **状态**: L2-task-12 完成 — 一键起全栈 + 启动 / 停止 / 日志 / 健康检查脚本
> **最后更新**: 2026-06-08
> **维护**: 运维谢擎

---

## 📦 目录

```
infrastructure/
├── docker-compose.yml          # 全栈 15 服务（生产）
├── docker-compose.dev.yml      # 开发模式（10 服务，跳过可观测性）
├── docker-compose.monitor.yml  # 旧版可观测性（已并入 prod 栈，保留兼容）
├── .env.example                # 环境变量模板
├── prometheus/                 # Prometheus 配置 + 告警规则
├── grafana/                    # Grafana dashboard + provisioning
├── alertmanager/               # AlertManager 路由 + 模板
├── nginx/                      # 预留反向代理
├── docker/                     # 辅助 Docker 资产
├── scripts/                    # 历史脚本
├── start.sh / start.ps1        # 一键起 dev
├── start-prod.sh               # 一键起 prod（全栈）
├── stop.sh / stop.ps1          # 一键停
├── logs.sh / logs.ps1          # 一键看日志
├── smoke-test.sh / .ps1        # 一键健康检查
└── README.md                   # ← 你在读这文件
```

---

## 🚀 快速开始

### 1. 第一次跑：初始化环境

```bash
cd infrastructure/

# Linux / macOS
cp .env.example .env
$EDITOR .env                  # 改密码 / webhook / SMTP

# Windows PowerShell
Copy-Item .env.example .env
notepad .env
```

### 2. 启动（推荐 dev 起步）

```bash
# Linux / macOS
./start.sh                    # 起 dev 栈（10 服务，省内存）
./smoke-test.sh               # 验证全绿

# Windows
.\start.ps1
.\smoke-test.ps1
```

### 3. 起生产全栈（15 服务）

```bash
./start-prod.sh               # 包含 prometheus / grafana / monitor
./smoke-test.sh --container   # 用 docker exec 探测 DB
```

### 4. 停

```bash
./stop.sh                     # 默认 prod；加 --dev 停 dev；加 --volumes 清数据
# 或
docker compose -f docker-compose.dev.yml down
```

### 5. 看日志

```bash
./logs.sh                     # 跟所有
./logs.sh --service user-service
./logs.sh --tail 200 --no-follow
```

---

## 🧱 服务清单（15）

| # | 服务 | 容器端口 | 主机端口 | 镜像 | 类别 |
|---|------|---------|---------|------|------|
| 1 | postgres      | 5432  | 5432  | postgres:16-alpine     | 数据 |
| 2 | redis         | 6379  | 6379  | redis:7-alpine         | 数据 |
| 3 | user-service  | 8088  | 8088  | 自建 (services/user-service)  | 后端 |
| 4 | project-service | 8089 | 8089 | 自建 (services/project-service) | 后端 |
| 5 | billing-service | 8090 | 8090 | 自建 (services/billing-service) | 后端 |
| 6 | collab-service  | 8091 (HTTP+WS) | 8091 | 自建 (services/collab-service) | 后端 |
| 7 | api-gateway   | 8080  | 8080  | 自建 (services/api-gateway) | 入口 |
| 8 | monitor       | 8092  | 8092  | 自建 (services/monitor)   | 监控 |
| 9 | prometheus    | 9090  | 9090  | prom/prometheus:v2.55.0  | 监控 |
| 10 | alertmanager | 9093  | 9093  | prom/alertmanager:v0.27.0 | 监控 |
| 11 | grafana       | 3000  | 3010  | grafana/grafana:11.3.0   | 监控 |
| 12 | web           | 3000  | 3000  | 自建 (apps/web)          | 前端 |
| 13 | studio        | 3001  | 3001  | 自建 (apps/studio)       | 前端 |
| 14 | admin-portal  | 3002  | 3002  | 自建 (apps/admin-portal) | 前端 |
| 15 | user-portal   | 3003  | 3003  | 自建 (apps/user-portal)  | 前端 |

> **端口冲突解决**：web (3000) 与 grafana (容器内 3000) 主机端口错开，grafana 用 3010。  
> **启动顺序**：postgres → redis → 4 后端 → api-gateway → monitor → 4 前端 / prom / grafana  
> **网络**：所有服务在 `manhuaworks_net` (bridge, 172.30.0.0/16)  
> **数据卷**：`postgres-data / redis-data / prometheus-data / alertmanager-data / grafana-data`

---

## 🌐 dev 栈 vs prod 栈

| 维度 | dev (`docker-compose.dev.yml`) | prod (`docker-compose.yml`) |
|------|--------------------------------|-----------------------------|
| 服务数 | 10（无 observability） | 15（含 prom/grafana/AM/monitor） |
| 业务镜像 | `target: builder` 阶段 | `target: runtime` 阶段 |
| 源码挂载 | ✅ 挂 ../services/&lt;x&gt;/src | ❌ 拷到镜像里 |
| 模式 | `tsx watch` 热重载 | `node dist/index.js` |
| restart | `no`（崩了不自动拉） | `unless-stopped` |
| 数据卷后缀 | `-dev` | 无 |
| 用途 | 本地编码、L1 集成测试 | 部署 / 演示 / 压力测试 |
| 内存占用 | ~1.5 GB | ~3 GB |

切换方法：
```bash
./start.sh                    # dev
./start-prod.sh               # prod
./stop.sh --dev               # 停 dev
./stop.sh --prod              # 停 prod
```

---

## 🔧 环境变量（.env）

完整列表见 `.env.example`。**生产环境必须改**的：

| 变量 | 默认占位 | 说明 |
|------|---------|------|
| `POSTGRES_PASSWORD` | `change_me_postgres_password_32chars` | Postgres 超级用户密码 |
| `JWT_SECRET` | `change_me_jwt_secret_at_least_32_characters_long` | 业务 JWT 签发密钥，**所有服务共用** |
| `GRAFANA_PASSWORD` | `change_me_grafana_admin_16chars` | Grafana admin 密码 |
| `FEISHU_WEBHOOK_URL` | (空) | 飞书机器人 webhook（告警用） |
| `SMTP_PASS` | `change_me_smtp_password` | 邮件发送密码 |

`./start-prod.sh` 会**自动拦截占位密码**，避免你用 dev 密码上生产。

---

## 🔍 健康检查（smoke test）

```bash
./smoke-test.sh                # 默认：HTTP 探测 12 端点
./smoke-test.sh --container    # 容器内探测（更准，要 docker exec）
./smoke-test.sh --verbose      # 失败时输出响应体
./smoke-test.sh --retries 5    # 每个端点最多重试 5 次
./smoke-test.sh --timeout 10   # 每次 HTTP 超时 10s
```

检查覆盖（13 项）：

| 分类 | 端点 |
|------|------|
| 后端 | `user/project/billing/collab-service /health` |
| 入口 | `api-gateway /health` |
| 监控 | `monitor /health` |
| 可观测 | `prometheus /-/healthy` + `/api/v1/status/config` |
| 可观测 | `alertmanager /-/healthy` |
| 可观测 | `grafana /api/health` |
| 数据 | `postgres` (`pg_isready` 或 tcp/5432) |
| 数据 | `redis` (`PING` 或 tcp/6379) |
| 前端 | `web / studio / admin-portal / user-portal` |

退出码：`0` 全绿；`1` 有失败（脚本打印失败清单）。

---

## 🩺 排错（Troubleshooting）

### 端口被占用

```
ERROR: for postgres  Cannot start service postgres: driver failed programming
external connectivity on endpoint mhw-postgres: Error starting userland proxy:
listen tcp 0.0.0.0:5432: bind: address already in use
```

→ 改 `.env` 里 `POSTGRES_*` / 主机端口映射，或停掉占用进程：

```bash
# Linux
sudo lsof -i :5432
sudo kill <PID>

# Windows
netstat -ano | findstr :5432
taskkill /PID <PID> /F
```

### 容器起不来 / 一直 Restarting

```bash
./logs.sh --service <容器名> --tail 200
# 例：
./logs.sh --service user-service --tail 200
```

常见原因：
- `.env` 没设置 → `JWT_SECRET is required` / `DATABASE_URL is required`
- DB 还没起就 ping → `ECONNREFUSED 127.0.0.1:5432`：等 30s 重试
- 端口冲突 → 同上

### 健康检查 503

`GET /health` 返回 `503` 表示依赖（DB / Redis）不可用：

```bash
# 看详细 deps 状态
curl -s http://localhost:8088/health | jq .

# 看后端日志
./logs.sh --service user-service --tail 100
```

### Prometheus 抓不到目标

```bash
# 看 prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health, lastError: .lastError}'
```

### Grafana dashboard 空

1. 打开 `http://localhost:3010`（admin / `$GRAFANA_PASSWORD`）
2. 检查 `Datasources → Prometheus` 是否连上 `http://prometheus:9090`
3. `Dashboards → Browse → ManhuaWorks → overview / business`

### 飞书告警不触发

1. 检查 `FEISHU_WEBHOOK_URL` 是否设置：`./logs.sh --service alertmanager | grep webhook`
2. 手动测：`curl -X POST $FEISHU_WEBHOOK_URL -d '{"msg_type":"text","content":{"text":"test"}}'`
3. 检查 `infrastructure/alertmanager/rules.yml` 是否有匹配规则

### 业务后端日志 "Cannot find module '/app/dist/...'"

→ 构建失败但容器已起。重新 build：

```bash
./stop.sh
./start-prod.sh --rebuild
```

### 前端 vite preview 起不来

→ 多半是 `apps/<x>/dist` 缺失。先在 host 跑一次 build：

```bash
cd apps/web
npm run build
# 再
cd ../..
./start-prod.sh --rebuild
```

---

## 💾 备份 / 恢复

### 备份数据卷

```bash
# 停栈（避免写入）
./stop.sh

# 备份所有命名卷
docker run --rm \
  -v mhw-postgres-data:/from:ro \
  -v mhw-redis-data:/from2:ro \
  -v mhw-grafana-data:/from3:ro \
  -v $(pwd)/backups:/to \
  alpine sh -c "tar czf /to/pg-$(date +%Y%m%d).tar.gz -C /from . \
            && tar czf /to/redis-$(date +%Y%m%d).tar.gz -C /from2 . \
            && tar czf /to/grafana-$(date +%Y%m%d).tar.gz -C /from3 ."
```

### 恢复

```bash
docker run --rm \
  -v mhw-postgres-data:/to \
  -v $(pwd)/backups:/from:ro \
  alpine sh -c "tar xzf /from/pg-YYYYMMDD.tar.gz -C /to"
./start-prod.sh
```

### 逻辑备份（推荐 + 体积小）

```bash
# pg_dump
docker exec mhw-postgres pg_dump -U mhw manhuaworks | gzip > backups/mhw-$(date +%Y%m%d).sql.gz

# redis 备份（先触发一次 bgsave）
docker exec mhw-redis redis-cli BGSAVE
docker cp mhw-redis:/data/dump.rdb backups/redis-$(date +%Y%m%d).rdb
```

---

## ⬆️ 升级

```bash
# 1) 拉取基础镜像
./stop.sh
docker pull postgres:16-alpine
docker pull redis:7-alpine
docker pull prom/prometheus:v2.55.0
docker pull prom/alertmanager:v0.27.0
docker pull grafana/grafana:11.3.0

# 2) 重新 build 业务镜像（用最新代码）
./start-prod.sh --rebuild --pull

# 3) 验证
./smoke-test.sh
```

⚠️ 升级 Postgres 大版本（如 16 → 17）需要先 `pg_dump` 再恢复。Redis 大版本同理（save → rdb → load）。

---

## 🧪 L2-task-12 产出清单

| 类别 | 数量 | 路径 |
|------|------|------|
| docker-compose | 2 | `docker-compose.yml` (15 服务) + `docker-compose.dev.yml` (10 服务) |
| 环境变量 | 1 | `.env.example` |
| 启动脚本 | 4 | `start.sh` + `start.ps1` + `start-prod.sh` + (stop 同目录) |
| 停止脚本 | 2 | `stop.sh` + `stop.ps1` |
| 日志脚本 | 2 | `logs.sh` + `logs.ps1` |
| 健康检查 | 2 | `smoke-test.sh` + `smoke-test.ps1` |
| Dockerfile（后端）| 1 | `services/project-service/Dockerfile`（补缺）|
| Dockerfile（前端）| 4 | `apps/{web,studio,admin-portal,user-portal}/Dockerfile`（补缺）|
| 后端最小脚手架 | 3 | `services/project-service/src/{app,index,routes/index}.ts`（补缺）|
| 健康端点 | 1 | `services/project-service/src/controllers/healthController.ts`（补缺）|
| 文档 | 1 | `infrastructure/README.md`（本文件）|
| **合计** | **21** | 实际新增/补齐文件 |

> **未做**：实际 `docker compose up`（环境无 docker），仅写配置 + 验证 YAML 语法。  
> **遗留**：project-service 业务接口 `/api/v1/*` 仍为 501 stub；需后续 L2 task 补 controllers / services / repositories。

---

## 📞 联系

- 运维：谢擎
- 文档维护：基础设施组
- 紧急：参考 `alertmanager/rules.yml` + `FEISHU_WEBHOOK_URL` 配置的值班群
