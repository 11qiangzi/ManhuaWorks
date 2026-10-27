/**
 * Invoice Controller
 *  GET   /api/v1/invoices
 *  GET   /api/v1/invoices/:id
 *  POST  /api/v1/invoices
 *  GET   /api/v1/invoices/:id/pdf
 *  POST  /api/v1/invoices/:id/void  (admin)
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authRequired, adminOnly, type AuthedRequest } from "../middleware/auth";
import { invoiceService } from "../services/invoiceService";
import { ah, HttpError } from "../middleware/error";

const router = Router();

const createSchema = z.object({
  order_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  tax_id: z.string().max(50).optional(),
});

router.get("/", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const [list, total] = await Promise.all([
    invoiceService.listByUser(req.user!.sub, limit, offset),
    invoiceService.countByUser(req.user!.sub),
  ]);
  res.json({ code: 0, message: "ok", data: { list, total } });
}));

router.post("/", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const body = createSchema.parse(req.body);
  const inv = await invoiceService.issue({
    orderId: body.order_id,
    userId: req.user!.sub,
    title: body.title,
    taxId: body.tax_id,
    isAdmin: (req.user!.role ?? 0) >= 5,
  });
  res.status(201).json({ code: 0, message: "issued", data: inv });
}));

router.get("/:id", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const inv = await invoiceService.getById(req.params.id!, req.user!.sub, (req.user!.role ?? 0) >= 5);
  res.json({ code: 0, message: "ok", data: inv });
}));

router.get("/:id/pdf", authRequired(), ah(async (req: AuthedRequest, res: Response) => {
  const { buffer, filename } = await invoiceService.getOrGeneratePdf(
    req.params.id!,
    req.user!.sub,
    (req.user!.role ?? 0) >= 5
  );
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.setHeader("Content-Length", String(buffer.length));
  res.end(buffer);
}));

router.post("/:id/void", authRequired(), adminOnly, ah(async (req: AuthedRequest, res: Response) => {
  const inv = await invoiceService.void(req.params.id!, true);
  res.json({ code: 0, message: "voided", data: inv });
}));

export default router;
