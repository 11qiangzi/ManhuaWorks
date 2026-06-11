/**
 * project_versions仓储。
 */
import { pool } from '../config/db';
import type { ProjectVersionRow, ProjectVersionCreateInput } from '../models/projectVersion';

const COLS =
 'id, project_id, version_no, snapshot, message, created_by, created_at';

export async function listByProject(
 projectId: string,
 opts: { page?: number; pageSize?: number } = {},
): Promise<{ rows: ProjectVersionRow[]; total: number }> {
 const page = Math.max(1, opts.page ??1);
 const pageSize = Math.min(100, Math.max(1, opts.pageSize ??20));
 const offset = (page -1) * pageSize;

 const rowsR = await pool.query<ProjectVersionRow>(
 `SELECT ${COLS} FROM project_versions
 WHERE project_id = $1
 ORDER BY version_no DESC
 LIMIT $2 OFFSET $3`,
 [projectId, pageSize, offset],
 );
 const totalR = await pool.query<{ c: number }>(
 `SELECT COUNT(*)::int AS c FROM project_versions WHERE project_id = $1`,
 [projectId],
 );
 return { rows: rowsR.rows, total: totalR.rows[0]?.c ??0 };
}

export async function findByNo(projectId: string, versionNo: number): Promise<ProjectVersionRow | null> {
 const r = await pool.query<ProjectVersionRow>(
 `SELECT ${COLS} FROM project_versions
 WHERE project_id = $1 AND version_no = $2
 LIMIT1`,
 [projectId, versionNo],
 );
 return r.rows[0] ?? null;
}

export async function getMaxVersionNo(projectId: string): Promise<number> {
 const r = await pool.query<{ max_no: number | null }>(
 `SELECT MAX(version_no) AS max_no FROM project_versions WHERE project_id = $1`,
 [projectId],
 );
 return r.rows[0]?.max_no ??0;
}

export async function insert(input: ProjectVersionCreateInput): Promise<ProjectVersionRow> {
 const r = await pool.query<ProjectVersionRow>(
 `INSERT INTO project_versions
 (project_id, version_no, snapshot, message, created_by)
 VALUES ($1, $2, $3::jsonb, $4, $5)
 RETURNING ${COLS}`,
 [
 input.project_id,
 input.version_no,
 JSON.stringify(input.snapshot),
 input.message ?? null,
 input.created_by,
 ],
 );
 return r.rows[0]!;
}

export async function findById(id: string): Promise<ProjectVersionRow | null> {
 const r = await pool.query<ProjectVersionRow>(
 `SELECT ${COLS} FROM project_versions WHERE id = $1 LIMIT1`,
 [id],
 );
 return r.rows[0] ?? null;
}
