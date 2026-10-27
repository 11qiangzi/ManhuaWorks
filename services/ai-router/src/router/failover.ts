// 故障转移：连续失败 N 次自动切备用 Provider。
// 复用 selector 的 ranked 列表，跳过失败项。

import { registry, ProviderRegistry } from "./registry.js";
import { select, type SelectOptions, type Selection } from "./selector.js";
import type { ProviderId, TaskType } from "../types.js";
import { ProviderError } from "../types.js";

export interface FailoverAttempt {
  provider: ProviderId;
  modelId: string;
  ok: boolean;
  error?: string;
  latencyMs: number;
}

export interface FailoverResult<T> {
  value: T;
  attempts: FailoverAttempt[];
}

/** 用 tryFn 依次尝试 ranked 列表，跳过连续失败 >= 阈值的 provider。
 *  半开路由：熔断超过 HALF_OPEN_AFTER_MS 的 provider 会被 candidatesFor 加入候选末尾。
 *  这里允许这些半开路 provider 各做一次真实请求来尝试恢复。
 */
export async function withFailover<T>(
  options: SelectOptions,
  tryFn: (provider: ProviderId, modelId: string) => Promise<T>,
): Promise<FailoverResult<T>> {
  const selection: Selection = select(options);
  const attempts: FailoverAttempt[] = [];
  let lastErr: unknown;

  for (const candidate of selection.ranked) {
    const provider = candidate.model.provider;
    const modelId = candidate.model.id;
    const start = Date.now();
    try {
      const value = await tryFn(provider, modelId);
      registry.recordSuccess(provider);
      attempts.push({ provider, modelId, ok: true, latencyMs: Date.now() - start });
      return { value, attempts };
    } catch (err) {
      const latency = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({ provider, modelId, ok: false, error: message, latencyMs: latency });
      // Only count 5xx/network errors toward circuit breaker, not 4xx client errors
      const errStatus = (err as any)?.status ?? (err as any)?.statusCode ?? 500;
      if (errStatus >= 500) {
        registry.recordFailure(provider, message);
      }
      lastErr = err;

      const health = registry.getHealth(provider);
      const now = Date.now();
      const isHalfOpen =
        health && !health.healthy &&
        now - health.lastCheckedAt > ProviderRegistry.HALF_OPEN_AFTER_MS;

      // 已熔断且还未到半开窗口：跳过此候选
      if (health && health.consecutiveFailures >= 3 && !isHalfOpen) {
        continue;
      }
    }
  }

  // 全部失败
  if (lastErr instanceof ProviderError) throw lastErr;
  throw new Error(
    `all providers failed for task=${options.task}: ${attempts.map((a) => `${a.provider}=${a.error}`).join("; ")}`,
  );
}

/** 手动标记健康状态（用于健康检查接口） */
export async function runHealthCheck(
  providerId: ProviderId,
  apiKey: string,
): Promise<boolean> {
  const p = registry.get(providerId);
  if (!p) return false;
  const h = await p.healthCheck(apiKey);
  registry.setHealth(h);
  return h.healthy;
}
