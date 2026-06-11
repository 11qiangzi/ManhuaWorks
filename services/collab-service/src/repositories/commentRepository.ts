/**
 * Comment 数据访问
 *  - 直接用 pg 拼 SQL (无 ORM 依赖)
 */
import { query, withTransaction } from "../config/db.js";
import type { Comment, CommentTargetType, CreateCommentInput, UpdateCommentInput } from "../models/comment.js";

const SELECT = `
  id, project_id, author_id, target_type, target_id,
  parent_comment_id, body, mentions,
  resolved, resolved_by, resolved_at, edited_at,
  created_at, updated_at
`;

function rowToComment(r: Record<string, unknown>): Comment {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    authorId: String(r.author_id),
    targetType: r.target_type as CommentTargetType,
    targetId: r.target_id == null ? null : String(r.target_id),
    parentCommentId: r.parent_comment_id == null ? null : String(r.parent_comment_id),
    body: String(r.body),
    mentions: Array.isArray(r.mentions) ? (r.mentions as string[]).map(String) : [],
    resolved: Boolean(r.resolved),
    resolvedBy: r.resolved_by == null ? null : String(r.resolved_by),
    resolvedAt: r.resolved_at == null ? null : new Date(r.resolved_at as string),
    editedAt: r.edited_at == null ? null : new Date(r.edited_at as string),
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
  };
}

export async function insertComment(input: CreateCommentInput & { mentions: string[] }): Promise<Comment> {
  const sql = `
    INSERT INTO comments (project_id, author_id, target_type, target_id, parent_comment_id, body, mentions)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING ${SELECT}
  `;
  const res = await query<Record<string, unknown>>(sql, [
    input.projectId,
    input.authorId,
    input.targetType,
    input.targetId ?? null,
    input.parentCommentId ?? null,
    input.body,
    input.mentions,
  ]);
  const row = res.rows[0];
  if (!row) throw new Error("insertComment: 未返回行");
  return rowToComment(row);
}

export async function findCommentById(id: string): Promise<Comment | null> {
  const res = await query<Record<string, unknown>>(
    `SELECT ${SELECT} FROM comments WHERE id = $1`,
    [id]
  );
  const row = res.rows[0];
  return row ? rowToComment(row) : null;
}

export async function listComments(
  projectId: string,
  opts: { targetType?: CommentTargetType; targetId?: string; limit?: number; before?: Date } = {}
): Promise<Comment[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const params: unknown[] = [projectId];
  let where = "project_id = $1";
  if (opts.targetType) {
    params.push(opts.targetType);
    where += ` AND target_type = $${params.length}`;
  }
  if (opts.targetId) {
    params.push(opts.targetId);
    where += ` AND target_id = $${params.length}`;
  }
  if (opts.before) {
    params.push(opts.before);
    where += ` AND created_at < $${params.length}`;
  }
  params.push(limit);
  const res = await query<Record<string, unknown>>(
    `SELECT ${SELECT} FROM comments WHERE ${where}
     ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  return res.rows.map(rowToComment);
}

export async function listThread(rootId: string): Promise<Comment[]> {
  const res = await query<Record<string, unknown>>(
    `WITH RECURSIVE thread AS (
       SELECT ${SELECT.split(",").map((c) => c.trim()).join(", ")} FROM comments WHERE id = $1
       UNION ALL
       SELECT ${SELECT.split(",").map((c) => c.trim()).join(", ")}
       FROM comments c
       INNER JOIN thread t ON c.parent_comment_id = t.id
     )
     SELECT * FROM thread ORDER BY created_at ASC`,
    [rootId]
  );
  return res.rows.map(rowToComment);
}

export async function updateComment(id: string, input: UpdateCommentInput, mentions: string[]): Promise<Comment | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.body !== undefined) {
    params.push(input.body);
    sets.push(`body = $${params.length}`);
    sets.push(`edited_at = NOW()`);
  }
  if (mentions.length > 0 || mentions.length === 0) {
    params.push(mentions);
    sets.push(`mentions = $${params.length}`);
  }
  if (sets.length === 0) return findCommentById(id);
  params.push(id);
  const res = await query<Record<string, unknown>>(
    `UPDATE comments SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${SELECT}`,
    params
  );
  const row = res.rows[0];
  return row ? rowToComment(row) : null;
}

export async function setResolved(
  id: string,
  resolved: boolean,
  userId: string
): Promise<Comment | null> {
  const res = await query<Record<string, unknown>>(
    `UPDATE comments
        SET resolved = $1,
            resolved_by = CASE WHEN $1 THEN $2 ELSE NULL END,
            resolved_at = CASE WHEN $1 THEN NOW() ELSE NULL END
      WHERE id = $3
      RETURNING ${SELECT}`,
    [resolved, userId, id]
  );
  const row = res.rows[0];
  return row ? rowToComment(row) : null;
}

export async function deleteComment(id: string): Promise<boolean> {
  const res = await query("DELETE FROM comments WHERE id = $1", [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function countByProject(projectId: string): Promise<number> {
  const res = await query<{ c: string }>(
    "SELECT COUNT(*)::text AS c FROM comments WHERE project_id = $1",
    [projectId]
  );
  return Number(res.rows[0]?.c ?? 0);
}

export async function bulkInsertWithClient(
  client: import("pg").PoolClient,
  input: CreateCommentInput & { mentions: string[] }
): Promise<Comment> {
  const sql = `
    INSERT INTO comments (project_id, author_id, target_type, target_id, parent_comment_id, body, mentions)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING ${SELECT}
  `;
  const res = await client.query<Record<string, unknown>>(sql, [
    input.projectId,
    input.authorId,
    input.targetType,
    input.targetId ?? null,
    input.parentCommentId ?? null,
    input.body,
    input.mentions,
  ]);
  const row = res.rows[0];
  if (!row) throw new Error("bulkInsert: 未返回行");
  return rowToComment(row);
}

export { withTransaction };
