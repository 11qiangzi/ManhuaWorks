/**
 * Subscription Controller
 *  GET    /api/v1/subscriptions/me
 *  PUT    /api/v1/subscriptions/me
 *  PATCH  /api/v1/subscriptions/me/renew
 *  POST   /api/v1/subscriptions/cancel
 *  PATCH  /api/v1/subscriptions/me/auto-renew
 *  GET    /api/v1/subscriptions/plans
 *  GET    /api/v1/subscriptions              (admin)
 *  GET    /api/v1/subscriptions/can-create-project
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authRequired, adminOnly, type AuthedRequest } from "../middleware/auth";
import { subscriptionService } from "../services/subscriptionService";
import { subscriptionRepository } from "../repositories/subscriptionRepository";
import { ah } from "../middleware/error";

const router = Router();

const upsertSchema = z.object({
  plan: z.string().min(1),
  expires_at: z.string().datetime().optional(),
  auto_renew: z.boolean().optional(),
});

const renewSchema = z.object({
  extend_days: z.number().int().min(1).max(3650).optional(),
  expires_at: z.string().datetime().optional(),
  auto_renew: z.boolean().optional(),
});

const autoRenewSchema = z.object({
  auto_renew: z.boolean(),
});

router.get("/plans", ah(async (_req: Request, res: Response) => {
  res.json({ code: 0, message: "ok", data: subscriptionService.listPlans() });
}));

/* 全部订阅（admin） */
router.get("/", authRequired(), adminOnly, ah(async (req: AuthedRequest, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const list = await subscriptionRepository.listAll(limit, offset);
  const total = await subscriptionRepository.countAll();
  res.json({ code: 0, message: "ok", data: { list, total } });
}));

router.get("/me", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const sub = await subscriptionService.getOrInit(req.user!.sub);
  res.json({ code: 0, message: "ok", data: sub });
}));

router.put("/me", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const body = upsertSchema.parse(req.body);
  const sub = await subscriptionService.upsert(req.user!.sub, {
    plan: body.plan,
    expiresAt: body.expires_at ? new Date(body.expires_at) : null,
    autoRenew: body.auto_renew,
  });
  res.json({ code: 0, message: "upserted", data: sub });
}));

router.patch("/me/renew", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const body = renewSchema.parse(req.body);
  const sub = await subscriptionService.renew(req.user!.sub, {
    extendDays: body.extend_days,
    expiresAt: body.expires_at ? new Date(body.expires_at) : undefined,
    autoRenew: body.auto_renew,
  });
  res.json({ code: 0, message: "renewed", data: sub });
}));

router.patch("/me/auto-renew", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const body = autoRenewSchema.parse(req.body);
  const sub = await subscriptionService.setAutoRenew(req.user!.sub, body.auto_renew);
  res.json({ code: 0, message: "ok", data: sub });
}));

router.post("/cancel", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const sub = await subscriptionService.cancel(req.user!.sub);
  res.json({ code: 0, message: "cancelled", data: sub });
}));

router.get("/can-create-project", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const result = await subscriptionService.canCreateProject(req.user!.sub);
  res.json({ code: 0, message: "ok", data: result });
}));

export default router;
