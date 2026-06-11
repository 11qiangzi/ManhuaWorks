/**
 * Notification 数据访问
 */
import { query } from "../config/db.js";
import type { Notification, NotificationChannel, NotificationStatus, NotificationType, CreateNotificationInput } from "../models/notification.js";

function rowToNotification(r: Record<string, unknown>): Notification {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    type: r.type as NotificationType,
    channel: (r.channel as NotificationChannel) ?? "in_app",
    status: (r.status as NotificationStatus) ?? "unread",
    title: String(r.title),
    body: String(r.body),
    projectId: r.project_id == null ? null : String(r.project_id),
    actorId: r.actor_id == null ? null : String(r.actor_id),
    link: r.link == null ? null : String(r.link),
    payload: (r.payload as Record<string, unknown> | null) ?? {},
    readAt: r.read_at == null ? null : new Date(r.read_at as string),
    createdAt: new Date(r.created_at as string),
  };
}

const SELECT = `
  id, user_id, type, channel, status, title, body,
  project_id, actor_id, link, payload, read_at, created_at
`;

export async function insertNotification(input: CreateNotificationInput): Promise<Notification> {
  const res = await query<Record<string, unknown>>(
    `INSERT INTO notifications (user_id, type, channel, title, body, project_id, actor_id, link, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${SELECT}`,
    [
      input.userId,
      input.type,
      input.channel ?? "in_app",
      input.title,
      input.body,
      input.projectId ?? null,
      input.actorId ?? null,
      input.link ?? null,
      input.payload ?? {},
    ]
  );
  const row = res.rows[0];
  if (!row) throw new Error("insertNotification: 未返回行");
  return rowToNotification(row);
}

export async function listNotifications(
  userId: string,
  opts: { status?: NotificationStatus; limit?: number; before?: Date } = {}
): Promise<Notification[]> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 200);
  const params: unknown[] = [userId];
  let where = "user_id = $1";
  if (opts.status) {
    params.push(opts.status);
    where += ` AND status = $${params.length}`;
  }
  if (opts.before) {
    params.push(opts.before);
    where += ` AND created_at < $${params.length}`;
  }
  params.push(limit);
  const res = await query<Record<string, unknown>>(
    `SELECT ${SELECT} FROM notifications WHERE ${where}
     ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  return res.rows.map(rowToNotification);
}

export async function countUnread(userId: string): Promise<number> {
  const res = await query<{ c: string }>(
    "SELECT COUNT(*)::text AS c FROM notifications WHERE user_id = $1 AND status = 'unread'",
    [userId]
  );
  return Number(res.rows[0]?.c ?? 0);
}

export async function markRead(id: string, userId: string): Promise<boolean> {
  const res = await query(
    "UPDATE notifications SET status = 'read', read_at = NOW() WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function markAllRead(userId: string): Promise<number> {
  const res = await query(
    "UPDATE notifications SET status = 'read', read_at = NOW() WHERE user_id = $1 AND status = 'unread'",
    [userId]
  );
  return res.rowCount ?? 0;
}

export async function archive(id: string, userId: string): Promise<boolean> {
  const res = await query(
    "UPDATE notifications SET status = 'archived' WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return (res.rowCount ?? 0) > 0;
}
