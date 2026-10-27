// Key 管理：CRUD + 轮换 + 用量统计
// 轮换策略：同 provider+owner 下按"最近最少使用 + 用量最低"挑选

import { keyStore, type StoredKey } from "./store.js";
import type { KeySummary, ProviderId } from "../types.js";

export interface CreateKeyInput {
  providerId: ProviderId;
  ownerUserId: string | null;
  label: string;
  apiKey: string;
  enabled?: boolean;
}

export interface RotateKeyOptions {
  providerId: ProviderId;
  ownerUserId: string | null;
  /** 选择策略：'lru' (默认) | 'least-usage' | 'random' */
  strategy?: "lru" | "least-usage" | "random";
}

class KeyManager {
  /** 新增或更新一个 key */
  async createOrUpdate(input: CreateKeyInput): Promise<KeySummary> {
    return keyStore.upsert({
      providerId: input.providerId,
      ownerUserId: input.ownerUserId,
      label: input.label,
      apiKey: input.apiKey,
      enabled: input.enabled,
    });
  }

  /** 列出某个 provider 的 key（owner 维度） */
  async list(providerId: ProviderId, ownerUserId: string | null): Promise<StoredKey[]> {
    return keyStore.list({ providerId, ownerUserId });
  }

  /** 列出所有 key 的摘要（admin 用） */
  async listAll(): Promise<KeySummary[]> {
    // 简单遍历：8 个 provider × 2 个 owner 维度
    const providers: ProviderId[] = ["minimax", "deepseek", "zhipu", "volcengine", "qwen", "openai", "replicate", "fal", "agnes"];
    const out: KeySummary[] = [];
    for (const p of providers) {
      const platform = await keyStore.list({ providerId: p, ownerUserId: null });
      out.push(...platform.map((k) => this.toSummary(k)));
    }
    return out;
  }

  async getFirst(providerId: ProviderId, ownerUserId: string | null): Promise<StoredKey | null> {
    return keyStore.getFirst({ providerId, ownerUserId });
  }

  /** 轮换：按策略挑一个 key */
  async rotate(opts: RotateKeyOptions): Promise<StoredKey | null> {
    const all = await keyStore.list({ providerId: opts.providerId, ownerUserId: opts.ownerUserId });
    if (all.length === 0) return null;
    if (all.length === 1) return all[0]!;

    const strategy = opts.strategy ?? "lru";
    switch (strategy) {
      case "least-usage":
        return all.slice().sort((a, b) => a.monthlyUsageUsd - b.monthlyUsageUsd)[0]!;
      case "random":
        return all[Math.floor(Math.random() * all.length)]!;
      case "lru":
      default:
        return all
          .slice()
          .sort((a, b) => (a.lastUsedAt ?? 0) - (b.lastUsedAt ?? 0))[0]!;
    }
  }

  /** 用量统计：累加 + 标记最近使用 */
  async recordUsage(keyId: string, usd: number): Promise<void> {
    await keyStore.touch(keyId);
    await keyStore.addUsage(keyId, usd);
  }

  async delete(id: string): Promise<void> {
    return keyStore.delete(id);
  }

  private toSummary(k: StoredKey): KeySummary {
    return {
      id: k.id,
      providerId: k.providerId,
      ownerUserId: k.ownerUserId,
      label: k.label,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      monthlyUsageUsd: k.monthlyUsageUsd,
      enabled: k.enabled,
    };
  }
}

export const keyManager = new KeyManager();
export { KeyManager };
