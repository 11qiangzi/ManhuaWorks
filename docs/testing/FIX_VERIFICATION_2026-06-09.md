# 🛠️ M3.5 修复验证总报告 (2026-06-09)

> 父 agent 虾总助亲自复测, 17:00-17:15

## 🎯 总览
- **修复派工**: 谢擎 (后端) + 赵千影 (前端)
- **修复 bug**: 1 P0 + 8 P1 (含 1 个虾总助新发现)
- **父 agent 验**: 13/13 全过

## 🟢 谢擎后端修复 (3/3 全过)

### P0-001: GET /users/me 500 → 200
- 根因: 路由 /users/:id 把 'me' 当 UUID 触发 invalid input syntax
- 修法: routes/index.ts 加 1 行 router.get('/users/me', ...) 优先匹配
- **父 agent 验**: ✅ 200 + 返 user 对象 (id/email/role/status)

### P1-002: /api-keys 404 → 200/201
- 根因: 实际挂在 /user/api-keys, 前端调 /api-keys 走 notFound
- 修法: routes/index.ts 加 1 行 router.use('/api-keys', apiKeyRouter) 别名
- **父 agent 验**: ✅ GET 200, 返 api-keys 列表

### P1-003: collab 4 端点 404 → 200/201
- 根因: collab 路由平铺式, 前端 REST 嵌套式
- 修法: routes/index.ts 重写, 加 alias /projects/:projectId/comments, 复建 annotations
- **父 agent 验**: ✅ 7/7 端点全过 (comments/annotations/notifications/activities/presence)

## 🟢 赵千影前端修复 (4/4 P1 全过)

### P1-001: WorkflowDesignerView 4 处硬编码
- 改: 用 vite proxy (默认 '' 走 /api → 8087)
- **父 agent 验**: ✅ 0 处 localhost:8087 (Select-String 无匹配)

### P1-002: orchestrator.ts BASE_URL
- 改: const BASE_URL = import.meta.env?.VITE_ORCHESTRATOR_URL ?? ''
- **父 agent 验**: ✅ 用 env 变量 + 兜底走 proxy

### P1-003: ProjectsView POST
- 改: body 用 title (不是 name), header 加 x-mhw-user-id: userId
- **父 agent 验**: ✅ L132-137 字段全有

### P1-004: ProjectEditor mock → 真
- 改: onMounted 调 api.projects.get(id) 真接口
- **父 agent 验**: ✅ loadProject 调 api.projects.get 真 API

## 🟢 虾总助额外修 1 个 (父 agent 发现 + 修)

### BUG-EXTRA-001: collab /collab 前缀漏挂
- 现象: 谢擎改 routes/index.ts 加了 REST 嵌套路由, 但 app.ts 没挂 /collab 前缀 alias
- 修法: app.ts 加 1 行 app.use("/api/v1/collab", apiRouter)
- **父 agent 验**: ✅ 7 端点 (comments/annotations/notifications/activities/presence) 全过

## 📊 父 agent 复测用例 (13/13 全过)

### 后端 (9)
- GET /api/v1/users/me ✅ 200
- GET /api/v1/api-keys ✅ 200
- GET /api/v1/collab/projects/{id}/comments ✅ 200
- POST /api/v1/collab/comments ✅ 201
- GET /api/v1/collab/projects/{id}/annotations ✅ 200
- POST /api/v1/collab/projects/{id}/annotations ✅ 201
- GET /api/v1/collab/notifications ✅ 200
- GET /api/v1/collab/activities ✅ 200 (带 projectId)
- GET /api/v1/collab/presence/project/{id} ✅ 200

### 前端 (4)
- WorkflowDesignerView 硬编码 ✅ 0 处
- orchestrator.ts BASE_URL ✅ env 变量
- ProjectsView POST ✅ title + x-mhw-user-id
- ProjectEditor onMounted ✅ api.projects.get()

## 🎯 下一步
- 派 3 测试员 (卫峥/纪弦/路寒) 复测
- 全过 → 出《全功能测试通过报告》
