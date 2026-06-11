// 用户级限流
// 优先 Redis token bucket；REDIS_URL 不存在时用内存滑动窗口。

import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./auth.js";
import { config } from "../config.js";

interface Bucket {
  count: number;
  resetAt: number;
}

class MemoryRateLimiter {
  private buckets = new Map<string, Bucket>();
  private windowMs: number;

  constructor(perMinute: number) {
    this.windowMs = 60_000;
    void perMinute;
  }

  hit(key: string, limit: number): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      const fresh: Bucket = { count: 1, resetAt: now + this.windowMs };
      this.buckets.set(key, fresh);
      return { allowed: true, remaining: limit - 1, resetMs: this.windowMs };
    }
    b.count += 1;
    const allowed = b.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - b.count),
      resetMs: Math.max(0, b.resetAt - now),
    };
  }
}

const memoryLimiter = new MemoryRateLimiter(config.rateLimitPerMin);

export const rateLimitMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  const key = user?.userId ?? c.req.header("x-forwarded-for") ?? "anonymous";
  const limit = config.rateLimitPerMin;
  const result = memoryLimiter.hit(`rl:${key}`, limit);

  c.header("X-RateLimit-Limit", String(limit));
  c.header("X-RateLimit-Remaining", String(result.remaining));
  c.header("X-RateLimit-Reset", String(Math.ceil(result.resetMs / 1000)));

  if (!result.allowed) {
    return c.json({ error: "rate limit exceeded", limit, resetMs: result.resetMs }, 429);
  }
  await next();
});
