/**
 * Activity 数据访问
 */
import { query } from "../config/db.js";
import type { Activity, ActivityType, RecordActivityInput } from "../models/activity.js";

function rowToActivity(r: Record<string, unknown>): Activity {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    actorId: String(r.actor_id),
    type: r.type as ActivityType,
    targetType: r.target_type == null ? null : String(r.target_type),
    targetId: r.target_id == null ? null : String(r.target_id),
    payload: (r.payload as Record<string, unknown> | null) ?? {},
    createdAt: new Date(r.created_at as string),
  };
}

export async function insertActivity(input: RecordActivityInput): Promise<Activity> {
  const res = await query<Record<string, unknown>>(
    `INSERT INTO activities (project_id, actor_id, type, target_type, target_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, project_id, actor_id, type, target_type, target_id, payload, created_at`,
    [input.projectId, input.actorId, input.type, input.targetType ?? null, input.targetId ?? null, input.payload ?? {}]
  );
  const row = res.rows[0];
  if (!row) throw new Error("insertActivity: 未返回行");
  return rowToActivity(row);
}

export async function listActivities(
  projectId: string,
  opts: { limit?: number; before?: Date; actorId?: string; type?: ActivityType } = {}
): Promise<Activity[]> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 200);
  const params: unknown[] = [projectId];
  let where = "project_id = $1";
  if (opts.actorId) {
    params.push(opts.actorId);
    where += ` AND actor_id = $${params.length}`;
  }
  if (opts.type) {
    params.push(opts.type);
    where += ` AND type = $${params.length}`;
  }
  if (opts.before) {
    params.push(opts.before);
    where += ` AND created_at < $${params.length}`;
  }
  params.push(limit);
  const res = await query<Record<string, unknown>>(
    `SELECT id, project_id, actor_id, type, target_type, target_id, payload, created_at
       FROM activities
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length}`,
    params
  );
  return res.rows.map(rowToActivity);
}
