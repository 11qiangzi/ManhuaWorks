﻿﻿﻿/**
 * billing admin routes �?admin 计费管理 + 退款审�? *
 * P0 D5 �?billing-service admin 端点 (派单 22B)
 * 鉴权: requireAuth() + requireRole(5)
 *
 * 端点:
 *   GET    /api/v1/admin/billing/summary  �?计费概览 (D5)
 *   GET    /api/v1/admin/billing/overview �?详细概览 (P1.3)
 *   GET    /api/v1/admin/refunds          �?退款申请列�?(P1.3)
 *   POST   /api/v1/admin/refunds/:id/approve �?审批通过 (P1.3)
 *   POST   /api/v1/admin/refunds/:id/reject  �?审批拒绝 (P1.3)
 */
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { requireAuth, requireRole, getUser } from "@manhuaworks/shared";
import { ah, HttpError } from "../middleware/error";
import { query, withTransaction } from "../config/db";
import { logger } from "../config/logger";
import { z } from "zod";

export const billingAdminRouter = Router();

// ─── 全部端点�?auth + requireRole(5) ───
billingAdminRouter.use(requireAuth() as unknown as import("express").RequestHandler);
billingAdminRouter.use(requireRole(5) as unknown as import("express").RequestHandler);

/* ============== GET /api/v1/admin/billing/summary (D5) ============== */
billingAdminRouter.get(
  "/summary",
  ah(async (_req: Request, res: Response) => {
    const [
      totalRevenue,
      totalRecharges,
      activeSubscriptions,
      todayRevenue,
    ] = await Promise.all([
      query<{ sum: string }>(
        `SELECT COALESCE(SUM(balance_cents), 0)::text AS sum FROM user_balances`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM invoices WHERE status = 'paid'`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM user_balances WHERE balance_cents > 0`
      ),
      query<{ sum: string }>(
        `SELECT COALESCE(SUM(amount_cents), 0)::text AS sum
         FROM invoices
         WHERE status = 'paid' AND issued_at >= CURRENT_DATE`
      ),
    ]);

    res.json({
      code: 0,
      message: "ok",
      data: {
        totalRevenue: Math.round(Number(totalRevenue.rows[0]?.sum ?? 0) / 100),
        totalRecharges: Number(totalRecharges.rows[0]?.count ?? 0),
        activeSubscriptions: Number(activeSubscriptions.rows[0]?.count ?? 0),
        todayRevenue: Math.round(Number(todayRevenue.rows[0]?.sum ?? 0) / 100),
      },
    });
  })
);

/* ============== GET /api/v1/admin/billing/overview (P1.3) ============== */
billingAdminRouter.get(
  "/overview",
  ah(async (_req: Request, res: Response) => {
    const [
      totalRevenue,
      totalRecharges,
      activeSubscriptions,
      todayRevenue,
      pendingRefunds,
      totalCostLogs,
    ] = await Promise.all([
      query<{ sum: string }>(
        `SELECT COALESCE(SUM(balance_cents), 0)::text AS sum FROM user_balances`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM invoices WHERE status = 'paid'`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM user_balances WHERE balance_cents > 0`
      ),
      query<{ sum: string }>(
        `SELECT COALESCE(SUM(amount_cents), 0)::text AS sum
         FROM invoices WHERE status = 'paid' AND issued_at >= CURRENT_DATE`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM refunds WHERE status = 'pending'`
      ),
      query<{ sum: string }>(
        `SELECT COALESCE(SUM(cost_cents), 0)::text AS sum FROM cost_logs
         WHERE created_at >= CURRENT_DATE`
      ),
    ]);

    res.json({
      code: 0,
      message: "ok",
      data: {
        totalRevenue: Math.round(Number(totalRevenue.rows[0]?.sum ?? 0) / 100),
        totalRecharges: Number(totalRecharges.rows[0]?.count ?? 0),
        activeSubscriptions: Number(activeSubscriptions.rows[0]?.count ?? 0),
        todayRevenue: Math.round(Number(todayRevenue.rows[0]?.sum ?? 0) / 100),
        pendingRefunds: Number(pendingRefunds.rows[0]?.count ?? 0),
        todayCostUsd: Math.round(Number(totalCostLogs.rows[0]?.sum ?? 0) / 100),
      },
    });
  })
);

/* ============== GET /api/v1/admin/refunds (P1.3) ============== */
const RefundListQuery = z.object({
  status: z.string().optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

billingAdminRouter.get(
  "/refunds",
  ah(async (req: Request, res: Response) => {
    const q = RefundListQuery.parse(req.query);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (q.status) {
      conditions.push(`status = $${idx++}`);
      params.push(q.status);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT id, user_id, order_id, amount_cents, currency, reason, status, created_at, updated_at
         FROM refunds ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, q.limit, q.offset]
      ),
      query(
        `SELECT COUNT(*)::text AS count FROM refunds ${where}`,
        params
      ),
    ]);

    res.json({
      code: 0,
      message: "ok",
      data: {
        items: dataRes.rows,
        total: Number(countRes.rows[0]?.count ?? 0),
        limit: q.limit,
        offset: q.offset,
      },
    });
  })
);

/* ============== POST /api/v1/admin/refunds/:id/approve (P1.3) ============== */
billingAdminRouter.post(
  "/refunds/:id/approve",
  ah(async (req: Request, res: Response) => {
    const refundId = req.params.id;

    await withTransaction(async (client) => {
      const refund = await client.query<{
        id: string; user_id: string; amount_cents: string; order_id: string; status: string
      }>(
        `SELECT id, user_id, amount_cents, order_id, status
         FROM refunds WHERE id = $1 FOR UPDATE`,
        [refundId]
      );
      if (refund.rowCount === 0) throw new HttpError(404, "refund_not_found");
      if (refund.rows[0]!.status !== "pending") {
        throw new HttpError(400, "refund_not_pending");
      }

      const { user_id, amount_cents } = refund.rows[0]!;
      const amount = Number(amount_cents);

      // Deduct balance
      await client.query(
        `UPDATE user_balances
         SET balance_cents = balance_cents - $1, updated_at = NOW()
         WHERE user_id = $2`,
        [amount, user_id]
      );

      // 标记 refund approved
      await client.query(
        `UPDATE refunds SET status = 'approved', updated_at = NOW() WHERE id = $1`,
        [refundId]
      );
    });

    logger.info({ refundId }, "[billing-admin] refund approved");
    res.json({ code: 0, message: "refund_approved", data: { id: refundId } });
  })
);

/* ============== POST /api/v1/admin/refunds/:id/reject (P1.3) ============== */
billingAdminRouter.post(
  "/refunds/:id/reject",
  ah(async (req: Request, res: Response) => {
    const refundId = req.params.id;

    const refund = await query<{ status: string }>(
      `SELECT status FROM refunds WHERE id = $1 LIMIT 1`,
      [refundId]
    );
    if (refund.rowCount === 0) throw new HttpError(404, "refund_not_found");
    if (refund.rows[0]!.status !== "pending") {
      throw new HttpError(400, "refund_not_pending");
    }

    await query(
      `UPDATE refunds SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
      [refundId]
    );

    logger.info({ refundId }, "[billing-admin] refund rejected");
    res.json({ code: 0, message: "refund_rejected", data: { id: refundId } });
  })
);

// ══════════════════════════════════════════════════════════════
// P2 新增端点 (派单 48 — 谢擎 2026-06-10)
// ══════════════════════════════════════════════════════════════

/* ============== GET /api/v1/admin/invoices ============== */
const InvoiceListQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['issued', 'draft', 'void']).optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

billingAdminRouter.get(
  '/invoices',
  ah(async (req: Request, res: Response) => {
    const q = InvoiceListQuery.parse(req.query);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (q.status) {
      conditions.push(`i.status = $${idx++}`);
      params.push(q.status);
    }
    if (q.userId) {
      conditions.push(`i.user_id = $${idx++}`);
      params.push(q.userId);
    }
    if (q.dateFrom) {
      conditions.push(`i.issued_at >= $${idx++}`);
      params.push(q.dateFrom);
    }
    if (q.dateTo) {
      conditions.push(`i.issued_at <= $${idx++}`);
      params.push(q.dateTo);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT i.id, i.invoice_no, i.title, i.tax_id, i.amount_cents,
                i.currency, i.status, i.pdf_path, i.issued_at,
                u.email AS user_email, u.display_name AS user_name,
                o.order_no
         FROM invoices i
         LEFT JOIN users u ON u.id = i.user_id
         LEFT JOIN orders o ON o.id = i.order_id
         ${where}
         ORDER BY i.issued_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, q.limit, q.offset]
      ),
      query(
        `SELECT COUNT(*)::text AS count FROM invoices i ${where}`,
        params
      ),
    ]);

    const items = dataRes.rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      invoiceNo: r.invoice_no,
      title: r.title,
      taxId: r.tax_id,
      amount: Math.round(Number(r.amount_cents) / 100),
      amountCents: Number(r.amount_cents),
      currency: r.currency,
      status: r.status,
      pdfPath: r.pdf_path,
      issuedAt: r.issued_at,
      userEmail: (r as any).user_email,
      userName: (r as any).user_name,
      orderNo: (r as any).order_no,
    }));

    res.json({
      code: 0,
      message: 'ok',
      data: {
        items,
        total: Number(countRes.rows[0]?.count ?? 0),
        limit: q.limit,
        offset: q.offset,
      },
    });
  })
);

/* ============== POST /api/v1/admin/billing/charge ============== */
const ChargeBody = z.object({
  userId: z.string().uuid(),
  amount: z.number().min(-1000000).max(1000000),
  reason: z.string().min(1).max(500),
  currency: z.enum(['CNY', 'USD']).default('CNY'),
});

billingAdminRouter.post(
  '/charge',
  ah(async (req: Request, res: Response) => {
    const body = ChargeBody.parse(req.body);
    const amountCents = Math.round(body.amount * 100);

    // 校验用户
    const userCheck = await query<{ id: string; display_name: string }>(
      'SELECT id, display_name FROM users WHERE id = $1 LIMIT 1',
      [body.userId]
    );
    if (userCheck.rowCount === 0) {
      throw new HttpError(404, 'user_not_found');
    }

    // 确保 user_balances 行存在
    await query(
      `INSERT INTO user_balances (user_id, balance_cents)
       VALUES ($1, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [body.userId]
    );

    // 扣款时检查余额
    if (amountCents < 0) {
      const bal = await query<{ balance_cents: string }>(
        'SELECT balance_cents::text FROM user_balances WHERE user_id = $1 FOR UPDATE',
        [body.userId]
      );
      const current = Number(bal.rows[0]?.balance_cents ?? 0);
      if (current + amountCents < 0) {
        throw new HttpError(400, 'insufficient_balance');
      }
    }

    // 执行余额变更
    await query(
      `UPDATE user_balances
       SET balance_cents = balance_cents + $1, updated_at = NOW()
       WHERE user_id = $2`,
      [amountCents, body.userId]
    );

    logger.info({
      userId: body.userId,
      userName: userCheck.rows[0]?.display_name,
      amountCents,
      reason: body.reason,
    }, '[admin] manual charge');

    res.json({
      code: 0,
      message: 'charge_applied',
      data: {
        userId: body.userId,
        userName: userCheck.rows[0]?.display_name,
        amount: body.amount,
        amountCents,
        currency: body.currency,
        reason: body.reason,
        appliedAt: new Date().toISOString(),
      },
    });
  })
);

export default billingAdminRouter;
