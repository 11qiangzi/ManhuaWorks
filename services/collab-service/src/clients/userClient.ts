/**
 * user-service HTTP 客户端
 *  - 用于解析 @mention 时拉取 username -> id
 *  - 软依赖: 调用失败降级，不阻塞主流程
 */
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export interface UserBrief {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

interface UserSearchResponse {
  code: number;
  data?: { users?: UserBrief[] };
}

const CACHE_TTL_SEC = 60;
const cache = new Map<string, { value: UserBrief | null; expiresAt: number }>();

export async function resolveUsername(username: string): Promise<UserBrief | null> {
  const key = username.toLowerCase();
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const url = `${env.USER_SERVICE_URL}/api/v1/users/lookup?username=${encodeURIComponent(username)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      cache.set(key, { value: null, expiresAt: now + CACHE_TTL_SEC * 1000 });
      return null;
    }
    const body = (await res.json()) as UserSearchResponse;
    const user = body.data?.users?.[0] ?? null;
    cache.set(key, { value: user, expiresAt: now + CACHE_TTL_SEC * 1000 });
    return user;
  } catch (err) {
    logger.warn({ err, username }, "userClient.resolveUsername 失败");
    cache.set(key, { value: null, expiresAt: now + 5_000 });
    return null;
  }
}

export async function resolveUsernames(usernames: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const name of usernames) {
    const u = await resolveUsername(name);
    if (u) out.push(u.id);
  }
  return out;
}

export function clearUserCache(): void {
  cache.clear();
}
