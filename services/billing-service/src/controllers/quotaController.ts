/**
 * Quota Controller
 *  GET   /api/v1/quota
 *  GET   /api/v1/quota/usage       (admin)
 *  POST  /api/v1/quota/reset       (admin)
 *  POST  /api/v1/quota/consume     (内部 / billing 回调)
 *  PUT   /api/v1/quota             (admin)
 *
 * 配额统一使用"次"（episodes）计量。
 */

import { Router, Response } from "express";
import { z } from "zod";
import { authRequired, adminOnly, type AuthedRequest } from "../middleware/auth";
import { quotaService } from "../services/quotaService";
import { ah, HttpError } from "../middleware/error";

const router = Router();

router.get("/", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const q = await quotaService.getForUser(req.user!.sub);
  res.json({ code: 0, message: "ok", data: q });
}));

router.get("/usage", authRequired(), adminOnly, ah(async (_req, res: Response) => {
  const usage = await quotaService.totalUsage();
  res.json({ code: 0, message: "ok", data: usage });
}));

router.post("/reset", authRequired(), adminOnly, ah(async (req: AuthedRequest, res: Response) => {
  // 管理员可以传 target user_id，否则自己
  const targetUserId = (req.body?.user_id as string | undefined) ?? req.user!.sub;
  const q = await quotaService.reset(targetUserId, true);
  res.json({ code: 0, message: "reset", data: q });
}));

const setSchema = z.object({
  user_id: z.string().uuid().optional(),
  monthly_episodes: z.number().int().min(-1).optional(),
});

router.put("/", authRequired(), adminOnly, ah(async (req: AuthedRequest, res: Response) => {
  const body = setSchema.parse(req.body);
  const target = body.user_id ?? req.user!.sub;
  const q = await quotaService.setMonthly(target, true, {
    monthlyEpisodes: body.monthly_episodes,
  });
  res.json({ code: 0, message: "ok", data: q });
}));

const consumeSchema = z.object({
  amount: z.number().int().min(1).max(1_000_000),
  user_id: z.string().uuid().optional(),
});

router.post("/consume", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const body = consumeSchema.parse(req.body);
  const isAdmin = (req.user!.role ?? 0) >= 5;
  const target = body.user_id ?? req.user!.sub;
  if (target !== req.user!.sub && !isAdmin) {
    throw new HttpError(403, "forbidden");
  }
  const result = await quotaService.consume(target, body.amount);
  if (!result.ok) {
    res.status(429).json({
      code: 429,
      message: result.reason,
      data: result.quota,
    });
    return;
  }
  res.json({ code: 0, message: "ok", data: result.quota });
}));

export default router;
