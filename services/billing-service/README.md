# ManhuaWorks · billing-service

> 计费服务 · 2026-06-08 周三 W4-D3 赵千影

负责：

- 订阅生命周期（free / pro / team，含试用→续费→过期→升降级）
- 订单 + 支付（mock 沙盒：alipay / wechat / paypal / mock）
- 发票（PDF 生成，pdfkit）
- 退款审核
- 配额（token / image / video，月度重置 + cron 自动巡检）

---

## 端口 & 依赖

- **端口**：`8090`
- **DB**：`postgres://mhw:mhw_dev_password_2026@127.0.0.1:5432/manhuaworks`
- **依赖**：
  - `user-service`：`http://localhost:8088`（取用户信息）
  - `project-service`：`http://localhost:8089`（取项目数做 plan 限额）
  - 同一 `JWT_SECRET`（HS256，iss/aud 与 user-service 对齐）

## 启动

```powershell
# 安装依赖
cd D:\ManhuaWorks\services\billing-service
npm install

# 启动
npm run dev          # tsx watch（开发）
npm run build && npm start  # tsc 编译 + 跑 dist
```

首次启动会自动建表（idempotent）：

- `orders` / `invoices` / `payments` / `refunds`
- 触发器 `trg_*_updated_at`（如果不存在）

`users / subscriptions / quotas / projects / api_keys / api_call_logs / role_vectors`
由 `db/001a_core.sql` 提供，本服务不重建。

## 订阅档位

| 档位 | 别名 | 月费（分） | 项目数 | 月度 token | 月度 image | 月度 video |
|------|------|-----------:|-------:|-----------:|-----------:|-----------:|
| free | — | 0 | 5 | 100 000 | 50 | 10 |
| pro | — | 9 900 | 不限 | 10 000 000 | 5 000 | 500 |
| team | enterprise | 49 900 | 不限 | 50 000 000 | 20 000 | 2 000 |

> ⚠️ 数据库 `subscriptions.plan` CHECK 限定为 `('free','pro','team')`，
> API 层把 `enterprise` 别名映射到 `team`（`src/config/plans.ts` → `resolvePlanId`）。

## 路由

```
GET    /health
GET    /                                    服务自描述

# 订阅
GET    /api/v1/subscriptions/plans
GET    /api/v1/subscriptions/me
PUT    /api/v1/subscriptions/me            { plan, expires_at?, auto_renew? }
PATCH  /api/v1/subscriptions/me/renew      { extend_days | expires_at, auto_renew? }
PATCH  /api/v1/subscriptions/me/auto-renew { auto_renew: bool }
POST   /api/v1/subscriptions/cancel
GET    /api/v1/subscriptions/can-create-project

# 订单
POST   /api/v1/orders                      { plan, billing_cycle?, payment_method? }
GET    /api/v1/orders?limit&offset
GET    /api/v1/orders/:id
POST   /api/v1/orders/:id/pay              (内部用，调 mock 支付)
POST   /api/v1/orders/webhook              (支付回调，外部)
POST   /api/v1/orders/:id/cancel

# 发票
GET    /api/v1/invoices
POST   /api/v1/invoices                    { order_id, title, tax_id? }
GET    /api/v1/invoices/:id
GET    /api/v1/invoices/:id/pdf            (application/pdf)
POST   /api/v1/invoices/:id/void           (admin)

# 支付
GET    /api/v1/payment/methods
POST   /api/v1/payment/mock                { order_id, method?, channel?, outcome? }

# 配额
GET    /api/v1/quota
GET    /api/v1/quota/usage                 (admin)
POST   /api/v1/quota/reset                 (admin)
PUT    /api/v1/quota                       (admin)
POST   /api/v1/quota/consume               { type: tokens|images|videos, amount }

# 退款
GET    /api/v1/refunds
POST   /api/v1/refunds                     { order_id, reason?, amount_cents? }
GET    /api/v1/refunds/:id
POST   /api/v1/refunds/:id/approve         (admin)
POST   /api/v1/refunds/:id/reject          (admin)
```

## 支付流（mock 沙盒）

1. 用户 `POST /api/v1/orders` → 拿到 `order_id` (status=pending)
2. `POST /api/v1/payment/mock { order_id, method: "alipay" }`
   - 服务端直接创建 payment (sandbox=true)
   - 调内部 `handlePaidWebhook`
   - 标记 order=paid
   - 续/升订阅
   - 返回 `transactionId`（MOCK- 前缀）
3. 真实环境接支付宝/微信时：把 `paymentService.mockPay` 换成生成支付链接
   + 提供 `POST /api/v1/orders/webhook` 接收回调

## 测试

```powershell
npm test
```

`tests/billing.test.ts` 覆盖：

- 订阅：初始化 / 升级 / 续费 / 取消
- 订单：创建 / mock 支付 / webhook
- 退款：申请 / 通过 / 拒绝
- 配额：扣减 / 超额 / 重置
- 档位配置 + alias 映射

DB 不可连时所有集成测试 `skipIf(!dbOk)`，不会失败。

## 目录

```
billing-service/
├── package.json
├── tsconfig.json
├── .env
├── Dockerfile
├── README.md
├── src/
│   ├── index.ts                 # 入口：建表 + cron + 启 HTTP
│   ├── app.ts                   # Express 实例
│   ├── config/
│   │   ├── env.ts               # 环境变量
│   │   ├── db.ts                # pg pool + 启动建表
│   │   ├── logger.ts            # pino
│   │   └── plans.ts             # 3 档订阅
│   ├── middleware/
│   │   ├── auth.ts              # JWT 鉴权
│   │   └── error.ts             # 全局错误处理
│   ├── models/
│   │   ├── subscription.ts
│   │   ├── order.ts
│   │   ├── invoice.ts
│   │   ├── payment.ts
│   │   ├── quota.ts
│   │   └── refund.ts
│   ├── repositories/
│   │   ├── subscriptionRepository.ts
│   │   ├── orderRepository.ts
│   │   ├── invoiceRepository.ts
│   │   ├── paymentRepository.ts
│   │   ├── quotaRepository.ts
│   │   └── refundRepository.ts
│   ├── services/
│   │   ├── subscriptionService.ts
│   │   ├── orderService.ts
│   │   ├── invoiceService.ts
│   │   ├── paymentService.ts
│   │   ├── quotaService.ts
│   │   └── refundService.ts
│   ├── controllers/
│   │   ├── subscriptionController.ts
│   │   ├── orderController.ts
│   │   ├── invoiceController.ts
│   │   ├── paymentController.ts
│   │   ├── quotaController.ts
│   │   ├── refundController.ts
│   │   └── healthController.ts
│   ├── clients/
│   │   ├── userClient.ts
│   │   └── projectClient.ts
│   └── routes/
│       └── index.ts
└── tests/
    └── billing.test.ts
```

## 已知约束

1. **schema 限制**：`subscriptions.plan` 只允许 `('free','pro','team')`，所以"企业版"内部存为 `team`。
2. **mock 支付**：不接真支付网关；事务号 `MOCK-{ts}-{rand}`。
3. **每日配额**：schema 只有一个 `reset_at`（月度），日级别不单独建模。
4. **webhook 签名**：当前不做 HMAC 校验（沙盒）。生产环境需在 `orderService.handlePaidWebhook` 头部加验签。
5. **依赖降级**：如果 `project-service` 未启，`canCreateProject` 会用本地 `projects` 表兜底统计。
