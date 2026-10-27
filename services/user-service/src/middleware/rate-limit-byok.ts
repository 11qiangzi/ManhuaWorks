/**
 * BYOK 限流中间件 (派单 17: 1 小时 60 次/key)
 *
 * 设计:
 *   - scope: `byok_key:<key_id>` — 限单 key
 *   - window: 1 小时整点窗口 (向下取整到小时)
 *   - 实现: PG 表 rate_limit_counters, 用 INSERT ... ON CONFLICT DO UPDATE 原子计数
 *   - 触发: 加在 ai-orchestrator 调用前, 也加在 POST /:id/test 上
 *
 * 用法:
 *   import { rateLimitByokKey } from '../middleware/rate-limit-byok'
 *   router.post('/:id/test', authMw, rateLimitByokKey({ limit: 60, windowMs: 3600_000 }), testHandler)
 *
 * 返回头 (跟 Express rate-limit 风格一致):
 *   X-RateLimit-Limit: 60
 *   X-RateLimit-Remaining: 47
 *   X-RateLimit-Reset: <unix-seconds>
 *
 * 超出:
 *   429 Too Many Requests, body { code: 42901, message: 'rate_limited', data: { resetAt } }
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import { rateLimitCounters } from '../db/schema';

export interface RateLimitOptions {
  limit: number;        // 窗口内最大请求数 (默认 60)
  windowMs: number;     // 窗口大小 (默认 1 小时)
}

interface RateLimitState {
  limit: number;
  windowMs: number;
}

const DEFAULT_OPTS: RateLimitOptions = { limit: 60, windowMs: 60 * 60 * 1000 };

/**
 * 取 key_id:
 *   1) req.params.id (路由 :id 优先)
 *   2) req.body.apiKeyId (POST /some/where 带 body)
 *   3) req.query.keyId (GET ?keyId=...)
 * 没有 → 跳过限流, 不报错 (避免误杀)
 */
function extractKeyId(req: Request): string | null {
  const fromParams = (req.params as Record<string, string | undefined>)?.id;
  if (fromParams) return fromParams;
  const fromBody = (req.body as Record<string, unknown> | undefined)?.apiKeyId;
  if (typeof fromBody === 'string' && fromBody) return fromBody;
  const fromQuery = typeof req.query?.['keyId'] === 'string' ? (req.query['keyId'] as string) : null;
  return fromQuery;
}

/** 把 Date 向下取整到整点小时 */
function floorToHour(d: Date): Date {
  const r = new Date(d);
  r.setMinutes(0, 0, 0);
  return r;
}

export function rateLimitByokKey(opts: Partial<RateLimitOptions> = {}): RequestHandler {
  const { limit, windowMs }: RateLimitState = { ...DEFAULT_OPTS, ...opts };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keyId = extractKeyId(req);
      if (!keyId) {
        // 没 key id, 不限流
        return next();
      }

      const scope = `byok_key:${keyId}`;
      const now = new Date();
      const windowStart = floorToHour(now);
      const windowEnd = new Date(windowStart.getTime() + windowMs);

      // 原子 upsert + 计数
      // ON CONFLICT (scope, window_start) DO UPDATE SET request_count = rate_limit_counters.request_count + 1
      const upserted = await db
        .insert(rateLimitCounters)
        .values({
          scope,
          windowStart,
          requestCount: 1,
        })
        .onConflictDoUpdate({
          target: [rateLimitCounters.scope, rateLimitCounters.windowStart],
          set: { requestCount: sql`${rateLimitCounters.requestCount} + 1` },
        })
        .returning({ count: rateLimitCounters.requestCount });

      const current = upserted[0]?.count ?? 1;
      const remaining = Math.max(0, limit - current);
      const resetUnix = Math.floor(windowEnd.getTime() / 1000);

      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(resetUnix));

      if (current > limit) {
        return res.status(429).json({
          code: 42901,
          message: 'rate_limited',
          data: {
            limit,
            resetAt: windowEnd.toISOString(),
          },
        });
      }

      next();
    } catch (err) {
      // 限流失败不能阻塞主业务
      next();
    }
  };
}
