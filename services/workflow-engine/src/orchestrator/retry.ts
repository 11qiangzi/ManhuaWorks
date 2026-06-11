/**
 * 重试策略
 * - 默认 3 次指数退避：1s → 4s → 16s（base=1000ms, factor=4）
 * - 对"瞬时错误"自动重试，对"业务错误"不重试
 * - 提供 shouldRetry() 供 BullMQ Worker 使用
 */

import { config } from '../config.js';

export interface RetryDecision {
  shouldRetry: boolean;
  /** 等待时间 ms */
  delayMs: number;
  /** 第几次尝试（从 1 开始） */
  attempt: number;
}

/** 错误分类 */
export type ErrorClass = 'transient' | 'business' | 'fatal';

/**
 * 判定错误类别
 * - 网络错误 / 5xx / 限流 → transient
 * - 4xx / 校验错误 / 业务拒绝 → business
 * - 配置错误 / OOM / 鉴权 → fatal
 */
export function classifyError(err: unknown): ErrorClass {
  if (!err) return 'fatal';
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  // 致命错误：不重试
  if (
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('api key') ||
    msg.includes('out of memory') ||
    msg.includes('eacces') ||
    msg.includes('eperm')
  ) {
    return 'fatal';
  }

  // 业务错误：不重试
  if (
    msg.includes('invalid input') ||
    msg.includes('validation') ||
    msg.includes('bad request') ||
    msg.includes('not found') ||
    msg.includes('unsupported') ||
    msg.includes('400') ||
    msg.includes('404') ||
    msg.includes('422')
  ) {
    return 'business';
  }

  // 瞬时错误：重试
  if (
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('enotfound') ||
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('socket hang up')
  ) {
    return 'transient';
  }

  // 默认按 transient 处理（保守起见）
  return 'transient';
}

/**
 * 计算退避时间
 * attempt 1 → base * 4^0 = 1000ms
 * attempt 2 → base * 4^1 = 4000ms
 * attempt 3 → base * 4^2 = 16000ms
 * 上限 60s，加 ±20% 抖动
 */
export function backoffMs(attempt: number): number {
  const base = config.retry.baseMs;
  const exp = Math.min(base * Math.pow(4, attempt - 1), 60_000);
  const jitter = exp * (0.8 + Math.random() * 0.4);
  return Math.floor(jitter);
}

export function shouldRetry(
  err: unknown,
  attempt: number,
  maxAttempts: number = config.retry.maxAttempts
): RetryDecision {
  const cls = classifyError(err);
  const canRetry = cls === 'transient' && attempt < maxAttempts;
  return {
    shouldRetry: canRetry,
    delayMs: canRetry ? backoffMs(attempt + 1) : 0,
    attempt: attempt + 1,
  };
}

/** 包装任意异步函数，自动重试 + 错误分类 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; onRetry?: (attempt: number, err: unknown) => void } = {}
): Promise<T> {
  const max = opts.maxAttempts ?? config.retry.maxAttempts;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const dec = shouldRetry(e, attempt, max);
      if (!dec.shouldRetry) throw e;
      if (opts.onRetry) opts.onRetry(dec.attempt, e);
      await new Promise((r) => setTimeout(r, dec.delayMs));
    }
  }
  throw lastErr;
}
