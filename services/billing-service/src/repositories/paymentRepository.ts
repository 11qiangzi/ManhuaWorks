/**
 * Payment Repository
 */

import { query } from "../config/db";
import type { Payment, PaymentRow, PaymentMethod, PaymentChannel, PaymentStatus } from "../models/payment";
import { rowToPayment } from "../models/payment";

export interface CreatePaymentInput {
  orderId: string;
  method: PaymentMethod;
  channel: PaymentChannel;
  amountCents: number;
  currency?: string;
  sandbox?: boolean;
  rawPayload?: Record<string, unknown>;
}

export const paymentRepository = {
  async create(input: CreatePaymentInput): Promise<Payment> {
    const { rows } = await query<PaymentRow>(
      `INSERT INTO payments (order_id, method, channel, amount_cents, currency, sandbox, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.orderId,
        input.method,
        input.channel,
        input.amountCents,
        input.currency ?? "CNY",
        input.sandbox ?? true,
        JSON.stringify(input.rawPayload ?? {}),
      ]
    );
    return rowToPayment(rows[0]!);
  },

  async findById(id: string): Promise<Payment | null> {
    const { rows } = await query<PaymentRow>(`SELECT * FROM payments WHERE id = $1`, [id]);
    return rows[0] ? rowToPayment(rows[0]) : null;
  },

  async findByOrderId(orderId: string): Promise<Payment[]> {
    const { rows } = await query<PaymentRow>(
      `SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC`,
      [orderId]
    );
    return rows.map(rowToPayment);
  },

  async findByTransactionId(txnId: string): Promise<Payment | null> {
    const { rows } = await query<PaymentRow>(
      `SELECT * FROM payments WHERE transaction_id = $1 LIMIT 1`,
      [txnId]
    );
    return rows[0] ? rowToPayment(rows[0]) : null;
  },

  async setStatus(
    id: string,
    status: PaymentStatus,
    transactionId?: string | null,
    rawPayload?: Record<string, unknown>
  ): Promise<Payment | null> {
    const { rows } = await query<PaymentRow>(
      `UPDATE payments
          SET status = $2,
              transaction_id = COALESCE($3, transaction_id),
              raw_payload = COALESCE($4::jsonb, raw_payload)
        WHERE id = $1
        RETURNING *`,
      [
        id,
        status,
        transactionId ?? null,
        rawPayload ? JSON.stringify(rawPayload) : null,
      ]
    );
    return rows[0] ? rowToPayment(rows[0]) : null;
  },

  async listByUser(userId: string, limit = 50, offset = 0): Promise<Payment[]> {
    const { rows } = await query<PaymentRow>(
      `SELECT p.* FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE o.user_id = $1
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows.map(rowToPayment);
  },
};
