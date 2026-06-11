/**
 * Payment Controller
 *  GET   /api/v1/payment/methods
 *  POST  /api/v1/payment/mock
 */

import { Router, Response } from "express";
import { z } from "zod";
import { authRequired, type AuthedRequest } from "../middleware/auth";
import { paymentService } from "../services/paymentService";
import { ah } from "../middleware/error";

const router = Router();

router.get("/methods", ah(async (_req, res: Response) => {
  res.json({ code: 0, message: "ok", data: paymentService.listMethods() });
}));

const mockSchema = z.object({
  order_id: z.string().uuid(),
  method: z.string().optional(),
  channel: z.enum(["h5", "pc", "app", "sdk"]).optional(),
  outcome: z.enum(["success", "fail"]).optional(),
});

router.post("/mock", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const body = mockSchema.parse(req.body);
  const result = await paymentService.mockPay({
    orderId: body.order_id,
    userId: req.user!.sub,
    method: body.method,
    channel: body.channel,
    outcome: body.outcome,
  });
  res.json({ code: 0, message: "ok", data: result });
}));

export default router;
