/**
 * AES-256-GCM 加密服务
 *
 * 用 Node.js 内置 crypto 模块（不引第三方包）。
 *
 * 设计要点：
 * - 算法固定 AES-256-GCM（authenticated encryption，附 integrity check）
 * - key 长度：32 字节（256 位）。masterKey 入参可是 hex 字符串或任意字符串：
 *     若 hex 长度 = 64 → 直接当 32 字节；否则 SHA-256 派生为 32 字节
 * - IV 长度：12 字节（96 位）— GCM 标准推荐
 * - authTag 长度：16 字节（128 位）— GCM 默认
 * - 同一明文 + 同一 key，每次都生成不同 IV（用 crypto.randomBytes，绝不重用）
 *
 * ⚠️ 安全性约束：
 * - 永远不要在日志/响应/错误里打印 plaintext / ciphertext / decrypted key
 * - 永远不要把 masterKey 落库或返回
 * - 加密的输出（iv/authTag/ciphertext）以 base64 序列化便于存储
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  timingSafeEqual,
} from 'node:crypto';

export const ALGORITHM = 'aes-256-gcm' as const;

export const IV_BYTES = 12;
export const AUTH_TAG_BYTES = 16;
export const KEY_BYTES = 32; // 256 位

export interface EncryptedPayload {
  iv: string;             // base64
  authTag: string;        // base64
  ciphertext: string;     // base64
  algorithm: 'aes-256-gcm';
  version: 1;
}

/**
 * 把任意输入的 masterKey 规范成 32 字节 buffer。
 *
 * 规则：
 *   1. 优先按 hex 解析（必须是 64 字符 hex = 32 字节）— 这种情况直接当 raw key
 *   2. 否则用 SHA-256(utf8(masterKey)) 派生
 *
 * 这样调用方可以传 hex 串（generateMasterKey 的输出）也可以传 passphrase。
 */
function deriveKey(masterKey: string): Buffer {
  if (typeof masterKey !== 'string' || masterKey.length === 0) {
    throw new Error('masterKey must be a non-empty string');
  }

  // 1) hex 严格解析
  if (masterKey.length === KEY_BYTES * 2 && /^[0-9a-fA-F]+$/.test(masterKey)) {
    return Buffer.from(masterKey, 'hex');
  }

  // 2) SHA-256 派生（统一到 32 字节）
  return createHash('sha256').update(masterKey, 'utf8').digest();
}

/**
 * AES-256-GCM 加密。
 *
 * 每次调用都用 crypto.randomBytes(12) 生成新 IV，**绝不重用**。
 *
 * @param plaintext  明文（任意 utf-8 字符串）
 * @param masterKey  主密钥（hex 64 字符 / 任意字符串）
 * @returns          加密结果（iv / authTag / ciphertext 都是 base64）
 */
export function encrypt(plaintext: string, masterKey: string): EncryptedPayload {
  if (typeof plaintext !== 'string') {
    throw new Error('plaintext must be a string');
  }

  const key = deriveKey(masterKey);
  const iv = randomBytes(IV_BYTES); // 12 字节随机

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 字节

  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: enc.toString('base64'),
    algorithm: ALGORITHM,
    version: 1,
  };
}

/**
 * AES-256-GCM 解密。
 *
 * 篡改检测：GCM 的 authTag 校验失败时，decipher.final() 会抛错（不是 false）。
 * 错 key：同上，decipher.final() 抛 'Unsupported state or unable to authenticate data'。
 */
export function decrypt(payload: EncryptedPayload, masterKey: string): string {
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload must be an object');
  }
  if (payload.algorithm !== ALGORITHM) {
    throw new Error(`unsupported algorithm: ${payload.algorithm}`);
  }
  // iv / authTag 必传（即便 ciphertext 是空），否则视为非法 payload
  if (!payload.iv || !payload.authTag) {
    throw new Error('payload missing iv/authTag');
  }
  // ciphertext 允许空串（对应 plaintext === '' 的合法 case）

  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');

  if (iv.length !== IV_BYTES) {
    throw new Error(`iv length must be ${IV_BYTES} bytes, got ${iv.length}`);
  }
  if (authTag.length !== AUTH_TAG_BYTES) {
    throw new Error(`authTag length must be ${AUTH_TAG_BYTES} bytes, got ${authTag.length}`);
  }

  const key = deriveKey(masterKey);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
  decipher.setAuthTag(authTag);

  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return dec.toString('utf8');
}

/**
 * 生成 32 字节随机主密钥，返回 64 字符 hex 串。
 */
export function generateMasterKey(): string {
  return randomBytes(KEY_BYTES).toString('hex');
}

/**
 * 主密钥轮换：用 newKey 重新加密旧密文。
 *
 * 流程：decrypt(oldKey) → encrypt(newKey)
 * 注意：oldKey 必须能解开旧密文；newKey 用于新密文。
 */
export function rotateMasterKey(
  oldKey: string,
  newKey: string,
  ciphertext: EncryptedPayload,
): EncryptedPayload {
  const plaintext = decrypt(ciphertext, oldKey);
  return encrypt(plaintext, newKey);
}

/**
 * 工具：取明文 key 的 fingerprint（SHA-256 前 8 hex 字符，16 字符 hex）。
 *
 * 用 raw plaintext 计算（不加密），方便 UI 展示 "key fingerprint"。
 * 注意：fingerprint 不是 secret 替代品 — 它是明文可计算的非敏感标识。
 */
export function keyFingerprint(plaintext: string): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('plaintext must be a non-empty string');
  }
  return createHash('sha256').update(plaintext, 'utf8').digest('hex').slice(0, 16);
}

/**
 * 工具：取明文 key 的末 4 位。
 *
 * 处理 length < 4：返回整个字符串（避免越界）。
 */
export function lastFour(plaintext: string): string {
  if (typeof plaintext !== 'string') {
    throw new Error('plaintext must be a string');
  }
  if (plaintext.length === 0) return '';
  return plaintext.slice(-4);
}

/**
 * 工具：常量时间比较两个 base64 buffer（防时序攻击）。
 * 内部用，导出便于测试。
 */
export function safeEqualB64(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'base64');
  const bb = Buffer.from(b, 'base64');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
