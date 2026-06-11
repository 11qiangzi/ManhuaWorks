/**
 * JWT 鉴权 + 5 级 RBAC 中间件
 *
 * 设计：
 *   - 用 `jose` 验签（支持 HS256/384/512），不要用 `jsonwebtoken`（同步阻塞）
 *   - payload 形如：
 *       { sub: 'usr_xxx', role: 'L3', exp: ..., iat: ..., iss, aud }
 *   - RBAC：路由用 `requireRole('L3+')` 声明最低级别
 *   - 失败一律 401（鉴权失败）/ 403（权限不足），body 给中文 message 方便调试
 *
 * 注意：
 *   - 这是「网关层」的粗粒度权限，业务服务还要自己再校验一次资源归属
 *   - 生产环境必须把 JWT_SECRET 改成强随机；这里给默认仅用于本地 dev
 */

import type { Context, MiddlewareHandler } from 'hono';
import { jwtVerify, SignJWT } from 'jose';
import { loadConfig, ROLE_BIT, ROLE_NAME, type Role } from '../config.js';

export interface AuthUser {
  sub: string;        // 用户 ID
  role: Role;         // 5 级角色
  email?: string;
  iat?: number;
  exp?: number;
}

export type AppEnv = {
  Variables: {
    user?: AuthUser;
  };
};

// ──────────────────────────────────────────────────────────
// 工具：把 Role 字符串解析为位掩码
// ──────────────────────────────────────────────────────────

function parseRole(s: unknown): Role | null {
  if (typeof s !== 'string') return null;
  if (s === 'L1' || s === 'L2' || s === 'L3' || s === 'L4' || s === 'L5') return s;
  return null;
}

/** 判断 `userRole` 是否 >= `minRole`（数字越大权限越高） */
export function hasAtLeast(userRole: Role, minRole: Role): boolean {
  return ROLE_BIT[userRole] >= ROLE_BIT[minRole];
}

// ──────────────────────────────────────────────────────────
// 验签
// ──────────────────────────────────────────────────────────

async function verifyToken(token: string): Promise<AuthUser> {
  const cfg = loadConfig();
  const secret = new TextEncoder().encode(cfg.JWT_SECRET);

  const { payload } = await jwtVerify(token, secret, {
    issuer: cfg.JWT_ISSUER,
    audience: cfg.JWT_AUDIENCE,
    algorithms: [cfg.JWT_ALGORITHM],
  });

  const role = parseRole(payload.role);
  if (!role) {
    throw new Error('payload.role 缺失或非法');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('payload.sub 缺失');
  }

  return {
    sub: payload.sub,
    role,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    iat: typeof payload.iat === 'number' ? payload.iat : undefined,
    exp: typeof payload.exp === 'number' ? payload.exp : undefined,
  };
}

/** 工具：给业务服务签 token（仅供本地开发 / 测试用） */
export async function signToken(claims: { sub: string; role: Role; email?: string; ttlSec?: number }): Promise<string> {
  const cfg = loadConfig();
  const secret = new TextEncoder().encode(cfg.JWT_SECRET);
  const ttl = claims.ttlSec ?? 3600;

  return await new SignJWT({ role: claims.role, email: claims.email })
    .setProtectedHeader({ alg: cfg.JWT_ALGORITHM })
    .setSubject(claims.sub)
    .setIssuer(cfg.JWT_ISSUER)
    .setAudience(cfg.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secret);
}

// ──────────────────────────────────────────────────────────
// 中间件（用原生 MiddlewareHandler，避免 createMiddleware 泛型推断坑）
// ──────────────────────────────────────────────────────────

/**
 * 解析 Authorization: Bearer <token>，把 user 塞到 context
 * 不强制失败 —— 业务路由自己决定是否要求鉴权
 */
export const jwtAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = c.req.header('authorization');
  if (!auth) return next();
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return next();
  try {
    const user = await verifyToken(m[1]!);
    c.set('user', user);
  } catch (err) {
    if (loadConfig().LOG_LEVEL === 'debug') {
      console.warn('[auth] token verify failed:', (err as Error).message);
    }
  }
  return next();
};

/** 强制要求已登录 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'unauthorized', message: '缺少有效 token' }, 401);
  }
  return next();
};

/**
 * 工厂：要求最低角色级别
 * 用法：app.get('/admin/x', requireRole('L3'), handler)
 */
export function requireRole(min: Role): MiddlewareHandler<AppEnv> {
  const minName = `${min} (${ROLE_NAME[min]})`;
  return async (c: Context<AppEnv>, next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'unauthorized', message: '缺少有效 token' }, 401);
    }
    if (!hasAtLeast(user.role, min)) {
      return c.json(
        {
          error: 'forbidden',
          message: `权限不足：需要 ${minName}，当前 ${user.role} (${ROLE_NAME[user.role]})`,
          required: min,
          current: user.role,
        },
        403,
      );
    }
    return next();
  };
}
