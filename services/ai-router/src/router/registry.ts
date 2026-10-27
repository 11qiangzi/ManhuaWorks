// Provider 注册中心
// 维护所有 Provider 实例 + 健康状态。
// 派单 16 扩展: 加 qwen / replicate / fal / openai 4 家，共 8 家

import { BaseProvider } from "../providers/base.js";
import { MiniMaxProvider } from "../providers/minimax.js";
import { DeepSeekProvider } from "../providers/deepseek.js";
import { ZhipuProvider } from "../providers/zhipu.js";
import { VolcengineProvider } from "../providers/volcengine.js";
import { QwenProvider } from "../providers/qwen.js";
import { OpenAIProvider } from "../providers/openai.js";
import { ReplicateProvider } from "../providers/replicate.js";
import { FalProvider } from "../providers/fal.js";
import { AgnesProvider } from "../providers/agnes.js";
import type { ProviderHealth, ProviderId, TaskType, ModelInfo } from "../types.js";

class ProviderRegistry {
  private providers = new Map<ProviderId, BaseProvider>();
  private health = new Map<ProviderId, ProviderHealth>();

  constructor() {
    // W2 阶段老 4 家
    this.register(new MiniMaxProvider());
    this.register(new DeepSeekProvider());
    this.register(new ZhipuProvider());
    this.register(new VolcengineProvider());
    // 派单 16 新增 4 家
    this.register(new QwenProvider());
    this.register(new OpenAIProvider());
    this.register(new ReplicateProvider());
    this.register(new FalProvider());
    this.register(new AgnesProvider());
  }

  register(p: BaseProvider): void {
    this.providers.set(p.id, p);
    this.health.set(p.id, {
      provider: p.id,
      healthy: true,
      consecutiveFailures: 0,
      lastCheckedAt: 0,
    });
  }

  get(id: ProviderId): BaseProvider | undefined {
    return this.providers.get(id);
  }

  all(): BaseProvider[] {
    return Array.from(this.providers.values());
  }

  /** 半开路：熔断后超过此时间（ms）则允许一次试探请求 */
  static readonly HALF_OPEN_AFTER_MS = 60_000;

  /**
   * 获取某任务类型的所有候选模型。
   * 半开路由：被标记为 unhealthy 的 provider，若超过 HALF_OPEN_AFTER_MS 未检查，
   * 仍加入候选（排在末尾），让 failover 做一次真实请求来恢复健康状态。
   */
  candidatesFor(task: TaskType): ModelInfo[] {
    const healthy: ModelInfo[] = [];
    const halfOpen: ModelInfo[] = [];
    const now = Date.now();

    for (const p of this.providers.values()) {
      const h = this.health.get(p.id);
      const isHealthy = h?.healthy ?? true;
      const isHalfOpen =
        !isHealthy &&
        h !== undefined &&
        now - h.lastCheckedAt > ProviderRegistry.HALF_OPEN_AFTER_MS;

      const models = p.getModels().filter((m) => m.capabilities.includes(task));
      if (isHealthy) {
        healthy.push(...models);
      } else if (isHalfOpen) {
        halfOpen.push(...models);
      }
    }

    // 健康的排前面，半开路的排后面作为最后备选
    return [...healthy, ...halfOpen];
  }

  // ---- 健康状态 ----
  isHealthy(id: ProviderId): boolean {
    return this.health.get(id)?.healthy ?? false;
  }

  getHealth(id: ProviderId): ProviderHealth | undefined {
    return this.health.get(id);
  }

  allHealth(): ProviderHealth[] {
    return Array.from(this.health.values());
  }

  setHealth(h: ProviderHealth): void {
    this.health.set(h.provider, h);
  }

  recordSuccess(id: ProviderId): void {
    this.health.set(id, {
      provider: id,
      healthy: true,
      consecutiveFailures: 0,
      lastCheckedAt: Date.now(),
    });
  }

  recordFailure(id: ProviderId, err?: string): ProviderHealth {
    const prev = this.health.get(id);
    const consecutive = (prev?.consecutiveFailures ?? 0) + 1;
    const next: ProviderHealth = {
      provider: id,
      healthy: consecutive < 3, // 与 failover 阈值一致
      consecutiveFailures: consecutive,
      lastCheckedAt: Date.now(),
      lastError: err,
    };
    this.health.set(id, next);
    return next;
  }
}

export const registry = new ProviderRegistry();
export { ProviderRegistry };