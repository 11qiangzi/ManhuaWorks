import { pool } from '../config/db';
import { User, Role, UserStatus, PublicUser, toPublicUser } from '../models/user';

export interface CreateUserInput {
  email?: string | null;
  phone?: string | null;
  password_hash?: string | null;
  display_name?: string | null;
  role?: number;
}

export interface UpdateUserInput {
  display_name?: string;
  avatar_url?: string;
  password_hash?: string;
  role?: number;
  status?: number;
}

export async function findById(id: string): Promise<User | null> {
  const r = await pool.query<User>(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findByEmail(email: string): Promise<User | null> {
  const r = await pool.query<User>(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return r.rows[0] ?? null;
}

export async function findByPhone(phone: string): Promise<User | null> {
  const r = await pool.query<User>(
    'SELECT * FROM users WHERE phone = $1',
    [phone]
  );
  return r.rows[0] ?? null;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const r = await pool.query<User>(
    `INSERT INTO users (email, phone, password_hash, display_name, role, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.email ?? null,
      input.phone ?? null,
      input.password_hash ?? null,
      input.display_name ?? null,
      input.role ?? Role.Reader,
      UserStatus.Active,
    ]
  );
  return r.rows[0]!;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (input.display_name !== undefined) { sets.push(`display_name = $${i++}`); vals.push(input.display_name); }
  if (input.avatar_url !== undefined)   { sets.push(`avatar_url = $${i++}`);   vals.push(input.avatar_url); }
  if (input.password_hash !== undefined){ sets.push(`password_hash = $${i++}`);vals.push(input.password_hash); }
  if (input.role !== undefined)         { sets.push(`role = $${i++}`);         vals.push(input.role); }
  if (input.status !== undefined)       { sets.push(`status = $${i++}`);       vals.push(input.status); }
  if (sets.length === 0) return findById(id);
  vals.push(id);
  const r = await pool.query<User>(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return r.rows[0] ?? null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const r = await pool.query('DELETE FROM users WHERE id = $1', [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function listUsers(opts: { limit: number; offset: number }): Promise<PublicUser[]> {
  const r = await pool.query<User>(
    'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [opts.limit, opts.offset]
  );
  return r.rows.map(toPublicUser);
}

export async function countUsers(): Promise<number> {
  const r = await pool.query<{ c: string }>('SELECT COUNT(*)::text AS c FROM users');
  return Number(r.rows[0]?.c ?? 0);
}
