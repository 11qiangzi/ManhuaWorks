// Provider 注册中心
// 维护所有 Provider 实例 + 健康状态。

import { BaseProvider } from "../providers/base.js";
import { MiniMaxProvider } from "../providers/minimax.js";
import { DeepSeekProvider } from "../providers/deepseek.js";
import { ZhipuProvider } from "../providers/zhipu.js";
import { VolcengineProvider } from "../providers/volcengine.js";
import type { ProviderHealth, ProviderId, TaskType, ModelInfo } from "../types.js";

class ProviderRegistry {
  private providers = new Map<ProviderId, BaseProvider>();
  private health = new Map<ProviderId, ProviderHealth>();

  constructor() {
    this.register(new MiniMaxProvider());
    this.register(new DeepSeekProvider());
    this.register(new ZhipuProvider());
    this.register(new VolcengineProvider());
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

  /** 获取某任务类型的所有候选模型（来自所有 provider） */
  candidatesFor(task: TaskType): ModelInfo[] {
    const out: ModelInfo[] = [];
    for (const p of this.providers.values()) {
      if (!this.isHealthy(p.id)) continue;
      for (const m of p.getModels()) {
        if (m.capabilities.includes(task)) out.push(m);
      }
    }
    return out;
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
