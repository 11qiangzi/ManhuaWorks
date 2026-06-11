/**
 * 健康检查
 *  - 200: 服务进程 + DB + Redis 都 OK
 *  - 503: 任一依赖不可用
 */
import type { Request, Response } from "express";
import { pingDb } from "../config/db.js";
import { redisCmd } from "../config/redis.js";
import { realtimeService } from "../container.js";

export async function health(_req: Request, res: Response): Promise<void> {
  const [dbOk, redisOk] = await Promise.all([
    pingDb(),
    redisCmd
      .ping()
      .then((r) => r === "PONG")
      .catch(() => false),
  ]);
  const ok = dbOk && redisOk;
  res.status(ok ? 200 : 503).json({
    code: ok ? 0 : 503,
    message: ok ? "ok" : "degraded",
    data: {
      service: "collab-service",
      version: "0.1.0",
      uptime_sec: Math.floor(process.uptime()),
      deps: { postgres: dbOk, redis: redisOk },
      realtime: realtimeService?.stats() ?? null,
      ts: new Date().toISOString(),
    },
  });
}
