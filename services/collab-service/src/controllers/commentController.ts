/**
 * CommentController
 */
import type { Request, Response } from "express";
import { AppError } from "../middleware/error.js";
import type { CommentService } from "../services/commentService.js";
import type { CommentTargetType } from "../models/comment.js";

export class CommentController {
  constructor(private service: CommentService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    const c = await this.service.create(req.user.id, req.body);
    res.status(201).json({ code: 0, message: "ok", data: c });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const projectId = String(req.query.projectId ?? "");
    if (!projectId) throw new AppError("缺少 projectId", 400, "BAD_REQUEST");
    const targetType = req.query.targetType as CommentTargetType | undefined;
    const targetId = req.query.targetId as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const before = req.query.before ? new Date(String(req.query.before)) : undefined;
    const list = await this.service.list(projectId, { targetType, targetId, limit, before });
    res.json({ code: 0, message: "ok", data: list });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const c = await this.service.get(req.params.id);
    res.json({ code: 0, message: "ok", data: c });
  };

  thread = async (req: Request, res: Response): Promise<void> => {
    const list = await this.service.thread(req.params.id);
    res.json({ code: 0, message: "ok", data: list });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    const c = await this.service.update(req.user.id, req.params.id, req.body);
    res.json({ code: 0, message: "ok", data: c });
  };

  resolve = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    const c = await this.service.setResolved(req.user.id, req.params.id, true);
    res.json({ code: 0, message: "ok", data: c });
  };

  reopen = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    const c = await this.service.setResolved(req.user.id, req.params.id, false);
    res.json({ code: 0, message: "ok", data: c });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    await this.service.remove(req.user.id, req.params.id);
    res.json({ code: 0, message: "ok" });
  };
}
