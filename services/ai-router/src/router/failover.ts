// 故障转移：连续失败 N 次自动切备用 Provider。
// 复用 selector 的 ranked 列表，跳过失败项。

import { registry } from "./registry.js";
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
 *  注意：selector 已经过滤了不健康的 provider；这里再做动态跳过。
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
      registry.recordFailure(provider, message);
      lastErr = err;

      // 触发熔断阈值后，下一轮 select 会自动跳过
      const health = registry.getHealth(provider);
      if (health && health.consecutiveFailures >= 3) {
        // 已熔断，继续下一个候选
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
