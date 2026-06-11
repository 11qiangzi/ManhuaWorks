/**
 * ActivityController
 */
import type { Request, Response } from "express";
import { AppError } from "../middleware/error.js";
import type { ActivityService } from "../services/activityService.js";
import type { ActivityType } from "../models/activity.js";

export class ActivityController {
  constructor(private service: ActivityService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const projectId = String(req.query.projectId ?? "");
    if (!projectId) throw new AppError("缺少 projectId", 400, "BAD_REQUEST");
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const before = req.query.before ? new Date(String(req.query.before)) : undefined;
    const actorId = req.query.actorId as string | undefined;
    const type = req.query.type as ActivityType | undefined;
    const list = await this.service.list(projectId, { limit, before, actorId, type });
    res.json({ code: 0, message: "ok", data: list });
  };
}
