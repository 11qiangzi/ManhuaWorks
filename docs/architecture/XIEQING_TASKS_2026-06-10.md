# 谢擎后端改造任务清单

> **编制**：程构 🔮 开发部长
> **日期**：2026-06-10 13:00
> **版本**：v1.0
> **给**：谢擎 🗄️ 开发部后端
> **输入文件**：`DEV_TEAM_PLAN_2026-06-10.md` (本文件配合使用)
> **上游文档**：SERVICE_CALL_CHAIN (自己写的, 71 链路) + BUSINESS_LOGIC_FLOW (林染, 196 节点) + MOCKUP INDEX (林染, 28 张)
> **模式**：每任务 → 程构审 schema → 谢擎写 route + test → 林染对接验证

---

## 全局约束 (程构一审必过)

1. **所有端点** 返回格式：`{ code: 0, message: "ok", data: {...} }` (谢擎自家标准)
2. **所有端点** (除 `/auth/login`, `/auth/register`, `/auth/refresh`) 过 `authMiddleware`
3. **所有 DB 操作** 含 try/catch → 500 不返 stack trace
4. **分页** 统一 `?offset=N&limit=N`，返回 `{ items: [], total: N }`
5. **错误码** 按谢擎标准：40000/40100/40300/40400/40900/50000
6. **DB migration** 先建 schema → 程构审核通过 → 再写 route

---

## 一、project-service (:8089) — P0 核心

> 路径：`services/project-service/src/`

### 任务 P0-1：shots schema + migration + CRUD (2 人天)

| 子任务 | 文件 | 改动 | 验收 |
|--------|------|------|------|
| P0-1a | `db/schema.ts` | 新增 `shots` 表：`id(uuid)`, `project_id(uuid FK→projects)`, `shot_number(int)`, `camera_angle(varchar)`, `camera_movement(varchar)`, `duration_sec(float)`, `transition(varchar)`, `dialogue(text)`, `description(text)`, `style_override(jsonb)`, `sort_order(int)`, `created_at`, `updated_at` | Drizzle schema 通过程构审核 |
| P0-1b | `db/migrations/` | drizzle-kit generate → 生成 migration SQL | migration 可执行 |
| P0-1c | `routes/shots.ts` | `GET /api/v1/projects/:id/shots` — 按 project 查分镜列表 (order by sort_order)，含 authMiddleware + projectOwnerCheck | `curl -H "Authorization: Bearer <jwt>" localhost:8089/api/v1/projects/<id>/shots` → 200 + items[] |
| P0-1d | `routes/shots.ts` | `POST /api/v1/projects/:id/shots` — 创建分镜，body: `{shot_number, camera_angle, dialogue, ...}`，自动设 sort_order = max+1 | `curl -X POST ... -d '{"shot_number":1,"camera_angle":"中景"}'` → 201 |
| P0-1e | `routes/shots.ts` | `PATCH /api/v1/projects/:id/shots/:shotId` — 更新分镜属性 | `curl -X PATCH ... -d '{"camera_angle":"特写"}'` → 200 |
| P0-1f | `routes/shots.ts` | `DELETE /api/v1/projects/:id/shots/:shotId` — 删除分镜 (硬删，级联不影响 project) | `curl -X DELETE ...` → 200 |
| P0-1g | `routes/index.ts` | 注册 shots 路由 | shots 端点全部可调 |
| P0-1h | `routes/shots.ts` | 鉴权检查：非 owner 调 → 403，未登录 → 401 | `curl (无token)` → 401 |

### 任务 P0-2：scenes schema + migration + CRUD (2 人天)

| 子任务 | 文件 | 改动 | 验收 |
|--------|------|------|------|
| P0-2a | `db/schema.ts` | 新增 `scenes` 表：`id(uuid)`, `project_id(uuid FK→projects)`, `name(varchar)`, `description(text)`, `scene_type(varchar)`, `light_color_temp(int)`, `light_brightness(float)`, `light_preset(varchar)`, `prompt(text)`, `thumbnail_url(varchar)`, `tags(jsonb)`, `created_at`, `updated_at` | Schema 通过审核 |
| P0-2b | `db/migrations/` | 生成 migration | 可执行 |
| P0-2c | `routes/scenes.ts` | `GET /api/v1/scenes?projectId=xxx` — 按项目查场景列表 | cURL → 200 |
| P0-2d | `routes/scenes.ts` | `POST /api/v1/scenes` — 创建场景，body: `{projectId, name, description, scene_type, light_*}` | cURL → 201 |
| P0-2e | `routes/scenes.ts` | `PATCH /api/v1/scenes/:id` — 更新场景 (含光照参数) | cURL → 200 |
| P0-2f | `routes/scenes.ts` | `DELETE /api/v1/scenes/:id` — 删除场景 | cURL → 200 |
| P0-2g | `routes/scenes.ts` | 鉴权：验证 projectOwner | cURL 无 token → 401 |

### 任务 P0-3：characters 补全 PATCH/DELETE (0.5 人天)

| 子任务 | 文件 | 改动 | 验收 |
|--------|------|------|------|
| P0-3a | `routes/characters.ts` | `PATCH /api/v1/characters/:id` — 更新角色信息 (archetype, description, tags, prompt) | cURL → 200 |
| P0-3b | `routes/characters.ts` | `DELETE /api/v1/characters/:id` — 删除角色 | cURL → 200 |
| P0-3c | `routes/characters.ts` | 鉴权验证 | cURL 无 token → 401 |

---

## 二、collab-service (:8091) — P1 团队管理补全

> 路径：`services/collab-service/src/`

### 任务 P1-1：teams CRUD 补全 + 成员管理 (1 人天)

| 子任务 | 文件 | 改动 | 验收 |
|--------|------|------|------|
| P1-1a | `routes/teams.ts` | `PATCH /api/v1/teams/:id` — 更新团队名 (仅 owner) | cURL → 200 |
| P1-1b | `routes/teams.ts` | `DELETE /api/v1/teams/:id` — 解散团队 (仅 owner) | cURL → 200 |
| P1-1c | `routes/teams.ts` | `GET /api/v1/teams/:id/invitations` — 查看团队邀请列表 | cURL → 200 |
| P1-1d | `routes/teams.ts` | `POST /api/v1/teams/:id/invitations/:invId/accept` — 接受邀请 | cURL → 200 |
| P1-1e | `routes/teams.ts` | `POST /api/v1/teams/:id/members` — 添加成员 (直接加，无需邀请) | cURL → 201 |
| P1-1f | `routes/teams.ts` | `DELETE /api/v1/teams/:id/members/:userId` — 移除成员 | cURL → 200 |
| P1-1g | `routes/teams.ts` | 鉴权：所有端点过 authMiddleware + teamRoleCheck | 非成员调 → 403 |

### 任务 P1-2：WebSocket 验证 (0.5 人天)

| 子任务 | 文件 | 改动 | 验收 |
|--------|------|------|------|
| P1-2a | `ws/handler.ts` | 确认 `/ws?projectId=x&token=jwt` 握手逻辑 → JWT 验证 + 加入房间 | wscat 连接成功 |
| P1-2b | `ws/handler.ts` | 确认断线重连 → 续推未消费事件 | 模拟断线→重连→补推 |

---

## 三、user-service (:8088) — P1 admin + ops

> 路径：`services/user-service/src/`

### 任务 P1-3：admin 用户管理 (1 人天)

| 子任务 | 文件 | 改动 | 验收 |
|--------|------|------|------|
| P1-3a | `routes/admin.ts` | 新建 admin 路由文件，所有端点过 adminAuthMiddleware (role=admin\|superadmin) | 普通用户 → 403 |
| P1-3b | `routes/admin.ts` | `GET /api/v1/admin/users?offset=0&limit=20&search=` — 用户列表 (含搜索/分页) | cURL admin JWT → 200 |
| P1-3c | `routes/admin.ts` | `PATCH /api/v1/admin/users/:id` — 启禁用用户 / 改角色 (body: `{is_active, role}`) | cURL → 200 |
| P1-3d | `routes/index.ts` | 注册 admin 路由 | 端点可调 |

### 任务 P1-4：admin 统计仪表盘 (0.5 人天)

| 子任务 | 文件 | 改动 | 验收 |
|--------|------|------|------|
| P1-4a | `routes/admin.ts` | `GET /api/v1/admin/stats` — 返回 `{ totalUsers, newUsersToday, activeUsers7d, totalProjects, totalRevenue }` | cURL admin JWT → 200 + 统计数 |
| P1-4b | — | 必要时跨服务查询 (project-service / billing-service 统计数据) 或直接查 user-service DB | 数据有来源 |

### 任务 P1-5：admin 审计日志 + 系统设置 (1 人天)

| 子任务 | 文件 | 改动 | 验收 |
|--------|------|------|------|
| P1-5a | `db/schema.ts` | 新增 `audit_logs` 表：`id(uuid)`, `user_id(uuid)`, `action(varchar)`, `resource(varchar)`, `resource_id(uuid)`, `ip(varchar)`, `detail(jsonb)`, `created_at` | Schema 通过审核 |
| P1-5b | `db/migrations/` | 生成 migration | 可执行 |
| P1-5c | `routes/admin.ts` | `GET /api/v1/admin/audit-logs?offset=0&limit=50&userId=&action=` — 审计日志查询 | cURL → 200 |
| P1-5d | `db/schema.ts` | 新增 `system_settings` 表：`key(varchar PK)`, `value(jsonb)`, `updated_at` | Schema 通过审核 |
| P1-5e | `routes/admin.ts` | `GET /api/v1/admin/settings` + `PATCH /api/v1/admin/settings` — 系统配置读写 | cURL → 200 |

### 任务 P1-6：ops 健康检查 + 指标 (1 人天)

| 子任务 | 文件 | 改动 | 验收 |
|--------|------|------|------|
| P1-6a | `routes/ops.ts` | 新建 ops 路由，adminAuthMiddleware (role=admin\|superadmin) | 非 admin → 403 |
| P1-6b | `routes/ops.ts` | `GET /api/v1/ops/health` — 返回 5 核心服务心跳：逐个 `GET http://<host>:<port>/health`，返回 `{ services: { user: {up,latency_ms}, project: {...}, ... } }` | cURL → 200 + 5 服务状态 |
| P1-6c | `routes/ops.ts` | `GET /api/v1/ops/metrics` — 读取各服务 `/metrics` 端点 (如 QPS/延迟/错误率) 或返回进程资源 (CPU/内存) | cURL → 200 |
| P1-6d | `routes/ops.ts` | `GET /api/v1/ops/services` — 服务列表 + 端口 + 状态 | cURL → 200 |
| P1-6e | `routes/index.ts` | 注册 ops 路由 | 端点可调 |

### 任务 P1-7：ops 部署管理 (0.5 人天)

| 子任务 | 文件 | 改动 | 验收 |
|--------|------|------|------|
| P1-7a | `routes/ops.ts` | `POST /api/v1/ops/deploy` — 触发 CI/CD (调用 webhook 或 shell exec)，body: `{service, branch, tag}` | cURL → 202 (异步) |
| P1-7b | `routes/ops.ts` | `GET /api/v1/ops/deploy/history` — 查询部署历史 | cURL → 200 |
| P1-7c | `db/schema.ts` | 新增 `deploy_history` 表：`id(uuid)`, `service(varchar)`, `branch(varchar)`, `tag(varchar)`, `status(varchar)`, `triggered_by(uuid)`, `created_at`, `finished_at` | Schema 通过审核 |

---

## 四、billing-service (:8090) — P1 管理 + 幂等

> 路径：`services/billing-service/src/`

### 任务 P1-8：admin 计费管理 + 退款审批 (1 人天)

| 子任务 | 文件 | 改动 | 验收 |
|--------|------|------|------|
| P1-8a | `routes/admin.ts` | 新建 admin 路由 (adminAuthMiddleware) | 非 admin → 403 |
| P1-8b | `routes/admin.ts` | `GET /api/v1/admin/billing/overview` — 返回 `{ totalRevenue, totalRecharges, activeSubscriptions, todayRevenue }` | cURL admin → 200 |
| P1-8c | `routes/admin.ts` | `GET /api/v1/admin/refunds?status=pending&offset=0&limit=20` — 退款申请列表 | cURL → 200 |
| P1-8d | `routes/refunds.ts` | `POST /api/v1/refunds/:id/approve` — 审批通过 (admin)，更新 refunds 表 status=approved → 原路退回 balance | cURL admin → 200 |
| P1-8e | `routes/refunds.ts` | `POST /api/v1/refunds/:id/reject` — 审批拒绝 | cURL → 200 |

---

## 五、ai-orchestrator (:8087) — P2 查询 + 统计

> 路径：`services/ai-orchestrator/src/`

### 任务 P2-1：用户任务列表 + Pipeline 统计 (0.5 人天)

| 子任务 | 文件 | 改动 | 验收 |
|--------|------|------|------|
| P2-1a | `routes/jobs.ts` | `GET /v1/orchestrator/jobs?userId=xxx&offset=0&limit=20` — 按用户查历史 Pipeline 任务 | cURL user JWT → 200 |
| P2-1b | `routes/jobs.ts` | `GET /v1/orchestrator/stats` — 返回 P1-P5 各 Pipeline 成功率 + 平均耗时 (admin/内部) | cURL x-api-key → 200 |

---

## 六、跨服务任务 (P0/P2)

### 任务 P0-4：鉴权链补全 — 5 服务 list 端点强制鉴权 (1 人天)

| 子任务 | 服务 | 文件 | 改动 | 验收 |
|--------|------|------|------|------|
| P0-4a | user-service | `routes/me.ts`, `routes/auth.ts` | 确认所有非公开端点已加 authMiddleware | grep 全端点 → 无遗漏 |
| P0-4b | project-service | `routes/projects.ts`, `routes/characters.ts` | `GET /api/v1/projects` + `GET /api/v1/characters` 加 authMiddleware (已知 bug #2) | 无 token → 401 |
| P0-4c | collab-service | `routes/teams.ts` | 所有团队端点过 authMiddleware | 无 token → 401 |
| P0-4d | billing-service | `routes/*.ts` | 所有非公开端点过 authMiddleware | 无 token → 401 |
| P0-4e | ai-orchestrator | `routes/jobs.ts` | x-api-key 验证服务间调用，用户面端点用 JWT | 无 token/x-api-key → 401 |

### 任务 P0-5：5 服务接口规范对齐 (0.5 人天)

| 子任务 | 范围 | 改动 | 验收 |
|--------|------|------|------|
| P0-5a | 5 服务全部 route | 统一分页参数：`offset`/`limit` (不是 `page`/`pageSize`) | grep 无 `page` / `pageSize` |
| P0-5b | 5 服务全部 route | 统一返回格式：`{ code, message, data }` (不是 `{ success, error }`) | grep 5 服务 response 格式 |
| P0-5c | 5 服务全部 route | 统一错误码：40100 (未登录) / 40101 (密码错) / 40300 (无权) / 40400 (不存在) | grep 错误码一致 |

---

## 七、P2 完善优化 (P1 完成后)

### 任务 P2-2：导出端点 (1 人天)

| 子任务 | 服务 | 文件 | 改动 | 验收 |
|--------|------|------|------|------|
| P2-2a | project-service | `routes/exports.ts` | `GET /api/v1/exports/presets` — 导出预设列表 (分辨率/编码/帧率 组合) | cURL → 200 |
| P2-2b | project-service | `routes/exports.ts` | `POST /api/v1/exports` — 触发导出任务，body: `{projectId, presetId, options:{...}}`，返回 jobId | cURL → 202 |
| P2-2c | project-service | `routes/exports.ts` | `GET /api/v1/exports/:jobId` — 查询导出进度/结果 | cURL → 200 |

### 任务 P2-3：WebSocket 协作验证 (0.5 人天)

| 子任务 | 服务 | 文件 | 改动 | 验收 |
|--------|------|------|------|------|
| P2-3a | collab-service | `ws/handler.ts` | 确认房间管理 (project ROOM) + 事件广播 (cursor/edit) | wscat 双连接 → 互见消息 |
| P2-3b | collab-service | `ws/handler.ts` | 鉴权验证 (JWT 握手) → 无效 token 拒绝连接 | wscat 无 token → 拒绝 |

### 任务 P2-4：性能优化 (1 人天)

| 子任务 | 范围 | 改动 | 验收 |
|--------|------|------|------|
| P2-4a | project-service DB | shots/scenes 表加索引：`project_id` + `created_at` 复合索引 | EXPLAIN ANALYZE 查询走 index scan |
| P2-4b | user-service DB | users 表加索引：`email` (去重) + `role` (admin 查询) | 邮箱查询走 index |
| P2-4c | billing-service DB | invoices/cost_logs 表加索引：`user_id` + `created_at` 复合索引 | 历史查询走 index |
| P2-4d | 5 服务全部 | 确认 Redis 缓存命中 (配置/统计等热数据) | redis-cli keys → 有关键缓存键 |

### 任务 P2-5：错误处理标准化 (0.5 人天)

| 子任务 | 范围 | 改动 | 验收 |
|--------|------|------|------|
| P2-5a | 5 服务全部 route | 所有 try/catch → 500 统一返 `{ code: 50000, message: "服务器内部错误" }`，不返 stack | cURL 触发 500 → 无 stack |
| P2-5b | 5 服务全部 middleware | authMiddleware 失败返 `{ code: 40100, message: "未登录" }` | 无 token → 401 + code 40100 |

### 任务 P2-6：billing 扣费幂等 (0.5 人天)

| 子任务 | 服务 | 文件 | 改动 | 验收 |
|--------|------|------|------|------|
| P2-6a | billing-service | `src/subscribers/ai-task.ts` | Redis 事件 `ai.task.completed` 消费时加 `eventId` 去重 → 查 `dedup_events` 表，已处理过则 skip | 同 eventId 重复 pub → 只扣费 1 次 |
| P2-6b | billing-service | `db/schema.ts` | 新增 `dedup_events` 表：`event_id(varchar PK)`, `processed_at` | Schema 通过 |
| P2-6c | billing-service | `db/migrations/` | 生成 migration | 可执行 |

---

## 八、谢擎每日计划 (P0 阶段，派单 22 日起)

| 天 | 任务 | 产出 | 完成标准 |
|----|------|------|---------|
| **D1** | P0-1a + P0-1b + P0-1c + P0-1d | shots schema + GET/POST | cURL 创建分镜 → 201, cURL 查询列表 → 200 |
| **D2** | P0-1e + P0-1f + P0-2a + P0-2b + P0-2c + P0-2d | shots 补全 + scenes schema + scenes GET/POST | shots 完整 CRUD, scenes 创建成功 |
| **D3** | P0-2e + P0-2f + P0-3a + P0-3b | scenes 补全 + characters 补全 | scenes 完整 CRUD, characters PATCH/DELETE |
| **D4** | P0-4a ~ P0-4e | 鉴权链补全 (5 服务) | 所有 list 端点无 token → 401 |
| **D5** | P0-5a ~ P0-5c + P0-1h + P0-2g + P0-3c | 接口规范对齐 + 鉴权验证 | grep 字段一致性通过 |
| **D6** | P0 集成测试 | 林染前端对接 shots + scenes + characters | studio 3 页调通 (分镜编辑/宫格/场景编辑) |

P0 完成后进入 P1，7 天 → 然后 P2，3.5 天。

---

## 九、程构审核节点

每个任务完成后，谢擎→程构审核，审核节点如下：

| P0 任务 | 审核内容 | 审核时间 |
|---------|---------|---------|
| P0-1ab | shots schema 字段/关系/索引 | D1 上午 |
| P0-1c~f | shots routes 鉴权/错误/字段 | D1-D2 |
| P0-2ab | scenes schema | D2 |
| P0-2c~f | scenes routes | D2-D3 |
| P0-3 | characters routes PATCH/DELETE | D3 |
| P0-4 | 鉴权链 grep 审计 | D4 |
| P0-5 | 接口规范 grep 审计 | D5 |

---

## 十、与林染前端对接清单

| 前端页面 | 需要的后端端点 | 谢擎完成节点 | 林染对接 |
|---------|---------------|-------------|---------|
| studio-shot-editor | shots CRUD (P0-1) | D2 | D6 |
| studio-storyboard-grid | shots GET (P0-1c) | D1 | D6 |
| studio-scene-edit | scenes CRUD (P0-2) | D3 | D6 |
| studio-character-edit | characters PATCH (P0-3a) | D3 | D6 |
| portal-team | teams 成员管理 (P1-1) | P1 | P1 |
| admin-* (7 页) | admin 端点 (P1-3~P1-5) | P1 | P1 (mockup 先出) |
| ops-* (3 页) | ops 端点 (P1-6~P1-7) | P1 | P1 (mockup 先出) |
| studio-export | 导出端点 (P2-2) | P2 | P2 |

---

> **程构署名**：本任务清单基于 DEV_TEAM_PLAN 拆解，每任务含路径+改动+验收，谢擎可直接照此执行。P0 6 天出 5 服务核心链路，P1 7 天出 admin+ops，P2 3.5 天完善。所有 schema 先过程构审核再写 route。工期按 1 人全栈 Node.js + Drizzle + PostgreSQL 估算，真实不拍脑袋。
>
> **下步**：虾总助派单 22 (谢擎) + 派单 23 (卫峥/纪弦/路寒)
