/**
 * PresenceController
 */
import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../middleware/error.js";
import type { PresenceService } from "../services/presenceService.js";

const CursorSchema = z.object({ x: z.number(), y: z.number() }).nullable().optional();

const HeartbeatSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  cursor: CursorSchema,
  status: z.enum(["online", "away"]).optional(),
});

const JoinSchema = z.object({ projectId: z.string().uuid() });

export class PresenceController {
  constructor(private service: PresenceService) {}

  heartbeat = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    const data = HeartbeatSchema.parse(req.body ?? {});
    const p = await this.service.heartbeat(req.user.id, data);
    res.json({ code: 0, message: "ok", data: p });
  };

  join = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    const data = JoinSchema.parse(req.body);
    const p = await this.service.join(req.user.id, data.projectId);
    res.json({ code: 0, message: "ok", data: p });
  };

  leave = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    const projectId = String(req.params.projectId ?? "");
    if (!projectId) throw new AppError("缺少 projectId", 400, "BAD_REQUEST");
    await this.service.leave(req.user.id, projectId);
    res.json({ code: 0, message: "ok" });
  };

  listProject = async (req: Request, res: Response): Promise<void> => {
    const projectId = String(req.params.projectId ?? "");
    if (!projectId) throw new AppError("缺少 projectId", 400, "BAD_REQUEST");
    const list = await this.service.listProject(projectId);
    res.json({ code: 0, message: "ok", data: list });
  };

  me = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("未认证", 401, "UNAUTHORIZED");
    const p = await this.service.get(req.user.id);
    res.json({ code: 0, message: "ok", data: p });
  };
}
