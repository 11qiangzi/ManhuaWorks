/**
 * user-service HTTP客户端
 *
 * 仅做一件事：远程校验 JWT。
 *
 * 设计：
 * - 不本地 verify token（user-service 是 JWT 的唯一信任源）
 * - 调用 user-service GET /api/v1/auth/me（带 Authorization: Bearer ...）
 * -200 + body.data.id → token合法
 * -401 → token非法/过期
 * -超时/网络错 →抛 AuthUnavailableError（让上游决定如何处理）
 */

const USER_SERVICE_URL = process.env.USER_SERVICE_URL ?? 'http://localhost:8088';
const TIMEOUT_MS = Number(process.env.USER_SERVICE_TIMEOUT_MS ??3000);

export interface VerifiedUser {
 id: string;
 email: string | null;
 phone: string | null;
 role: number;
 status: number;
 display_name: string | null;
}

export class AuthUnavailableError extends Error {
 constructor(detail: string) {
 super(`user-service unreachable: ${detail}`);
 this.name = 'AuthUnavailableError';
 }
}

export class InvalidTokenError extends Error {
 constructor(detail: string) {
 super(`invalid token: ${detail}`);
 this.name = 'InvalidTokenError';
 }
}

// ─── JWT 验签缓存 (派单 25: 缓解 100 并发下 auth 503) ───
// 10s TTL: 同一 token 在窗口内复用验签结果
// 生产若需要多进程共享可换 Redis
interface CacheEntry {
  user: VerifiedUser;
  expiresAt: number;
}
const jwtCache = new Map<string, CacheEntry>();
const JWT_CACHE_TTL_MS = 10_000;

// 每 30s 清理过期缓存条目
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of jwtCache) {
    if (now > v.expiresAt) jwtCache.delete(k);
  }
}, 30_000).unref();

/**
 *远程校验 Bearer token，拿到当前用户。
 *
 * 派单 25: 加 10s JWT 缓存, 同 token 复用验签结果
 */
export async function verifyTokenRemote(token: string): Promise<VerifiedUser> {
  // 缓存命中: 直接返回 (免 HTTP 调用)
  const cached = jwtCache.get(token);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.user;
  }
 const ctrl = new AbortController();
 const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
 try {
 const res = await fetch(`${USER_SERVICE_URL}/api/v1/me`, {
 method: 'GET',
 headers: {
 Authorization: `Bearer ${token}`,
 Accept: 'application/json',
 },
 signal: ctrl.signal,
 });
 if (res.status ===401 || res.status ===403) {
 const body = await res.text().catch(() => '');
 throw new InvalidTokenError(`status=${res.status} body=${body.slice(0,200)}`);
 }
 if (!res.ok) {
 throw new AuthUnavailableError(`status=${res.status}`);
 }
 const json = (await res.json()) as {
 code?: number;
 data?: {
 id: string;
 email: string | null;
 phone: string | null;
 role: number;
 status: number;
 display_name: string | null;
 };
 };
 if (json.code !==0 || !json.data?.id) {
 throw new InvalidTokenError('user-service returned non-ok');
 }
 const result: VerifiedUser = {
 id: json.data.id,
 email: json.data.email ?? null,
 phone: json.data.phone ?? null,
 role: json.data.role,
 status: json.data.status,
 display_name: json.data.display_name ?? null,
 };
 // 缓存成功验签结果 (10s TTL)
 jwtCache.set(token, { user: result, expiresAt: Date.now() + JWT_CACHE_TTL_MS });
 return result;
 } catch (err) {
 if (err instanceof InvalidTokenError) throw err;
 if ((err as Error).name === 'AbortError') {
 throw new AuthUnavailableError(`timeout after ${TIMEOUT_MS}ms`);
 }
 throw new AuthUnavailableError((err as Error).message ?? String(err));
 } finally {
 clearTimeout(timer);
 }
}

/**健康检查：user-service 是否可达。*/
export async function pingUserService(): Promise<boolean> {
 const ctrl = new AbortController();
 const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
 try {
 const res = await fetch(`${USER_SERVICE_URL}/health`, {
 method: 'GET',
 signal: ctrl.signal,
 });
 return res.ok;
 } catch {
 return false;
 } finally {
 clearTimeout(timer);
 }
}
