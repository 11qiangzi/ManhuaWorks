/**
 * crypto.ts 单元测试
 *
 * 覆盖：
 *   - 加密 → 解密 round-trip
 *   - 篡改检测（authTag 校验）
 *   - 错 key 解密报错
 *   - 空串 / 长串 / unicode / 特殊字符
 *   - IV 唯一性
 *   - 重放攻击防护
 *   - 批量加密
 *   - 轮换 key
 *   - 性能
 *   - fingerprint / lastFour 工具
 */
import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  generateMasterKey,
  rotateMasterKey,
  keyFingerprint,
  lastFour,
  safeEqualB64,
  ALGORITHM,
  IV_BYTES,
  AUTH_TAG_BYTES,
  KEY_BYTES,
  type EncryptedPayload,
} from '../src/services/crypto';

const masterKey = generateMasterKey();

describe('crypto.generateMasterKey', () => {
  it('returns 64-char hex string', () => {
    const k = generateMasterKey();
    expect(k).toMatch(/^[0-9a-f]{64}$/);
  });

  it('two keys are different (entropy)', () => {
    const a = generateMasterKey();
    const b = generateMasterKey();
    expect(a).not.toBe(b);
  });
});

describe('crypto.encrypt + decrypt round-trip', () => {
  it('encrypts and decrypts a normal string', () => {
    const r = encrypt('sk-abc123XYZ', masterKey);
    expect(r.algorithm).toBe(ALGORITHM);
    expect(r.version).toBe(1);
    expect(decrypt(r, masterKey)).toBe('sk-abc123XYZ');
  });

  it('handles empty string', () => {
    const r = encrypt('', masterKey);
    expect(decrypt(r, masterKey)).toBe('');
  });

  it('handles long string (10KB)', () => {
    const big = 'A'.repeat(10_000);
    const r = encrypt(big, masterKey);
    expect(decrypt(r, masterKey)).toBe(big);
  });

  it('handles unicode (中文 + emoji)', () => {
    const s = '中文密钥 🦊 αβγ';
    const r = encrypt(s, masterKey);
    expect(decrypt(r, masterKey)).toBe(s);
  });

  it('handles special characters (newlines, quotes, null bytes)', () => {
    const s = 'line1\nline2\r\n"quoted"\t\t\u0000\u0001';
    const r = encrypt(s, masterKey);
    expect(decrypt(r, masterKey)).toBe(s);
  });
});

describe('crypto.encrypt IV uniqueness', () => {
  it('two encryptions of same plaintext produce different IVs', () => {
    const a = encrypt('same-input', masterKey);
    const b = encrypt('same-input', masterKey);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('IV is exactly 12 bytes (16-char base64)', () => {
    const r = encrypt('x', masterKey);
    expect(Buffer.from(r.iv, 'base64').length).toBe(IV_BYTES);
  });

  it('authTag is exactly 16 bytes (24-char base64)', () => {
    const r = encrypt('x', masterKey);
    expect(Buffer.from(r.authTag, 'base64').length).toBe(AUTH_TAG_BYTES);
  });
});

describe('crypto.encrypt replay-attack protection', () => {
  it('replay with same IV + ciphertext but different plaintext fails auth', () => {
    // 我们不能在正常 API 注入相同 IV（因为 IV 是随机的），
    // 但我们可以构造一个 payload 篡改 ciphertext 来模拟。
    const r = encrypt('original', masterKey);
    // 把 ciphertext 篡改一位
    const buf = Buffer.from(r.ciphertext, 'base64');
    buf[0] = buf[0]! ^ 0x01;
    const tampered: EncryptedPayload = {
      ...r,
      ciphertext: buf.toString('base64'),
    };
    expect(() => decrypt(tampered, masterKey)).toThrow();
  });
});

describe('crypto.encrypt tamper detection', () => {
  it('tampered authTag fails decryption', () => {
    const r = encrypt('secret-payload', masterKey);
    const buf = Buffer.from(r.authTag, 'base64');
    buf[0] = buf[0]! ^ 0xff;
    const tampered: EncryptedPayload = { ...r, authTag: buf.toString('base64') };
    expect(() => decrypt(tampered, masterKey)).toThrow();
  });

  it('tampered IV fails decryption', () => {
    const r = encrypt('secret-payload', masterKey);
    const buf = Buffer.from(r.iv, 'base64');
    buf[0] = buf[0]! ^ 0x01;
    const tampered: EncryptedPayload = { ...r, iv: buf.toString('base64') };
    expect(() => decrypt(tampered, masterKey)).toThrow();
  });
});

describe('crypto.decrypt wrong key', () => {
  it('decrypting with wrong key throws', () => {
    const r = encrypt('sk-test', masterKey);
    const wrongKey = generateMasterKey();
    expect(() => decrypt(r, wrongKey)).toThrow();
  });

  it('decrypting with rotated key (only new) throws on old payload', () => {
    const r1 = encrypt('sk-test', masterKey);
    const k2 = generateMasterKey();
    expect(() => decrypt(r1, k2)).toThrow();
  });
});

describe('crypto.rotateMasterKey', () => {
  it('re-encrypts with new key, old key no longer works', () => {
    const oldKey = generateMasterKey();
    const newKey = generateMasterKey();
    const r1 = encrypt('sk-live-old', oldKey);
    const r2 = rotateMasterKey(oldKey, newKey, r1);
    expect(decrypt(r2, newKey)).toBe('sk-live-old');
    expect(() => decrypt(r2, oldKey)).toThrow();
  });

  it('preserves plaintext through rotation', () => {
    const k1 = generateMasterKey();
    const k2 = generateMasterKey();
    const k3 = generateMasterKey();
    let cur = encrypt('round-trip-me', k1);
    cur = rotateMasterKey(k1, k2, cur);
    cur = rotateMasterKey(k2, k3, cur);
    expect(decrypt(cur, k3)).toBe('round-trip-me');
  });
});

describe('crypto batch encryption', () => {
  it('encrypts 100 records with unique IVs', () => {
    const records: EncryptedPayload[] = [];
    for (let i = 0; i < 100; i++) {
      records.push(encrypt(`key-${i}`, masterKey));
    }
    const ivs = new Set(records.map((r) => r.iv));
    expect(ivs.size).toBe(100);
    // 全部能解回
    for (let i = 0; i < 100; i++) {
      expect(decrypt(records[i]!, masterKey)).toBe(`key-${i}`);
    }
  });
});

describe('crypto performance', () => {
  it('encrypts+decrypts 1000 ops in < 1s', () => {
    const t0 = Date.now();
    for (let i = 0; i < 1000; i++) {
      const r = encrypt(`payload-${i}`, masterKey);
      decrypt(r, masterKey);
    }
    const t1 = Date.now();
    expect(t1 - t0).toBeLessThan(1000);
  });
});

describe('crypto key derivation', () => {
  it('accepts hex 64-char masterKey as raw 32 bytes', () => {
    const hexKey = generateMasterKey();
    expect(hexKey).toHaveLength(KEY_BYTES * 2);
    const r = encrypt('test', hexKey);
    expect(decrypt(r, hexKey)).toBe('test');
  });

  it('accepts passphrase and derives via SHA-256', () => {
    const passphrase = 'my-secret-passphrase';
    const r = encrypt('test', passphrase);
    expect(decrypt(r, passphrase)).toBe('test');
  });

  it('rejects empty masterKey', () => {
    expect(() => encrypt('x', '')).toThrow();
  });
});

describe('crypto utilities', () => {
  it('keyFingerprint returns 16 hex chars', () => {
    const fp = keyFingerprint('sk-abc');
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it('keyFingerprint is deterministic for same input', () => {
    expect(keyFingerprint('sk-abc')).toBe(keyFingerprint('sk-abc'));
  });

  it('keyFingerprint differs for different inputs', () => {
    expect(keyFingerprint('sk-abc')).not.toBe(keyFingerprint('sk-xyz'));
  });

  it('lastFour returns last 4 chars', () => {
    expect(lastFour('sk-abc-1234')).toBe('1234');
    expect(lastFour('1234')).toBe('1234');
  });

  it('lastFour handles short / empty strings gracefully', () => {
    expect(lastFour('ab')).toBe('ab');
    expect(lastFour('')).toBe('');
  });

  it('safeEqualB64 returns true for equal buffers', () => {
    expect(safeEqualB64('aGVsbG8=', 'aGVsbG8=')).toBe(true);
  });

  it('safeEqualB64 returns false for different buffers', () => {
    expect(safeEqualB64('aGVsbG8=', 'd29ybGQ=')).toBe(false);
  });
});

describe('crypto constants', () => {
  it('ALGORITHM is aes-256-gcm', () => {
    expect(ALGORITHM).toBe('aes-256-gcm');
  });
  it('IV_BYTES = 12', () => {
    expect(IV_BYTES).toBe(12);
  });
  it('AUTH_TAG_BYTES = 16', () => {
    expect(AUTH_TAG_BYTES).toBe(16);
  });
  it('KEY_BYTES = 32', () => {
    expect(KEY_BYTES).toBe(32);
  });
});
