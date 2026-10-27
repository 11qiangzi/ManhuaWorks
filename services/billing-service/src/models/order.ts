/**
 * Order 模型
 */

import type { PlanId } from "../config/plans";

export type OrderStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled";
export type BillingCycle = "monthly" | "yearly" | "one_time";

export interface OrderRow {
  id: string;
  user_id: string;
  order_no: string;
  plan: PlanId;
  billing_cycle: BillingCycle;
  amount_cents: string | number; // pg bigint → string
  currency: string;
  status: OrderStatus;
  payment_method: string | null;
  paid_at: Date | null;
  expires_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: string;
  userId: string;
  orderNo: string;
  plan: PlanId;
  billingCycle: BillingCycle;
  amountCents: number;
  currency: string;
  status: OrderStatus;
  paymentMethod: string | null;
  paidAt: Date | null;
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    orderNo: row.order_no,
    plan: row.plan,
    billingCycle: row.billing_cycle,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    status: row.status,
    paymentMethod: row.payment_method,
    paidAt: row.paid_at,
    expiresAt: row.expires_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 生成订单号：MHB-yyyyMMddHHmmss-xxxxxx */
export function genOrderNo(now: Date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const stamp =
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .padStart(6, "0")
    .toUpperCase();
  return `MHB-${stamp}-${rand}`;
}
