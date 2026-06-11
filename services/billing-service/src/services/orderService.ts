/**
 * Order Service
 * 订单创建 + 支付回调处理
 */

import { orderRepository } from "../repositories/orderRepository";
import { paymentRepository } from "../repositories/paymentRepository";
import { subscriptionService } from "./subscriptionService";
import { getPlan, resolvePlanId, type PlanIdDb } from "../config/plans";
import { HttpError } from "../middleware/error";
import { genOrderNo, type BillingCycle, type Order } from "../models/order";
import type { PaymentMethod, PaymentChannel } from "../models/payment";
import { withTransaction } from "../config/db";
import { logger } from "../config/logger";
import { findMethod } from "../models/payment";

export interface CreateOrderInput {
  plan: string; // free/pro/team/enterprise
  billingCycle?: BillingCycle;
  paymentMethod?: string;
  channel?: PaymentChannel;
}

const CYCLE_DAYS: Record<BillingCycle, number> = {
  monthly: 30,
  yearly: 365,
  one_time: 36500,
};

const CYCLE_MULTIPLIER: Record<BillingCycle, number> = {
  monthly: 1,
  yearly: 12, // 12 个月折扣价（无折扣）
  one_time: 1,
};

export const orderService = {
  /** 创建订单（待支付） */
  async create(userId: string, input: CreateOrderInput): Promise<Order> {
    const plan = resolvePlanId(input.plan);
    if (!plan) {
      throw new HttpError(400, "invalid_plan", `unknown plan: ${input.plan}`);
    }
    const billingCycle: BillingCycle = input.billingCycle ?? "monthly";
    if (!(billingCycle in CYCLE_DAYS)) {
      throw new HttpError(400, "invalid_billing_cycle");
    }
    const planCfg = getPlan(plan);
    const amountCents = planCfg.priceCentsMonthly * CYCLE_MULTIPLIER[billingCycle];

    const orderNo = genOrderNo();
    const order = await orderRepository.create({
      userId,
      orderNo,
      plan,
      billingCycle,
      amountCents,
      currency: "CNY",
      metadata: {
        plan_name: planCfg.name,
        price_monthly_cents: planCfg.priceCentsMonthly,
        cycle_days: CYCLE_DAYS[billingCycle],
      },
    });

    logger.info(
      { userId, orderId: order.id, orderNo, plan, amountCents },
      "[order] created"
    );
    return order;
  },

  async getById(userId: string, id: string, isAdmin: boolean): Promise<Order> {
    const o = await orderRepository.findById(id);
    if (!o) throw new HttpError(404, "order_not_found");
    if (o.userId !== userId && !isAdmin) {
      throw new HttpError(403, "forbidden");
    }
    return o;
  },

  async listByUser(userId: string, limit: number, offset: number): Promise<{ list: Order[]; total: number }> {
    const list = await orderRepository.listByUser(userId, limit, offset);
    const total = await orderRepository.countByUser(userId);
    return { list, total };
  },

  /**
   * 处理支付回调（webhook）
   * - 校验订单存在
   * - 创建/更新 payment 记录
   * - 标记订单 paid，并 extend 订阅
   */
  async handlePaidWebhook(input: {
    orderId?: string;
    orderNo?: string;
    method: PaymentMethod;
    channel?: PaymentChannel;
    transactionId: string;
    amountCents?: number;
    rawPayload?: Record<string, unknown>;
  }): Promise<{ order: Order; paymentId: string }> {
    let order: Order | null = null;
    if (input.orderId) order = await orderRepository.findById(input.orderId);
    else if (input.orderNo) order = await orderRepository.findByOrderNo(input.orderNo);
    if (!order) throw new HttpError(404, "order_not_found");
    if (order.status === "paid") {
      // 幂等：返回已有
      const ps = await paymentRepository.findByOrderId(order.id);
      const p = ps.find((x) => x.status === "success");
      if (p) return { order, paymentId: p.id };
    }
    if (order.status === "refunded" || order.status === "cancelled") {
      throw new HttpError(409, "order_finalized", `order is ${order.status}`);
    }

    const result = await withTransaction(async (client) => {
      // 直接用 pg 客户端以保证原子（paymentRepository 当前用 pool）
      const payment = await paymentRepository.create({
        orderId: order!.id,
        method: input.method,
        channel: input.channel ?? "pc",
        amountCents: input.amountCents ?? order!.amountCents,
        sandbox: true,
        rawPayload: input.rawPayload ?? {},
      });
      const updated = await paymentRepository.setStatus(
        payment.id,
        "success",
        input.transactionId,
        input.rawPayload ?? {}
      );
      const cycleDays =
        (order!.metadata?.cycle_days as number | undefined) ?? 30;
      const expiresAt = new Date(Date.now() + cycleDays * 86400_000);
      const paidOrder = await orderRepository.updateStatus(order!.id, "paid", {
        paidAt: new Date(),
        paymentMethod: input.method,
        expiresAt,
      });
      return { payment: updated!, order: paidOrder! };
    });

    // 续订阅
    await subscriptionService.upsert(result.order.userId, {
      plan: result.order.plan,
      expiresAt: result.order.expiresAt,
      autoRenew: true,
    });

    logger.info(
      {
        orderId: result.order.id,
        paymentId: result.payment.id,
        userId: result.order.userId,
        plan: result.order.plan,
      },
      "[order] paid via webhook"
    );
    return { order: result.order, paymentId: result.payment.id };
  },

  /** mock 支付时直接标记为 paid（沙盒） */
  async markMockPaid(orderId: string, userId: string): Promise<Order> {
    const o = await orderRepository.findById(orderId);
    if (!o) throw new HttpError(404, "order_not_found");
    if (o.userId !== userId) throw new HttpError(403, "forbidden");
    if (o.status === "paid") return o;
    if (o.status !== "pending") {
      throw new HttpError(409, "order_finalized", `order is ${o.status}`);
    }
    const method = (findMethod(o.paymentMethod ?? "mock")?.id ?? "mock") as PaymentMethod;
    const txnId = `MOCK-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    const res = await this.handlePaidWebhook({
      orderId: o.id,
      method,
      channel: "pc",
      transactionId: txnId,
      amountCents: o.amountCents,
      rawPayload: { mock: true, source: "sandbox" },
    });
    return res.order;
  },

  /** 取消未支付订单 */
  async cancel(orderId: string, userId: string, isAdmin: boolean): Promise<Order> {
    const o = await orderRepository.findById(orderId);
    if (!o) throw new HttpError(404, "order_not_found");
    if (o.userId !== userId && !isAdmin) throw new HttpError(403, "forbidden");
    if (o.status !== "pending") {
      throw new HttpError(409, "cannot_cancel", `order is ${o.status}`);
    }
    const updated = await orderRepository.updateStatus(o.id, "cancelled");
    return updated!;
  },
};
