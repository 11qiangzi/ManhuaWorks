/**
 * NotificationController
 */
import type { Request, Response } from "express";
import { AppError } from "../middleware/error.js";
import type { NotificationService } from "../services/notificationService.js";
import type { NotificationStatus } from "../models/notification.js";

export class NotificationController {
  constructor(private service: NotificationService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    const status = req.query.status as NotificationStatus | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const before = req.query.before ? new Date(String(req.query.before)) : undefined;
    const list = await this.service.list(req.user.id, { status, limit, before });
    res.json({ code: 0, message: "ok", data: list });
  };

  unreadCount = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    const c = await this.service.unreadCount(req.user.id);
    res.json({ code: 0, message: "ok", data: { count: c } });
  };

  markRead = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    const ok = await this.service.markRead(req.user.id, req.params.id);
    res.json({ code: 0, message: "ok", data: { ok } });
  };

  markAllRead = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    const n = await this.service.markAllRead(req.user.id);
    res.json({ code: 0, message: "ok", data: { updated: n } });
  };

  archive = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    const ok = await this.service.archive(req.user.id, req.params.id);
    res.json({ code: 0, message: "ok", data: { ok } });
  };
}
