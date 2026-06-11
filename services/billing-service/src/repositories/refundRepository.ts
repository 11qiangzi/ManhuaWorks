/**
 * Refund Repository
 */

import { query } from "../config/db";
import type { Refund, RefundRow, RefundStatus } from "../models/refund";
import { rowToRefund } from "../models/refund";

export interface CreateRefundInput {
  orderId: string;
  paymentId?: string | null;
  userId: string;
  reason?: string | null;
  amountCents: number;
}

export const refundRepository = {
  async create(input: CreateRefundInput): Promise<Refund> {
    const { rows } = await query<RefundRow>(
      `INSERT INTO refunds (order_id, payment_id, user_id, reason, amount_cents)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.orderId,
        input.paymentId ?? null,
        input.userId,
        input.reason ?? null,
        input.amountCents,
      ]
    );
    return rowToRefund(rows[0]!);
  },

  async findById(id: string): Promise<Refund | null> {
    const { rows } = await query<RefundRow>(`SELECT * FROM refunds WHERE id = $1`, [id]);
    return rows[0] ? rowToRefund(rows[0]) : null;
  },

  async listByUser(userId: string, limit = 50, offset = 0): Promise<Refund[]> {
    const { rows } = await query<RefundRow>(
      `SELECT * FROM refunds WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows.map(rowToRefund);
  },

  async listAll(limit = 100, offset = 0, status?: RefundStatus): Promise<Refund[]> {
    if (status) {
      const { rows } = await query<RefundRow>(
        `SELECT * FROM refunds WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [status, limit, offset]
      );
      return rows.map(rowToRefund);
    }
    const { rows } = await query<RefundRow>(
      `SELECT * FROM refunds ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows.map(rowToRefund);
  },

  async approve(
    id: string,
    approverId: string,
    refundTxnId?: string | null
  ): Promise<Refund | null> {
    const { rows } = await query<RefundRow>(
      `UPDATE refunds
          SET status = 'completed',
              approved_by = $2,
              approved_at = NOW(),
              refund_txn_id = COALESCE($3, refund_txn_id)
        WHERE id = $1
        RETURNING *`,
      [id, approverId, refundTxnId ?? null]
    );
    return rows[0] ? rowToRefund(rows[0]) : null;
  },

  async reject(id: string, approverId: string): Promise<Refund | null> {
    const { rows } = await query<RefundRow>(
      `UPDATE refunds
          SET status = 'rejected',
              approved_by = $2,
              approved_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [id, approverId]
    );
    return rows[0] ? rowToRefund(rows[0]) : null;
  },

  async setStatus(id: string, status: RefundStatus): Promise<Refund | null> {
    const { rows } = await query<RefundRow>(
      `UPDATE refunds SET status = $2 WHERE id = $1 RETURNING *`,
      [id, status]
    );
    return rows[0] ? rowToRefund(rows[0]) : null;
  },
};
