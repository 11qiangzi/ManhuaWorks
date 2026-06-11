/**
 * Order Controller
 *  POST  /api/v1/orders
 *  GET   /api/v1/orders
 *  GET   /api/v1/orders/:id
 *  POST  /api/v1/orders/:id/pay       (内部用，调 mock 支付)
 *  POST  /api/v1/orders/webhook       (mock/real 回调)
 *  POST  /api/v1/orders/:id/cancel
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authRequired, type AuthedRequest } from "../middleware/auth";
import { orderService } from "../services/orderService";
import { ah, HttpError } from "../middleware/error";

const router = Router();

const createSchema = z.object({
  plan: z.string().min(1),
  billing_cycle: z.enum(["monthly", "yearly", "one_time"]).optional(),
  payment_method: z.string().optional(),
});

router.post("/", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const body = createSchema.parse(req.body);
  const o = await orderService.create(req.user!.sub, {
    plan: body.plan,
    billingCycle: body.billing_cycle,
    paymentMethod: body.payment_method,
  });
  res.status(201).json({ code: 0, message: "created", data: o });
}));

router.get("/", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const out = await orderService.listByUser(req.user!.sub, limit, offset);
  res.json({ code: 0, message: "ok", data: out });
}));

router.get("/:id", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const o = await orderService.getById(req.user!.sub, req.params.id!, (req.user!.role ?? 0) >= 5);
  res.json({ code: 0, message: "ok", data: o });
}));

router.post("/:id/pay", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  // 调起 mock 支付（沙盒）
  const { paymentService } = await import("../services/paymentService");
  const outcome = (req.body?.outcome as "success" | "fail" | undefined) ?? "success";
  const method = req.body?.method as string | undefined;
  const result = await paymentService.mockPay({
    orderId: req.params.id!,
    userId: req.user!.sub,
    method,
    outcome,
  });
  res.json({ code: 0, message: "ok", data: result });
}));

router.post("/webhook", ah(async (req: Request, res: Response) => {
  // 简化：不做签名校验（沙盒）；真实环境需 HMAC 验签
  const body = z
    .object({
      order_id: z.string().optional(),
      order_no: z.string().optional(),
      method: z.enum(["alipay", "wechat", "paypal", "mock"]),
      channel: z.enum(["h5", "pc", "app", "sdk"]).optional(),
      transaction_id: z.string().min(1),
      amount_cents: z.number().int().nonnegative().optional(),
      raw_payload: z.record(z.unknown()).optional(),
    })
    .parse(req.body);
  const out = await orderService.handlePaidWebhook({
    orderId: body.order_id,
    orderNo: body.order_no,
    method: body.method,
    channel: body.channel,
    transactionId: body.transaction_id,
    amountCents: body.amount_cents,
    rawPayload: body.raw_payload,
  });
  res.json({ code: 0, message: "ok", data: out });
}));

router.post("/:id/cancel", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const o = await orderService.cancel(req.params.id!, req.user!.sub, (req.user!.role ?? 0) >= 5);
  res.json({ code: 0, message: "cancelled", data: o });
}));

export default router;
