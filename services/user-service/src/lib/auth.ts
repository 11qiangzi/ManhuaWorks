/**
 * Hono 中间件：JWT 鉴权
 *
 * 期待请求头：Authorization: Bearer <token>
 * 解析成功后把 user 塞到 c.set('user', { id, role, ... })
 */

import type { Context, Next } from "hono";
import { verifyToken, type JwtPayload } from "./jwt.js";

declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const auth = c.req.header("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return c.json(
      { code: 401, message: "missing or invalid Authorization header" },
      401
    );
  }
  const token = auth.slice(7).trim();
  try {
    const payload = await verifyToken(token);
    c.set("user", payload);
    await next();
  } catch (err) {
    return c.json(
      {
        code: 401,
        message: "invalid or expired token",
        detail: err instanceof Error ? err.message : String(err),
      },
      401
    );
  }
}

/** 仅管理员（role >= 5）放行 */
export async function adminOnly(c: Context, next: Next) {
  const user = c.get("user");
  if (!user || user.role < 5) {
    return c.json({ code: 403, message: "admin only" }, 403);
  }
  await next();
}
