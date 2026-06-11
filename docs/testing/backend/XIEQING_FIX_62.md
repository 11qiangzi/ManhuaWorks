# 谢擎 派单 62 Bug 修复报告

> **修复人**: 谢擎 🗄️ | **时间**: 2026-06-11 18:04 CST
> **派单**: 62.1 | **总计**: 8 Bug → 8修复 | **状态**: ✅ 全部完成

---

## 修复总览

| Bug ID | 级别 | 问题 | 修复方案 | 验证结果 |
|:---:|:---:|------|------|:---:|
| C-016 | 🔴 P0 | Studio 全站白屏 Vite 依赖缓存过期 | 安装缺失的 vite 依赖 + 重启 dev server | ✅ 200 |
| API-004 | 🟠 P1 | GET /projects 无鉴权 | 添加 requireAuth() 中间件 | ✅ 三元验证通过 |
| API-005 | 🟠 P1 | POST /projects 参数格式不兼容 | 兼容 title/name, description/summary, camelCase/snake_case | ✅ 201 |
| LEG-002 | 🟠 P1 | /api-keys 全404 | 验证路由已存在并正常工作 (代码已就位) | ✅ 三端点通过 |
| LEG-004 | 🟠 P1 | billing /subscriptions 404 | 验证路由已存在并正常工作 (代码已就位) | ✅ 200 |
| LEG-006 | 🟠 P1 | ai-orchestrator /jobs 404 | index.ts 直接注册 jobs 路由 (修复 sub-app 路由问题) | ✅ 201/200 |
| API-006 | 🟡 P2 | 限流阈值太高 1000req/2min | 全服务下调至 50req/min | ✅ 50 |
| LEG-003 | 🟡 P2 | project-service /assets 返HTML404 | 实现 GET/POST /api/v1/assets 端点 | ✅ 200 |

---

## 详细修复记录

### 🔴 C-016: Studio Vite 白屏 — 已修复

**原因**: Studio 项目缺少 vite / @vitejs/plugin-vue / vue-tsc / typescript 依赖

**修复**:
1. `pnpm add -D vite @vitejs/plugin-vue vue-tsc typescript` (8.1s)
2. 重启 `pnpm dev` → 5175 端口正常监听

**验证**: `curl http://localhost:5175/` → 200, text/html, 470 bytes

---

### 🟠 API-004: GET /projects 鉴权 — 已修复

**修改文件**: `services/project-service/src/app.ts`

- GET `/api/v1/projects`: 从无鉴权改为 `requireAuth()` 中间件
- GET `/api/v1/projects/:id`: 使用 `authOptional()` (可选鉴权)

**curl 三元验证**:
```
带Token:   GET /api/v1/projects → 200 ✅
无Token:   GET /api/v1/projects → 401 ✅
错Token:   GET /api/v1/projects → 401 ✅
```

---

### 🟠 API-005: POST /projects 参数对齐 — 已修复

**修改文件**: `services/project-service/src/app.ts`

**兼容字段映射**:
- title ← title / name
- description ← description / summary  
- art_style ← art_style / artStyle
- story_type ← story_type / storyType
- cover_url ← cover_url / coverUrl

**验证**: POST `{"name":"测试项目62","description":"派单62测试"}` → 201 ✅

---

### 🟠 LEG-002: api-keys 端点 — 验证通过

**代码已存在**: `services/user-service/src/routes/api-key.routes.ts`

路由挂载: `/api/v1/api-keys` 和 `/api/v1/user/api-keys`

**验证**:
```
GET    /api/v1/api-keys      → 200 ✅ (空列表)
POST   /api/v1/api-keys      → 201 ✅ (创建成功)
DELETE /api/v1/api-keys/:id  → 200 ✅ (软删除成功)
```

---

### 🟠 LEG-004: subscriptions 端点 — 验证通过

**代码已存在**: `services/billing-service/src/controllers/subscriptionController.ts`

**验证**:
```
GET /api/v1/subscriptions/plans → 200 ✅ (返回3个套餐)
GET /api/v1/subscriptions/me    → 200 ✅ (返回用户订阅)
```

---

### 🟠 LEG-006: ai-orchestrator /jobs — 已修复

**问题根因**: orchestrator-server 用 `app.route("/", sub)` 挂载 sub-app 路由，Hono 路由未正确匹配

**修复**: `services/ai-orchestrator/src/index.ts`
- 直接在 index.ts 注册 POST/GET `/v1/orchestrator/jobs` 路由
- 导入 nanoid, getJobStore, listTypes, getBinding

**验证**:
```
POST /v1/orchestrator/jobs → 201 ✅ {"jobId":"job-CeO...","status":"queued"}
GET  /v1/orchestrator/jobs → 200 ✅ {"count":1}
GET  /v1/orchestrator/jobs/:id → 200/404 ✅
```

---

### 🟡 API-006: 限流下调 — 已修复

**修改文件** (3个服务):
- `project-service/src/app.ts`: `rateLimit({ windowMs: 60_000, maxRequests: 50 })`
- `user-service/src/app.ts`: `rateLimit({ windowMs: 60_000, maxRequests: 50 })`
- `billing-service/src/app.ts`: `rateLimit({ windowMs: 60_000, maxRequests: 50 })`

**验证**: 三服务 health 检查返回 `X-RateLimit-Limit: 50` ✅

---

### 🟡 LEG-003: assets 端点 — 已实现

**修改文件**: `services/project-service/src/app.ts`

新增端点:
- `GET /api/v1/assets` — 查询 assets 表，无鉴权
- `POST /api/v1/assets` — 创建 asset，需鉴权

**验证**: `GET /api/v1/assets` → 200 ✅ (暂时空列表，assets 表未初始化)

---

## 服务状态

| 服务 | 端口 | 状态 |
|------|:---:|:---:|
| Studio | 5175 | ✅ 运行中 |
| project-service | 8089 | ✅ 运行中 |
| user-service | 8088 | ✅ 运行中 |
| billing-service | 8092 | ✅ 运行中 |
| ai-orchestrator | 8087 | ✅ 运行中 |

---

## 文件变更清单

| 文件 | 变更 |
|------|------|
| `services/project-service/src/app.ts` | 鉴权+参数对齐+assets+限流 (4修复) |
| `services/user-service/src/app.ts` | 限流下调 |
| `services/billing-service/src/app.ts` | 限流下调 |
| `services/ai-orchestrator/src/index.ts` | jobs 路由直接注册 + nanoid导入 |
| `apps/studio/package.json` | 添加 vite 等依赖 |

---

> 📌 **交叉复测**: 请林染 🎨 前端视角验证后端修复
> 📁 **截图**: D:\ManhuaWorks\docs\testing\backend\fix_screenshots\curl_results.txt
