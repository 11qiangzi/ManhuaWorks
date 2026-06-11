import { pool } from '../config/db';
import { Verification, VerificationPurposeValue } from '../models/verification';

export async function createVerification(input: {
  user_id: string;
  token_hash: string;
  purpose: VerificationPurposeValue;
  target: string;
  expires_at: Date;
}): Promise<Verification> {
  // 同一 purpose 下旧的未用 token 全部作废，避免堆积
  await pool.query(
    'UPDATE verifications SET consumed_at = NOW() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL',
    [input.user_id, input.purpose]
  );

  const r = await pool.query<Verification>(
    `INSERT INTO verifications (user_id, token_hash, purpose, target, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.user_id, input.token_hash, input.purpose, input.target, input.expires_at]
  );
  return r.rows[0]!;
}

export async function findValidByHash(
  tokenHash: string,
  purpose: VerificationPurposeValue
): Promise<Verification | null> {
  const r = await pool.query<Verification>(
    `SELECT * FROM verifications
     WHERE token_hash = $1
       AND purpose = $2
       AND consumed_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash, purpose]
  );
  return r.rows[0] ?? null;
}

export async function consume(id: string): Promise<void> {
  await pool.query(
    'UPDATE verifications SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL',
    [id]
  );
}
