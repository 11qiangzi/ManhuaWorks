/**
 * 路由挂载
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "@manhuaworks/shared";
import { teamsRouter } from "./teams.js";
import { CommentController } from "../controllers/commentController.js";
import { PresenceController } from "../controllers/presenceController.js";
import { ActivityController } from "../controllers/activityController.js";
import { NotificationController } from "../controllers/notificationController.js";
import { AppError } from "@manhuaworks/shared";
import { query } from "../config/db.js";
import {
  commentService,
  presenceService,
  activityService,
  notificationService,
  realtimeService,
} from "../container.js";

const router = Router();

const commentCtl = new CommentController(commentService);
const presenceCtl = new PresenceController(presenceService);
const activityCtl = new ActivityController(activityService);
const notifCtl = new NotificationController(notificationService);

/* ============== Comments ============== */
router.post("/comments", requireAuth(), commentCtl.create);
router.get("/comments", requireAuth(), commentCtl.list);
router.get("/comments/:id", requireAuth(), commentCtl.get);
router.get("/comments/:id/thread", requireAuth(), commentCtl.thread);
router.patch("/comments/:id", requireAuth(), commentCtl.update);
router.post("/comments/:id/resolve", requireAuth(), commentCtl.resolve);
router.post("/comments/:id/reopen", requireAuth(), commentCtl.reopen);
router.delete("/comments/:id", requireAuth(), commentCtl.remove);

/* ============== Alias: /projects/:projectId/comments ==============
 * 前端�?project-service 拿到 projectId 后直接调这个�? * 桥接到现�?commentCtl.list/create（把 :projectId 注入 req.body / req.query）�? */
const injectProjectIdToBody = (req: Request, _res: Response, next: NextFunction): void => {
  const pid = req.params.projectId;
  if (!pid) return next();
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  if (!body.projectId) body.projectId = pid;
  req.body = body;
  next();
};

const listCommentsForProject: import("express").RequestHandler = async (req, res, next) => {
  try {
    const pid = req.params.projectId;
    if (!pid) throw new AppError("缺少 projectId", 400, "BAD_REQUEST");
    const q = req.query as Record<string, string>;
    const targetType = q.targetType as import("../models/comment.js").CommentTargetType | undefined;
    const targetId = q.targetId;
    const limit = q.limit ? Number(q.limit) : undefined;
    const before = q.before ? new Date(q.before) : undefined;
    const list = await commentService.list(pid, { targetType, targetId, limit, before });
    res.json({ code: 0, message: "ok", data: list });
  } catch (e) {
    next(e);
  }
};

router.post("/projects/:projectId/comments", requireAuth(), injectProjectIdToBody, commentCtl.create);
router.get("/projects/:projectId/comments", requireAuth(), listCommentsForProject);

/* ============== Annotations (简化版，复�?comments �? ==============
 * 位置信息 (x/y/width/height) 序列化到 body 头部前缀�? * 不扩列以避免 schema 变更�? */
const AnnotationPostBody = z.object({
  panelId: z.string().uuid().optional(),
  targetId: z.string().uuid().optional(),
  body: z.string().min(1).max(5000),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().finite().optional(),
  height: z.number().finite().optional(),
});

interface AnnotationRow {
  id: string;
  project_id: string;
  author_id: string;
  target_id: string | null;
  body: string;
  created_at: Date;
}

function parseAnnotationBody(raw: string): { clean: string; pos: { x: number | null; y: number | null; width: number | null; height: number | null } } {
  const m = raw.match(/^\[\[__pos__:(\{.+?\})\]]\s*/);
  if (!m) return { clean: raw, pos: { x: null, y: null, width: null, height: null } };
  let pos: { x: number | null; y: number | null; width: number | null; height: number | null } = { x: null, y: null, width: null, height: null };
  try {
    const parsed = JSON.parse(m[1]!) as Partial<typeof pos>;
    pos = {
      x: typeof parsed.x === "number" ? parsed.x : null,
      y: typeof parsed.y === "number" ? parsed.y : null,
      width: typeof parsed.width === "number" ? parsed.width : null,
      height: typeof parsed.height === "number" ? parsed.height : null,
    };
  } catch {
    /* ignore */
  }
  return { clean: raw.slice(m[0].length), pos };
}

router.post("/projects/:projectId/annotations", requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError("UNAUTHORIZED", 401, "UNAUTHORIZED");
    const pid = req.params.projectId;
    if (!pid) throw new AppError("缺少 projectId", 400, "BAD_REQUEST");
    const parsed = AnnotationPostBody.parse(req.body ?? {});
    const targetId = parsed.panelId ?? parsed.targetId ?? null;
    const meta = JSON.stringify({ x: parsed.x ?? null, y: parsed.y ?? null, width: parsed.width ?? null, height: parsed.height ?? null });
    const enrichedBody = `[[__pos__:${meta}]] ${parsed.body}`;
    const sql = `
      INSERT INTO comments (project_id, author_id, target_type, target_id, body, mentions)
      VALUES ($1, $2, 'panel', $3, $4, '{}'::uuid[])
      RETURNING id, project_id, author_id, target_type, target_id, body, created_at, updated_at
    `;
    const r = await query<Record<string, unknown>>(sql, [pid, req.user.id, targetId, enrichedBody]);
    const row = r.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new AppError("插入失败", 500, "INSERT_FAILED");
    res.status(201).json({
      code: 0,
      message: "created",
      data: {
        id: String(row.id),
        project_id: String(row.project_id),
        user_id: String(row.author_id),
        target_id: row.target_id == null ? null : String(row.target_id),
        body: parsed.body,
        position: { x: parsed.x ?? null, y: parsed.y ?? null, width: parsed.width ?? null, height: parsed.height ?? null },
        created_at: (row.created_at as Date).toISOString(),
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) return next(new AppError("invalid_body", 400, "BAD_REQUEST"));
    next(e);
  }
});

router.get("/projects/:projectId/annotations", requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = req.params.projectId;
    if (!pid) throw new AppError("缺少 projectId", 400, "BAD_REQUEST");
    const sql = `
      SELECT id, project_id, author_id, target_id, body, created_at
        FROM comments
       WHERE project_id = $1 AND target_type = 'panel'
       ORDER BY created_at DESC
       LIMIT 200
    `;
    const r = await query<Record<string, unknown>>(sql, [pid]);
    const rows = r.rows as AnnotationRow[];
    res.json({
      code: 0,
      message: "ok",
      data: rows.map((row) => {
        const { clean, pos } = parseAnnotationBody(row.body);
        return {
          id: row.id,
          project_id: row.project_id,
          user_id: row.author_id,
          target_id: row.target_id,
          body: clean,
          position: pos,
          created_at: row.created_at.toISOString(),
        };
      }),
    });
  } catch (e) {
    next(e);
  }
});

/* ============== Presence ============== */
router.post("/presence/heartbeat", requireAuth(), presenceCtl.heartbeat);
router.post("/presence/join", requireAuth(), presenceCtl.join);
router.post("/presence/leave/:projectId", requireAuth(), presenceCtl.leave);
router.get("/presence/project/:projectId", requireAuth(), presenceCtl.listProject);
router.get("/presence/me", requireAuth(), presenceCtl.me);

/* ============== Activities ============== */
router.get("/activities", requireAuth(), activityCtl.list);

/* ============== Notifications ============== */
router.get("/notifications", requireAuth(), notifCtl.list);
router.get("/notifications/unread-count", requireAuth(), notifCtl.unreadCount);
router.post("/notifications/:id/read", requireAuth(), notifCtl.markRead);
router.post("/notifications/read-all", requireAuth(), notifCtl.markAllRead);
router.post("/notifications/:id/archive", requireAuth(), notifCtl.archive);

/* ============== Stats (公开�?ops) ============== */
router.get("/stats", requireAuth(), (_req, res) => {
  res.json({ code: 0, message: "ok", data: realtimeService.stats() });
});

/* ============== Teams (P0 D4 + P1) ============== */
router.use("/teams", teamsRouter);

export default router;
