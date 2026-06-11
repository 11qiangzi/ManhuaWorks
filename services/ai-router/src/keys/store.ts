// API Key 存储：PostgreSQL + AES-256-GCM 加密
// 加密密钥来自 config.encryptionKey（64 hex chars = 32 bytes）

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { Pool } from "pg";
import { config } from "../config.js";
import type { KeySummary, ProviderId } from "../types.js";

interface RawKeyRow {
  id: string;
  provider_id: ProviderId;
  owner_user_id: string | null;
  label: string;
  encrypted_api_key: Buffer;
  iv: Buffer;
  auth_tag: Buffer;
  created_at: Date;
  last_used_at: Date | null;
  monthly_usage_usd: string; // pg numeric → string
  enabled: boolean;
}

export interface StoredKey {
  id: string;
  providerId: ProviderId;
  ownerUserId: string | null;
  label: string;
  apiKey: string; // 解密后
  createdAt: number;
  lastUsedAt: number | null;
  monthlyUsageUsd: number;
  enabled: boolean;
}

function deriveKey(hex: string): Buffer {
  // 接受 hex 字符串；非 hex 时按 sha256 规范化到 32 字节
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, "hex");
  }
  return createHash("sha256").update(hex).digest();
}

function encrypt(plain: string, key: Buffer): { ciphertext: Buffer; iv: Buffer; tag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag };
}

function decrypt(ciphertext: Buffer, iv: Buffer, tag: Buffer, key: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

class KeyStore {
  private pool: Pool | null = null;
  private cache = new Map<string, StoredKey>(); // key = `${providerId}:${ownerUserId ?? "_platform"}`
  private initialized = false;

  /** 启动时调用；DATABASE_URL 不存在则退化到内存模式。 */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (config.databaseUrl) {
      this.pool = new Pool({ connectionString: config.databaseUrl });
      await this.ensureSchema();
    }
    this.initialized = true;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ai_provider_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id TEXT NOT NULL,
        owner_user_id TEXT,
        label TEXT NOT NULL,
        encrypted_api_key BYTEA NOT NULL,
        iv BYTEA NOT NULL,
        auth_tag BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ,
        monthly_usage_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE (provider_id, owner_user_id, label)
      );
      CREATE INDEX IF NOT EXISTS idx_ai_provider_keys_provider ON ai_provider_keys (provider_id);
      CREATE INDEX IF NOT EXISTS idx_ai_provider_keys_owner ON ai_provider_keys (owner_user_id);
    `);
  }

  private get keyBuffer(): Buffer | null {
    if (!config.encryptionKey) return null;
    return deriveKey(config.encryptionKey);
  }

  /** 写入或更新一条 key（按 provider+owner+label 唯一） */
  async upsert(args: {
    providerId: ProviderId;
    ownerUserId: string | null;
    label: string;
    apiKey: string;
    enabled?: boolean;
  }): Promise<KeySummary> {
    const key = this.keyBuffer;
    if (!key) throw new Error("ENCRYPTION_KEY not configured");

    const enc = encrypt(args.apiKey, key);
    const id = `${args.providerId}:${args.ownerUserId ?? "_platform"}:${args.label}`;

    if (this.pool) {
      const res = await this.pool.query<RawKeyRow>(
        `INSERT INTO ai_provider_keys (provider_id, owner_user_id, label, encrypted_api_key, iv, auth_tag, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (provider_id, owner_user_id, label) DO UPDATE
         SET encrypted_api_key = EXCLUDED.encrypted_api_key,
             iv = EXCLUDED.iv,
             auth_tag = EXCLUDED.auth_tag,
             enabled = EXCLUDED.enabled
         RETURNING *`,
        [args.providerId, args.ownerUserId, args.label, enc.ciphertext, enc.iv, enc.tag, args.enabled ?? true],
      );
      const row = res.rows[0]!;
      const stored: StoredKey = this.rowToStored(row);
      this.cache.set(id, stored);
      return this.toSummary(stored);
    }

    // 内存模式
    const stored: StoredKey = {
      id,
      providerId: args.providerId,
      ownerUserId: args.ownerUserId,
      label: args.label,
      apiKey: args.apiKey,
      createdAt: Date.now(),
      lastUsedAt: null,
      monthlyUsageUsd: 0,
      enabled: args.enabled ?? true,
    };
    this.cache.set(id, stored);
    return this.toSummary(stored);
  }

  /** 按 provider + owner 拉取候选 key（owner=null 取平台共享） */
  async list(args: { providerId: ProviderId; ownerUserId: string | null }): Promise<StoredKey[]> {
    if (this.pool) {
      const res = await this.pool.query<RawKeyRow>(
        `SELECT * FROM ai_provider_keys WHERE provider_id = $1 AND owner_user_id IS NOT DISTINCT FROM $2 AND enabled = TRUE ORDER BY created_at ASC`,
        [args.providerId, args.ownerUserId],
      );
      return res.rows.map((r) => this.rowToStored(r));
    }
    const prefix = `${args.providerId}:${args.ownerUserId ?? "_platform"}`;
    return Array.from(this.cache.values()).filter(
      (k) => k.providerId === args.providerId && k.ownerUserId === args.ownerUserId && k.enabled,
    ).filter((k) => k.id.startsWith(prefix));
  }

  async getFirst(args: { providerId: ProviderId; ownerUserId: string | null }): Promise<StoredKey | null> {
    const list = await this.list(args);
    return list[0] ?? null;
  }

  async delete(id: string): Promise<void> {
    if (this.pool) {
      await this.pool.query(`DELETE FROM ai_provider_keys WHERE id::text = $1`, [id]);
    }
    this.cache.delete(id);
  }

  async touch(id: string): Promise<void> {
    const now = new Date();
    if (this.pool) {
      await this.pool.query(`UPDATE ai_provider_keys SET last_used_at = $1 WHERE id::text = $2`, [now, id]);
    }
    const k = this.cache.get(id);
    if (k) k.lastUsedAt = now.getTime();
  }

  async addUsage(id: string, usd: number): Promise<void> {
    if (this.pool) {
      await this.pool.query(
        `UPDATE ai_provider_keys SET monthly_usage_usd = monthly_usage_usd + $1 WHERE id::text = $2`,
        [usd, id],
      );
    }
    const k = this.cache.get(id);
    if (k) k.monthlyUsageUsd += usd;
  }

  private rowToStored(row: RawKeyRow): StoredKey {
    const key = this.keyBuffer;
    if (!key) throw new Error("ENCRYPTION_KEY not configured");
    return {
      id: row.id,
      providerId: row.provider_id,
      ownerUserId: row.owner_user_id,
      label: row.label,
      apiKey: decrypt(row.encrypted_api_key, row.iv, row.auth_tag, key),
      createdAt: row.created_at.getTime(),
      lastUsedAt: row.last_used_at ? row.last_used_at.getTime() : null,
      monthlyUsageUsd: Number(row.monthly_usage_usd ?? 0),
      enabled: row.enabled,
    };
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

export const keyStore = new KeyStore();
export { KeyStore };
