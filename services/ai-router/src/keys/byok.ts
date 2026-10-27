// BYOK（用户自带 Key）：用户 Key 优先，平台 Key 兜底
// 解决流程：
//   1. 如果用户没有该 provider 的自有 key → 用平台 key
//   2. 如果用户有自有 key → 用自有 key（按轮换策略挑一个）
//   3. 任何情况都要返回 usedByok 标记，供日志/计费用

import { keyManager } from "./manager.js";
import type { ByokResolution, ProviderId } from "../types.js";
import { config } from "../config.js";

export interface ResolveOptions {
  providerId: ProviderId;
  userId: string;
  /** 强制使用 BYOK（请求里 useByok=true 且用户没 key 时回落到平台 key） */
  requireByok?: boolean;
}

/** 平台共享 Key 兜底（来自环境变量）
 *  派单 16 扩展: 加 qwen / replicate / fal / openai
 */
const PLATFORM_FALLBACK: Record<ProviderId, string | null> = {
  minimax: process.env.MINIMAX_API_KEY ?? null,
  deepseek: process.env.DEEPSEEK_API_KEY ?? null,
  zhipu: process.env.ZHIPU_API_KEY ?? null,
  volcengine: process.env.VOLCENGINE_API_KEY ?? null,
  qwen: process.env.QWEN_API_KEY ?? null,
  openai: process.env.OPENAI_API_KEY ?? null,
  replicate: process.env.REPLICATE_API_KEY ?? null,
  fal: process.env.FAL_API_KEY ?? null,
  agnes: process.env.AGNES_API_KEY ?? null,
};

class ByokResolver {
  /**
   * 解析一个 provider 应该用哪个 key
   * 优先级：用户自有 > 平台兜底
   */
  async resolve(opts: ResolveOptions): Promise<ByokResolution> {
    const userKey = await keyManager.rotate({
      providerId: opts.providerId,
      ownerUserId: opts.userId,
      strategy: "lru",
    });

    if (userKey) {
      return {
        apiKey: userKey.apiKey,
        keyId: userKey.id,
        usedByok: true,
      };
    }

    if (opts.requireByok) {
      throw new Error(`BYOK required but no key for provider=${opts.providerId} user=${opts.userId}`);
    }

    // 平台兜底
    const platformFromStore = await keyManager.rotate({
      providerId: opts.providerId,
      ownerUserId: null,
      strategy: "lru",
    });
    if (platformFromStore) {
      return {
        apiKey: platformFromStore.apiKey,
        keyId: platformFromStore.id,
        usedByok: false,
      };
    }

    const envKey = PLATFORM_FALLBACK[opts.providerId];
    if (envKey) {
      return {
        apiKey: envKey,
        keyId: `env:${opts.providerId}`,
        usedByok: false,
      };
    }

    throw new Error(
      `No API key available for provider=${opts.providerId}. Configure platform key or BYOK. (encryptionKey=${config.encryptionKey ? "set" : "missing"})`,
    );
  }

  /** 用户给指定 provider 添加 BYOK */
  async addByok(args: { userId: string; providerId: ProviderId; apiKey: string; label?: string }): Promise<void> {
    await keyManager.createOrUpdate({
      providerId: args.providerId,
      ownerUserId: args.userId,
      label: args.label ?? "default",
      apiKey: args.apiKey,
      enabled: true,
    });
  }

  /** 删除用户的某个 BYOK */
  async removeByok(args: { userId: string; keyId: string }): Promise<void> {
    // 二次校验：只允许删自己的 key
    const all = await keyManager.listAll();
    const target = all.find((k) => k.id === args.keyId);
    if (!target) throw new Error(`key not found: ${args.keyId}`);
    if (target.ownerUserId !== args.userId) {
      throw new Error("forbidden: cannot delete another user's key");
    }
    await keyManager.delete(args.keyId);
  }
}

export const byokResolver = new ByokResolver();
export { ByokResolver };
