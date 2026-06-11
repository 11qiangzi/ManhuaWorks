import { pool } from '../config/db';
import { Session } from '../models/session';

export async function createSession(input: {
  user_id: string;
  refresh_token_hash: string;
  user_agent?: string | null;
  ip_address?: string | null;
  expires_at: Date;
}): Promise<Session> {
  const r = await pool.query<Session>(
    `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.user_id, input.refresh_token_hash, input.user_agent ?? null, input.ip_address ?? null, input.expires_at]
  );
  return r.rows[0]!;
}

export async function findSessionById(id: string): Promise<Session | null> {
  const r = await pool.query<Session>('SELECT * FROM sessions WHERE id = $1', [id]);
  return r.rows[0] ?? null;
}

export async function findActiveByRefreshHash(hash: string): Promise<Session | null> {
  const r = await pool.query<Session>(
    `SELECT * FROM sessions
     WHERE refresh_token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [hash]
  );
  return r.rows[0] ?? null;
}

export async function touchSession(id: string): Promise<void> {
  await pool.query('UPDATE sessions SET last_used_at = NOW() WHERE id = $1', [id]);
}

export async function revokeSession(id: string): Promise<void> {
  await pool.query(
    'UPDATE sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL',
    [id]
  );
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await pool.query(
    'UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
}
