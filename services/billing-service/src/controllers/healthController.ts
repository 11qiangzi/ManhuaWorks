/**
 * Health Controller
 */

import { Router, Request, Response } from "express";
import { getPool } from "../config/db";
import { env } from "../config/env";
import { ah } from "../middleware/error";

const router = Router();

router.get(
  "/health",
  ah(async (_req: Request, res: Response) => {
    let dbOk = false;
    let dbErr: string | undefined;
    try {
      const r = await getPool().query("SELECT 1 AS ok");
      dbOk = r.rows?.[0]?.ok === 1;
    } catch (err) {
      dbErr = err instanceof Error ? err.message : String(err);
    }
    res.json({
      code: dbOk ? 0 : 500,
      message: dbOk ? "ok" : "degraded",
      data: {
        service: "billing-service",
        version: "0.1.0",
        uptime_sec: Math.floor(process.uptime()),
        env: env.NODE_ENV,
        db: { ok: dbOk, error: dbErr },
        ts: new Date().toISOString(),
      },
    });
  })
);

/* GET /ready — 探活（始终返回 200，DB 仅作为信息字段） */
router.get("/ready", (_req: Request, res: Response) => {
  res.json({
    code: 0,
    message: "ready",
    data: {
      service: "billing-service",
      version: "0.1.0",
      ts: new Date().toISOString(),
    },
  });
});

router.get("/", (_req: Request, res: Response) => {
  res.json({
    code: 0,
    message: "ManhuaWorks billing-service",
    data: {
      service: "billing-service",
      version: "0.1.0",
      port: env.PORT,
      endpoints: [
        "GET  /health",
        "GET  /api/v1/subscriptions/plans",
        "GET  /api/v1/subscriptions/me",
        "PUT  /api/v1/subscriptions/me",
        "PATCH /api/v1/subscriptions/me/renew",
        "PATCH /api/v1/subscriptions/me/auto-renew",
        "POST /api/v1/subscriptions/cancel",
        "GET  /api/v1/subscriptions/can-create-project",
        "POST /api/v1/orders",
        "GET  /api/v1/orders",
        "GET  /api/v1/orders/:id",
        "POST /api/v1/orders/:id/pay",
        "POST /api/v1/orders/webhook",
        "POST /api/v1/orders/:id/cancel",
        "GET  /api/v1/invoices",
        "POST /api/v1/invoices",
        "GET  /api/v1/invoices/:id",
        "GET  /api/v1/invoices/:id/pdf",
        "POST /api/v1/invoices/:id/void",
        "GET  /api/v1/payment/methods",
        "POST /api/v1/payment/mock",
        "GET  /api/v1/quota",
        "GET  /api/v1/quota/usage",
        "POST /api/v1/quota/reset",
        "PUT  /api/v1/quota",
        "POST /api/v1/quota/consume",
        "GET  /api/v1/refunds",
        "POST /api/v1/refunds",
        "GET  /api/v1/refunds/:id",
        "POST /api/v1/refunds/:id/approve",
        "POST /api/v1/refunds/:id/reject",
        "GET  /ready",
        "POST /api/v1/billing/cost-logs",
        "GET  /api/v1/billing/cost-logs",
        "GET  /api/v1/billing/cost-logs/aggregate",
        "GET  /api/v1/billing/cost-logs/by-provider",
      ],
    },
  });
});

export default router;
