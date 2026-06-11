import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { pool } from './db';
import { logger } from './logger';

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and >= 32 chars');
}

const ACCESS_TTL = (process.env.JWT_ACCESS_TTL ?? '7d') as SignOptions['expiresIn'];
const REFRESH_TTL = (process.env.JWT_REFRESH_TTL ?? '30d') as SignOptions['expiresIn'];

export interface AccessTokenPayload extends JwtPayload {
  sub: string;       // user id (uuid)
  email: string | null;
  role: number;
  typ: 'access';
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  jti: string;       // session id
  typ: 'refresh';
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'typ' | 'iat' | 'exp'>): string {
  return jwt.sign({ ...payload, typ: 'access' }, SECRET as string, {
    expiresIn: ACCESS_TTL,
    algorithm: 'HS256',
  });
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'typ' | 'iat' | 'exp'>): string {
  return jwt.sign({ ...payload, typ: 'refresh' }, SECRET as string, {
    expiresIn: REFRESH_TTL,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, SECRET as string) as AccessTokenPayload;
  if (decoded.typ !== 'access') {
    throw new Error('invalid token type');
  }
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, SECRET as string) as RefreshTokenPayload;
  if (decoded.typ !== 'refresh') {
    throw new Error('invalid token type');
  }
  return decoded;
}

/**
 * 黑名单：撤销 refresh token（写 sessions.revoked_at）
 */
export async function revokeSession(sessionId: string): Promise<void> {
  try {
    await pool.query(
      'UPDATE sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL',
      [sessionId]
    );
  } catch (err) {
    logger.error({ err, sessionId }, 'revokeSession failed');
    throw err;
  }
}

export async function isSessionRevoked(sessionId: string): Promise<boolean> {
  const r = await pool.query<{ revoked: boolean }>(
    'SELECT (revoked_at IS NOT NULL) AS revoked FROM sessions WHERE id = $1',
    [sessionId]
  );
  return r.rows[0]?.revoked === true;
}

export const JWT_CONFIG = {
  accessTtl: ACCESS_TTL,
  refreshTtl: REFRESH_TTL,
};
