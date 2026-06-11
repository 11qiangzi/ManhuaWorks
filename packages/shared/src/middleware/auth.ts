/**
 * 统一鉴权中间件 — 5 服务共用 (谢擎标准, 派单 48)
 *
 * 替代各服务独立实现:
 *   - user-service: requireAuth (直接函数)
 *   - project-service: authRequired (async remote verify)
 *   - collab-service: authRequired (本地 verify)
 *   - billing-service: authRequired() (工厂, 本地 verify)
 *   - ai-orchestrator: authMiddleware (Hono)
 *
 * 统一为: requireAuth() 工厂 + requireRole() 工厂
 *
 * 错误码 (谢擎标准):
 *   40100 — 未登录
 *   40102 — token 无效或已过期
 *   40300 — 无权访问
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { ErrorCodes } from "../types/errors.js";

// ─── JWT Payload ────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  email?: string | null;
  role: number;
  typ?: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  sub: string;
  id: string;
  email?: string | null;
  role: number;
  displayName?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// ─── Token 验证 ──────────────────────────────────────────────

function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? "changeme-in-production";
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    }) as Record<string, unknown>;

    if (!decoded.sub) return null;
    // 仅接受 typ === 'access' 的 token (兼容无 typ 的旧 token)
    if (decoded.typ && decoded.typ !== "access") return null;

    return {
      sub: String(decoded.sub),
      id: String(decoded.sub),
      email: (decoded.email as string | null) ?? null,
      role: (decoded.role as number) ?? 0,
      displayName: decoded.displayName as string | undefined,
    };
  } catch {
    return null;
  }
}

// ─── 中间件 ──────────────────────────────────────────────────

/**
 * requireAuth — 强制鉴权 (工厂函数)
 *
 * 40100: 未登录 (无 Authorization header)
 * 40102: token 无效或已过期
 */
export function requireAuth(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header("authorization") ?? req.header("Authorization");

    if (!header || !header.toLowerCase().startsWith("bearer ")) {
      res.status(401).json({
        code: ErrorCodes.UNAUTHORIZED,
        message: "未登录",
      });
      return;
    }

    const token = header.slice(7).trim();
    if (!token) {
      res.status(401).json({
        code: ErrorCodes.UNAUTHORIZED,
        message: "未登录",
      });
      return;
    }

    const user = verifyToken(token);
    if (!user) {
      res.status(401).json({
        code: ErrorCodes.INVALID_TOKEN,
        message: "token 无效或已过期",
      });
      return;
    }

    req.user = user;
    next();
  };
}

/**
 * requireRole — 角色鉴权 (工厂函数)
 *
 * @param minRole 最低角色等级 (1=普通, 5=管理员, 10=超管)
 *
 * 40100: 未登录
 * 40300: 角色不足
 */
export function requireRole(minRole: number): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        code: ErrorCodes.UNAUTHORIZED,
        message: "未登录",
      });
      return;
    }

    if ((req.user.role ?? 0) < minRole) {
      res.status(403).json({
        code: ErrorCodes.FORBIDDEN,
        message: "无权访问",
      });
      return;
    }

    next();
  };
}

/**
 * authOptional — 可选鉴权
 *
 * 有 token 就解析用户信息，没有也不拦截。
 */
export function authOptional(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header("authorization") ?? req.header("Authorization");
    if (header && header.toLowerCase().startsWith("bearer ")) {
      const token = header.slice(7).trim();
      const user = verifyToken(token);
      if (user) req.user = user;
    }
    next();
  };
}

/**
 * getUser — 从 req 安全提取用户信息
 *
 * 返回 null 表示未登录 (不抛异常，由调用方处理)
 */
export function getUser(req: Request): AuthUser | null {
  return req.user ?? null;
}

/**
 * requireOwner — 资源所有者检查 (工厂函数)
 *
 * @param getOwnerId 从 req 提取 owner ID 的函数
 *
 * 40100: 未登录
 * 40300: 非 owner 且非 admin
 * 40400: 资源不存在
 */
export function requireOwner(
  getOwnerId: (req: Request) => string | Promise<string>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        code: ErrorCodes.UNAUTHORIZED,
        message: "未登录",
      });
      return;
    }

    try {
      const ownerId = await getOwnerId(req);
      if (req.user.id !== ownerId && (req.user.role ?? 0) < 5) {
        res.status(403).json({
          code: ErrorCodes.FORBIDDEN,
          message: "无权访问该资源",
        });
        return;
      }
      next();
    } catch {
      res.status(404).json({
        code: ErrorCodes.NOT_FOUND,
        message: "资源不存在",
      });
    }
  };
}
