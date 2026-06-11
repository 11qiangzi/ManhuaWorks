/**
 * HKDF-SHA256密钥派生
 *
 *目的：从全局 MASTER_KEY + 用户上下文（user_id + provider）派生出 user-specific key。
 * 即使 MASTER_KEY泄露，没有 HKDF salt 也无法批量解密所有用户。
 *
 *协议：
 * derivedKey = HKDF-SHA256(
 * ikm = MASTER_KEY,
 * salt = HKDF_SALT,
 * info = `manhuaworks:byok:${userId}:${provider}`,
 * L =32 // bytes，用于 AES-256
 * )
 */

import { hkdfSync } from "node:crypto";
import { config, masterKey } from "../config.js";

const KEY_LENGTH =32; // AES-256 需要32字节

/**
 *派生 user-specific AES key
 * @param userId用户的 UUID
 * @param provider厂商标识（openai / anthropic / ...）
 * @returns32字节Buffer
 */
export function deriveUserKey(userId: string, provider: string): Buffer {
 const salt = Buffer.from(config.HKDF_SALT, "utf-8");
 const info = Buffer.from(
 `${config.HKDF_INFO}:${userId}:${provider}`,
 "utf-8"
 );

 const derived = hkdfSync("sha256", masterKey, salt, info, KEY_LENGTH);
 return Buffer.from(derived);
}

/**
 * 生成 key hint（用于 UI显示，不泄露真实 key）
 * 例：sk-abc...xyz → "sk-***xyz"
 */
export function makeKeyHint(plaintext: string): string {
 const trimmed = plaintext.trim();
 if (trimmed.length <=8) return "***";
 const prefix = trimmed.slice(0, Math.min(4, trimmed.length));
 const suffix = trimmed.slice(-4);
 return `${prefix}***${suffix}`;
}
