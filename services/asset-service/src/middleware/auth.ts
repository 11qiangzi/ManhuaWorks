/**
 * 鉴权中间件
 * 支持三种模式：api-key / jwt / none
 * - api-key：Header `X-API-Key: <key>` 或 `Authorization: Bearer <key>`
 * - jwt：Header `Authorization: Bearer <jwt>`，用 HS256 + JWT_SECRET 验签
 * - none：完全开放（仅 dev 用）
 *
 * 与 workflow-engine 的 auth 中间件语义保持一致，方便上层统一处理。
 */

import type { Context, Next } from 'hono';
import { config } from '../config.js';

export interface AuthContext {
  /** 鉴权通过后的主体 id（api-key 模式下 = key 前 8 位；jwt 模式下 = sub） */
  subject: string;
  /** 鉴权模式 */
  mode: 'api-key' | 'jwt' | 'none';
  /** 角色：admin / editor / viewer / anonymous */
  role: 'admin' | 'editor' | 'viewer' | 'anonymous';
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

/** 简易 JWT HS256 验签（避免引入 jose 依赖） */
function verifyJwt(token: string, secret: string): { sub: string; role?: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  // base64url → base64
  const toStdB64 = (s: string): string =>
    s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);

  const data = `${headerB64}.${payloadB64}`;
  const crypto = require('node:crypto') as typeof import('node:crypto');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (expected !== sigB64) return null;

  try {
    const payloadJson = Buffer.from(toStdB64(payloadB64), 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson) as { sub?: string; exp?: number; role?: string };
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null;
    if (typeof payload.sub !== 'string') return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

function extractToken(c: Context): { type: 'api-key' | 'jwt'; value: string } | null {
  const auth = c.req.header('authorization');
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m && m[1]) return { type: 'jwt', value: m[1].trim() };
  }
  const apiKey = c.req.header('x-api-key');
  if (apiKey) return { type: 'api-key', value: apiKey.trim() };
  return null;
}

function normalizeRole(role: string | undefined): AuthContext['role'] {
  if (role === 'admin' || role === 'editor' || role === 'viewer') return role;
  return 'editor'; // 默认 editor 权限
}

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const mode = config.auth.mode;

  // none 模式：完全放行（仅 dev）
  if (mode === 'none') {
    c.set('auth', { subject: 'anonymous', mode: 'none', role: 'anonymous' });
    return next();
  }

  const token = extractToken(c);
  if (!token) {
    return c.json({ error: 'unauthorized', message: 'Missing credentials' }, 401);
  }

  if (mode === 'api-key') {
    if (token.value.length !== config.auth.apiKey.length) {
      return c.json({ error: 'unauthorized', message: 'Invalid API key' }, 401);
    }
    let diff = 0;
    for (let i = 0; i < token.value.length; i++) {
      diff |= token.value.charCodeAt(i) ^ config.auth.apiKey.charCodeAt(i);
    }
    if (diff !== 0) {
      return c.json({ error: 'unauthorized', message: 'Invalid API key' }, 401);
    }
    c.set('auth', { subject: `key:${token.value.slice(0, 8)}`, mode: 'api-key', role: 'admin' });
    return next();
  }

  if (mode === 'jwt') {
    const payload = verifyJwt(token.value, config.auth.jwtSecret);
    if (!payload) {
      return c.json({ error: 'unauthorized', message: 'Invalid JWT' }, 401);
    }
    c.set('auth', { subject: payload.sub, mode: 'jwt', role: normalizeRole(payload.role) });
    return next();
  }

  return c.json({ error: 'unauthorized', message: 'Unknown auth mode' }, 401);
}
