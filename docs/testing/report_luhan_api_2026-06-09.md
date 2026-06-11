# 路寒 API 测试报告 (2026-06-09)

- 测试员: tester-luhan (开发部测试组)
- 测试账号: tester-luhan@manhuaworks.local
- 测试时间: 2026-06-09 15:06 CST
- 测试方式: 直连 service API (内网 192.168.0.11)

## user-service (8088)

| TC | Endpoint | 方法 | 状态 | 响应摘要 | 备注 |
|----|----------|------|------|----------|------|
| TC-API-LOGIN | `/auth/login` | POST | 200 | {"code":0,"message":"ok","data":{"access_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyZTcxYjE5OS0zZDE5LTQ5Yj | ✅ |
| TC-API-002 | `/auth/login (wrong pw)` | POST | 401 | {"code":"unauthorized","message":"invalid_credentials"} | 边界 |
| TC-API-003 | `/auth/register` | POST | 201 | {"code":0,"message":"created","data":{"access_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwYTRmNTZiNC0xZjcxL | ✅ |
| TC-API-004 | `/users/me` | GET | 500 | {"code":"internal_error","message":"internal server error"} | ❌ |
| TC-API-005 | `/users/me (no token)` | GET | 401 | {"code":"unauthorized","message":"missing_bearer_token"} | 边界 |
| TC-API-006 | `/users (admin)` | GET | 403 | {"code":"forbidden","message":"insufficient_role"} | ❌ |
| TC-API-007 | `/api-keys` | POST | 404 | {"code":"not_found","message":"route not found","path":"/api/v1/api-keys"} | ❌ |
| TC-API-008 | `/api-keys` | GET | 404 | {"code":"not_found","message":"route not found","path":"/api/v1/api-keys"} | ❌ |
| TC-API-009 | `/api-keys/{id}` | DELETE | skip | no id created | 跳过 |

## project-service (8089)

| TC | Endpoint | 方法 | 状态 | 响应摘要 | 备注 |
|----|----------|------|------|----------|------|
| TC-API-010 | `/projects` | GET | 200 | {"code":0,"message":"ok","data":{"items":[],"count":0}} | ✅ |
| TC-API-011 | `/projects` | POST | 400 | {"code":"bad_request","message":"missing title or x-mhw-user-id"} | ❌ |
| TC-API-012 | `/projects/{id}` | GET | skip | no id | 跳过 |
| TC-API-013 | `/projects/000… (404)` | GET | 404 | {"code":"not_found","message":"project not found"} | 边界 |
| TC-API-014 | `/projects/{id}` | PATCH | skip | no id | 跳过 |
| TC-API-015 | `/assets` | GET | 404 | <!DOCTYPE html> <html lang="en"> <head> <meta charset="utf-8"> <title>Error</title> </head> <body> <pre>Cannot GET /api/ | ❌ |
| TC-API-016 | `/scenes` | POST | skip | no proj_id | 跳过 |
| TC-API-017 | `/projects/{id}` | DELETE | skip | no id | 跳过 |

## billing-service (8090)

| TC | Endpoint | 方法 | 状态 | 响应摘要 | 备注 |
|----|----------|------|------|----------|------|
| TC-API-020 | `/billing/balance` | GET | 200 | {"code":0,"message":"ok","data":{"userId":"2e71b199-3d19-49b1-aba9-c9d4ad736164","balanceCents":10000,"balance":100,"cur | ✅ |
| TC-API-021 | `/billing/recharge` | POST | 400 | {"code":400,"message":"validation_error","detail":[{"path":"userId","message":"Required","code":"invalid_type"}]} | ❌ |
| TC-API-022 | `/billing/subscriptions` | GET | 404 | {"code":404,"message":"not_found","path":"/api/v1/billing/subscriptions"} | ❌ |
| TC-API-023 | `/billing/invoices` | GET | 200 | {"code":0,"message":"ok","data":{"list":[],"total":0,"limit":20,"offset":0}} | ✅ |
| TC-API-024 | `/billing/usage` | GET | 404 | {"code":404,"message":"not_found","path":"/api/v1/billing/usage"} | ❌ |
| TC-API-025 | `/billing/balance (no auth)` | GET | 401 | {"code":401,"message":"missing or invalid Authorization header"} | 边界 |

## collab-service (8091)

| TC | Endpoint | 方法 | 状态 | 响应摘要 | 备注 |
|----|----------|------|------|----------|------|
| TC-API-030 | `/projects/11111111/comments` | GET | 404 | {"code":404,"message":"Not Found"} | ❌ |
| TC-API-031 | `/projects/11111111/comments` | POST | 404 | {"code":404,"message":"Not Found"} | ❌ |
| TC-API-032 | `/projects/11111111/annotations` | GET | 404 | {"code":404,"message":"Not Found"} | ❌ |
| TC-API-033 | `/projects/11111111/annotations` | POST | 404 | {"code":404,"message":"Not Found"} | ❌ |

## ai-orchestrator (8087)

| TC | Endpoint | 方法 | 状态 | 响应摘要 | 备注 |
|----|----------|------|------|----------|------|
| TC-API-040 | `/health` | GET | 200 | {"ok":true,"service":"ai-orchestrator","version":"0.5.0","mode":"dev-skipped","uptime":8379942,"env":"development","port | ✅ |
| TC-API-041 | `/orchestrator/jobs` | POST | 404 | {"error":"not_found","path":"/api/v1/orchestrator/jobs"} | ❌ |
| TC-API-042 | `/orchestrator/jobs` | GET | 404 | {"error":"not_found","path":"/api/v1/orchestrator/jobs"} | ❌ |
| TC-API-043 | `/orchestrator/pipelines` | GET | 404 | {"error":"not_found","path":"/api/v1/orchestrator/pipelines"} | ❌ |

## 总览

- 总用例: **31**
- 通过 (2xx): **6**
- 失败 (4xx/5xx/异常): **25**
- 边界用例 (401/403/400/404): **4**
- 跳过 (依赖失败): **5**

## 备注
- 所有请求均通过本地 192.168.0.11 内网直连, 未走 gateway
- 401/403/400/404 视为预期边界, 不计入'失败'
- 严重度: 5xx 视为严重, 4xx 视情况 (业务预期则降级)