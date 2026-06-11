# 谢擎 ⚙️ 派单 61-1 — P0 修复 + 后端补测

> **派发**: 陈远枢 @ 派单 61 | **时间**: 2026-06-11 15:37 CST
> **截止**: P0修复 6/11 19:00 | 端点补测 6/12 12:00
> **人天**: 1.5 (6/11 下午0.5 + 6/12 上午1.0)

---

## 🚨 铁律

- **P0 不过夜** — 5 个 P0 今晚 19:00 前必须修完
- **每端点真 curl** — 拒绝空口白话，所有端点必须有 curl 输出截图/文本
- **修完自己验证** — 修完一个端点立即自测，记录状态码+响应时间
- **不准瞎填** — 实测数据进 Excel，没测到的写 "未测"，不许造假

---

## 📋 任务清单

### 🔴 任务1: P0修复 (6/11 19:00 截止, 必须完成)

| # | Bug ID | 问题 | 修复方案 |
|---|--------|------|------|
| 1 | API-001 | billing(8090)/collab(8091)/ai-orch(8087) 三服务 DOWN | 检查依赖安装 → pnpm install → 检查启动脚本 → 逐个启动并验证 |
| 2 | API-002 | project-service 运行版本落后源码 | 重建: `cd services/project-service && pnpm build && pnpm dev` |
| 3 | API-003 | 跨服务鉴权失败 (user-token被project-service拒绝) | 检查两服务的 JWT_SECRET 是否一致 → 确认鉴权中间件配置 |
| 4 | LEG-001 | GET /users/me → 500 | 查找根因 → 修复 → 自测 200 |
| 5 | API-004 | GET /projects 无鉴权 (不带Token也200) | 添加 auth 中间件 → 验证无Token返回401 |

**每项修复后**:
```
curl -s -o /dev/null -w "%{http_code}" http://localhost:{port}/{endpoint}
echo " → 期望XXX, 实际XXX"
```

---

### 🟠 任务2: 三服务端点补测 (6/12 12:00 截止)

修完 P0 后，对之前 DOWN 的三服务逐端点测试：

#### billing-service (8090) — 11 端点

| # | 方法 | 端点 | 说明 |
|---|------|------|------|
| 1 | GET | /health | 健康检查 |
| 2 | GET | /subscriptions | 套餐列表 |
| 3 | POST | /subscriptions | 订阅套餐 |
| 4 | GET | /orders | 订单列表 |
| 5 | POST | /orders | 创建订单 |
| 6 | GET | /invoices | 发票列表 |
| 7 | POST | /payment/callback | 支付回调 |
| 8 | GET | /quota | 配额查询 |
| 9 | POST | /refunds | 申请退款 |
| 10 | GET | /billing/cost-logs | 费用日志 |
| 11 | POST | /billing/recharge | 充值 |

#### collab-service (8091) — 9 端点

| # | 方法 | 端点 | 说明 |
|---|------|------|------|
| 12 | GET | /health | 健康检查 |
| 13 | POST | /comments | 创建评论 |
| 14 | GET | /comments | 评论列表 |
| 15 | PATCH | /comments/:id | 编辑评论 |
| 16 | POST | /comments/:id/resolve | 解决评论 |
| 17 | DELETE | /comments/:id | 删除评论 |
| 18 | GET | /presence/project/:pid | 在线用户 |
| 19 | GET | /notifications/unread-count | 未读通知 |
| 20 | GET | /stats | 公开统计 |

#### ai-orchestrator (8087) — 全端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |
| POST | /generate | 发起生成 |
| GET | /jobs/:id | 查询任务状态 |
| GET | /jobs | 任务列表 |
| DELETE | /jobs/:id | 取消任务 |
| POST | /jobs/:id/retry | 重试 |

---

### 🟡 任务3: 鉴权 + 边界补验

对补测的 billing/collab/ai-orch 端点，每端点跑三鉴权:
1. 带正确 Token → 期望 200/201
2. 不带 Token → 期望 401
3. 带错 Token → 期望 401/403

---

## 📄 输出

**文件**: `D:\ManhuaWorks\docs\testing\backend\XIEQING_BLIND_BACKEND_2026-06-11_v2.md`

格式与 v1 相同，追加:
- P0 修复记录 (每个 Bug 的修复时间 + 验证结果)
- billing/collab/ai-orch 三服务逐端点测试结果
- 鉴权三元验证表

---

## ⏰ 排期

| 时段 | 任务 |
|------|------|
| 15:37-17:00 | 修 P0-1/2/3 (三服务+鉴权) |
| 17:00-17:30 | 修 LEG-001 + API-004 |
| 17:30-18:00 | 自测全部 P0 修复 |
| 18:00-19:00 | billing 端点补测 |
| 19:00-20:00 | **P0 截止** + collab 端点补测 |
| 6/12 09:00-11:00 | ai-orch 端点 + 鉴权补验 |
| 6/12 11:00-12:00 | v2 报告提交 |

---

> 📌 修完一个 P0 → 更新 Excel Bug 追踪 (告知陈远枢或自行标记)
> 🚨 19:00 P0 未清零 → 立即上报
