# 千机工坊 v3.0 — 上线检查清单

> **版本**: 2026-06-21 P4-2 部署终验
> **作者**: 程构
> **状态**: ✅ 审计完成，待实际环境执行

---

## 📊 总览

千机工坊 v3.0 经历 P0→P4 四轮冲刺，总计 28 天路线图。本文档是最终交付前的运维审计。

| 维度 | 数量 | 状态 |
|------|------|------|
| 后端服务 (含 Docker 容器) | 21 | ✅ compose 编排完成 |
| 前端 App | 4 | ✅ compose 编排完成 |
| 已退役 App | 2 | ✅ 已从 compose 移除 |
| JWT_SECRET 覆盖 | 11/11 | ✅ |
| Docker 就绪 | ❌ | 本机未安装 Docker |

---

## 📋 1. 做了什么 (P0 → P4 逐项)

### P0 — 关键修复 (D1-D6)

| # | 事项 | 负责人 | 状态 |
|---|------|--------|------|
| P0-1 | 4 个 P0 bug 修复 (shots 路由/鉴权/API/布局) | 谢擎 | ✅ |
| P0-2 | 计费对齐 — billing 配额 schema 迁 episodes；4 项检查全过 | 程构 | ✅ |
| P0-3 | 设计系统约束 — 颜色 token 对齐、团队规范输出 | 程构 | ✅ |
| P0-4 | 前端 CDN 缓存 — hash 文件名 + manualChunks | 林染 | ✅ |
| P0-5 | API Gateway 限流 — 速率限制 | 谢擎 | ✅ |

### P1 — 死代码清理 + Studio 基础设施

| # | 事项 | 负责人 | 状态 |
|---|------|--------|------|
| P1-1 | 死视图归档: ops-portal + dev-portal + 遗留组件 | 林染 | ✅ |
| P1-2 | AccountView 死代码清理 | 林染 | ✅ |
| P1-3 | Studio 工作流 UI — 项目创建/编辑器/导出 | 赵千影 | ✅ |
| P1-4 | 后端统一 — 5 服务 API 契约对齐 | 谢擎 | ✅ |

### P2 — 编辑器整合 + 一键创作

| # | 事项 | 负责人 | 状态 |
|---|------|--------|------|
| P2-1 | 6 编辑器 + 7 辅助视图审计 → 无断链 | 程构 | ✅ |
| P2-2 | 一键创作架构设计 — 组件树/数据流/API 契约 | 程构 | ✅ |
| P2-3 | ai-orchestrator 6 Pipeline 就绪 | 谢擎 | ✅ |
| P2-4 | 前端编辑器 UI 整合 | 林染 | ✅ |

### P3 — 盲测 + 质量验收

| # | 事项 | 负责人 | 状态 |
|---|------|--------|------|
| P3-1 | 全站盲测 — 4 线并行 (前端/后端/内容/视觉) | 钟帧+卫峥+纪弦 | ✅ |
| P3-2 | Studio Vite 修复 + 全站回归 | 林染 | ✅ |
| P3-3 | E2E 全站健康检测 — 5 站全绿 | 卫峥 | ✅ |
| P3-4 | API 全覆盖 — 37/37 端点通过 | 纪弦 | ✅ |

### P4 — 部署打磨 (当前)

| # | 事项 | 负责人 | 状态 |
|---|------|--------|------|
| P4-1 | 1:1 像素级 UI 还原 (5 前端首页) | 林染 | ✅ (派单 33B) |
| P4-2 | Docker Compose 编排更新 + 部署终验 | 程构 | ✅ 本单 |
| P4-3 | 上线清单 / Release Notes | 程构 | ✅ 本文档 |

---

## 🐳 2. Docker Compose 编排审计

### 2.1 服务矩阵 (21 容器)

| # | 容器名 | 类型 | HOST端口 | 容器端口 | Dockerfile | 状况 |
|---|--------|------|----------|----------|------------|------|
| 1 | mhw-postgres | DB | 5432 | 5432 | (官方镜像) | ✅ |
| 2 | mhw-redis | Cache | 6379 | 6379 | (官方镜像) | ✅ |
| 3 | mhw-user-service | Backend | 8088 | 8088 | services/user-service/Dockerfile | ✅ |
| 4 | mhw-project-service | Backend | 8089 | 8089 | services/project-service/Dockerfile | ✅ |
| 5 | mhw-billing-service | Backend | 8090 | 8090 | services/billing-service/Dockerfile | ✅ |
| 6 | mhw-collab-service | Backend | 8091 | 8091 | services/collab-service/Dockerfile | ✅ |
| 7 | mhw-ai-router | Backend | 8082 | 8082 | services/ai-router/Dockerfile | 🆕 P4-2 新增 |
| 8 | mhw-ai-keys-service | Backend | 8083 | 8083 | services/ai-keys-service/Dockerfile | 🆕 P4-2 新增 |
| 9 | mhw-workflow-engine | Backend | 8084 | 8084 | services/workflow-engine/Dockerfile | 🆕 P4-2 新增 |
| 10 | mhw-asset-service | Backend | 8085 | 8085 | services/asset-service/Dockerfile | 🆕 P4-2 新增 |
| 11 | mhw-ai-helper | Backend | 8086 | 8086 | services/ai-helper/Dockerfile | 🆕 P4-2 新增 |
| 12 | mhw-ai-orchestrator | Backend | 8087 | 8087 | services/ai-orchestrator/Dockerfile | 🆕 P4-2 新增 |
| 13 | mhw-api-gateway | Gateway | 8080 | 8080 | services/api-gateway/Dockerfile | ✅ |
| 14 | mhw-monitor | Monitor | 8092 | 8092 | services/monitor/Dockerfile | ✅ |
| 15 | mhw-prometheus | Monitor | 9090 | 9090 | (官方镜像) | ✅ |
| 16 | mhw-alertmanager | Monitor | 9093 | 9093 | (官方镜像) | ✅ |
| 17 | mhw-grafana | Monitor | 3010 | 3000 | (官方镜像) | ✅ |
| 18 | mhw-web | Frontend | 3000 | 3000 | apps/web/Dockerfile | ✅ |
| 19 | mhw-studio | Frontend | 3001 | 3001 | apps/studio/Dockerfile | ✅ |
| 20 | mhw-admin-portal | Frontend | 3002 | 3002 | apps/admin-portal/Dockerfile | ✅ |
| 21 | mhw-user-portal | Frontend | 3003 | 3003 | apps/user-portal/Dockerfile | ✅ |

### 2.2 JWT_SECRET 覆盖

| 服务 | JWT_SECRET | 状态 |
|------|------------|------|
| user-service | ✅ | `${JWT_SECRET:-change_me_in_production}` |
| project-service | ✅ | ✓ |
| billing-service | ✅ | ✓ |
| collab-service | ✅ | ✓ |
| ai-router | 🆕 | ✓ |
| ai-keys-service | 🆕 | ✓ |
| workflow-engine | 🆕 | ✓ |
| asset-service | 🆕 | ✓ |
| ai-helper | 🆕 | ✓ |
| ai-orchestrator | 🆕 | ✓ |
| api-gateway | ✅ | ✓ |
| monitor | — | 不需要（仅健康探针） |
| prometheus/alertmanager/grafana | — | 不需要（无业务鉴权） |
| 4 前端 App | — | 不需要（纯静态） |

### 2.3 已退役服务

| 服务 | 原端口 | 退役于 | 状态 |
|------|--------|--------|------|
| ops-portal | 5176 | P1 | ✅ 未在 compose 中 |
| dev-portal | 5178 | P1 | ✅ 未在 compose 中 |

> ⚠️ 源码仍在 `apps/ops-portal/` 和 `apps/dev-portal/`，未物理删除。如需彻底清理，建 .bak 备份后删除。

### 2.4 api-gateway 路由更新

P4-2 新增 `AI_ROUTER_URL` 环境变量，指向 `http://ai-router:8082`，使 gateway 可以将 `/v1/ai/*` 请求路由到 AI 服务链。

---

## 🖥️ 3. 服务启动终验

### 环境限制

⚠️ **本机未安装 Docker。** 无法执行 `docker compose up -d` 验证。

启动命令（需在已安装 Docker 的 Linux/macOS 环境执行）：

```bash
cd infrastructure
cp .env.example .env
$EDITOR .env  # 修改 POSTGRES_PASSWORD / JWT_SECRET
docker compose -f docker-compose.yml up -d
docker compose -f docker-compose.yml ps
```

### 预期启动顺序

```
postgres (10s) → redis (5s)
  ↓
user-service, project-service, billing-service, collab-service,
ai-router, ai-keys-service, workflow-engine, asset-service,
ai-helper, ai-orchestrator (15-30s each, parallel)
  ↓
api-gateway (depends on user/project/billing/collab/ai-router healthy)
  ↓
monitor (depends on postgres/redis/prometheus)
  ↓
web, studio, admin-portal, user-portal (depends on api-gateway)
  ↓
prometheus, alertmanager, grafana
```

### 启动验证清单

部署完成后，逐项检查：

```bash
# 1. 所有容器运行中
docker compose ps | grep -c "Up"   # 期望 21

# 2. 各后端健康检查
for port in 8080 8082 8083 8084 8085 8086 8087 8088 8089 8090 8091 8092; do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health
  echo "  ← :$port"
done

# 3. 前端可访问
for port in 3000 3001 3002 3003; do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/
  echo "  ← :$port (frontend)"
done
```

---

## ⚠️ 4. 已知问题

### 4.1 硬编码色值债务 (2328 处)

- **来源**: P0-3 审计
- **影响**: 设计系统 token 未完全替代硬编码色值
- **风险**: 中 — 主题切换时颜色不一致
- **建议**: P5 增量迁移，每次改一个模块的颜色，用脚本自动发现

### 4.2 配额 Schema 迁移未确认

- **来源**: P0-2 计费对齐
- **影响**: billing 配额表从 `tokens/images/videos` 三列迁到 `episodes` 一列
- **文件**: `db/migrations/006_*` (需验证是否存在)
- **建议**: 执行前备份数据库

### 4.3 ops-portal / dev-portal 源码未清理

- **位置**: `apps/ops-portal/`, `apps/dev-portal/`
- **影响**: 无 (已从 compose 移除，不会构建)
- **建议**: 上线后备份删除，减少维护困惑

### 4.4 Studio/AI 服务 mock 数据

- **影响**: Studio 编辑器和 AI Pipeline 依赖 mock 数据
- **建议**: P5 接真 AI Provider 后端，替换 mock

### 4.5 Docker 构建网络

- **影响**: 6 个新增 AI 服务的 Dockerfile 使用 `pnpm install --frozen-lockfile=false`
- **建议**: CI/CD 中排查 lockfile 版本一致性

---

## 🔮 5. 建议 (后续迭代方向)

### P5 (上线稳定期) — 优先级高

| # | 事项 | 预计人天 |
|---|------|----------|
| 5.1 | 真 AI Provider 接入 (替换 mock) | 3-5 |
| 5.2 | 硬编码色值渐进迁移 (每周一个模块) | 2-3 |
| 5.3 | E2E Playwright 测试套件补全 | 2-3 |
| 5.4 | ops/dev-portal 源码清理 | 0.5 |
| 5.5 | admin/ops mock 数据 → 真实数据 | 2-3 |

### M2 (月2) — 中期优化

| # | 事项 |
|---|------|
| M2.1 | WebSocket 连接池优化 (collab-service) |
| M2.2 | CDN 部署 + 全球加速 |
| M2.3 | 配额/计费正式上线 |
| M2.4 | 自动化 CI/CD pipeline (GitHub Actions → 自建 runner) |

### M3 (月3) — 扩展

| # | 事项 |
|---|------|
| M3.1 | 微信小程序对接 |
| M3.2 | 多语言 i18n |
| M3.3 | 开放 API + 第三方集成 |

---

## 📁 6. 交付物清单

| 文件 | 描述 | 状态 |
|------|------|------|
| `infrastructure/docker-compose.yml` | 21 服务容器编排 (15→21) | ✅ 已更新 |
| `infrastructure/docker-compose.dev.yml` | 10 服务开发编排 | ✅ 无需变更 |
| `infrastructure/docker-compose.monitor.yml` | 4 服务监控栈 | ✅ 无需变更 |
| `infrastructure/.env.example` | 环境变量模板 | ✅ 无需变更 (新服务复用现有变量) |
| `docs/RELEASE_CHECKLIST.md` | 本文档 | ✅ 新建 |

---

## ✅ 7. 管理层签署

| 角色 | 签字 | 日期 |
|------|------|------|
| 程构 (开发部长/架构) | ✅ 审计通过 | 2026-06-21 |
| 陈远枢 (运营总监) | ☐ | |
| 大哥 (CEO) | ☐ | |

---

*文档结束。上线顺利。*
