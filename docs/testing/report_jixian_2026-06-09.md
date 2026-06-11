# 纪弦 admin + ops-portal 测试报告 (2026-06-09)

## 总览
- 测试 view 数: 10 (admin 7 + ops 3)
- 文件存在: 10/10 ✅
- HTTP 200 (Vite SPA): 12/12 ✅ (注意: SPA 所有路径都 200, 真实状态看 router 注册)
- 静态问题: 3 项
- 权限边界: creator `/users`=403 ✅, admin `/users`=200 ✅
- **致命发现: admin-portal 7 个 view 全部调 mock data, 没接真后端**
- **致命发现: ops-portal BillingView 硬编码 `http://127.0.0.1:8090`, 完全绕开 vite proxy**

## admin-portal (5174) - 7 view

| View | 文件 | HTTP | 静态问题 | 严重 |
|------|------|------|----------|------|
| DashboardView | ✅ 5249B | 200 | 全走 `@/api/admin` mock | P1 |
| UsersView | ✅ 2311B | 200 | 全走 `@/api/admin` mock | P1 |
| BillingView | ✅ 6402B | 200 | 全走 `@/api/admin` mock | P1 |
| AuditView | ✅ 1566B | 200 | 全走 `@/api/admin` mock | P1 |
| SettingsView | ✅ 4124B | 200 | 全走 `@/api/admin` mock | P1 |
| OpsView | ✅ 15173B | 200 | 全走 `@/api/ops` mock (composables/ops.ts) | P1 |
| ComplianceView | ✅ 8202B | 200 | 全走 `@/api/ops` mock | P1 |

**架构问题 BUG-ADM-001 [P1]**: `src/api/admin.ts` + `src/api/ops.ts` 整个文件都是 mock data (MOCK_USERS/MOCK_ORDERS/MOCK_LOGS/MOCK_KPI 数组 + `delay()` 假延迟)。Admin 看到的所有 KPI/用户/订单/日志都是假的。

**Router 注册**: 7 路由全注册 ✅, redirect / → /dashboard ✅

## ops-portal (5176) - 3 view

| View | 文件 | HTTP | 静态问题 | 严重 |
|------|------|------|----------|------|
| DashboardView | ✅ 7673B | 200 | 全走 `@/api/mock-data` 纯前端 mock | P2 |
| UsersView | ✅ 7880B | 200 | 全走 `@/api/mock-data` 纯前端 mock | P2 |
| BillingView | ✅ 5966B | 200 | **硬编码 `http://127.0.0.1:8090/api/v1/billing`** | **P0** |

**BUG-OPS-001 [P0]**: `BillingView.vue:63` 硬编码 `const API_BASE = 'http://127.0.0.1:8090/api/v1/billing'`，3 处 `fetch()` 直接绕过 vite proxy。后果:
1. 跨主机访问 → CORS/连接失败 (proxy 在 5176 内部, 但绕过去直连 8090)
2. `127.0.0.1` 只在浏览器本机有效, LAN/远端访问必失败
3. vite 已配 `/api/v1/billing → 192.168.0.11:8090`, 应该用相对路径 `/api/v1/billing`

**BUG-OPS-002 [P0]**: `ops-portal/src/router/index.ts` **未注册 `/billing` 路由**! router 只有 `/dashboard` + `/users`。访问 `/billing` 时 vite 返回 index.html, 但 vue-router 找不到匹配 → 空白页。

**BUG-OPS-003 [P1]**: ops-portal 完全没有 auth/login/router-guard 逻辑。`main.ts` 只有 `createApp + pinia + router`, 没有 store 也没有守卫。任何 URL 直进。

**Router 注册**: ops-portal 仅注册 2 路由 (/dashboard + /users), `/billing` 缺失 → 死链

## 权限边界

| 角色 | 端点 | 期望 | 实际 | 结果 |
|------|------|------|------|------|
| creator (role=2) | GET /users | 403 | 403 forbidden/insufficient_role | ✅ |
| creator | GET /users/me | 200 (登录态) | **500 internal_error** | ❌ P0 |
| creator | GET /me | 200 | 200 | ✅ (但前端没用) |
| creator | GET /billing/* | 4xx | **404 not_found** | ❌ 后端没实现 |
| admin (role=5) | GET /users | 200 | 200 (返回用户列表) | ✅ |
| admin | GET /billing/* | 200 | **404 not_found** | ❌ 后端没实现 |
| admin | GET /audit | 200 | **404 not_found** | ❌ 后端没实现 |
| admin | GET /ops/dashboard | 200 | **404 not_found** | ❌ 后端没实现 |
| admin | GET /compliance | 200 | **404 not_found** | ❌ 后端没实现 |

## 后端 endpoint 审计 (8 个候选端点)

| Endpoint | 状态 | 说明 |
|----------|------|------|
| /users/me | **500** | 前端用, 后端崩 (已知 P0) |
| /me | 200 | 后端真实 endpoint, 但前端没用 |
| /user/me | 404 | 路径错 |
| /users/{id} | 200 | OK |
| /billing, /billing/plans, /billing/orders, /billing/invoices | **全 404** | 后端未实现 |
| /audit, /ops/dashboard, /compliance | **全 404** | 后端未实现 |

## Bug 清单 (按严重度)

### P0 (阻塞)
- **BUG-OPS-001**: BillingView.vue L63 硬编码 `http://127.0.0.1:8090`, 3 处 fetch 绕 proxy。修复: 改为相对路径 `/api/v1/billing`。
- **BUG-OPS-002**: ops-portal router 缺 `/billing` 注册。修复: 添加 `path: 'billing'` 到 router/index.ts。
- **BUG-API-001**: 后端 `/users/me` 500, 前端所有 auth store 都用此端点。修复: 后端排查 stack trace。

### P1 (架构)
- **BUG-ADM-001**: admin-portal 7 个 view 全走 mock (`src/api/admin.ts` + `src/api/ops.ts`), 看不到真实数据。
- **BUG-OPS-003**: ops-portal 无 auth store + 无 router guard, 未登录可访问所有页面。
- **BUG-API-002**: 后端 `/billing/*` `/audit` `/ops/*` `/compliance/*` 全部 404, M1-W3 L3.K 承诺的模块未交付。

### P2 (体验)
- **BUG-OPS-004**: ops-portal Dashboard/Users 全 mock data, 无真实业务数据展示。
- **BUG-ADM-002**: admin-portal router meta title/icon 出现乱码 (GBK/UTF-8 编码问题, 不影响功能)。

## 关键发现 (一句话总结)

**Admin/Ops portal 表面 UI 完整 (10 view 都在, 路由都能访问), 但 95% 数据是 mock, 后端 `/billing` `/audit` `/ops` `/compliance` 模块全部 404, `/users/me` 500, ops-portal BillingView 还硬编码 URL 绕 proxy。建议: M1 阶段先补后端 endpoint, 再接前端 API。**