/**
 * bcrypt 密码哈希
 * 用 bcryptjs（纯 JS 兼容，避免 native build 在 alpine 容器里翻车）。
 */

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}
