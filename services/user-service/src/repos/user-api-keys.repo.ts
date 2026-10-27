/**
 * user_api_keys 仓库 (派单 17: BYOK)
 *
 * 与 api-key.repo.ts 的区别：
 *   - 表: user_api_keys (PG JSONB 存 EncryptedPayload) vs api_keys (PG bytea 存 IV)
 *   - 字段: nickname / is_default / base_url / last_test_at / last_test_status vs alias / 基础字段
 *   - 用例: 6 provider (DeepSeek/通义千问/智谱/Replicate/fal/OpenAI) vs 5 (OpenAI/Anthropic/Google/DeepSeek/MiniMax)
 *   - 并存关系: 派单 16 已落 api_keys 表 + api-key.routes, 派单 17 新建 user_api_keys + 本路由
 *     两个表不冲突, 都是 BYOK 但走两条路 (api-keys 给 ai-orchestrator 内部用, user-api-keys 给用户配置面板)
 *
 * 安全约束:
 *   - 不存明文 key
 *   - 不在 list/find 返回值里返回 apiKeyEncrypted
 *   - 一个 userId + provider + nickname 唯一 (DB UNIQUE 约束)
 *   - is_default 是软标志: 设默认 = 把同 userId+provider 其他 key 设为 0, 这个设为 1
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { userApiKeys, type UserApiKey } from '../db/schema';
import {
  encrypt,
  decrypt,
  type EncryptedPayload,
} from '../services/crypto';

export type UserApiKeyProvider =
  | 'deepseek'
  | 'openai'
  | 'replicate'
  | 'qianwen'
  | 'zhipu'
  | 'fal';

export const SUPPORTED_PROVIDERS: UserApiKeyProvider[] = [
  'deepseek',
  'openai',
  'replicate',
  'qianwen',
  'zhipu',
  'fal',
];

/** 外部返回: 剥离 apiKeyEncrypted */
export type UserApiKeyPublic = Omit<UserApiKey, 'apiKeyEncrypted'>;

export class UserApiKeyNotFoundError extends Error {
  constructor(id: string) {
    super(`user api key not found: ${id}`);
    this.name = 'UserApiKeyNotFoundError';
  }
}

export class UserApiKeyConflictError extends Error {
  constructor(userId: string, provider: UserApiKeyProvider, nickname: string) {
    super(`api key already exists for user ${userId} / provider ${provider} / nickname ${nickname}`);
    this.name = 'UserApiKeyConflictError';
  }
}

function toPublic(row: UserApiKey): UserApiKeyPublic {
  const { apiKeyEncrypted: _omit, ...rest } = row;
  return rest;
}

class UserApiKeysRepo {
  /**
   * 加 key
   * 自动:
   *   - 加密明文
   *   - 如果 isDefault=1, 把同 user+provider 其他 key 设为 0
   *   - 算 keyFingerprint (sha256 前 16 hex) + lastFour (末 4 位) — 暂存 baseUrl/nickname 里;
   *     实际不存这两个非敏感字段, 列表展示时算
   */
  async create(
    userId: string,
    provider: UserApiKeyProvider,
    plaintextKey: string,
    nickname: string,
    options: { baseUrl?: string; isDefault?: boolean; masterKey: string }
  ): Promise<UserApiKeyPublic> {
    if (!userId) throw new Error('userId required');
    if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
      throw new Error(`provider must be one of ${SUPPORTED_PROVIDERS.join(', ')}`);
    }
    if (typeof plaintextKey !== 'string' || plaintextKey.length === 0) {
      throw new Error('plaintextKey must be non-empty');
    }
    if (!nickname || nickname.length === 0) {
      throw new Error('nickname required');
    }

    const encrypted = encrypt(plaintextKey, options.masterKey);

    type Tx = PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >;
    return await db.transaction(async (tx: Tx) => {
      // 检查唯一
      const existing = await tx
        .select()
        .from(userApiKeys)
        .where(
          and(
            eq(userApiKeys.userId, userId),
            eq(userApiKeys.provider, provider),
            eq(userApiKeys.nickname, nickname)
          )
        )
        .limit(1);
      if (existing.length > 0) {
        throw new UserApiKeyConflictError(userId, provider, nickname);
      }

      // 设默认 = 把同 user+provider 其他 key 设为 0
      if (options.isDefault) {
        await tx
          .update(userApiKeys)
          .set({ isDefault: 0 })
          .where(
            and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider))
          );
      }

      const [inserted] = await tx
        .insert(userApiKeys)
        .values({
          userId,
          provider,
          apiKeyEncrypted: encrypted,
          baseUrl: options.baseUrl ?? null,
          nickname,
          isDefault: options.isDefault ? 1 : 0,
        })
        .returning();

      return toPublic(inserted);
    });
  }

  /**
   * 列用户所有 key (不返回 apiKeyEncrypted)
   * 默认按 createdAt desc
   */
  async listByUser(userId: string): Promise<UserApiKeyPublic[]> {
    const rows = await db
      .select()
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, userId))
      .orderBy(desc(userApiKeys.createdAt));
    return rows.map(toPublic);
  }

  /**
   * 按 id 查 (不返回 apiKeyEncrypted)
   */
  async findById(id: string): Promise<UserApiKeyPublic> {
    const [row] = await db
      .select()
      .from(userApiKeys)
      .where(eq(userApiKeys.id, id))
      .limit(1);
    if (!row) throw new UserApiKeyNotFoundError(id);
    return toPublic(row);
  }

  /** 内部用: 取带 encrypted 的完整 row */
  async findByIdInternal(id: string): Promise<UserApiKey> {
    const [row] = await db
      .select()
      .from(userApiKeys)
      .where(eq(userApiKeys.id, id))
      .limit(1);
    if (!row) throw new UserApiKeyNotFoundError(id);
    return row;
  }

  /**
   * 改 nickname / isDefault (不能改 key 本身 — 派单 17 明确, 删了重加)
   * 设默认时: 把同 user+provider 其他 key 设为 0
   */
  async update(
    id: string,
    patch: { nickname?: string; isDefault?: boolean }
  ): Promise<UserApiKeyPublic> {
    type Tx = PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >;
    return await db.transaction(async (tx: Tx) => {
      const current = await tx
        .select()
        .from(userApiKeys)
        .where(eq(userApiKeys.id, id))
        .limit(1);
      if (current.length === 0) throw new UserApiKeyNotFoundError(id);
      const cur = current[0];

      const updateVals: Partial<UserApiKey> = {
        updatedAt: new Date(),
      };
      if (patch.nickname !== undefined) updateVals.nickname = patch.nickname;
      if (patch.isDefault !== undefined) {
        if (patch.isDefault) {
          // 把同 user+provider 其他 key 设为 0
          await tx
            .update(userApiKeys)
            .set({ isDefault: 0 })
            .where(
              and(
                eq(userApiKeys.userId, cur.userId),
                eq(userApiKeys.provider, cur.provider)
              )
            );
        }
        updateVals.isDefault = patch.isDefault ? 1 : 0;
      }

      const [updated] = await tx
        .update(userApiKeys)
        .set(updateVals)
        .where(eq(userApiKeys.id, id))
        .returning();

      return toPublic(updated);
    });
  }

  /**
   * 删 (硬删 — 派单 17 没说要软删, 跟 api-key.repo 的 revoke 不同)
   * 找不到抛 NotFound
   */
  async delete(id: string, userId: string): Promise<{ id: string }> {
    const [deleted] = await db
      .delete(userApiKeys)
      .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, userId)))
      .returning({ id: userApiKeys.id });
    if (!deleted) throw new UserApiKeyNotFoundError(id);
    return { id: deleted.id };
  }

  /**
   * 更新 lastUsedAt (调用时由中间件触发)
   */
  async touchLastUsed(id: string): Promise<void> {
    await db
      .update(userApiKeys)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(userApiKeys.id, id));
  }

  /**
   * 更新 lastTestAt + lastTestStatus (POST /:id/test 触发)
   */
  async recordTestResult(
    id: string,
    status: 'ok' | 'invalid' | 'rate_limited'
  ): Promise<void> {
    await db
      .update(userApiKeys)
      .set({
        lastTestAt: new Date(),
        lastTestStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(userApiKeys.id, id));
  }

  /**
   * 解密拿明文 (内部: 给 ai-orchestrator 等内部服务用)
   * 路由层不暴露
   */
  decryptKey(row: UserApiKey, masterKey: string): string {
    return decrypt(row.apiKeyEncrypted as EncryptedPayload, masterKey);
  }

  /**
   * 取用户对某 provider 的默认 key
   * (给 ai-orchestrator 用 — 它需要从 PG 查 default key)
   */
  async findDefaultByUserProvider(
    userId: string,
    provider: UserApiKeyProvider
  ): Promise<UserApiKeyPublic | null> {
    const [row] = await db
      .select()
      .from(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, userId),
          eq(userApiKeys.provider, provider),
          eq(userApiKeys.isDefault, 1)
        )
      )
      .limit(1);
    if (!row) return null;
    return toPublic(row);
  }

  /** 测试用: 清空 (慎用) */
  async clear(): Promise<void> {
    await db.delete(userApiKeys);
  }
}

export const userApiKeysRepo = new UserApiKeysRepo();
