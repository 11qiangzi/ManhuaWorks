/**
 * api-key.repo 单元测试
 *
 * 覆盖：
 *   - create / listByUser / findById / revoke / touchLastUsed
 *   - fingerprint + lastFour 自动生成
 *   - 不在返回值里包含 encryptedKey（隐私）
 *   - 多 provider 支持
 *   - 唯一约束 (userId, provider)
 *   - revoke 后允许同 provider 再加
 *   - 软删（数据保留）
 *   - findActiveByUserProvider / decryptKey
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  apiKeyRepo,
  ApiKeyConflictError,
  ApiKeyNotFoundError,
  type ApiKeyProvider,
} from '../src/repos/api-key.repo';
import { generateMasterKey } from '../src/services/crypto';

const USER_A = 'user-a';
const USER_B = 'user-b';
const MASTER = generateMasterKey();

beforeEach(() => {
  apiKeyRepo.clear();
});

describe('apiKeyRepo.create + listByUser', () => {
  it('creates a key and returns public record (no encryptedKey)', () => {
    const r = apiKeyRepo.create(USER_A, 'openai', 'sk-abc-1234', MASTER);
    expect(r.id).toBeTruthy();
    expect(r.userId).toBe(USER_A);
    expect(r.provider).toBe('openai');
    expect(r.keyFingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(r.lastFour).toBe('1234');
    expect(r.revokedAt).toBeNull();
    expect(r.createdAt).toBeGreaterThan(0);
    // 关键：返回值绝对不含 encryptedKey
    expect((r as unknown as { encryptedKey?: unknown }).encryptedKey).toBeUndefined();
  });

  it('different keys produce different fingerprints', () => {
    // 跨 provider：同 user 不同 provider，fingerprint 可比较
    const r1 = apiKeyRepo.create(USER_A, 'openai', 'sk-aaaa-1234', MASTER);
    const r2 = apiKeyRepo.create(USER_A, 'anthropic', 'sk-bbbb-5678', MASTER);
    expect(r1.keyFingerprint).not.toBe(r2.keyFingerprint);
    expect(r1.lastFour).toBe('1234');
    expect(r2.lastFour).toBe('5678');
  });

  it('listByUser returns only that user keys, no encryptedKey', () => {
    apiKeyRepo.create(USER_A, 'openai', 'sk-aaaa-1234', MASTER);
    apiKeyRepo.create(USER_A, 'anthropic', 'sk-ant-9999', MASTER);
    apiKeyRepo.create(USER_B, 'openai', 'sk-bbbb-1234', MASTER);

    const aList = apiKeyRepo.listByUser(USER_A);
    expect(aList).toHaveLength(2);
    for (const k of aList) {
      expect(k.userId).toBe(USER_A);
      expect((k as unknown as { encryptedKey?: unknown }).encryptedKey).toBeUndefined();
    }

    const bList = apiKeyRepo.listByUser(USER_B);
    expect(bList).toHaveLength(1);
    expect(bList[0]?.provider).toBe('openai');
  });

  it('listByUser sorts by createdAt desc', async () => {
    const r1 = apiKeyRepo.create(USER_A, 'openai', 'sk-aaaa-1234', MASTER);
    await new Promise((r) => setTimeout(r, 2));
    const r2 = apiKeyRepo.create(USER_A, 'anthropic', 'sk-bbbb-1234', MASTER);

    const list = apiKeyRepo.listByUser(USER_A);
    expect(list[0]?.id).toBe(r2.id);
    expect(list[1]?.id).toBe(r1.id);
  });
});

describe('apiKeyRepo unique constraint (userId, provider)', () => {
  it('throws ApiKeyConflictError on duplicate (userId, provider)', () => {
    apiKeyRepo.create(USER_A, 'openai', 'sk-aaaa-1234', MASTER);
    expect(() =>
      apiKeyRepo.create(USER_A, 'openai', 'sk-aaaa-9999', MASTER),
    ).toThrow(ApiKeyConflictError);
  });

  it('allows same user different provider', () => {
    apiKeyRepo.create(USER_A, 'openai', 'sk-aaaa-1234', MASTER);
    expect(() =>
      apiKeyRepo.create(USER_A, 'anthropic', 'sk-ant-9999', MASTER),
    ).not.toThrow();
  });

  it('allows same provider different user', () => {
    apiKeyRepo.create(USER_A, 'openai', 'sk-aaaa-1234', MASTER);
    expect(() =>
      apiKeyRepo.create(USER_B, 'openai', 'sk-bbbb-1234', MASTER),
    ).not.toThrow();
  });

  it('all 5 providers supported', () => {
    const providers: ApiKeyProvider[] = [
      'openai',
      'anthropic',
      'google',
      'deepseek',
      'minimax',
    ];
    for (const p of providers) {
      const r = apiKeyRepo.create(USER_A, p, `sk-${p}-1234`, MASTER);
      expect(r.provider).toBe(p);
    }
    expect(apiKeyRepo.listByUser(USER_A)).toHaveLength(5);
  });
});

describe('apiKeyRepo.findById', () => {
  it('returns public record by id', () => {
    const created = apiKeyRepo.create(USER_A, 'openai', 'sk-abc-1234', MASTER);
    const found = apiKeyRepo.findById(created.id);
    expect(found.id).toBe(created.id);
    expect((found as unknown as { encryptedKey?: unknown }).encryptedKey).toBeUndefined();
  });

  it('throws ApiKeyNotFoundError for unknown id', () => {
    expect(() => apiKeyRepo.findById('non-existent-id')).toThrow(ApiKeyNotFoundError);
  });
});

describe('apiKeyRepo.revoke (soft delete)', () => {
  it('revoke sets revokedAt and keeps record', () => {
    const r = apiKeyRepo.create(USER_A, 'openai', 'sk-abc-1234', MASTER);
    apiKeyRepo.revoke(r.id);
    const after = apiKeyRepo.findById(r.id);
    expect(after.revokedAt).not.toBeNull();
    // 仍然能在 listByUser 看到
    const list = apiKeyRepo.listByUser(USER_A);
    expect(list).toHaveLength(1);
  });

  it('revoke throws on unknown id', () => {
    expect(() => apiKeyRepo.revoke('nope')).toThrow(ApiKeyNotFoundError);
  });

  it('after revoke, can add same (user, provider) again', () => {
    const r1 = apiKeyRepo.create(USER_A, 'openai', 'sk-old-1234', MASTER);
    apiKeyRepo.revoke(r1.id);
    const r2 = apiKeyRepo.create(USER_A, 'openai', 'sk-new-5678', MASTER);
    expect(r2.id).not.toBe(r1.id);
    expect(r2.lastFour).toBe('5678');
  });
});

describe('apiKeyRepo.touchLastUsed', () => {
  it('updates lastUsedAt', async () => {
    const r = apiKeyRepo.create(USER_A, 'openai', 'sk-abc-1234', MASTER);
    expect(r.lastUsedAt).toBeNull();
    apiKeyRepo.touchLastUsed(r.id);
    const after = apiKeyRepo.findById(r.id);
    expect(after.lastUsedAt).not.toBeNull();
  });

  it('throws on unknown id', () => {
    expect(() => apiKeyRepo.touchLastUsed('nope')).toThrow(ApiKeyNotFoundError);
  });
});

describe('apiKeyRepo decrypt + findActive', () => {
  it('decryptKey returns original plaintext (internal use)', () => {
    const r = apiKeyRepo.create(USER_A, 'openai', 'sk-secret-9999', MASTER);
    const plain = apiKeyRepo.decryptKey(r.id, MASTER);
    expect(plain).toBe('sk-secret-9999');
  });

  it('decryptKey throws on revoked key', () => {
    const r = apiKeyRepo.create(USER_A, 'openai', 'sk-secret-9999', MASTER);
    apiKeyRepo.revoke(r.id);
    expect(() => apiKeyRepo.decryptKey(r.id, MASTER)).toThrow(/revoked/);
  });

  it('findActiveByUserProvider returns active key', () => {
    apiKeyRepo.create(USER_A, 'openai', 'sk-secret-9999', MASTER);
    const active = apiKeyRepo.findActiveByUserProvider(USER_A, 'openai');
    expect(active).not.toBeNull();
    expect(active?.provider).toBe('openai');
  });

  it('findActiveByUserProvider returns null after revoke', () => {
    const r = apiKeyRepo.create(USER_A, 'openai', 'sk-secret-9999', MASTER);
    apiKeyRepo.revoke(r.id);
    expect(apiKeyRepo.findActiveByUserProvider(USER_A, 'openai')).toBeNull();
  });

  it('findActiveByUserProvider returns null for unknown', () => {
    expect(apiKeyRepo.findActiveByUserProvider('nobody', 'openai')).toBeNull();
  });
});
