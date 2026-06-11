/**
 * Cost Log Controller — 成本日志 HTTP 路由
 *
 * 挂载路径（routes/index.ts）：/api/v1/billing/cost-logs
 *  - POST   /                  写入一次 AI 调用成本日志
 *  - GET    /                  列表（按 user_id? + from? + to? + provider?）
 *  - GET    /aggregate         聚合（by=user|project|provider, period=day|week|month|year|all）
 *  - GET    /by-provider       快捷：按 provider 聚合（admin 专用）
 *
 * 鉴权：authRequired；adminOnly 在 by=provider / 跨用户查询时强校验。
 */

import { Router, Response } from "express";
import { z } from "zod";
import { authRequired, type AuthedRequest } from "../middleware/auth";
import { costLogService } from "../services/costLogService";
import { ah, HttpError } from "../middleware/error";

const router = Router();

/* POST /api/v1/billing/cost-logs */
const createSchema = z.object({
  user_id: z.string().min(1),
  project_id: z.string().optional().nullable(),
  workflow_id: z.string().optional().nullable(),
  node_id: z.string().optional().nullable(),
  provider: z.enum(["openai", "anthropic", "google", "deepseek", "minimax"]),
  model: z.string().min(1),
  prompt_tokens: z.number().int().min(0),
  completion_tokens: z.number().int().min(0),
  request_id: z.string().optional().nullable(),
  cost_cents: z.number().int().min(0).optional(), // 可选：调用方已算好（旁路）
  currency: z.string().optional(),
});
type CreateBody = z.infer<typeof createSchema>;

router.post(
  "/",
  authRequired(),
  ah(async (req: AuthedRequest, res: Response) => {
    const body: CreateBody = createSchema.parse(req.body);
    const isAdmin = (req.user!.role ?? 0) >= 5;
    if (body.user_id !== req.user!.sub && !isAdmin) {
      throw new HttpError(403, "forbidden");
    }
    let rec;
    if (typeof body.cost_cents === "number") {
      rec = costLogService.recordRaw({
        userId: body.user_id,
        projectId: body.project_id ?? null,
        workflowId: body.workflow_id ?? null,
        nodeId: body.node_id ?? null,
        provider: body.provider,
        model: body.model,
        promptTokens: body.prompt_tokens,
        completionTokens: body.completion_tokens,
        costCents: body.cost_cents,
        currency: body.currency,
        requestId: body.request_id ?? null,
      });
    } else {
      rec = costLogService.recordCall({
        userId: body.user_id,
        projectId: body.project_id ?? null,
        workflowId: body.workflow_id ?? null,
        nodeId: body.node_id ?? null,
        provider: body.provider,
        model: body.model,
        promptTokens: body.prompt_tokens,
        completionTokens: body.completion_tokens,
        requestId: body.request_id ?? null,
      });
    }
    res.status(201).json({ code: 0, message: "created", data: rec });
  })
);

/* GET /api/v1/billing/cost-logs?user_id=&project_id=&from=&to=&provider= */
const listSchema = z.object({
  user_id: z.string().min(1).optional(),
  project_id: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  provider: z.enum(["openai", "anthropic", "google", "deepseek", "minimax"]).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
type ListQuery = z.infer<typeof listSchema>;

router.get(
  "/",
  authRequired(),
  ah(async (req: AuthedRequest, res: Response) => {
    const q: ListQuery = listSchema.parse(req.query);
    const isAdmin = (req.user!.role ?? 0) >= 5;
    const opts = {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      provider: q.provider,
      limit: q.limit,
      offset: q.offset,
    };
    let records;
    if (q.project_id) {
      records = costLogService.listByProject(q.project_id, opts);
    } else {
      const uid = q.user_id ?? req.user!.sub;
      if (uid !== req.user!.sub && !isAdmin) {
        throw new HttpError(403, "forbidden");
      }
      records = costLogService.listByUser(uid, opts);
    }
    res.json({ code: 0, message: "ok", data: records });
  })
);

/* GET /api/v1/billing/cost-logs/aggregate?by=&period=&user_id=&project_id= */
const aggregateSchema = z.object({
  by: z.enum(["user", "project", "provider"]),
  period: z.enum(["day", "week", "month", "year", "all"]).optional().default("month"),
  user_id: z.string().min(1).optional(),
  project_id: z.string().min(1).optional(),
});
type AggregateQuery = z.infer<typeof aggregateSchema>;

router.get(
  "/aggregate",
  authRequired(),
  ah(async (req: AuthedRequest, res: Response) => {
    const q: AggregateQuery = aggregateSchema.parse(req.query);
    const isAdmin = (req.user!.role ?? 0) >= 5;
    if (q.by === "user") {
      const uid = q.user_id ?? req.user!.sub;
      if (uid !== req.user!.sub && !isAdmin) {
        throw new HttpError(403, "forbidden");
      }
      const report = costLogService.aggregate({ by: "user", period: q.period, userId: uid });
      res.json({ code: 0, message: "ok", data: report });
      return;
    }
    if (q.by === "project") {
      if (!q.project_id) throw new HttpError(400, "project_id required");
      const report = costLogService.aggregate({ by: "project", period: q.period, projectId: q.project_id });
      res.json({ code: 0, message: "ok", data: report });
      return;
    }
    // by=provider：跨所有用户，必须 admin
    if (!isAdmin) throw new HttpError(403, "admin only");
    const report = costLogService.aggregate({ by: "provider", period: q.period });
    res.json({ code: 0, message: "ok", data: report });
  })
);

/* GET /api/v1/billing/cost-logs/by-provider  快捷：按 provider 聚合（admin 专用） */
router.get(
  "/by-provider",
  authRequired(),
  ah(async (req: AuthedRequest, res: Response) => {
    if ((req.user!.role ?? 0) < 5) {
      throw new HttpError(403, "admin only");
    }
    const report = costLogService.aggregate({ by: "provider", period: "all" });
    res.json({ code: 0, message: "ok", data: report });
  })
);

export default router;
