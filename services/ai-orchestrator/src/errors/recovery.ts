/**
 * 错误恢复（errors/recovery.ts）
 *
 * 4 种重试策略 + 备选 provider 切换：
 *   1. fixed-backoff       固定间隔重试
 *   2. exponential-backoff 指数退避（推荐）
 *   3. linear-backoff      线性递增
 *   4. jitter-backoff      指数 + 随机抖动（防雪崩）
 *
 * Provider 切换：
 *   - 优先供应商失败 → 切到备选（按 preferredProviders 顺序）
 *   - 最多切换 N 次（默认 2）
 *   - 切换时记录 fallback 原因
 *
 * 用法：
 *   const r = await withRecovery(() => workflowClient.imageGen(input), {
 *     strategy: "exponential-backoff",
 *     maxRetries: 3,
 *     preferredProviders: ["volcengine", "zhipu"],
 *     onFallback: (from, to, err) => log(...),
 *   });
 */

import type { ProviderId } from "../clients/ai-router.js";
import { aiRouterClient } from "../clients/ai-router.js";

export type RetryStrategy = "fixed-backoff" | "exponential-backoff" | "linear-backoff" | "jitter-backoff";

export interface RecoveryOptions {
  /** 重试策略 */
  strategy: RetryStrategy;
  /** 最大重试次数（不含首次执行） */
  maxRetries: number;
  /** 基础间隔（ms） */
  baseDelayMs: number;
  /** 上限间隔（ms） */
  maxDelayMs: number;
  /** 备选 provider 顺序（首次用第 0 个，失败后依次后移） */
  preferredProviders: ProviderId[];
  /** 切换 provider 时回调 */
  onFallback?: (from: ProviderId, to: ProviderId, err: Error) => void;
  /** 每次重试回调 */
  onRetry?: (attempt: number, err: Error, delayMs: number) => void;
  /** 操作标签（日志用） */
  label: string;
  /** AbortSignal */
  signal?: AbortSignal;
}

export interface RecoveryResult<T> {
  ok: boolean;
  value?: T;
  error?: Error;
  attempts: number;
  totalLatencyMs: number;
  fallbacks: Array<{ from: ProviderId; to: ProviderId; err: string }>;
}

/** 工具：算 delay */
export function calcDelay(
  strategy: RetryStrategy,
  attempt: number,
  baseMs: number,
  maxMs: number,
): number {
  switch (strategy) {
    case "fixed-backoff":
      return Math.min(baseMs, maxMs);
    case "exponential-backoff":
      return Math.min(baseMs * 2 ** (attempt - 1), maxMs);
    case "linear-backoff":
      return Math.min(baseMs * attempt, maxMs);
    case "jitter-backoff": {
      const base = baseMs * 2 ** (attempt - 1);
      const jitter = Math.random() * base;
      return Math.min(base + jitter, maxMs);
    }
  }
}

/** 工具：sleep（可被 abort 中断） */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = (): void => {
        clearTimeout(t);
        resolve();
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/** 4 策略的"重试执行器"（不切 provider，只重试） */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: Omit<RecoveryOptions, "preferredProviders" | "onFallback">,
): Promise<RecoveryResult<T>> {
  const t0 = Date.now();
  let attempt = 0;
  let lastErr: Error | null = null;
  for (attempt = 0; attempt <= opts.maxRetries; attempt++) {
    if (opts.signal?.aborted) {
      return { ok: false, error: new Error("aborted"), attempts: attempt, totalLatencyMs: Date.now() - t0, fallbacks: [] };
    }
    try {
      const v = await fn();
      return { ok: true, value: v, attempts: attempt + 1, totalLatencyMs: Date.now() - t0, fallbacks: [] };
    } catch (err) {
      lastErr = err as Error;
      if (attempt >= opts.maxRetries) break;
      const d = calcDelay(opts.strategy, attempt + 1, opts.baseDelayMs, opts.maxDelayMs);
      opts.onRetry?.(attempt + 1, lastErr, d);
      await sleep(d, opts.signal);
    }
  }
  return { ok: false, error: lastErr ?? new Error("unknown"), attempts: attempt + 1, totalLatencyMs: Date.now() - t0, fallbacks: [] };
}

/** AI 调用版：重试 + 备选 provider 切换 */
export async function withAiFallback<T>(
  fn: (provider: ProviderId) => Promise<T>,
  opts: RecoveryOptions,
): Promise<RecoveryResult<T>> {
  const t0 = Date.now();
  const fallbacks: Array<{ from: ProviderId; to: ProviderId; err: string }> = [];
  let providerIdx = 0;
  let lastErr: Error | null = null;
  let attempts = 0;

  while (providerIdx < opts.preferredProviders.length) {
    const provider = opts.preferredProviders[providerIdx]!;
    const res = await withRetry(() => fn(provider), {
      ...opts,
      maxRetries: opts.maxRetries,
      onRetry: (a, e, d) => opts.onRetry?.(a, e, d),
    });
    attempts += res.attempts;
    if (res.ok) {
      return { ok: true, value: res.value, attempts, totalLatencyMs: Date.now() - t0, fallbacks };
    }
    lastErr = res.error ?? new Error("unknown");
    // 切下一个 provider
    if (providerIdx < opts.preferredProviders.length - 1) {
      const next = opts.preferredProviders[providerIdx + 1]!;
      fallbacks.push({ from: provider, to: next, err: lastErr.message });
      opts.onFallback?.(provider, next, lastErr);
      providerIdx++;
    } else {
      break;
    }
  }
  return { ok: false, error: lastErr ?? new Error("all providers failed"), attempts, totalLatencyMs: Date.now() - t0, fallbacks };
}

/** 错误分类（决定是否值得重试） */
export function isRetriable(err: Error): boolean {
  const m = err.message.toLowerCase();
  if (m.includes("timeout")) return true;
  if (m.includes("502") || m.includes("503") || m.includes("504")) return true;
  if (m.includes("rate limit") || m.includes("429")) return true;
  if (m.includes("econnreset") || m.includes("econnrefused")) return true;
  if (m.includes("network")) return true;
  // 4xx 业务错误（400/401/403/404）一般不重试
  if (m.includes("400") || m.includes("401") || m.includes("403") || m.includes("404")) return false;
  return true; // 默认重试
}

/** 错误分类标签 */
export function classifyError(err: Error): "timeout" | "rate-limit" | "server" | "client" | "network" | "unknown" {
  const m = err.message.toLowerCase();
  if (m.includes("timeout") || m.includes("504")) return "timeout";
  if (m.includes("429") || m.includes("rate limit")) return "rate-limit";
  if (m.includes("502") || m.includes("503") || m.includes("500")) return "server";
  if (m.includes("400") || m.includes("401") || m.includes("403") || m.includes("404")) return "client";
  if (m.includes("econn") || m.includes("network") || m.includes("fetch")) return "network";
  return "unknown";
}

/** 重新导出 aiRouterClient，方便单次调用指定 provider */
export const aiRouter = aiRouterClient;

/** 默认恢复配置（按 quality mode 选择） */
export function defaultRecoveryForMode(mode: "cost" | "speed" | "quality"): Pick<RecoveryOptions, "strategy" | "maxRetries" | "baseDelayMs" | "maxDelayMs"> {
  switch (mode) {
    case "cost":
      return { strategy: "fixed-backoff", maxRetries: 0, baseDelayMs: 500, maxDelayMs: 2000 };
    case "speed":
      return { strategy: "exponential-backoff", maxRetries: 1, baseDelayMs: 400, maxDelayMs: 4000 };
    case "quality":
      return { strategy: "jitter-backoff", maxRetries: 2, baseDelayMs: 600, maxDelayMs: 8000 };
  }
}
