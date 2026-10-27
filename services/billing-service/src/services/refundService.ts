/**
 * Refund Service
 * 退款审核：用户申请 → admin 审核 → 状态流转
 */

import { refundRepository } from "../repositories/refundRepository";
import { orderRepository } from "../repositories/orderRepository";
import { paymentRepository } from "../repositories/paymentRepository";
import { subscriptionService } from "./subscriptionService";
import { HttpError } from "../middleware/error";
import type { Refund } from "../models/refund";
import { logger } from "../config/logger";

export interface CreateRefundInput {
  orderId: string;
  userId: string;
  reason?: string;
  /** 不传则全额 */
  amountCents?: number;
}

export const refundService = {
  /** 用户发起退款申请 */
  async createRequest(input: CreateRefundInput): Promise<Refund> {
    const o = await orderRepository.findById(input.orderId);
    if (!o) throw new HttpError(404, "order_not_found");
    if (o.userId !== input.userId) throw new HttpError(403, "forbidden");
    if (o.status !== "paid") {
      throw new HttpError(409, "order_not_paid", "only paid orders can be refunded");
    }
    // 默认全额
    const amount = input.amountCents ?? o.amountCents;
    if (amount <= 0 || amount > o.amountCents) {
      throw new HttpError(400, "invalid_amount");
    }
    // 取最近一笔成功 payment 作为关联
    const ps = await paymentRepository.findByOrderId(o.id);
    const successPay = ps.find((p) => p.status === "success");

    // 已存在 pending 申请则直接返回（防重复）
    const existing = await refundRepository.listByUser(input.userId, 50, 0);
    const dup = existing.find(
      (r) => r.orderId === o.id && r.status === "pending"
    );
    if (dup) return dup;

    const r = await refundRepository.create({
      orderId: o.id,
      paymentId: successPay?.id ?? null,
      userId: input.userId,
      reason: input.reason ?? null,
      amountCents: amount,
    });
    logger.info(
      { refundId: r.id, orderId: o.id, amount },
      "[refund] request created"
    );
    return r;
  },

  async listByUser(userId: string, limit: number, offset: number): Promise<Refund[]> {
    return refundRepository.listByUser(userId, limit, offset);
  },

  async listAll(limit: number, offset: number): Promise<Refund[]> {
    return refundRepository.listAll(limit, offset);
  },

  async countByUser(userId: string): Promise<number> {
    return refundRepository.countByUser(userId);
  },

  async countAll(): Promise<number> {
    return refundRepository.countAll();
  },

  async getById(id: string, userId: string, isAdmin: boolean): Promise<Refund> {
    const r = await refundRepository.findById(id);
    if (!r) throw new HttpError(404, "refund_not_found");
    if (r.userId !== userId && !isAdmin) throw new HttpError(403, "forbidden");
    return r;
  },

  /** admin 审核通过 */
  async approve(id: string, approverId: string): Promise<Refund> {
    const r = await refundRepository.findById(id);
    if (!r) throw new HttpError(404, "refund_not_found");
    if (r.status !== "pending") {
      throw new HttpError(409, "already_processed", `refund is ${r.status}`);
    }
    // 标记订单 refunded
    await orderRepository.updateStatus(r.orderId, "refunded");
    // 把订阅降级到 free
    await subscriptionService.cancel(r.userId);
    // 生成退款流水号
    const refundTxnId = `RFND-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    const updated = await refundRepository.approve(id, approverId, refundTxnId);
    logger.info(
      { refundId: id, approverId, refundTxnId },
      "[refund] approved"
    );
    return updated!;
  },

  /** admin 拒绝 */
  async reject(id: string, approverId: string): Promise<Refund> {
    const r = await refundRepository.findById(id);
    if (!r) throw new HttpError(404, "refund_not_found");
    if (r.status !== "pending") {
      throw new HttpError(409, "already_processed", `refund is ${r.status}`);
    }
    const updated = await refundRepository.reject(id, approverId);
    logger.info({ refundId: id, approverId }, "[refund] rejected");
    return updated!;
  },
};
