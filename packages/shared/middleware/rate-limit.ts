/**
 * rate-limit middleware — 跨服务 IP 限流
 *
 * P0 D6 — 派单 22B 跨服务第 3 项
 *
 * 使用内存滑动窗口 (生产换 Redis)
 * Default: 1000 req / 2min / IP (派单 25 上调)
 * 可配置: windowMs (窗口毫秒), maxRequests (最大请求数)
 */
import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** 窗口毫秒数, 默认 120000 (2分钟) */
  windowMs?: number;
  /** 最大请求数, 默认 1000 */
  maxRequests?: number;
  /** 自定义 key 生成器 (默认 IP) */
  keyGenerator?: (req: Request) => string;
  /** 是否跳过限流 (默认 false) */
  skip?: (req: Request) => boolean;
}

/** 默认 key: X-Forwarded-For → req.ip → "unknown" */
function defaultKeyGenerator(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function rateLimit(opts: RateLimitOptions = {}): (req: Request, res: Response, next: NextFunction) => void {
  const windowMs = opts.windowMs ?? 120_000;
  const maxRequests = opts.maxRequests ?? 1000;
  const keyGen = opts.keyGenerator ?? defaultKeyGenerator;
  const shouldSkip = opts.skip ?? (() => false);

  const store = new Map<string, RateLimitEntry>();

  // 每 60s 清理过期条目
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 60_000);
  cleanupInterval.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    if (shouldSkip(req)) return next();

    const key = keyGen(req);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    // 设置标准限流头
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfterSec);
      res.status(429).json({
        code: 42900,
        message: "请求过于频繁，请稍后再试",
        retryAfter: retryAfterSec,
      });
      return;
    }

    next();
  };
}

export default rateLimit;
