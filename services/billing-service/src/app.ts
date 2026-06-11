/**
 * Express App
 *
 *  - express + helmet + cors + pino-http
 *  - /health 在根
 *  - 业务路由：/api/v1/*
 *  - 全局错误处理
 */

import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./config/logger";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler, notFoundHandler, healthRouter } from "@manhuaworks/shared";
import { rateLimit } from "@manhuaworks/shared";

export function createApp(): Application {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, origin ?? "*"),
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // 全局限流: 50 req/min/IP (派单 62 API-006 下调)
  app.use(rateLimit({ windowMs: 60_000, maxRequests: 50 }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === "/health",
      },
    })
  );

  // 标准化健康检查 (谢擎标准)
  app.use("/health", healthRouter({
    service: "billing-service",
    version: "0.3.0",
  }));

  // 根 + 业务路由
  app.use("/", routes);
  app.use("/api/v1", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
