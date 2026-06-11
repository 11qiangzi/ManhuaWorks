/**
 * RealtimeSession 数据访问
 */
import { query } from "../config/db.js";
import type { RealtimeSession, SessionStatus } from "../models/realtimeSession.js";

function rowToSession(r: Record<string, unknown>): RealtimeSession {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    projectId: r.project_id == null ? null : String(r.project_id),
    clientId: String(r.client_id),
    ip: r.ip == null ? null : String(r.ip),
    userAgent: r.user_agent == null ? null : String(r.user_agent),
    status: r.status as SessionStatus,
    connectedAt: new Date(r.connected_at as string),
    lastPingAt: new Date(r.last_ping_at as string),
    closedAt: r.closed_at == null ? null : new Date(r.closed_at as string),
    closeReason: r.close_reason == null ? null : String(r.close_reason),
  };
}

export async function openSession(input: {
  id: string;
  userId: string;
  projectId: string | null;
  clientId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<RealtimeSession> {
  const res = await query<Record<string, unknown>>(
    `INSERT INTO realtime_sessions (id, user_id, project_id, client_id, ip, user_agent, status, connected_at, last_ping_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
     RETURNING *`,
    [input.id, input.userId, input.projectId, input.clientId, input.ip ?? null, input.userAgent ?? null]
  );
  const row = res.rows[0];
  if (!row) throw new Error("openSession: 未返回行");
  return rowToSession(row);
}

export async function pingSession(id: string): Promise<void> {
  await query("UPDATE realtime_sessions SET last_ping_at = NOW() WHERE id = $1", [id]);
}

export async function closeSession(id: string, reason: string): Promise<void> {
  await query(
    "UPDATE realtime_sessions SET status = 'closed', closed_at = NOW(), close_reason = $2 WHERE id = $1",
    [id, reason]
  );
}

export async function expireStaleSessions(olderThanMs: number): Promise<number> {
  const res = await query(
    "UPDATE realtime_sessions SET status = 'expired', closed_at = NOW(), close_reason = 'heartbeat-timeout' WHERE status = 'active' AND last_ping_at < NOW() - ($1::int || ' milliseconds')::interval RETURNING id",
    [olderThanMs]
  );
  return res.rowCount ?? 0;
}

export async function listActiveByUser(userId: string): Promise<RealtimeSession[]> {
  const res = await query<Record<string, unknown>>(
    "SELECT * FROM realtime_sessions WHERE user_id = $1 AND status = 'active' ORDER BY connected_at DESC",
    [userId]
  );
  return res.rows.map(rowToSession);
}
