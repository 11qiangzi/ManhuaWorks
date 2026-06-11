/**
 * Payment Service
 * mock 支付 + 沙盒
 */

import { paymentRepository } from "../repositories/paymentRepository";
import { orderRepository } from "../repositories/orderRepository";
import { HttpError } from "../middleware/error";
import { PAYMENT_METHODS, type PaymentMethod, type PaymentChannel, findMethod } from "../models/payment";
import { env } from "../config/env";
import { logger } from "../config/logger";

export interface MockPayInput {
  orderId: string;
  userId: string;
  method?: string;
  channel?: PaymentChannel;
  /** 强制成功/失败：默认 success；调试时可设 "fail" */
  outcome?: "success" | "fail";
}

export const paymentService = {
  /** 列出可用支付方式 */
  listMethods() {
    return PAYMENT_METHODS.map((m) => ({ ...m, sandbox: env.PAYMENT_SANDBOX }));
  },

  /**
   * mock 支付：直接生成一个 transactionId + 调 webhook 路径
   * 真实环境会跳转到支付宝/微信/PayPal；这里全部走沙盒
   */
  async mockPay(input: MockPayInput): Promise<{
    orderId: string;
    paymentId: string;
    method: PaymentMethod;
    transactionId: string;
    redirectUrl: string;
    sandbox: true;
  }> {
    const o = await orderRepository.findById(input.orderId);
    if (!o) throw new HttpError(404, "order_not_found");
    if (o.userId !== input.userId) throw new HttpError(403, "forbidden");
    if (o.status !== "pending") {
      throw new HttpError(409, "order_finalized", `order is ${o.status}`);
    }
    const methodId = (input.method ?? "mock") as string;
    const m = findMethod(methodId);
    if (!m) throw new HttpError(400, "invalid_method", `unknown method: ${methodId}`);

    // 创建 pending payment
    const payment = await paymentRepository.create({
      orderId: o.id,
      method: m.id,
      channel: input.channel ?? "pc",
      amountCents: o.amountCents,
      sandbox: true,
      rawPayload: { mock: true, source: "sandbox" },
    });

    // 模拟：直接 success / fail
    const outcome = input.outcome ?? "success";
    const txnId = `MOCK-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    if (outcome === "success") {
      // 直接复用 orderService.handlePaidWebhook
      const { orderService } = await import("./orderService");
      await orderService.handlePaidWebhook({
        orderId: o.id,
        method: m.id,
        channel: input.channel ?? "pc",
        transactionId: txnId,
        amountCents: o.amountCents,
        rawPayload: { mock: true, source: "sandbox", outcome },
      });
    } else {
      await paymentRepository.setStatus(payment.id, "failed", txnId, { outcome });
      await orderRepository.updateStatus(o.id, "failed", { paymentMethod: m.id });
    }
    logger.info(
      { orderId: o.id, paymentId: payment.id, method: m.id, outcome },
      "[payment] mock"
    );

    return {
      orderId: o.id,
      paymentId: payment.id,
      method: m.id,
      transactionId: txnId,
      redirectUrl: `https://sandbox.manhuaworks.example/mock-pay/${payment.id}`,
      sandbox: true,
    };
  },
};
