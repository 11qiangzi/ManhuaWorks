/**
 * Presence (在线状态) 数据访问
 *  - 主存储: Redis HASH collab:presence (跨进程)
 *  - 持久化: 落库做审计
 */
import { redisCmd } from "../config/redis.js";
import { query } from "../config/db.js";
import type { Presence, PresenceStatus } from "../models/presence.js";

const KEY = (userId: string) => `collab:presence:${userId}`;
const PROJECT_SET = (projectId: string) => `collab:presence:project:${projectId}`;

export async function upsertRedis(p: Presence, ttlSec = 90): Promise<void> {
  const k = KEY(p.userId);
  const data = {
    status: p.status,
    projectId: p.projectId ?? "",
    cursor: p.cursor ? JSON.stringify(p.cursor) : "",
    lastHeartbeatAt: p.lastHeartbeatAt.toISOString(),
    joinedAt: p.joinedAt.toISOString(),
    meta: JSON.stringify(p.meta ?? {}),
  };
  await redisCmd.hset(k, data);
  await redisCmd.expire(k, ttlSec);
  if (p.projectId) {
    await redisCmd.sadd(PROJECT_SET(p.projectId), p.userId);
    await redisCmd.expire(PROJECT_SET(p.projectId), ttlSec);
  }
}

export async function getRedis(userId: string): Promise<Presence | null> {
  const raw = await redisCmd.hgetall(KEY(userId));
  if (!raw || Object.keys(raw).length === 0) return null;
  return {
    userId,
    status: (raw.status as PresenceStatus) ?? "offline",
    projectId: raw.projectId ? raw.projectId : null,
    cursor: raw.cursor ? JSON.parse(raw.cursor) : null,
    lastHeartbeatAt: new Date(raw.lastHeartbeatAt ?? Date.now()),
    joinedAt: new Date(raw.joinedAt ?? Date.now()),
    meta: raw.meta ? JSON.parse(raw.meta) : {},
  };
}

export async function listProjectPresence(projectId: string): Promise<Presence[]> {
  const userIds = await redisCmd.smembers(PROJECT_SET(projectId));
  if (userIds.length === 0) return [];
  const pipeline = redisCmd.pipeline();
  for (const uid of userIds) pipeline.hgetall(KEY(uid));
  const results = (await pipeline.exec()) ?? [];
  const out: Presence[] = [];
  for (let i = 0; i < userIds.length; i++) {
    const entry = results[i];
    if (!entry) continue;
    const [err, raw] = entry as [Error | null, Record<string, string> | null];
    if (err || !raw || Object.keys(raw).length === 0) continue;
    const uid = userIds[i];
    if (!uid) continue;
    out.push({
      userId: uid,
      status: (raw.status as PresenceStatus) ?? "online",
      projectId: raw.projectId ? raw.projectId : projectId,
      cursor: raw.cursor ? JSON.parse(raw.cursor) : null,
      lastHeartbeatAt: new Date(raw.lastHeartbeatAt ?? Date.now()),
      joinedAt: new Date(raw.joinedAt ?? Date.now()),
      meta: raw.meta ? JSON.parse(raw.meta) : {},
    });
  }
  return out;
}

export async function markOffline(userId: string): Promise<void> {
  const cur = await getRedis(userId);
  if (cur?.projectId) {
    await redisCmd.srem(PROJECT_SET(cur.projectId), userId);
  }
  await redisCmd.del(KEY(userId));
}

export async function listAllOnline(): Promise<Presence[]> {
  // 仅供后台任务使用，谨慎
  const keys = await redisCmd.keys("collab:presence:*");
  const result: Presence[] = [];
  for (const k of keys) {
    if (k.includes(":project:")) continue;
    const uid = k.replace("collab:presence:", "");
    const p = await getRedis(uid);
    if (p) result.push(p);
  }
  return result;
}

// 持久化 (审计)
export async function persistHeartbeat(p: Presence): Promise<void> {
  await query(
    `INSERT INTO presence_heartbeats (user_id, project_id, status, last_heartbeat_at)
     VALUES ($1, $2, $3, $4)`,
    [p.userId, p.projectId, p.status, p.lastHeartbeatAt]
  );
}
