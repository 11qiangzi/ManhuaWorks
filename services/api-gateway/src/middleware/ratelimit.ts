/**
 * 基于 Redis 的滑动窗口限流
 *
 * 策略：固定窗口（counter + EXPIRE），实现简单、性能好
 *   key  = rl:<bucket>:<identity>:<window-start>
 *   INCR  → 1
 *   如果是 1，EXPIRE key windowSec
 *   如果 count > max → 429
 *
 * key 组成：
 *   - bucket：路由分组，比如 'global' / 'auth' / 'studio'（由调用方传）
 *   - identity：user.sub（已登录）或 IP（未登录）
 *
 * 降级：
 *   Redis 不可用 → 放行 + warn 日志（不阻塞业务）
 *   业务上可以通过 `strict: true` 强制 Redis 必需（生产建议）
 */

import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './auth.js';
import { getRedis } from '../redis.js';
import { loadConfig } from '../config.js';

export interface RateLimitOptions {
  bucket: string;          // 路由分组，如 'auth'、'studio'
  windowMs?: number;       // 窗口长度，默认用 config
  max?: number;            // 窗口内最大请求数，默认用 config
  strict?: boolean;        // Redis 故障时是 fail-open (默认) 还是 fail-closed
  /** 自定义 identity 取法，默认：已登录用 sub，否则用 IP */
  identityFrom?: (c: any) => string;
}

function defaultIdentity(c: any): string {
  const u = c.get?.('user') as { sub?: string } | undefined;
  if (u?.sub) return `u:${u.sub}`;
  // X-Forwarded-For 优先（nginx 反代场景），否则 fallback 到 X-Real-IP，再否则 'unknown'
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return `ip:${first}`;
  }
  const xri = c.req.header('x-real-ip');
  if (xri) return `ip:${xri}`;
  return 'ip:unknown';
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler<AppEnv> {
  const windowMs = opts.windowMs ?? loadConfig().RATE_LIMIT_WINDOW_MS;
  const max = opts.max ?? loadConfig().RATE_LIMIT_MAX;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const strict = opts.strict ?? false;
  const idFn = opts.identityFrom ?? defaultIdentity;

  return async (c, next) => {
    const identity = idFn(c);
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const key = `rl:${opts.bucket}:${identity}:${windowStart}`;

    let count = 0;
    let redisHealthy = true;
    try {
      const r = await getRedis();
      const tx = r.multi();
      tx.incr(key);
      tx.pexpire(key, windowMs);
      const res = await tx.exec();
      count = Number(res?.[0]?.[1] ?? 0);
    } catch (err) {
      redisHealthy = false;
      if (loadConfig().LOG_LEVEL === 'debug') {
        console.warn(`[ratelimit] redis unavailable, ${strict ? 'fail-closed' : 'fail-open'}:`, (err as Error).message);
      }
      if (strict) {
        return c.json({ error: 'service_unavailable', message: '限流服务暂时不可用' }, 503);
      }
      // fail-open：放行
      return next();
    }

    const remaining = Math.max(0, max - count);
    const resetSec = Math.ceil((windowStart + windowMs - now) / 1000);

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetSec));
    c.header('X-RateLimit-Window', `${windowSec}s`);
    c.header('X-RateLimit-Bucket', opts.bucket);
    c.header('X-RateLimit-Backend', redisHealthy ? 'redis' : 'bypass');

    if (count > max) {
      c.header('Retry-After', String(resetSec));
      return c.json(
        {
          error: 'rate_limited',
          message: `请求过于频繁，${windowSec}s 内最多 ${max} 次`,
          bucket: opts.bucket,
          retryAfterSec: resetSec,
        },
        429,
      );
    }

    return next();
  };
}
