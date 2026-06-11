# ManhuaWorks 开发部统筹计划

> **编制**：程构 🔮 开发部长
> **日期**：2026-06-10 13:00
> **版本**：v1.0
> **上游文档**：谢擎 SERVICE_CALL_CHAIN (71 链路) + 林染 BUSINESS_LOGIC_FLOW (196 节点) + 林染 MOCKUP INDEX (28 张) + 林染 MEMORY (派单 20 答 5 问)
> **用途**：梁总/虾总助审阅 → 派单 22 (谢擎后端改造) → 派单 23 (卫峥/纪弦/路寒测试验收)

---

## 一、5 服务改造范围

### 1.1 user-service (:8088) — Express, 状态 ✅ 运行中

| 维度 | 现状 | 需要改 |
|------|------|--------|
| 鉴权 | `/auth/login`, `/auth/login-pwd`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/me`, `/me/password` 全部就位 | 无 |
| 用户管理 | `/me` GET 用户自身信息 | **新增** `/admin/users` 列表 (admin-portal)、`/admin/users/:id` 启禁用/改角色 |
| BYOK | `/user/api-keys` 增删查改 + `/user/api-keys/:id/reveal` | 确认 reveal 一次性显示逻辑正确 |
| 订阅 | `/subscriptions` 代理到 billing-service | 确认代理链路完整 |
| Admin 统计 | 无 | **新增** `/admin/stats` (总用户数/新注册/在线) |
| **改造量** | — | **2 新端点 + 1 验证** |

### 1.2 project-service (:8089) — Express, 状态 ⚠️ 未启 (shots 端点未实现)

| 维度 | 现状 | 需要改 |
|------|------|--------|
| 项目 CRUD | `/projects` GET/POST/PATCH/DELETE 就位 | 无 |
| 分镜 (shots) | ⚠️ **未实现** (程构已知 bug #1) | **新增** `/projects/:id/shots` GET/POST/PATCH/DELETE (4 端点) |
| 场景 (scenes) | ⚠️ **未实现** | **新增** `/scenes` GET/POST/PATCH/DELETE (4 端点) |
| 角色 | `/characters` GET/POST 就位 | **补** PATCH `/characters/:id`, DELETE `/characters/:id` |
| 鉴权 | authMiddleware 已就位 | 确认 list 端点 (GET /projects, GET /characters, GET /scenes) 全部过 authMiddleware (已知 bug #2) |
| Admin 项目 | 无 | **新增** `/admin/projects` (全局项目列表/审核/删除) |
| **改造量** | — | **10+ 端点 (shots 4 + scenes 4 + characters 补 2 + admin)** — **本项目改造量最大** |

### 1.3 collab-service (:8091) — Express+WS, 状态 ⚠️ 未启

| 维度 | 现状 | 需要改 |
|------|------|--------|
| 团队 | `/teams` POST/GET 就位 | **补** PATCH `/teams/:id` (改名), DELETE `/teams/:id` |
| 邀请 | `/teams/:id/invitations` POST 就位 | **补** GET `/teams/:id/invitations` (邀请列表), POST `/teams/:id/invitations/:id/accept` |
| 成员管理 | 无 | **新增** POST `/teams/:id/members` (添加成员), DELETE `/teams/:id/members/:userId` |
| WebSocket | `/ws?projectId=x` 就位 | 确认握手鉴权+房间逻辑 |
| 项目邀请 | `/collab/invite` 就位 | 确认 |
| **改造量** | — | **5 端点补全 + 1 WS 验证** |

### 1.4 billing-service (:8090) — Express, 状态 ✅ 运行中

| 维度 | 现状 | 需要改 |
|------|------|--------|
| 余额 | `/billing/balance` GET 就位 | 无 |
| 充值 | `/billing/recharge` POST (5 步流程) 就位 | 无 |
| 发票 | `/billing/invoices` GET 就位 | 无 |
| 成本日志 | `/billing/cost-logs` GET 就位 | 无 |
| 订阅 | `/subscriptions` GET/POST 就位 | 确认订阅升降级流程 |
| 退款 | `/refunds` POST (人工审核) 就位 | **新增** `/refunds/:id/approve` (admin 审批), `/refunds/:id/reject` |
| Admin 计费 | 无 | **新增** `/admin/billing/overview` (总营收/充值笔数/活跃订阅) |
| 事件监听 | Redis Pub-Sub (`ai.task.completed`, `workflow.run.completed`) 就位 | 确认去重 (幂等扣费) |
| **改造量** | — | **3 新端点 + 1 幂等验证** |

### 1.5 ai-orchestrator (:8087) — Express, 状态 ✅ 运行中

| 维度 | 现状 | 需要改 |
|------|------|--------|
| Pipeline 任务 | `/v1/orchestrator/jobs` POST (P1-P5), `/v1/orchestrator/jobs/:id` GET | 无 |
| 用户任务列表 | 无 | **新增** `/v1/orchestrator/jobs?userId=xxx` (按用户查历史任务) |
| Pipeline 统计 | 无 | **新增** `/v1/orchestrator/stats` (各 Pipeline 成功率/平均耗时) |
| 服务间鉴权 | x-api-key 就位 | 确认 |
| **改造量** | — | **2 新端点** |

### 服务改造量汇总

| 服务 | 端口 | 需改造 | 新端点 | 复杂度评级 |
|------|------|--------|--------|-----------|
| **project-service** | 8089 | ✅ 最大 | 10+ | 🔴 高 (shots+scenes 全链路) |
| **collab-service** | 8091 | ✅ 中等 | 5 | 🟡 中 (团队管理补全) |
| **billing-service** | 8090 | ✅ 轻量 | 3 | 🟡 中 (admin+退款流) |
| **user-service** | 8088 | ✅ 轻量 | 2 | 🟢 低 (admin 端点) |
| **ai-orchestrator** | 8087 | ✅ 轻量 | 2 | 🟢 低 (查询+统计) |
| **总计** | — | **5 服务** | **22+** | — |

---

## 二、38 页面后端依赖 (按页面列接口)

### web (4 页面)

| # | 页面 | 前端文件 | 需要的后端端点 | 所属服务 | 状态 |
|---|------|---------|---------------|---------|------|
| 1 | 产品首页 | `web-home` | 无 (静态) | — | ✅ |
| 2 | 作品展示 | `web-showcase` | `GET /api/v1/projects?public=true` | project-service | ⚠️ 需加 public 字段 |
| 3 | 登录 | `web-login` | `POST /api/v1/auth/login` + `POST /api/v1/auth/login-pwd` | user-service | ✅ |
| 4 | 用户工作台 | `web-dashboard` | `GET /api/v1/me` + `GET /api/v1/projects` + `GET /api/v1/billing/balance` | user/project/billing | ✅ |

### studio (18 页面：9 主页 + 9 子功能)

| # | 页面 | 前端文件 | 需要的后端端点 | 所属服务 | 状态 |
|---|------|---------|---------------|---------|------|
| 5 | Studio 首页 | `studio-home` | `GET /api/v1/me` + `GET /api/v1/projects?recent` | user/project | ✅ |
| 6 | 角色管理 | `studio-characters` | `GET/POST /api/v1/characters` + `PATCH/DELETE /api/v1/characters/:id` | project-service | ⚠️ PATCH/DELETE 待补 |
| 7 | 场景管理 | `studio-scenes` | `GET/POST/PATCH/DELETE /api/v1/scenes` | project-service | 🔴 **未实现** |
| 8 | 工作流设计器 | `studio-workflow` | `GET/POST /api/v1/workflows` + `POST /api/v1/workflows/start` | workflow-engine (不在 5 服务范围内) | ✅ (由 workflow-engine 负责) |
| 9 | 项目编辑器 | `studio-project` | `GET/PATCH /api/v1/projects/:id` + `GET /api/v1/projects/:id/shots` | project-service | ⚠️ shots 待实现 |
| 10 | 工具箱 | `studio-tools` | `POST /api/v1/ai/image/generate` + `/ai/video/generate` + `/ai/tts` + 6 helper 端点 | ai-router + ai-helper (不在 5 服务范围内) | ✅ |
| 11 | 导出中心 | `studio-export` | `POST /api/v1/exports` (新) | project-service 或新端点 | 🔴 **未实现** |
| 12 | 素材库 | `studio-materials` | `GET/POST /api/v1/assets` | asset-service (不在 5 服务范围内) | ✅ (由 asset-service 负责) |
| 13 | 占位页 | `studio-placeholder` | 无 (静态) | — | ✅ |
| 14 | 分镜编辑 | `studio-shot-editor` | `GET/PATCH /api/v1/projects/:id/shots/:shotId` | project-service | 🔴 **未实现** |
| 15 | 分镜宫格 | `studio-storyboard-grid` | `GET /api/v1/projects/:id/shots` + `PATCH /api/v1/projects/:id/shots/reorder` | project-service | 🔴 **未实现** |
| 16 | 角色详情编辑 | `studio-character-edit` | `GET/PATCH /api/v1/characters/:id` | project-service | ⚠️ PATCH 待补 |
| 17 | 场景详情编辑 | `studio-scene-edit` | `GET/PATCH /api/v1/scenes/:id` | project-service | 🔴 **未实现** |
| 18 | 工作流节点配置 | `studio-node-config` | 无 (前端配置) | — | ✅ |
| 19 | 项目设置 | `studio-project-settings` | `PATCH /api/v1/projects/:id` + `GET/POST /api/v1/teams` | project/collab | ⚠️ collab 待验证 |
| 20 | 导出参数设置 | `studio-export-settings` | `GET /api/v1/exports/presets` | 新端点 | 🔴 **未实现** |
| 21 | 新建项目向导 | `studio-new-project-wizard` | `POST /api/v1/projects` + `POST /api/v1/characters` | project-service | ✅ |
| 22 | (studio 工具调用) | — | `/api/v1/helper/prompt-optimize`, `/inspire`, `/character-check`, `/style-check`, `/content-scan`, `/rename` | ai-helper (不在 5 服务范围内) | ✅ |

### user-portal (7 页面：6 主页 + 1 子功能)

| # | 页面 | 前端文件 | 需要的后端端点 | 所属服务 | 状态 |
|---|------|---------|---------------|---------|------|
| 23 | 用户工作台 | `portal-dashboard` | `GET /api/v1/me` + `GET /api/v1/projects` + `GET /api/v1/billing/balance` | user/project/billing | ✅ |
| 24 | 首页 | `portal-home` | `GET /api/v1/me` + `GET /api/v1/projects` | user/project | ✅ |
| 25 | 我的项目 | `portal-projects` | `GET/POST/PATCH/DELETE /api/v1/projects` | project-service | ✅ |
| 26 | 团队协作 | `portal-team` | `GET/POST /api/v1/teams` + `POST /api/v1/teams/:id/invitations` + `POST /api/v1/collab/invite` | collab-service | ⚠️ 补成员管理 |
| 27 | API 密钥 | `portal-apikeys` | `GET/POST/DELETE /api/v1/user/api-keys` + `GET /api/v1/user/api-keys/:id/reveal` | user-service | ✅ |
| 28 | 设置 | `portal-settings` | `GET/PATCH /api/v1/me` + `GET/POST /api/v1/subscriptions` | user-service | ✅ |
| 29 | Profile 编辑 | `portal-profile-edit` | `PATCH /api/v1/me` (avatar upload) | user-service | ⚠️ avatar upload 待确认 |

### admin-portal (7 页面，mockup 待补)

| # | 页面 | 需要的后端端点 | 所属服务 | 状态 |
|---|------|---------------|---------|------|
| 30 | Admin 仪表盘 | `GET /api/v1/admin/stats` (用户数/项目数/收入/活跃) | user-service + billing-service | 🔴 **未实现** |
| 31 | 用户管理 | `GET /api/v1/admin/users` + `PATCH /api/v1/admin/users/:id` (启禁用/改角色) | user-service | 🔴 **未实现** |
| 32 | 项目管理 | `GET/DELETE /api/v1/admin/projects` (全局列表/审核/删除) | project-service | 🔴 **未实现** |
| 33 | 计费管理 | `GET /api/v1/admin/billing/overview` + `GET /api/v1/admin/refunds` + `POST /api/v1/refunds/:id/approve` | billing-service | 🔴 **未实现** |
| 34 | AI Key 管理 | `GET /api/v1/admin/api-keys` (平台密钥池) | user-service | 🔴 **未实现** |
| 35 | 审计日志 | `GET /api/v1/admin/audit-logs` | user-service (新表) | 🔴 **未实现** |
| 36 | 系统设置 | `GET/PATCH /api/v1/admin/settings` | user-service (新表) | 🔴 **未实现** |

### ops-portal (3 页面，mockup 待补)

| # | 页面 | 需要的后端端点 | 所属服务 | 状态 |
|---|------|---------------|---------|------|
| 37 | Ops 仪表盘 | `GET /api/v1/ops/health` (各服务心跳/CPU/内存) + `GET /api/v1/ops/metrics` (QPS/延迟/错误率) | 新 ops 模块 (可附到 user-service 或独立) | 🔴 **未实现** |
| 38 | 服务管理 | `GET /api/v1/ops/services` + `POST /api/v1/ops/services/:id/restart` | 新 ops 模块 | 🔴 **未实现** |
| 39 | 部署管理 | `POST /api/v1/ops/deploy` (触发 CI/CD) + `GET /api/v1/ops/deploy/history` | 新 ops 模块 | 🔴 **未实现** |

### 后端依赖统计

| 服务 | 已就位端点 | 新端点需求 | 页面覆盖 |
|------|-----------|-----------|---------|
| user-service | 8 | **8** (admin stats/users/audit/settings + ops 健康检查) | 10 页 |
| project-service | 6 | **12** (shots 4 + scenes 4 + characters 2 + admin 2) | 14 页 |
| collab-service | 4 | **5** (团队补全 + 成员管理) | 2 页 |
| billing-service | 7 | **3** (admin overview + refund approve/reject) | 3 页 |
| ai-orchestrator | 2 | **2** (jobs list + stats) | 2 页 |
| **总计 (5 服务)** | **27** | **30** | **31 页 (扣除静态/AI/资产页)** |

> 📌 注：`workflow-engine` (:8084) / `ai-router` (:8083) / `ai-helper` (:8086) / `asset-service` (:8085) 不在本次 5 服务改造范围内，由各自服务负责团队维护。页面 #8/10/12/18/22 依赖这些服务，但不计入 5 服务改造量。

---

## 三、Mockup 覆盖：28 张已有 + 10 张要补

### 3.1 已有 28 张 (林染 派单 17 + 追补)

| 站点 | 数量 | 分辨率 | 覆盖页面 |
|------|------|--------|---------|
| web | 4 | 1440×900 | home / showcase / login / dashboard |
| studio (主页) | 9 | 1920×1080 | home / characters / scenes / workflow / project / tools / export / materials / placeholder |
| studio (子功能) | 9 | 1920×1080 | shot-editor / storyboard-grid / character-edit / scene-edit / node-config / project-settings / export-settings / new-project-wizard / (portal-profile-edit 归 user-portal) |
| user-portal | 6 | 1440×900 | dashboard / home / projects / team / apikeys / settings |
| **小计** | **28** | — | — |

### 3.2 要补 10 张 (派单 19 林染)

| 站点 | 数量 | 页面 | 优先级 |
|------|------|------|--------|
| **admin-portal** | **7** | dashboard / users / projects / billing / ai-keys / audit / settings | P1 |
| **ops-portal** | **3** | dashboard / services / deploy | P1 |
| **小计** | **10** | — | — |

### 3.3 Mockup 补图优先级

```
P0 (林染 派单 19): admin-portal 7 张 + ops-portal 3 张
   → admin 设计语言与 studio 一致 (Linear/Notion 深色 + 紫蓝渐变)
   → ops 偏监控面板风格 (Grafana-like 暗色仪表盘)
```

---

## 四、后端改造优先级

### P0 — 核心链路：不完成无法跑通主要功能 (6 人天)

| # | 任务 | 服务 | 人天 | 理由 |
|---|------|------|------|------|
| P0-1 | **shots CRUD 完整实现** | project-service | 2 | 分镜编辑/宫格/项目详情 3 页均依赖，是创作链路核心 |
| P0-2 | **scenes CRUD 完整实现** | project-service | 2 | 场景管理/场景编辑 2 页依赖，与角色并列素材库 |
| P0-3 | **characters PATCH/DELETE** | project-service | 0.5 | 角色编辑页依赖，补全 CRUD |
| P0-4 | **鉴权链补全** | 全部 5 服务 | 1 | list 端点强制鉴权 (已知 bug #2)，统一 authMiddleware |
| P0-5 | **5 服务接口规范对齐** | 全部 5 服务 | 0.5 | 字段名/分页格式/错误码统一，跨服务一致性 |
| **P0 小计** | | | **6** | |

### P1 — 管理/运营功能：admin + ops (7 人天)

| # | 任务 | 服务 | 人天 | 理由 |
|---|------|------|------|------|
| P1-1 | **admin 用户管理** (list/patch) | user-service | 1 | admin-portal 用户页依赖 |
| P1-2 | **admin 项目管理** (list/delete) | project-service | 1 | admin-portal 项目页依赖 |
| P1-3 | **admin 计费管理** (overview/refunds) | billing-service | 1 | admin-portal 计费页 + 退款审批 |
| P1-4 | **admin 统计仪表盘** (stats endpoint) | user-service | 0.5 | admin-portal 首页依赖 |
| P1-5 | **admin 审计+设置** (audit/settings) | user-service | 1 | admin-portal 审计/设置页 |
| P1-6 | **ops 健康检查** (health/metrics) | user-service (新模块) | 1 | ops-portal 仪表盘依赖 |
| P1-7 | **ops 部署管理** (deploy trigger/history) | user-service (新模块) | 0.5 | ops-portal 部署页 |
| P1-8 | **collab 团队管理补全** | collab-service | 1 | portal-team 成员管理依赖 |
| **P1 小计** | | | **7** | |

### P2 — 完善/优化 (3.5 人天)

| # | 任务 | 服务 | 人天 | 理由 |
|---|------|------|------|------|
| P2-1 | **导出端点** (export presets + trigger) | project-service | 1 | studio-export 依赖 |
| P2-2 | **WebSocket 协作验证** | collab-service | 0.5 | 确认实时同步房间逻辑 |
| P2-3 | **性能优化** (索引/缓存) | 全部服务 | 1 | DB 查询索引 + Redis 缓存策略 |
| P2-4 | **错误处理标准化** | 全部服务 | 0.5 | `/me` 错误码对齐谢擎标准 |
| P2-5 | **退款幂等验证** | billing-service | 0.5 | Redis Pub-Sub 扣费去重 |
| **P2 小计** | | | **3.5** | |

---

## 五、改造工期估算 (人天，真实)

### 5.1 前提假设
- **后端开发**：谢擎 1 人 (全栈 Node.js)
- **前端对接**：林染并行 (mockup → Vue，不计入后端人天)
- **数据库**：PostgreSQL schema 由程构审核 (独立人天)
- **测试**：卫峥/纪弦/路寒 (派单 23 独立人天)
- **不含**：workflow-engine / ai-router / ai-helper / asset-service 改造 (不在 5 服务范围)

### 5.2 工期估算表

| 阶段 | 人天 | 日历天 (1人) | 说明 |
|------|------|-------------|------|
| **P0 核心链路** | 6 | **6 天** | shots+scenes CRUD + 鉴权 + 规范对齐 |
| **P1 管理功能** | 7 | **7 天** | admin 7 页 + ops 3 页 + collab 团队 |
| **P2 完善优化** | 3.5 | **3.5 天** | 导出 + WS + 性能 + 错误处理 |
| **小计** | **16.5** | **16.5 天 ≈ 3.3 周** | 1 人全栈 |
| **程构审核 (schema/CR)** | 3 | 穿插 | 每个 P0/P1 任务完成后三审 |
| **总计 (含程构审核)** | **19.5** | **≈ 4 周** | |

### 5.3 如果不能 1 人全栈 > 建议招聘后端二把手

| 方案 | 人数 | 日历天 | 可并行 |
|------|------|--------|--------|
| A (现状) | 谢擎 × 1 | 16.5 天 | project-service → admin → ops |
| B (招聘后端) | 谢擎 + 新人 × 2 | 10 天 | 谢擎 (project) ∥ 新人 (admin+ops) |

### 5.4 不要拍脑袋的关键数据

| 数据点 | 来源 | 值 |
|--------|------|-----|
| shots 端点量 | 调用链文档 + 林染流程图 | GET/POST/PATCH/DELETE 4 个 → 含 DB migration + route + test ± 2 人天 |
| scenes 端点量 | 同上 | 同 shots 模式 → 2 人天 |
| admin 端点量 | admin 7 页需求反推 | 6-8 个端点 → 3 人天 |
| ops 端点量 | ops 3 页需求反推 | 4-5 个端点 → 1.5 人天 |
| 已有端点覆盖率 | 谢擎调用链统计 | 71 链路中约 60% 就位，缺 shots/scenes/admin/ops |

---

## 六、谢擎任务清单 (派单 22 输入)

> 📋 详见独立文件：`D:\ManhuaWorks\docs\architecture\XIEQING_TASKS_2026-06-10.md`

### 6.1 谢擎总任务量

| 优先级 | 任务数 | 人天 | ETA |
|--------|--------|------|-----|
| P0 | 5 | 6 | 派单 22 日起 6 天 |
| P1 | 8 | 7 | P0 完成后 7 天 |
| P2 | 5 | 3.5 | P1 完成后 3.5 天 |
| **合计** | **18** | **16.5** | **约 3.3 周** |

### 6.2 谢擎每日产出要求 (P0 阶段)

| 天 | 产出 | 验收标准 |
|----|------|---------|
| D1 | shots schema migration + GET/POST 端点 | cURL 创建分镜成功 |
| D2 | shots PATCH/DELETE + scenes schema + GET/POST | cURL 完整 CRUD |
| D3 | scenes PATCH/DELETE + characters PATCH/DELETE | 场景编辑页数据就绪 |
| D4 | 鉴权链补全 (5 服务 list 端点加 authMiddleware) | 未登录调 list → 401 |
| D5 | 接口规范对齐 (字段名/分页/错误码) + 5 服务一致性自检 | grep 检查字段一致性 |
| D6 | P0 集成测试 + 林染前端对接验证 | 林染 3 页调通 (分镜编辑+宫格+场景编辑) |

---

## 七、测试验收点 (派单 23 卫峥/纪弦/路寒输入)

### 7.1 project-service (P0)

| # | 验收点 | 方法 |
|---|--------|------|
| T1 | `POST /api/v1/projects/:id/shots` 创建分镜 → 201 + 返回 shot 对象 | cURL + Jest |
| T2 | `GET /api/v1/projects/:id/shots` 返回分镜列表 → 200 + 数组 | cURL + Jest |
| T3 | `PATCH /api/v1/projects/:id/shots/:shotId` 更新机位/对白 → 200 | cURL + Jest |
| T4 | `DELETE /api/v1/projects/:id/shots/:shotId` 删除分镜 → 200 | cURL + Jest |
| T5 | 非 owner 调 shots 端点 → 403 | cURL |
| T6 | 未登录调 shots 端点 → 401 | cURL |

### 7.2 project-service scenes (P0)

| # | 验收点 | 方法 |
|---|--------|------|
| T7 | `POST /api/v1/scenes` 创建场景 → 201 | cURL + Jest |
| T8 | `GET /api/v1/scenes?projectId=xxx` 返回场景列表 | cURL + Jest |
| T9 | `PATCH /api/v1/scenes/:id` 更新光照/描述 → 200 | cURL + Jest |
| T10 | `DELETE /api/v1/scenes/:id` 删除场景 → 200 | cURL + Jest |

### 7.3 鉴权补全 (P0)

| # | 验收点 | 方法 |
|---|--------|------|
| T11 | `GET /api/v1/projects` 无 token → 401 | cURL |
| T12 | `GET /api/v1/characters` 无 token → 401 | cURL |
| T13 | `GET /api/v1/teams` 无 token → 401 | cURL |
| T14 | `GET /api/v1/subscriptions` 无 token → 401 | cURL |

### 7.4 admin 端点 (P1)

| # | 验收点 | 方法 |
|---|--------|------|
| T15 | `GET /api/v1/admin/stats` admin 可见 → 200 + 统计数 | cURL (admin JWT) |
| T16 | 普通用户调 admin 端点 → 403 | cURL (user JWT) |
| T17 | `PATCH /api/v1/admin/users/:id` 启禁用用户 → 200 | cURL (admin JWT) |

### 7.5 5 服务接口一致性 (P0)

| # | 验收点 | 方法 |
|---|--------|------|
| T18 | 所有返回 JSON 格式为 `{ code, message, data? }` | grep 5 服务 response |
| T19 | 分页字段统一 (`limit`/`offset` 或 `page`/`pageSize`) | 谢擎标准文档 |
| T20 | 错误码表与谢擎规范一致 (40100/40101/40300/40400/50000) | grep 5 服务 error codes |

### 7.6 林染前端对接验收 (P0 完成时)

| # | 验收点 | 方法 |
|---|--------|------|
| F1 | studio-shot-editor 调通 shots CRUD → 创建/编辑/删除分镜正常 | E2E 浏览器 |
| F2 | studio-storyboard-grid 调通 shots 列表 → 宫格视图有数据 | E2E 浏览器 |
| F3 | studio-scene-edit 调通 scenes CRUD → 编辑场景正常 | E2E 浏览器 |
| F4 | studio-character-edit 调通 characters PATCH → 编辑角色属性正常 | E2E 浏览器 |

---

## 八、程构审核 Checklist (派单 22 每任务必过)

- [ ] schema 字段与 `BUSINESS_LOGIC_FLOW` + `API_REFERENCE` 一致
- [ ] 鉴权链完整 (`authMiddleware` 每个端点必过)
- [ ] 错误码规范: `{ code, message, data? }` (谢擎标准)
- [ ] DB 操作有 try/catch + 500 不返 stack trace
- [ ] 接口设计 5 服务间一致 (字段名/格式/分页)
- [ ] 无循环依赖 (5 服务间调用链不闭环)
- [ ] 无临时方案 (无 `// TODO: fix later`)

---

## 九、风险提示

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| shots 端点 schema 设计返工 | 中 | P0 延迟 1 天 | 程构先审 schema 再让谢擎写代码 |
| scenes 与 shots 数据模型重复 | 低 | P0 延迟 0.5 天 | 先画 ER 图确认字段 |
| 鉴权中间件引入后前端 401 大面积报错 | 中 | 前端修复 1 天 | 林染同步改 axios interceptor 加 token |
| admin/ops mockup 未出，后端先写 | 高 | P1 返工 | 林染 P1 mockup 必须在谢擎 P1 编码前 2 天完成 |
| billing 扣费幂等 | 低 | 财务事故 | Redis 事件加 `eventId` + billing 去重表 |

---

> **程构署名**：本计划基于 4 上游文档（谢擎 71 链路 + 林染 196 节点流程图 + 林染 28 张 mockup 索引 + 林染 12:55 答 5 问），所有端点/端口/服务状态均来自真实代码/文档，零拍脑袋。工期按 1 人全栈 Node.js + Drizzle + PostgreSQL 经验估算，含 schema/route/test/对接 4 步。
>
> **下步**：虾总助→派单 22 (谢擎按 XIEQING_TASKS 执行) + 派单 23 (卫峥/纪弦/路寒按测试验收点执行)
