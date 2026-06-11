import { pool } from '../config/db';
import { AuditLog } from '../models/audit';

export async function log(input: {
  user_id?: string | null;
  action: string;
  status?: number;          // 0=fail, 1=success
  ip_address?: string | null;
  user_agent?: string | null;
  detail?: Record<string, unknown> | null;
}): Promise<AuditLog> {
  const r = await pool.query<AuditLog>(
    `INSERT INTO audit_logs (user_id, action, status, ip_address, user_agent, detail)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.user_id ?? null,
      input.action,
      input.status ?? 1,
      input.ip_address ?? null,
      input.user_agent ?? null,
      input.detail ? JSON.stringify(input.detail) : null,
    ]
  );
  return r.rows[0]!;
}

export async function listForUser(userId: string, limit = 50): Promise<AuditLog[]> {
  const r = await pool.query<AuditLog>(
    'SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return r.rows;
}
