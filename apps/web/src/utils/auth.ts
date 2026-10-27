/** 统一 token 读取，优先 mhw.access_token（带命名空间的正式 key） */
export function getToken(): string | null {
  return localStorage.getItem('mhw.access_token')
      ?? localStorage.getItem('token')
      ?? null
}
