/**
 * healthCheck — 统一健康检查端点 (P0 整改 第4项)
 *
 * 为 5 个核心服务提供统一的 /health 端点：
 *   user-service (8088), project-service (8089), collab-service (8091),
 *   billing-service (8090), ai-orchestrator (8087)
 *
 * 返回格式：
 *   {
 *     ok: boolean,
 *     service: string,
 *     version: string,
 *     uptime: number,        // ms
 *     time: string,          // ISO 8601
 *     deps: { db?: 'up'|'down'|'skipped', redis?: ..., ... }
 *   }
 *
 * Usage:
 *   import { createHealthRouter } from '@manhuaworks/shared/middleware/health';
 *   app.use('/health', createHealthRouter({ service: 'user-service', version: '1.0.0' }));
 */
import { Router, type Request, type Response } from "express";

export type DepStatus = "up" | "down" | "skipped";

export interface HealthDeps {
  [name: string]: DepStatus | undefined;
}

export interface HealthReport {
  ok: boolean;
  service: string;
  version: string;
  uptime: number;
  time: string;
  deps: HealthDeps;
}

export interface HealthOptions {
  service: string;
  version: string;
  /** 额外依赖检查函数 (返回 DepStatus 的 Promise) */
  checks?: Record<string, () => Promise<DepStatus>>;
  /** 启动时间戳 (默认 Date.now()) */
  startedAt?: number;
}

export function createHealthRouter(opts: HealthOptions): Router {
  const router = Router();
  const startedAt = opts.startedAt ?? Date.now();

  router.get("/", async (_req: Request, res: Response) => {
    const deps: HealthDeps = {};

    if (opts.checks) {
      const entries = Object.entries(opts.checks);
      const results = await Promise.all(
        entries.map(async ([name, check]) => {
          try {
            const status = await check();
            return [name, status] as const;
          } catch {
            return [name, "down" as const] as const;
          }
        })
      );
      for (const [name, status] of results) {
        deps[name] = status;
      }
    }

    // 如果没有注入任何 check, 至少标记服务本身 up
    if (Object.keys(deps).length === 0) {
      // 服务已达此处 = up
    }

    const allUp = Object.values(deps).every((d) => d === "up" || d === "skipped");

    const report: HealthReport = {
      ok: allUp,
      service: opts.service,
      version: opts.version,
      uptime: Date.now() - startedAt,
      time: new Date().toISOString(),
      deps,
    };

    const statusCode = allUp ? 200 : 503;
    res.status(statusCode).json(report);
  });

  return router;
}

/**
 * healthRouter — 向后兼容简化版 (user-service 等已使用)
 *
 * 接受 { service, version, dbCheck?: () => Promise<boolean> }
 */
export function healthRouter(opts: {
  service: string;
  version: string;
  dbCheck?: () => Promise<boolean>;
}): Router {
  return createHealthRouter({
    service: opts.service,
    version: opts.version,
    checks: opts.dbCheck ? { db: async () => (await opts.dbCheck!()) ? "up" : "down" } : undefined,
  });
}

export default createHealthRouter;
