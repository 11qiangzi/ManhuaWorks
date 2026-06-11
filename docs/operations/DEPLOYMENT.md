# ManhuaWorks 部署手册

> **版本**: 2026-06-09 (L4-C 部署脚本)
> **作者**: 虾总助 (L2-task-12 后, 取消 Electron, 改成纯 web 部署)
> **状态**: 实施中 (M1-W4 6/30 计划项, 陈远枢接单)

## 📑 目录

- [1. 架构总览](#1-架构总览)
- [2. 三套环境](#2-三套环境)
- [3. nginx 反向代理](#3-nginx-反向代理)
- [4. PM2 进程管理](#4-pm2-进程管理)
- [5. Dev 脚本 (Windows)](#5-dev-脚本-windows)
- [6. Windows 注意事项](#6-windows-注意事项)
- [7. 故障排查](#7-故障排查)

---

## 1. 架构总览

ManhuaWorks 取消 Electron 后, 改成 **4 portal + 4 service + 1 orchestrator** 的纯 web 部署。

### 1.1 端口矩阵

| 类型 | 服务 | 端口 | dev 启动 | prod 启动 |
|------|------|------|----------|-----------|
| 前端 | web (主站) | **3000** | `pnpm dev` (vite) | `node dist` (nginx 静态) |
| 前端 | admin-portal | **5174** | `pnpm dev` (vite) | `node dist` |
| 前端 | studio (创作者台) | **5175** | `pnpm dev` (vite) | `node dist` |
| 前端 | user-portal (用户后台) | **5180** | `pnpm dev` (vite) | `node dist` |
| 后端 | user-service | **8088** | `pnpm dev` (tsx) | `pm2 start` |
| 后端 | project-service | **8089** | `pnpm dev` (tsx) | `pm2 start` |
| 后端 | billing-service | **8090** | `pnpm dev` (tsx) | `pm2 start` |
| 后端 | collab-service (含 ws) | **8091** | `pnpm dev` (tsx) | `pm2 start` |
| 后端 | ai-orchestrator (M1-W4) | **8087** | `pnpm dev` (tsx) | `pm2 start` |
| 数据 | postgres | 5432 | docker / 本地服务 | docker / 托管 PG |
| 缓存 | redis | 6379 | docker | 托管 Redis |
| 监控 | prometheus | 9090 | docker | 容器化 |
| 监控 | grafana | 3010 | docker | 容器化 |

### 1.2 进程拓扑

```
            ┌─────────────────────────────────────┐
            │  浏览器 (Chrome / Safari / 微信内置)  │
            └──────────────┬──────────────────────┘
                           │ HTTPS
                           ▼
                  ┌──────────────────┐
                  │  nginx :80/:443  │
                  │  (反代 + 静态)    │
                  └────┬─────┬─────┬─┘
                       │     │     │
        ┌──────────────┘     │     └──────────────┐
        ▼                    ▼                    ▼
  ┌──────────┐         ┌──────────┐         ┌──────────┐
  │web:3000  │         │studio    │         │user-     │
  │admin:5174│         │:5175     │         │portal    │
  └──────────┘         └──────────┘         │:5180     │
                                           └──────────┘

  ┌──────────────────────────────────────────────────────┐
  │  pm2 管理的 5 个 node 进程 (后端)                    │
  │  user-svc :8088  project-svc :8089  billing-svc :8090│
  │  collab-svc :8091  ai-orchestrator :8087             │
  └──────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  postgres :5432        │
              │  redis    :6379        │
              └────────────────────────┘
```

### 1.3 目录结构

```
D:\ManhuaWorks\
├── apps\                  # 4 个前端 portal
│   ├── web\
│   ├── admin-portal\
│   ├── studio\
│   └── user-portal\
├── services\              # 4 个后端 service + 1 orchestrator
│   ├── user-service\
│   ├── project-service\
│   ├── billing-service\
│   ├── collab-service\
│   └── ai-orchestrator\
├── packages\              # 共享代码 (api-client / shared-types 等)
├── infrastructure\        # 基础设施 (本次新增)
│   ├── nginx\
│   │   ├── nginx.conf            # 主配置
│   │   └── conf.d\
│   │       └── manhuaworks.conf  # ← L4-C 新增, server 块
│   ├── pm2\
│   │   └── ecosystem.config.cjs  # ← L4-C 新增, 5 个 app
│   ├── docker-compose*.yml
│   ├── alertmanager\ grafana\ prometheus\ jaeger\
│   └── *.ps1 *.sh      # 老的 docker 启停脚本 (保留)
├── scripts\               # 工具脚本 (本次新增)
│   ├── dev-start.ps1            # ← L4-C 新增
│   ├── dev-stop.ps1             # ← L4-C 新增
│   └── *.mjs            # 老的测试脚本
├── docs\operations\
│   └── DEPLOYMENT.md            # ← L4-C 新增 (本文)
├── logs\                  # 运行日志
│   ├── dev\             # dev-start 写的日志
│   └── pm2\             # pm2 进程日志
└── .run\                  # PID 文件 (dev-start 写的)
```

---

## 2. 三套环境

### 2.1 开发环境 (development)

**目标**: 单机跑全套, 改代码即生效

| 组件 | 工具 | 命令 |
|------|------|------|
| 数据库 | 本地 postgres / docker | `net start postgresql-x64-16` |
| 缓存 | 本地 redis / docker | `docker run -d -p 6379:6379 redis:7` |
| 4 后端 | dev-start.ps1 | `.\scripts\dev-start.ps1` |
| 4 前端 | dev-start.ps1 (同上) | 同上 |
| 反代 | 不需要 (前端直连 service) | - |
| 监控 | 可选, docker-compose.monitor.yml | `docker compose -f infrastructure/docker-compose.monitor.yml up -d` |

### 2.2 预发环境 (staging)

**目标**: 跟生产一致, 但流量小, 用于最后回归

| 组件 | 工具 | 备注 |
|------|------|------|
| 数据库 | 托管 PG (staging 实例) | 同城双活 |
| 缓存 | 托管 Redis | 单实例 |
| 4 后端 | pm2 + ecosystem.config.cjs --env staging | 单机或 2 机 |
| 4 前端 | 静态构建 + nginx serve | CDN 加速 |
| 反代 | nginx + conf.d/manhuaworks.conf | server_name: staging.mhw.local |
| 监控 | 完整 (prom + grafana + alertmanager) | 全套 |

### 2.3 生产环境 (production)

| 组件 | 工具 | 备注 |
|------|------|------|
| 数据库 | 托管 PG (主从) | 主写从读 |
| 缓存 | 托管 Redis 集群 | 3 主 3 从 |
| 4 后端 | pm2 + ecosystem.config.cjs --env production | 多机 |
| 4 前端 | CDN + nginx | OSS / S3 静态资源 |
| 反代 | nginx + HTTPS | let's encrypt / 商业证书 |
| 监控 | 完整 + 告警 (alertmanager 飞书 webhook) | 24h 值班 |

---

## 3. nginx 反向代理

**配置文件**: `infrastructure/nginx/conf.d/manhuaworks.conf`

### 3.1 关键路由表

| 路径 | 转发到 | 用途 |
|------|--------|------|
| `/` | web:3000 | 主站首页 |
| `/admin/*` | admin-portal:5174 | 管理后台 |
| `/studio/*` | studio:5175 | 创作者工作台 |
| `/app/*` | user-portal:5180 | 用户后台 |
| `/api/auth/*` | user-service:8088 | 登录注册 |
| `/api/users/*` | user-service:8088 | 用户 CRUD |
| `/api/audit/*` | user-service:8088 | 审计日志 |
| `/api/projects/*` | project-service:8089 | 项目 CRUD |
| `/api/billing/*` | billing-service:8090 | 计费 |
| `/api/collab/*` | collab-service:8091 | 协作 REST |
| `/api/collab-ws*` | collab-service:8091 | 协作 WebSocket |
| `/v1/orchestrate/*` | ai-orchestrator:8087 | AI 编排 (M1-W4) |
| `/healthz` | 200 OK | LB 探活 |
| `/assets/*` | web:3000 | 静态资源 (1 年缓存) |
| `*.{js,css,woff2,...}` | web:3000 | 静态资源 (1 年缓存) |

### 3.2 WebSocket 配置要点

`/api/collab-ws` 是 WebSocket 端点, 必须:

1. `proxy_http_version 1.1` (HTTP/1.1 才有 Upgrade 语义)
2. 透传 `Upgrade` 和 `Connection` 头
3. 调高 `proxy_read_timeout` 到 86400s (24h), 否则默认 60s 踢掉
4. `rewrite ^/api/collab-ws(.*)$ /ws$1 break;` (前端用 `/api/collab-ws` 路径, 后端实际挂在 `/ws`)

### 3.3 加载配置

```bash
# 主配置 include 这一行
# /etc/nginx/nginx.conf:
http {
    include /etc/nginx/conf.d/*.conf;
}

# 测试配置
nginx -t

# 重载
nginx -s reload
```

### 3.4 静态资源缓存策略

| 资源类型 | Cache-Control | 原因 |
|----------|---------------|------|
| `*.{js,css,woff2,png,svg,...}` | `public, immutable, max-age=1y` | vite 构建产物带 hash, 改了 hash 就换文件名 |
| `/index.html` | `no-cache, no-store, must-revalidate` | 灰度要立即生效, 不能缓存 |

---

## 4. PM2 进程管理

**配置文件**: `infrastructure/pm2/ecosystem.config.cjs`

### 4.1 5 个 app 清单

| name | 端口 | cwd | 内存上限 |
|------|------|-----|----------|
| `mhw-user-service` | 8088 | `services/user-service` | 512M |
| `mhw-project-service` | 8089 | `services/project-service` | 512M |
| `mhw-billing-service` | 8090 | `services/billing-service` | 512M |
| `mhw-collab-service` | 8091 | `services/collab-service` | 1G (ws 长连接) |
| `mhw-ai-orchestrator` | 8087 | `services/ai-orchestrator` | 1G (AI 长任务) |

### 4.2 启动 / 停止 / 重启

```bash
# 进入配置目录
cd infrastructure/pm2

# 启动 (默认 development)
pm2 start ecosystem.config.cjs

# 启动预发
pm2 start ecosystem.config.cjs --env staging

# 启动生产
pm2 start ecosystem.config.cjs --env production

# 看状态
pm2 list
pm2 status

# 重启单个
pm2 restart mhw-user-service

# 重启全部
pm2 restart ecosystem.config.cjs

# 0 停机热重启 (cluster 模式才生效, 我们单实例用不到)
pm2 reload ecosystem.config.cjs

# 停
pm2 stop mhw-user-service
pm2 stop all

# 从 pm2 列表删除 (下次 start 会重新拉)
pm2 delete ecosystem.config.cjs
```

### 4.3 日志

```bash
# 全部日志 (合并)
pm2 logs --lines 200

# 单个 app
pm2 logs mhw-user-service --lines 200

# 只看错误
pm2 logs mhw-user-service --err --lines 100

# 清空日志
pm2 flush

# 实时面板
pm2 monit
```

### 4.4 持久化 + 开机自启

```bash
# 启动后保存当前快照
pm2 save

# 开机自启 (Linux)
pm2 startup
# 按提示执行它给的命令

# 开机自启 (Windows) - 用 nssm 或 pm2-windows-startup
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

### 4.5 部署脚本 (远端)

```bash
# 第一次配置: 远端机器的 ssh 用户 / host / git 仓库
# 已在 deploy.production 里配好

# 在本地执行
pm2 deploy production setup
pm2 deploy production
```

---

## 5. Dev 脚本 (Windows)

### 5.1 dev-start.ps1

**位置**: `scripts/dev-start.ps1`

**功能**: 一键起 4 service + 4 portal, 全部后台跑

```powershell
# 正常启动
.\scripts\dev-start.ps1

# 演练 (打要执行的命令, 不真起)
.\scripts\dev-start.ps1 -WhatIf

# 只检查端口监听状态, 不启动
.\scripts\dev-start.ps1 -CheckOnly

# 跳过 postgres 端口检查 (postgres 跑别的机器时用)
.\scripts\dev-start.ps1 -SkipPostgres

# 只起 service, 不起 vite
.\scripts\dev-start.ps1 -SkipPortal
```

**实现要点**:
- `Start-Process` 拉后台, 重定向 stdout/stderr 到 `logs/dev/<name>.log`
- 写 `.run/<name>.pid` 文件存 PID
- 等 8s, 跑一次端口自检, 失败的给提示查日志

### 5.2 dev-stop.ps1

**位置**: `scripts\dev-stop.ps1`

**功能**: 一键停 dev-start 拉起来的所有进程, **不误杀其他 node**

```powershell
# 优雅停 (TERM, 等 3s)
.\scripts\dev-stop.ps1

# 强制停 (KILL, 不等)
.\scripts\dev-stop.ps1 -Force

# 停完顺手清 .run/*.pid
.\scripts\dev-stop.ps1 -Clean

# 演练
.\scripts\dev-stop.ps1 -WhatIf
```

**安全护栏**:
1. 只杀 `node / pnpm / npm / tsx` 进程
2. 只杀路径在 `D:\ManhuaWorks*` 下的进程
3. 只杀白名单端口 (3000/5174/5175/5180/8087-8091) 上的 PID
4. PID 文件 + 端口双源取 PID, 去重

### 5.3 状态查看

```powershell
# 看进程
Get-Process -Name node | Format-Table Id, ProcessName, StartTime, WorkingSet

# 看端口
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,5174,5175,5180,8087,8088,8089,8090,8091 } | Format-Table LocalPort, OwningProcess, @{n='Cmd';e={(Get-Process -Id $_.OwningProcess).ProcessName}}

# 看日志
Get-Content logs\dev\web.log -Wait -Tail 50
Get-Content logs\pm2\user-service-out.log -Tail 100
```

---

## 6. Windows 注意事项

### 6.1 路径分隔符

PowerShell 用 `\` , 写代码时统一用反斜杠:
```powershell
# ✅ 对
Set-Location D:\ManhuaWorks
$logFile = 'logs\dev\web.log'

# ❌ 错
Set-Location D:/ManhuaWorks
$logFile = 'logs/dev/web.log'
```

### 6.2 进程可见性

- `Start-Process -NoNewWindow` 起的后台进程, 在任务管理器能看到
- 但 stdout 重定向后, 控制台看不到, 只能 `Get-Content <log>`
- 要看实时日志, 用 PowerShell 别名:
  ```powershell
  function Tail-Logs { Get-Content logs\dev\*.log -Wait -Tail 50 }
  ```

### 6.3 端口冲突

| 端口 | 谁在用 | 解决 |
|------|--------|------|
| 3000 | 老项目 (如 React dev) | 改 web 的 vite.config.ts |
| 5432 | 多个 postgres 实例 | 改 DATABASE_URL |
| 8080 | api-gateway 老版本 | 已废弃, 让出 |
| 9090 | prometheus | 监控专用, 别跟业务混 |

### 6.4 防火墙

第一次跑, Windows Defender 会问要不要放行 `node.exe`:
- 开发环境: 选 "允许私有网络"
- 生产环境: 走 nginx 80/443, node 不暴露外网

### 6.5 反斜杠转义

JSON 字符串里的反斜杠要双写:
```json
{
  "log_file": "..\\..\\logs\\pm2\\user-service-combined.log"
}
```

---

## 7. 故障排查

### 7.1 端口被占

```powershell
# 症状
.\scripts\dev-start.ps1
# 写: ❌ web :3000 DOWN

# 排查
Get-NetTCPConnection -LocalPort 3000 -State Listen

# 看到是 PID 1234
Get-Process -Id 1234
# 看是哪个项目, 不在白名单就: Stop-Process -Id 1234 -Force
```

### 7.2 vite dev 启动失败

```powershell
# 看详细日志
Get-Content logs\dev\web.log.err -Tail 100

# 常见原因
# 1. 端口被占 → 7.1
# 2. 缺依赖 → cd apps\web && pnpm install
# 3. vite.config 写错 → 跟 git 上一版对比
```

### 7.3 service 启动后马上死

```powershell
# 看 error log
Get-Content logs\dev\user-service.log.err -Tail 100

# 常见原因
# 1. postgres 没起 → 7.4
# 2. .env 缺配置 → 跟 .env.example 对比
# 3. 端口被占 → 7.1
# 4. tsx watch 死循环 → pkill tsx 后重启
```

### 7.4 postgres 连不上

```powershell
# 1. 看进程
Get-Service postgresql*  # 找服务名
Get-Service -Name postgresql-x64-16  # 看状态

# 2. 启动
Start-Service postgresql-x64-16

# 3. 测试连接
psql -U mhw -d manhuaworks -h localhost -p 5432
# 没 psql 命令 → docker exec -it <pg-container> psql -U mhw

# 4. 检查 pg_hba.conf (trust / md5 / peer)
```

### 7.5 pm2 进程反复重启

```bash
# 看 error log
pm2 logs mhw-user-service --err --lines 100

# 常见
# 1. OOM → 调大 max_memory_restart
# 2. 端口被占 → lsof -i :8088 / netstat
# 3. 数据库连不上 → 7.4
# 4. 代码 bug → 看堆栈
```

### 7.6 nginx 502 Bad Gateway

```bash
# 1. 上游没起
pm2 list  # 看 5 个 app 是不是都 online

# 2. 端口不匹配
# nginx upstream 配的端口, 跟 service 监听的端口对一下

# 3. SELinux / iptables
# Linux: sudo setsebool -P httpd_can_network_connect 1

# 4. 看 nginx error log
tail -f /var/log/nginx/mhw.error.log
```

### 7.7 WebSocket 连不上

```powershell
# 1. 后端服务在跑?
Get-NetTCPConnection -LocalPort 8091 -State Listen

# 2. nginx 配的 rewrite 对不对
# /api/collab-ws → /ws, 路径要重写

# 3. 浏览器调试 → Network → WS → 看握手
#    HTTP/1.1 101 Switching Protocols = 成功
#    200 / 404 / 502 = 失败
```

### 7.8 前端 vite proxy 404

```powershell
# 症状: web 页面打开, /api/* 全 404
# 原因: vite proxy target 配错
# 解决: 改 apps\web\vite.config.ts 的 proxy.target

# 当前配置 (apps\web\vite.config.ts):
#   /api → http://localhost:8080  (api-gateway, 已废弃)
# 应该改成:
#   /api/auth → http://localhost:8088
#   /api/users → http://localhost:8088
#   /api/projects → http://localhost:8089
#   ...
```

---

## 8. 附录: 跟 L2-task-12 的关系

L2-task-12 (2026-06-08) 把项目搬上了 docker-compose, 这次 L4-C 是 docker 之外的一条 **直跑** 路径, 用于:

1. **开发**: 改代码立即生效 (docker 要 rebuild, 太慢)
2. **小规模预发**: 不想起 docker 的环境
3. **Windows 原生开发**: 跟 WSL / docker desktop 解耦

| 场景 | 用 docker | 用直跑 |
|------|-----------|--------|
| 改后端代码 | rebuild 镜像 (慢) | tsx watch 自动重启 ✅ |
| 改前端代码 | rebuild 镜像 (慢) | vite HMR 立即刷新 ✅ |
| 跑压测 | 起全套, 一次性 | 单独起需要的服务 ✅ |
| 内存占用 | 大 (镜像 + 容器) | 小 (直接 node) ✅ |
| 跟生产一致性 | 高 ✅ | 中 (路径 / 端口一致, 行为一致) |
| 启动速度 | 慢 (拉镜像) | 快 (秒级) ✅ |

> **结论**: docker 用于生产, 直跑用于开发。L4-C 的脚本只管直跑。

---

**文档结束。反馈 / 改错: 飞书找梁总, 或在 git 提 issue。**
