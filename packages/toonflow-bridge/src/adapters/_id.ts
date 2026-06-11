/**
 * 极简 ID 生成器 —— 不引第三方包。
 * 12 字符 base36 随机串：够防冲突 + URL 安全。
 */

const ALPHA = "abcdefghijklmnopqrstuvwxyz0123456789";

export function nanoid(size = 12): string {
  let id = "";
  const bytes = new Uint8Array(size);
  // Node 20 全局 crypto
  crypto.getRandomValues(bytes);
  for (let i = 0; i < size; i++) {
    id += ALPHA[bytes[i] % ALPHA.length];
  }
  return id;
}
