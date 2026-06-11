/**
 * API Key 仓库（内存实现）
 *
 * 业务规则：
 *   - 不存明文 key，仅存加密结果（EncryptedPayload）
 *   - 不在 list/find 的返回值里返回 encryptedKey / decryptedKey
 *   - keyFingerprint（sha256 前 16 hex） + lastFour（末 4 位）是给 UI 展示的非敏感元数据
 *   - revoke 是软删：写 revoked_at，不删行
 *   - 一个用户 + 一个 provider 只允许一个有效 key（unique on (userId, provider) WHERE revoked_at IS NULL）
 *
 * 存储后端是 Map（纯内存 + 索引），但接口设计成可以无缝替换为 PG 实现。
 */
import { randomUUID } from 'node:crypto';
import {
  encrypt,
  decrypt,
  keyFingerprint,
  lastFour,
  type EncryptedPayload,
} from '../services/crypto';

export type ApiKeyProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'minimax';

/** 内部记录：包含敏感字段（encryptedKey） */
export interface ApiKeyRecord {
  id: string;
  userId: string;
  provider: ApiKeyProvider;
  encryptedKey: EncryptedPayload;
  keyFingerprint: string;
  lastFour: string;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

/** 外部返回：剥离 encryptedKey，只留元数据 */
export type ApiKeyPublic = Omit<ApiKeyRecord, 'encryptedKey'>;

export class ApiKeyNotFoundError extends Error {
  constructor(id: string) {
    super(`api key not found: ${id}`);
    this.name = 'ApiKeyNotFoundError';
  }
}

export class ApiKeyConflictError extends Error {
  constructor(userId: string, provider: ApiKeyProvider) {
    super(`api key already exists for user ${userId} / provider ${provider}`);
    this.name = 'ApiKeyConflictError';
  }
}

class ApiKeyRepo {
  /** id → record */
  private readonly byId = new Map<string, ApiKeyRecord>();
  /** "userId:provider" → id（用于 active 唯一约束检查） */
  private readonly activeByUserProvider = new Map<string, string>();
  /** userId → Set<id>（list 加速） */
  private readonly idsByUser = new Map<string, Set<string>>();

  /**
   * 用户加 key。
   *
   * @throws ApiKeyConflictError 同一 userId+provider 已有 active key
   */
  create(
    userId: string,
    provider: ApiKeyProvider,
    plaintextKey: string,
    masterKey: string,
  ): ApiKeyPublic {
    if (!userId) throw new Error('userId required');
    if (!provider) throw new Error('provider required');
    if (typeof plaintextKey !== 'string' || plaintextKey.length === 0) {
      throw new Error('plaintextKey must be a non-empty string');
    }

    // unique on (userId, provider) for active keys
    const activeKey = `${userId}:${provider}`;
    if (this.activeByUserProvider.has(activeKey)) {
      throw new ApiKeyConflictError(userId, provider);
    }

    const id = randomUUID();
    const record: ApiKeyRecord = {
      id,
      userId,
      provider,
      encryptedKey: encrypt(plaintextKey, masterKey),
      keyFingerprint: keyFingerprint(plaintextKey),
      lastFour: lastFour(plaintextKey),
      createdAt: Date.now(),
      lastUsedAt: null,
      revokedAt: null,
    };

    this.byId.set(id, record);
    this.activeByUserProvider.set(activeKey, id);

    let ids = this.idsByUser.get(userId);
    if (!ids) {
      ids = new Set();
      this.idsByUser.set(userId, ids);
    }
    ids.add(id);

    return this.toPublic(record);
  }

  /**
   * 列某用户的所有 key（不返回 encryptedKey）。
   * 默认按 createdAt desc。
   */
  listByUser(userId: string): ApiKeyPublic[] {
    const ids = this.idsByUser.get(userId);
    if (!ids) return [];
    const records: ApiKeyRecord[] = [];
    for (const id of ids) {
      const r = this.byId.get(id);
      if (r) records.push(r);
    }
    records.sort((a, b) => b.createdAt - a.createdAt);
    return records.map((r) => this.toPublic(r));
  }

  /**
   * 按 id 查（不返回 encryptedKey）。
   * 找不到抛 ApiKeyNotFoundError。
   */
  findById(id: string): ApiKeyPublic {
    const r = this.byId.get(id);
    if (!r) throw new ApiKeyNotFoundError(id);
    return this.toPublic(r);
  }

  /**
   * 内部专用：按 id 拿到带 encryptedKey 的完整 record。
   * 仅供 getDecryptedKey 这种解密路径用。
   * 路由层不暴露。
   */
  findByIdInternal(id: string): ApiKeyRecord {
    const r = this.byId.get(id);
    if (!r) throw new ApiKeyNotFoundError(id);
    return r;
  }

  /**
   * 软撤销：写 revokedAt = now。已撤销的不能再用（业务层判断）。
   * 找不到抛 ApiKeyNotFoundError。
   */
  revoke(id: string): ApiKeyPublic {
    const r = this.byId.get(id);
    if (!r) throw new ApiKeyNotFoundError(id);
    if (r.revokedAt === null) {
      r.revokedAt = Date.now();
      const activeKey = `${r.userId}:${r.provider}`;
      // 释放 active 槽位（允许同 user+provider 加新的）
      if (this.activeByUserProvider.get(activeKey) === id) {
        this.activeByUserProvider.delete(activeKey);
      }
    }
    return this.toPublic(r);
  }

  /**
   * 更新 lastUsedAt。找不到抛 ApiKeyNotFoundError。
   */
  touchLastUsed(id: string): void {
    const r = this.byId.get(id);
    if (!r) throw new ApiKeyNotFoundError(id);
    r.lastUsedAt = Date.now();
  }

  /**
   * 解密拿明文（内部服务用，路由层不暴露）。
   * 已撤销的 key 不允许解密。
   */
  decryptKey(id: string, masterKey: string): string {
    const r = this.byId.get(id);
    if (!r) throw new ApiKeyNotFoundError(id);
    if (r.revokedAt !== null) {
      throw new Error(`api key ${id} is revoked`);
    }
    return decrypt(r.encryptedKey, masterKey);
  }

  /**
   * 取用户对某 provider 的当前 active key（用于 ai-orchestrator 内部调用）。
   * 已撤销的视为不存在。
   */
  findActiveByUserProvider(
    userId: string,
    provider: ApiKeyProvider,
  ): ApiKeyPublic | null {
    const id = this.activeByUserProvider.get(`${userId}:${provider}`);
    if (!id) return null;
    const r = this.byId.get(id);
    if (!r) return null;
    if (r.revokedAt !== null) return null;
    return this.toPublic(r);
  }

  // ─── 内部辅助 ─────────────────────────────────────────────────────────

  private toPublic(r: ApiKeyRecord): ApiKeyPublic {
    return {
      id: r.id,
      userId: r.userId,
      provider: r.provider,
      keyFingerprint: r.keyFingerprint,
      lastFour: r.lastFour,
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt,
      revokedAt: r.revokedAt,
    };
  }

  /** 测试用：清空全部 */
  clear(): void {
    this.byId.clear();
    this.activeByUserProvider.clear();
    this.idsByUser.clear();
  }

  /** 测试用：当前记录数 */
  size(): number {
    return this.byId.size;
  }
}

export const apiKeyRepo = new ApiKeyRepo();
