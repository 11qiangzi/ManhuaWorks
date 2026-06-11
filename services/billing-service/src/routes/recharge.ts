﻿﻿/**
 * Recharge 路由
 * ManhuaWorks · L5-D · 真实账号 + 充值（mock 支付�? *
 * 端点（全部在 /api/v1/billing 命名空间）：
 *   POST /billing/recharge    充值：body { userId, amount, currency? }
 *   GET  /billing/balance     当前用户余额
 *   GET  /billing/invoices    当前用户发票列表�?充值历史）
 *
 * 鉴权：复�?user-service �?HS256 JWT（共�?JWT_SECRET�? * 支付：纯 mock，sleep 100ms �?95% 成功；留 payHook 给真支付接入
 * 数据：写�?user_balances（自管表�? invoices + payments
 *
 * 5 步流程：
 *   1) 校验 user 存在 + currency 合法
 *   2) 创建 invoice (status=issued)
 *   3) 模拟支付：sleep 100ms，random 95% 成功
 *   4) 创建 payment (status=success/failed) + transaction_id
 *   5) 更新 user_balances.balance_cents（成功时 +amount，失败时不动�? */

import { Router, Request, Response } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { requireAuth, getUser } from "@manhuaworks/shared";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { ah, HttpError } from "../middleware/error";
import { query, withTransaction } from "../config/db";
import { genInvoiceNo } from "../models/invoice";

const router = Router();

/* ------------------------------------------------------------------ */
/*  验证 schema                                                         */
/* ------------------------------------------------------------------ */

const ALLOWED_CURRENCIES = ["USD", "CNY", "EUR", "JPY"] as const;
type Currency = (typeof ALLOWED_CURRENCIES)[number];

const rechargeBodySchema = z.object({
  userId: z.string().uuid("invalid userId (must be uuid)"),
  amount: z.number().positive().max(1_000_000, "amount too large"),
  currency: z.enum(ALLOWED_CURRENCIES).default("USD"),
  //?key 重试返回�?invoice，不重复扣款�?  idempotencyKey: z.string().min(8).max(128).optional(),
});

const listInvoicesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/* ------------------------------------------------------------------ */
/*  辅助：随机成�?失败 + 模拟延迟                                       */
/* ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function mockPayOutcome(): { ok: boolean; reason?: string; transactionId: string } {
  const txnId = `MOCK-${Date.now()}-${Math.floor(Math.random() * 1e8).toString(36).toUpperCase()}`;
  // 95% 成功
  const ok = Math.random() < 0.95;
  return ok
    ? { ok: true, transactionId: txnId }
    : { ok: false, reason: "mock_random_failure", transactionId: txnId };
}

/**
 * 留给真实支付接入�?hook
 * 当前实现：mock 5 步流�? * 真实接入时替换为：调 stripe / 支付�?/ 微信 �?�?transactionId �?回调
 */
export interface RechargeHookInput {
  userId: string;
  amountCents: number;
  currency: Currency;
  invoiceId: string;
  invoiceNo: string;
}
export interface RechargeHookOutput {
  ok: boolean;
  transactionId: string;
  rawPayload?: Record<string, unknown>;
  reason?: string;
}

export async function defaultRechargeHook(_input: RechargeHookInput): Promise<RechargeHookOutput> {
  // 模拟 100ms 延迟
  await sleep(100);
  const o = mockPayOutcome();
  return {
    ok: o.ok,
    transactionId: o.transactionId,
    reason: o.reason,
    rawPayload: { mock: true, ts: Date.now() },
  };
}

/* ------------------------------------------------------------------ */
/*  工具：查/更新余额                                                   */
/* ------------------------------------------------------------------ */

interface UserBalanceRow {
  user_id: string;
  balance_cents: string;
  currency: string;
  updated_at: Date;
}

async function findUserById(userId: string): Promise<{ id: string; email: string | null; display_name: string | null } | null> {
  const r = await query<{ id: string; email: string | null; display_name: string | null }>(
    `SELECT id, email, display_name FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return r.rows[0] ?? null;
}

async function getBalance(userId: string): Promise<{ balanceCents: number; currency: string; updatedAt: Date }> {
  const r = await query<UserBalanceRow>(
    `SELECT user_id, balance_cents, currency, updated_at
       FROM user_balances WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  if (!r.rows[0]) {
    // Auto-create zero balance account if not exists
    await query(
      `INSERT INTO user_balances (user_id, balance_cents, currency)
       VALUES ($1, 0, 'USD')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    return { balanceCents: 0, currency: "USD", updatedAt: new Date() };
  }
  return {
    balanceCents: Number(r.rows[0].balance_cents),
    currency: r.rows[0].currency,
    updatedAt: r.rows[0].updated_at,
  };
}

async function getBalanceForUpdate(
  client: import("pg").PoolClient,
  userId: string
): Promise<{ balanceCents: number; currency: string }> {
  const r = await client.query<UserBalanceRow>(
    `SELECT user_id, balance_cents, currency, updated_at
       FROM user_balances WHERE user_id = $1 FOR UPDATE`,
    [userId]
  );
  if (!r.rows[0]) {
    await client.query(
      `INSERT INTO user_balances (user_id, balance_cents, currency) VALUES ($1, 0, 'USD')`,
      [userId]
    );
    return { balanceCents: 0, currency: "USD" };
  }
  return {
    balanceCents: Number(r.rows[0].balance_cents),
    currency: r.rows[0].currency,
  };
}

/* ------------------------------------------------------------------ */
/*  端点 1: POST /billing/recharge                                     */
/* ------------------------------------------------------------------ */

router.post(
  "/recharge",
  requireAuth(),
  ah(async (req: Request, res: Response) => {
    const body = rechargeBodySchema.parse(req.body);

    //?admin/ops 可代他人充值；普通用户只能给自己
    const caller = req.user!;
    const isAdmin = (caller.role ?? 0) >= 4;
    if (body.userId !== caller.sub && !isAdmin) {
      throw new HttpError(403, "forbidden", "cannot recharge for another user");
    }

    // 1) 校验 user
    const target = await findUserById(body.userId);
    if (!target) {
      throw new HttpError(404, "user_not_found", `user ${body.userId} not found`);
    }

    //?返回已存在的 invoice
    if (body.idempotencyKey) {
      const exist = await query<{ id: string; invoice_no: string; title: string; amount_cents: string; currency: string; status: string; issued_at: Date }>(
        `SELECT id, invoice_no, title, amount_cents, currency, status, issued_at
           FROM invoices
          WHERE user_id = $1 AND title = $2
          ORDER BY created_at DESC LIMIT 1`,
        [body.userId, `recharge:${body.idempotencyKey}`]
      );
      if (exist.rows[0]) {
        res.status(200).json({
          code: 0,
          message: "idempotent_replay",
          data: {
            invoice: {
              id: exist.rows[0].id,
              invoiceNo: exist.rows[0].invoice_no,
              title: exist.rows[0].title,
              amountCents: Number(exist.rows[0].amount_cents),
              currency: exist.rows[0].currency,
              status: exist.rows[0].status,
              issuedAt: exist.rows[0].issued_at,
            },
            idempotent: true,
          },
        });
        return;
      }
    }

    const amountCents = Math.round(body.amount * 100);
    const invoiceNo = genInvoiceNo();
    const title = body.idempotencyKey
      ? `recharge:${body.idempotencyKey}`
      : `recharge:${invoiceNo}`;

    //?+ mock hook
    const out = await withTransaction(async (client) => {
      // 2) invoice (status:issued)
      const inv = await client.query<{ id: string; issued_at: Date }>(
        `INSERT INTO invoices (user_id, invoice_no, title, amount_cents, currency, status)
         VALUES ($1, $2, $3, $4, $5, 'issued') RETURNING id, issued_at`,
        [body.userId, invoiceNo, title, amountCents, body.currency]
      );
      const invoiceId = inv.rows[0]!.id;

      const hook = await defaultRechargeHook({
        userId: body.userId,
        amountCents,
        currency: body.currency,
        invoiceId,
        invoiceNo,
      });

      //?pending order �?payment 关联�?      const orderNo = `RC-${invoiceNo}`;
      const ord = await client.query<{ id: string }>(
        `INSERT INTO orders (user_id, order_no, plan, billing_cycle, amount_cents, currency, status, payment_method)
         VALUES ($1, $2, 'free', 'one_time', $3, $4, 'pending', 'mock')
         RETURNING id`,
        [body.userId, orderNo, amountCents, body.currency]
      );
      const orderId = ord.rows[0]!.id;

      //?order
      await client.query(`UPDATE invoices SET order_id = $1 WHERE id = $2`, [orderId, invoiceId]);

      //?payment
      await client.query(
        `INSERT INTO payments (order_id, method, channel, amount_cents, currency, status, transaction_id, sandbox, raw_payload)
         VALUES ($1, 'mock', 'pc', $2, $3, $4, $5, TRUE, $6::jsonb)`,
        [
          orderId,
          amountCents,
          body.currency,
          hook.ok ? "success" : "failed",
          hook.transactionId,
          JSON.stringify(hook.rawPayload ?? {}),
        ]
      );

      // 5) 余额（成功才加；加锁防并发）
      let balanceCents: number;
      if (hook.ok) {
        const before = await getBalanceForUpdate(client, body.userId);
        const after = before.balanceCents + amountCents;
        await client.query(
          `UPDATE user_balances SET balance_cents = $2, currency = $3, updated_at = NOW() WHERE user_id = $1`,
          [body.userId, after, body.currency]
        );
        // 标记 order paid
        await client.query(
          `UPDATE orders SET status = 'paid', paid_at = NOW(), payment_method = 'mock' WHERE id = $1`,
          [orderId]
        );
        balanceCents = after;
      } else {
        //?order failed，不动余�?        await client.query(`UPDATE orders SET status = 'failed' WHERE id = $1`, [orderId]);
        balanceCents = (await getBalanceForUpdate(client, body.userId)).balanceCents;
      }

      return {
        invoiceId,
        invoiceNo,
        orderId,
        transactionId: hook.transactionId,
        ok: hook.ok,
        reason: hook.reason,
        balanceCents,
        amountCents,
        currency: body.currency,
      };
    });

    logger.info(
      {
        userId: body.userId,
        amountCents: out.amountCents,
        currency: out.currency,
        ok: out.ok,
        invoiceNo: out.invoiceNo,
        transactionId: out.transactionId,
        balanceCents: out.balanceCents,
      },
      "[recharge] processed"
    );

    const status = out.ok ? 201 : 402; // Payment Required
    res.status(status).json({
      code: out.ok ? 0 : 402,
      message: out.ok ? "recharged" : "payment_failed",
      data: {
        ok: out.ok,
        reason: out.reason ?? null,
        invoice: {
          id: out.invoiceId,
          invoiceNo: out.invoiceNo,
          amountCents: out.amountCents,
          currency: out.currency,
        },
        payment: {
          method: "mock",
          transactionId: out.transactionId,
          status: out.ok ? "success" : "failed",
        },
        balance: {
          balanceCents: out.balanceCents,
          currency: out.currency,
        },
        idempotent: false,
      },
    });
  })
);

/* ------------------------------------------------------------------ */
/*  端点 2: GET /billing/balance                                       */
/* ------------------------------------------------------------------ */

router.get(
  "/balance",
  requireAuth(),
  ah(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const bal = await getBalance(userId);
    res.json({
      code: 0,
      message: "ok",
      data: {
        userId,
        balanceCents: bal.balanceCents,
        balance: bal.balanceCents / 100,
        currency: bal.currency,
        updatedAt: bal.updatedAt,
      },
    });
  })
);

/* ------------------------------------------------------------------ */
/*  端点 3: GET /billing/invoices                                      */
/* ------------------------------------------------------------------ */

router.get(
  "/invoices",
  requireAuth(),
  ah(async (req: Request, res: Response) => {
    const q = listInvoicesQuerySchema.parse(req.query);
    const userId = req.user!.sub;

    const r = await query<{
      id: string;
      invoice_no: string;
      title: string;
      amount_cents: string;
      currency: string;
      status: string;
      issued_at: Date;
      created_at: Date;
    }>(
      `SELECT id, invoice_no, title, amount_cents, currency, status, issued_at, created_at
         FROM invoices
        WHERE user_id = $1
        ORDER BY issued_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, q.limit, q.offset]
    );
    const total = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM invoices WHERE user_id = $1`,
      [userId]
    );

    res.json({
      code: 0,
      message: "ok",
      data: {
        list: r.rows.map((row) => ({
          id: row.id,
          invoiceNo: row.invoice_no,
          title: row.title,
          amountCents: Number(row.amount_cents),
          currency: row.currency,
          status: row.status,
          issuedAt: row.issued_at,
          createdAt: row.created_at,
        })),
        total: Number(total.rows[0]?.count ?? 0),
        limit: q.limit,
        offset: q.offset,
      },
    });
  })
);

/* ------------------------------------------------------------------ */
/*  健康端点（测试用�?                                                  */
/* ------------------------------------------------------------------ */

router.get(
  "/ping",
  ah(async (_req: Request, res: Response) => {
    res.json({ code: 0, message: "pong", data: { ts: new Date().toISOString() } });
  })
);

/* ------------------------------------------------------------------ */
/*  测试用辅助：直接�?JWT 解码（仅供测�?/ 不暴露到生产�?             */
/* ------------------------------------------------------------------ */

/** 测试辅助：解码当前请�?token（不签名校验�?*/
export function _unsafeDecode(token: string): jwt.JwtPayload | null {
  try {
    return jwt.decode(token) as jwt.JwtPayload | null;
  } catch {
    return null;
  }
}

/** 测试辅助：签�?token（仅测试用） */
export function _signTestToken(userId: string, role = 1): string {
  return jwt.sign({ sub: userId, role, typ: "access" }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
}

export default router;
