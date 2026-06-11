# 🐛 ManhuaWorks Bug 汇总 (M3.5 测试阶段)

> 生成时间: 2026-06-09 15:09
> 阶段: 1 个测试员 (路寒-2/2) 报告, 父 agent 复测后
> 待办: 卫峥/纪弦/路寒-1/2 报告加入后, 派工修复

## 🔴 P0 (核心流程, 必修)

| Bug | 位置 | 现象 | 父 agent 验 | 派工 |
|------|------|------|------|------|
| GET /users/me → 500 | user-service (8088) | 带合法 token 返 500 internal_error | ✅ 复测 500 | 谢擎 |

## 🟡 P1 (待确认)

| Bug | 位置 | 现象 | 父 agent 验 | 备注 |
|------|------|------|------|------|
| GET /users 403 | user-service | role=2 被拒 | ✅ 真预期 (admin-only) | 边界, 非 bug |

## ⚪ 路由缺失 (L2 计划未实现, 待商榷)

| Service | 缺失端点 |
|------|------|
| user-service | /api-keys (POST/GET/DELETE) 全 404 |
| project-service | /assets 返 HTML 404, /scenes 未测 |
| billing-service | /subscriptions, /usage 全 404 |
| collab-service | /comments, /annotations 4 endpoint 全 404 |
| ai-orchestrator | /orchestrator/jobs, /pipelines 全 404 (除 /health) |

> 这不是测试 bug, 是 L2 后端路由**没实现**, 莫言画/E2 排期问题, 需大哥拍板:
> A: 列入 L5+ 后续阶段
> B: 紧急让谢擎加班补完

## 🟢 边界 (预期, 非 bug)
- /auth/login wrong pw → 401 ✅
- /users/me no token → 401 ✅
- /billing/balance no auth → 401 ✅
- /projects/000 → 404 ✅
- /users (admin) role=2 → 403 ✅
