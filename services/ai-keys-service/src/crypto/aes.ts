/**
 * AES-256-GCM加密 / 解密
 *
 *特点：
 * -每次加密生成随机12字节 IV（推荐长度）
 * -16字节 auth tag 用于完整性校验
 * - 输出格式：base64(IV(12) || TAG(16) || CIPHERTEXT(N))
 * - 解密时先验证 auth tag 再解密密文，失败抛错
 *
 *依赖：Node.js 内置 crypto，无需第三方包。
 */

import {
 createCipheriv,
 createDecipheriv,
 randomBytes,
} from "node:crypto";
import { deriveUserKey } from "./key-derivation.js";

const ALGO = "aes-256-gcm";
const IV_LENGTH =12; // GCM 推荐12字节
const TAG_LENGTH =16; // GCM 默认16字节

/**
 *加密
 * @param plaintext 明文（如用户的 API key）
 * @param userId 用户 UUID
 * @param provider厂商标识
 * @returns base64字符串：IV || TAG || CIPHERTEXT
 */
export function encryptApiKey(
 plaintext: string,
 userId: string,
 provider: string
): string {
 const key = deriveUserKey(userId, provider);
 const iv = randomBytes(IV_LENGTH);
 const cipher = createCipheriv(ALGO, key, iv);

 const ct = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
 const tag = cipher.getAuthTag();

 // IV(12) + TAG(16) + CT(N)
 const packed = Buffer.concat([iv, tag, ct]);
 return packed.toString("base64");
}

/**
 * 解密
 * @param packed base64字符串（IV || TAG || CIPHERTEXT）
 * @param userId 用户 UUID
 * @param provider厂商标识
 * @returns 明文
 * @throws auth tag校验失败或数据被篡改时抛错
 */
export function decryptApiKey(
 packed: string,
 userId: string,
 provider: string
): string {
 const key = deriveUserKey(userId, provider);
 const buf = Buffer.from(packed, "base64");
 if (buf.length < IV_LENGTH + TAG_LENGTH) {
 throw new Error("ciphertext too short");
 }
 const iv = buf.subarray(0, IV_LENGTH);
 const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
 const ct = buf.subarray(IV_LENGTH + TAG_LENGTH);

 const decipher = createDecipheriv(ALGO, key, iv);
 decipher.setAuthTag(tag);

 const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
 return pt.toString("utf-8");
}

/**
 *快速校验：能否成功解密（用于 audit / self-check）
 */
export function canDecrypt(
 packed: string,
 userId: string,
 provider: string
): boolean {
 try {
 decryptApiKey(packed, userId, provider);
 return true;
 } catch {
 return false;
 }
}
