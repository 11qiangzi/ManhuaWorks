/**
 * Refund 模型
 */

export type RefundStatus = "pending" | "approved" | "rejected" | "completed";

export interface RefundRow {
  id: string;
  order_id: string;
  payment_id: string | null;
  user_id: string;
  reason: string | null;
  amount_cents: string | number;
  status: RefundStatus;
  approved_by: string | null;
  approved_at: Date | null;
  refund_txn_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Refund {
  id: string;
  orderId: string;
  paymentId: string | null;
  userId: string;
  reason: string | null;
  amountCents: number;
  status: RefundStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  refundTxnId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function rowToRefund(row: RefundRow): Refund {
  return {
    id: row.id,
    orderId: row.order_id,
    paymentId: row.payment_id,
    userId: row.user_id,
    reason: row.reason,
    amountCents: Number(row.amount_cents),
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    refundTxnId: row.refund_txn_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
