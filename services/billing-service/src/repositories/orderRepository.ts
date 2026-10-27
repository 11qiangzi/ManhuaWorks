/**
 * Order Repository
 */

import { query } from "../config/db";
import type { Order, OrderRow, OrderStatus, BillingCycle } from "../models/order";
import { rowToOrder } from "../models/order";
import type { PlanId } from "../config/plans";

export interface CreateOrderInput {
  userId: string;
  orderNo: string;
  plan: PlanId;
  billingCycle?: BillingCycle;
  amountCents: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export const orderRepository = {
  async create(input: CreateOrderInput): Promise<Order> {
    const { rows } = await query<OrderRow>(
      `INSERT INTO orders (user_id, order_no, plan, billing_cycle, amount_cents, currency, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.userId,
        input.orderNo,
        input.plan,
        input.billingCycle ?? "monthly",
        input.amountCents,
        input.currency ?? "CNY",
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    return rowToOrder(rows[0]!);
  },

  async findById(id: string): Promise<Order | null> {
    const { rows } = await query<OrderRow>(`SELECT * FROM orders WHERE id = $1 LIMIT 1`, [id]);
    return rows[0] ? rowToOrder(rows[0]) : null;
  },

  async findByOrderNo(orderNo: string): Promise<Order | null> {
    const { rows } = await query<OrderRow>(
      `SELECT * FROM orders WHERE order_no = $1 LIMIT 1`,
      [orderNo]
    );
    return rows[0] ? rowToOrder(rows[0]) : null;
  },

  async listByUser(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<Order[]> {
    const { rows } = await query<OrderRow>(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows.map(rowToOrder);
  },

  async listAll(limit = 100, offset = 0, status?: OrderStatus): Promise<Order[]> {
    if (status) {
      const { rows } = await query<OrderRow>(
        `SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [status, limit, offset]
      );
      return rows.map(rowToOrder);
    }
    const { rows } = await query<OrderRow>(
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows.map(rowToOrder);
  },

  async updateStatus(
    id: string,
    status: OrderStatus,
    extra: { paidAt?: Date; paymentMethod?: string; expiresAt?: Date } = {}
  ): Promise<Order | null> {
    const { rows } = await query<OrderRow>(
      `UPDATE orders
         SET status = $2,
             paid_at = COALESCE($3, paid_at),
             payment_method = COALESCE($4, payment_method),
             expires_at = COALESCE($5, expires_at)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        extra.paidAt ?? null,
        extra.paymentMethod ?? null,
        extra.expiresAt ?? null,
      ]
    );
    return rows[0] ? rowToOrder(rows[0]) : null;
  },

  async countByUser(userId: string): Promise<number> {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM orders WHERE user_id = $1`,
      [userId]
    );
    return Number(rows[0]?.count ?? 0);
  },

  async findPaidByUserAndPlan(userId: string, plan: string): Promise<Order | null> {
    const { rows } = await query<OrderRow>(
      `SELECT * FROM orders
        WHERE user_id = $1 AND plan = $2 AND status = 'paid'
        ORDER BY paid_at DESC NULLS LAST
        LIMIT 1`,
      [userId, plan]
    );
    return rows[0] ? rowToOrder(rows[0]) : null;
  },
};
