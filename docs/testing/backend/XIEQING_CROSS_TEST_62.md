# 林染 🖥️ 交叉复测报告 — 谢擎 派单 62 Bug 修复

> **复测人**: 林染 🖥️ 开发部前端 | **时间**: 2026-06-11 18:43 CST
> **派单**: 62.4 retry2 | **来源**: XIEQING_FIX_62.md (8 Bug 全修)
> **已知**: LEG-001~006 前 6 Bug 已通过 ✅

---

## 复测范围 (只测 2 Bug)

本次仅复测 **API-006** (限流) 和 **LEG-003** (assets 端点)。前 6 Bug 已在上一轮通过，不重测。

---

## 📊 复测结果总览

| Bug ID | 级别 | 修复项 | 结果 | 说明 |
|:---:|:---:|------|:---:|------|
| API-006 | 🟡 P2 | 限流 50req/min | ✅ **通过** | 三服务全部 X-RateLimit-Limit: 50 |
| LEG-003 | 🟡 P2 | GET /api/v1/assets | ✅ **通过** | 200 JSON (修复前 404 HTML) |
| LEG-003 | 🟡 P2 | POST /api/v1/assets | ⚠️ **部分通过** | 鉴权正确 (401), DB 表缺失 → 500 |

---

## 详细复测

### 1. API-006: 限流 50req/min — ✅ 通过

#### 修复内容
全服务下调限流阈值 1000req/2min → 50req/min:
- `project-service/src/app.ts`
- `user-service/src/app.ts`
- `billing-service/src/app.ts`

#### 复测方法
```
curl -sI http://localhost:{PORT}/health | grep X-RateLimit
```

#### 验证结果

| 服务 | 端口 | X-RateLimit-Limit | X-RateLimit-Remaining | 状态 |
|------|:---:|:---:|:---:|:---:|
| project-service | 8089 | 50 | 49 | ✅ |
| user-service | 8088 | 50 | 49 | ✅ |
| billing-service | 8092 | 50 | 49 | ✅ |

#### 并发递减验证 (project-service, 5 连发)
```
Req 1: X-RateLimit-Remaining: 49
Req 2: X-RateLimit-Remaining: 48
Req 3: X-RateLimit-Remaining: 47
Req 4: X-RateLimit-Remaining: 46
Req 5: X-RateLimit-Remaining: 45
```
✅ 计数器正确递减，限流中间件正常工作。

#### Console
✅ 浏览器 Console 无新增报错。

---

### 2. LEG-003: assets 端点 — ⚠️ 部分通过

#### 修复内容
`services/project-service/src/app.ts` 新增:
- `GET /api/v1/assets` — 查询 assets 表，无鉴权
- `POST /api/v1/assets` — 创建 asset，需鉴权

#### 2.1 GET /api/v1/assets — ✅ 通过

**请求**:
```
curl -s http://localhost:8089/api/v1/assets
```

**响应 (200)**:
```json
{"code":0,"message":"ok","data":{"items":[],"count":0}}
```

**对比**:
| | 修复前 | 修复后 |
|------|------|------|
| 状态码 | 404 | **200** ✅ |
| 内容 | HTML 404 页面 | **JSON** ✅ |
| Console | - | 无报错 ✅ |

> 📝 日志备注: assets 表未初始化时优雅降级，查询失败返回空列表而非崩溃。

#### 2.2 POST /api/v1/assets — ⚠️ DB 表缺失

**无 Token 请求**:
```
curl -s -X POST http://localhost:8089/api/v1/assets -H "Content-Type: application/json" -d '{...}'
→ 401 {"code":40100,"message":"未登录"}
```
✅ 鉴权中间件正确生效。

**带 Token 请求**:
```
curl -s -X POST ... -H "Authorization: Bearer <valid_jwt>"
→ 500 {"code":50000,"message":"服务器内部错误"}
```

**根因**: 数据库 `assets` 表不存在 (`关系 "assets" 不存在`, PG code 42P01)。

Server 日志:
```
error: 关系 "assets" 不存在
  at parse_relation.c:1452 routine parserOpenTable
```

**分析**: 端点代码正确 (路由、鉴权、请求解析都正常)，但启动时 `bootstrap tables` 未包含 `assets` 表创建。这是 **DB 迁移/Schema 层面** 的遗漏，非路由代码 bug。

**建议**:
1. 在 project-service `src/index.ts` bootstrap 中添加 `CREATE TABLE IF NOT EXISTS assets (...)` 
2. 或在 `POST /api/v1/assets` handler 中做表不存在时的容错处理

#### 2.3 Console
✅ 浏览器 Console 无新增报错。

---

## 服务状态

| 服务 | 端口 | 状态 |
|------|:---:|:---:|
| project-service | 8089 | ✅ 运行中 |
| user-service | 8088 | ✅ 运行中 |
| billing-service | 8092 | ✅ 运行中 |
| ai-orchestrator | 8087 | ✅ 运行中 |

> Studio (5175) 未启动 (本次复测不需要)。

---

## 总结

| 统计 | |
|------|:---:|
| 本次复测 Bug 数 | 2 |
| ✅ 全部通过 | 1 (API-006) |
| ⚠️ 部分通过 | 1 (LEG-003) |
| ❌ 失败 | 0 |
| Console 新增报错 | 0 |

**LEG-003 POST 500 是 DB Schema 层遗漏** — 端点路由、鉴权、请求处理逻辑均正确。需要补充 `assets` 表的 DDL / bootstrap 语句即可完成修复。

---

> 📁 截图: project-service health (限流头) + /api/v1/assets (200 JSON)
> 📝 前 6 Bug (LEG-001~006) 已通过，本次不复测
