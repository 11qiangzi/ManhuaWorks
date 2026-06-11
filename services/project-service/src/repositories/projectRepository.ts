/**
 * projects 表仓储 —纯 SQL（pg.Pool.query）。
 *
 *字段命名严格遵循001_init.sql（snake_case）。
 */
import { pool } from '../config/db';
import type {
 ProjectRow,
 ProjectCreateInput,
 ProjectUpdateInput,
 ProjectStatus,
} from '../models/project';

const COLS =
 'id, user_id, title, description, art_style, story_type, cover_url, status, created_at';

export async function findById(id: string): Promise<ProjectRow | null> {
 const r = await pool.query<ProjectRow>(
 `SELECT ${COLS} FROM projects WHERE id = $1 LIMIT1`,
 [id],
 );
 return r.rows[0] ?? null;
}

export async function findByIdIncludingDeleted(id: string): Promise<ProjectRow | null> {
 // projects 表本身没有 deleted_at字段；status=3视为归档，软删用 status=3。
 const r = await pool.query<ProjectRow>(
 `SELECT ${COLS} FROM projects WHERE id = $1 LIMIT1`,
 [id],
 );
 return r.rows[0] ?? null;
}

export async function listByUser(
 userId: string,
 opts: { page?: number; pageSize?: number; status?: ProjectStatus; includeArchived?: boolean } = {},
): Promise<{ rows: ProjectRow[]; total: number }> {
 const page = Math.max(1, opts.page ??1);
 const pageSize = Math.min(100, Math.max(1, opts.pageSize ??20));
 const offset = (page -1) * pageSize;

 const where: string[] = ['user_id = $1'];
 const params: unknown[] = [userId];
 if (opts.status !== undefined) {
 params.push(opts.status);
 where.push(`status = $${params.length}`);
 } else if (!opts.includeArchived) {
 where.push('status <>3');
 }
 const whereSql = `WHERE ${where.join(' AND ')}`;

 const rowsP = pool.query<ProjectRow>(
 `SELECT ${COLS} FROM projects ${whereSql}
 ORDER BY created_at DESC
 LIMIT $${params.length +1} OFFSET $${params.length +2}`,
 [...params, pageSize, offset],
 );
 const totalP = pool.query<{ c: number }>(
 `SELECT COUNT(*)::int AS c FROM projects ${whereSql}`,
 params,
 );
 const [rowsR, totalR] = await Promise.all([rowsP, totalP]);
 return { rows: rowsR.rows, total: totalR.rows[0]?.c ??0 };
}

export async function insert(input: ProjectCreateInput): Promise<ProjectRow> {
 const r = await pool.query<ProjectRow>(
 `INSERT INTO projects
 (user_id, title, description, art_style, story_type, cover_url, status)
 VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7,0))
 RETURNING ${COLS}`,
 [
 input.user_id,
 input.title,
 input.description ?? null,
 input.art_style ?? null,
 input.story_type ?? null,
 input.cover_url ?? null,
 input.status ?? null,
 ],
 );
 return r.rows[0]!;
}

export async function update(id: string, patch: ProjectUpdateInput): Promise<ProjectRow | null> {
 const sets: string[] = [];
 const vals: unknown[] = [];
 let i =1;
 if (patch.title !== undefined) { sets.push(`title = $${i++}`); vals.push(patch.title); }
 if (patch.description !== undefined) { sets.push(`description = $${i++}`); vals.push(patch.description); }
 if (patch.art_style !== undefined) { sets.push(`art_style = $${i++}`); vals.push(patch.art_style); }
 if (patch.story_type !== undefined) { sets.push(`story_type = $${i++}`); vals.push(patch.story_type); }
 if (patch.cover_url !== undefined) { sets.push(`cover_url = $${i++}`); vals.push(patch.cover_url); }
 if (patch.status !== undefined) { sets.push(`status = $${i++}`); vals.push(patch.status); }
 if (sets.length ===0) return findById(id);
 vals.push(id);
 const r = await pool.query<ProjectRow>(
 `UPDATE projects SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${COLS}`,
 vals,
 );
 return r.rows[0] ?? null;
}

/**软删：status置为3（归档）。*/
export async function softDelete(id: string): Promise<boolean> {
 const r = await pool.query<{ id: string }>(
 `UPDATE projects SET status =3 WHERE id = $1 AND status <>3 RETURNING id`,
 [id],
 );
 return (r.rowCount ??0) >0;
}

/**还原：恢复到软删前状态（默认 status=0 draft）。*/
export async function restore(id: string, toStatus: ProjectStatus =0): Promise<ProjectRow | null> {
 const r = await pool.query<ProjectRow>(
 `UPDATE projects SET status = $2 WHERE id = $1 RETURNING ${COLS}`,
 [id, toStatus],
 );
 return r.rows[0] ?? null;
}

/**硬删（仅供管理/测试使用，业务层通常走 softDelete）。*/
export async function hardDelete(id: string): Promise<boolean> {
 const r = await pool.query<{ id: string }>(
 `DELETE FROM projects WHERE id = $1 RETURNING id`,
 [id],
 );
 return (r.rowCount ??0) >0;
}
