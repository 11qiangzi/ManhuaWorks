/**
 * project_members仓储。
 */
import { pool } from '../config/db';
import type {
 ProjectMemberRow,
 ProjectMemberCreateInput,
 ProjectMemberUpdateInput,
 MemberRole,
} from '../models/projectMember';

const COLS =
 'project_id, user_id, role, joined_at, last_active_at';

export async function listByProject(projectId: string): Promise<ProjectMemberRow[]> {
 const r = await pool.query<ProjectMemberRow>(
 `SELECT ${COLS} FROM project_members WHERE project_id = $1 ORDER BY joined_at ASC`,
 [projectId],
 );
 return r.rows;
}

export async function findOne(projectId: string, userId: string): Promise<ProjectMemberRow | null> {
 const r = await pool.query<ProjectMemberRow>(
 `SELECT ${COLS} FROM project_members
 WHERE project_id = $1 AND user_id = $2
 LIMIT1`,
 [projectId, userId],
 );
 return r.rows[0] ?? null;
}

export async function insert(input: ProjectMemberCreateInput): Promise<ProjectMemberRow> {
 const r = await pool.query<ProjectMemberRow>(
 `INSERT INTO project_members (project_id, user_id, role)
 VALUES ($1, $2, $3)
 RETURNING ${COLS}`,
 [input.project_id, input.user_id, input.role],
 );
 return r.rows[0]!;
}

export async function updateRole(
 projectId: string,
 userId: string,
 patch: ProjectMemberUpdateInput,
): Promise<ProjectMemberRow | null> {
 const r = await pool.query<ProjectMemberRow>(
 `UPDATE project_members
 SET role = $3, last_active_at = NOW()
 WHERE project_id = $1 AND user_id = $2
 RETURNING ${COLS}`,
 [projectId, userId, patch.role],
 );
 return r.rows[0] ?? null;
}

export async function touchLastActive(projectId: string, userId: string): Promise<void> {
 await pool.query(
 `UPDATE project_members SET last_active_at = NOW()
 WHERE project_id = $1 AND user_id = $2`,
 [projectId, userId],
 );
}

export async function remove(projectId: string, userId: string): Promise<boolean> {
 const r = await pool.query<{ project_id: string }>(
 `DELETE FROM project_members
 WHERE project_id = $1 AND user_id = $2
 RETURNING project_id`,
 [projectId, userId],
 );
 return (r.rowCount ??0) >0;
}

export async function listProjectsByUser(userId: string): Promise<{
 project_id: string;
 role: MemberRole;
}[]> {
 const r = await pool.query<{ project_id: string; role: MemberRole }>(
 `SELECT project_id, role FROM project_members WHERE user_id = $1`,
 [userId],
 );
 return r.rows;
}
