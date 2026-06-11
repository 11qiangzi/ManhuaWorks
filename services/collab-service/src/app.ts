/**
 * Express 应用工厂
 *  - 全局中间件: helmet / cors / json
 *  - 健康检查 + 业务路由 + 错误处理
 *  - WS 单独通过 attachWebSocket(httpServer) 挂载
 */
import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler, notFoundHandler, healthRouter } from "@manhuaworks/shared";
import { rateLimit } from "@manhuaworks/shared/middleware/rate-limit";
import apiRouter from "./routes/index.js";

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // 全局限流: 1000 req/2min/IP (派单 25 上调)
  app.use(rateLimit({ windowMs: 120_000, maxRequests: 1000 }));

  // 请求日志 (轻量, 不引第三方)
  app.use((req, _res, next) => {
    logger.debug({ method: req.method, path: req.path }, "req");
    next();
  });

  // 标准化健康检查 (谢擎标准)
  app.use("/health", healthRouter({
    service: "collab-service",
    version: "0.3.0",
    dbCheck: async () => {
      try { const { pool } = await import("./config/db.js"); await pool.query("SELECT 1"); return true; } catch { return false; }
    },
  }));
  app.get("/api/v1/teams-test", (_req, res) => { res.json({ code:0, message:"teams-test-ok" }); });
  app.use("/api/v1", apiRouter);
  // alias: 前端 api-client 调的是 /api/v1/collab/...
  app.use("/api/v1/collab", apiRouter);

  app.get("/", (_req, res) => {
    res.json({
      code: 0,
      message: "ManhuaWorks collab-service",
      data: {
        service: "collab-service",
        version: "0.1.0",
        endpoints: [
          "GET  /health",
          "GET  /api/v1/stats",
          "WS   /ws (token in query)",
          "POST /api/v1/comments",
          "GET  /api/v1/comments?projectId=...",
          "POST /api/v1/comments/:id/resolve",
          "POST /api/v1/presence/heartbeat",
          "GET  /api/v1/presence/project/:id",
          "GET  /api/v1/activities?projectId=...",
          "GET  /api/v1/notifications",
        ],
      },
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
