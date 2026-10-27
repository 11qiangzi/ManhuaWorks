/**
 * project-service 入口 (P0)
 *
 * 谢擎 2026-06-10 P0 改造：
 * 接入 shots / scenes / characters 路由 (apiRouter)
 * 保留原 projects CRUD 桩 + health
 */
import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import pino from "pino";
import { pool } from "./config/db";
import { apiRouter } from "./routes";
import { rateLimit, requireAuth, requireRole, authOptional, errorHandler, notFoundHandler, healthRouter } from "@manhuaworks/shared";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));

  // 全局限流: 50 req/min/IP (派单 62 API-006 下调)
  app.use(rateLimit({ windowMs: 60_000, maxRequests: 50 }));

  // ─── P0 业务路由 (shots / scenes / characters) ───
  app.use("/api/v1", apiRouter);

  // 标准化健康检查 (谢擎标准)
  app.use("/health", healthRouter({
    service: "project-service",
    version: "0.3.0",
    dbCheck: async () => {
      try { await pool.query("SELECT 1"); return true; } catch { return false; }
    },
  }));

  // ─── 项目 CRUD (派单 62 API-004: 加鉴权, API-005: 参数对齐) ───
  // GET /projects: 必须鉴权 (requireAuth) — API-004 三元验证: 有Token=200, 无Token=401, 错Token=401
  app.get("/api/v1/projects", requireAuth(), async (req, res) => {
    try {
      const authUser = (req as any).user;
      const userId = authUser?.sub ?? null;
      const r = await pool.query(
        "SELECT id, user_id, title, description, art_style, story_type, cover_url, status, created_at FROM projects WHERE ($1::uuid IS NULL OR user_id = $1) ORDER BY created_at DESC LIMIT 50",
        [userId]
      );
      res.json({ code: 0, message: "ok", data: { items: r.rows, count: r.rowCount } });
    } catch (err) {
      logger.error({ err }, "list projects");
      res.status(500).json({ code: 50000, message: "服务器内部错误" });
    }
  });

  // POST /projects: 必须鉴权, 支持 title/name 两种字段名 (API-005 对齐)
  app.post("/api/v1/projects", requireAuth(), async (req, res) => {
    try {
      const b = req.body ?? {};
      const authUser = (req as any).user;
      const userId = authUser?.sub ?? null;
      // API-005: 兼容 title 和 name 两种字段名
      const title = b.title || b.name || null;
      if (!title || !userId) {
        return res.status(400).json({ code: 40000, message: "缺少项目名称(title/name) 或未登录" });
      }
      const r = await pool.query(
        `INSERT INTO projects (user_id, title, description, art_style, story_type, cover_url, status)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,0))
         RETURNING id, user_id, title, description, art_style, story_type, cover_url, status, created_at`,
        [userId, title, b.description ?? b.summary ?? null, b.art_style ?? b.artStyle ?? null, b.story_type ?? b.storyType ?? null, b.cover_url ?? b.coverUrl ?? null, b.status]
      );
      res.status(201).json({ code: 0, message: "created", data: r.rows[0] });
    } catch (err) {
      logger.error({ err }, "create project");
      res.status(500).json({ code: 50000, message: "服务器内部错误" });
    }
  });

  // GET /projects/:id: 鉴权可选
  app.get("/api/v1/projects/:id", authOptional(), async (req, res) => {
    try {
      const r = await pool.query(
        "SELECT id, user_id, title, description, art_style, story_type, cover_url, status, created_at FROM projects WHERE id = $1",
        [req.params.id]
      );
      if (r.rowCount === 0) return res.status(404).json({ code: 40400, message: "项目不存在" });
      res.json({ code: 0, message: "ok", data: r.rows[0] });
    } catch (err) {
      logger.error({ err }, "get project");
      res.status(500).json({ code: 50000, message: "服务器内部错误" });
    }
  });

  // ─── Assets 端点 (LEG-003 P2) ───
  app.get("/api/v1/assets", async (req, res) => {
    try {
      const r = await pool.query(
        "SELECT id, project_id, url, type, status FROM assets ORDER BY created_at DESC LIMIT 100"
      );
      res.json({ code: 0, message: "ok", data: { items: r.rows, count: r.rowCount } });
    } catch (err) {
      // 如果 assets 表不存在则返回空列表
      logger.warn({ err }, "assets query failed, returning empty");
      res.json({ code: 0, message: "ok", data: { items: [], count: 0 } });
    }
  });

  app.post("/api/v1/assets", requireAuth(), async (req, res) => {
    try {
      const b = req.body ?? {};
      const authUser = (req as any).user;
      if (!b.url || !b.type) {
        return res.status(400).json({ code: 40000, message: "缺少 url 或 type" });
      }
      const r = await pool.query(
        `INSERT INTO assets (project_id, user_id, url, type, status)
         VALUES ($1,$2,$3,$4,COALESCE($5,0))
         RETURNING id, project_id, user_id, url, type, status, created_at`,
        [b.project_id ?? b.projectId ?? null, authUser?.sub ?? null, b.url, b.type, b.status]
      );
      res.status(201).json({ code: 0, message: "created", data: r.rows[0] });
    } catch (err) {
      logger.error({ err }, "create asset");
      res.status(500).json({ code: 50000, message: "服务器内部错误" });
    }
  });

  // 根路径
  app.get("/", (_req, res) => {
    res.json({
      code: 0,
      message: "ManhuaWorks project-service (P0)",
      data: {
        service: "project-service",
        version: "0.3.0",
        endpoints: [
          "GET  /health",
          "GET  /api/v1/projects",
          "POST /api/v1/projects",
          "GET  /api/v1/projects/:id",
          "GET  /api/v1/projects/:id/shots",
          "POST /api/v1/projects/:id/shots",
          "PATCH /api/v1/projects/:id/shots/:shotId",
          "DELETE /api/v1/projects/:id/shots/:shotId",
          "GET  /api/v1/scenes?projectId=xxx",
          "POST /api/v1/scenes",
          "PATCH /api/v1/scenes/:id",
          "DELETE /api/v1/scenes/:id",
          "GET  /api/v1/characters?projectId=xxx",
          "POST /api/v1/characters",
          "PATCH /api/v1/characters/:id",
          "DELETE /api/v1/characters/:id",
          "GET  /api/v1/projects/:id/members",
          "POST /api/v1/projects/:id/members",
          "DELETE /api/v1/projects/:id/members/:userId",
          "PUT  /api/v1/projects/:id/members/:userId/role",
          "POST /api/v1/projects/:id/archive",
          "GET  /api/v1/assets",
          "POST /api/v1/assets",
        ],
      },
    });
  });

  // 统一错误处理 (谢擎标准)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
