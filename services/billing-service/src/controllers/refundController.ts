/**
 * Refund Controller
 *  GET   /api/v1/refunds
 *  GET   /api/v1/refunds/:id
 *  POST  /api/v1/refunds
 *  POST  /api/v1/refunds/:id/approve   (admin)
 *  POST  /api/v1/refunds/:id/reject    (admin)
 */

import { Router, Response } from "express";
import { z } from "zod";
import { authRequired, adminOnly, type AuthedRequest } from "../middleware/auth";
import { refundService } from "../services/refundService";
import { ah, HttpError } from "../middleware/error";

const router = Router();

const createSchema = z.object({
  order_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
  amount_cents: z.number().int().positive().optional(),
});

router.get("/", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const isAdmin = (req.user!.role ?? 0) >= 5;
  const list = isAdmin
    ? await refundService.listAll(limit, offset)
    : await refundService.listByUser(req.user!.sub, limit, offset);
  res.json({ code: 0, message: "ok", data: { list, total: list.length } });
}));

router.post("/", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const body = createSchema.parse(req.body);
  const r = await refundService.createRequest({
    orderId: body.order_id,
    userId: req.user!.sub,
    reason: body.reason,
    amountCents: body.amount_cents,
  });
  res.status(201).json({ code: 0, message: "created", data: r });
}));

router.get("/:id", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const r = await refundService.getById(req.params.id!, req.user!.sub, (req.user!.role ?? 0) >= 5);
  res.json({ code: 0, message: "ok", data: r });
}));

router.post("/:id/approve", authRequired(), adminOnly, ah(async (req: AuthedRequest, res: Response) => {
  if (!req.user) throw new HttpError(401, "unauthorized");
  const r = await refundService.approve(req.params.id!, req.user.sub);
  res.json({ code: 0, message: "approved", data: r });
}));

router.post("/:id/reject", authRequired(), adminOnly, ah(async (req: AuthedRequest, res: Response) => {
  if (!req.user) throw new HttpError(401, "unauthorized");
  const r = await refundService.reject(req.params.id!, req.user.sub);
  res.json({ code: 0, message: "rejected", data: r });
}));

export default router;
