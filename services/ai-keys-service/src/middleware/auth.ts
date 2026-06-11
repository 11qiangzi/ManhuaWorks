/**
 * Hono 中间件：JWT鉴权
 *
 * 与 user-service签发的 JWT兼容：
 * - alg: HS256
 * - iss: manhuaworks
 * - aud: manhuaworks-api
 * - secret: 共用 JWT_SECRET
 *
 *期望 header：Authorization: Bearer <token>
 *成功后把 payload塞到 c.set('user', { sub, role, ... })
 */

import type { Context, Next } from "hono";
import { jwtVerify } from "jose";
import { config } from "../config.js";

export interface AuthUser {
 sub: string; // user_id UUID
 role: number;
 phone?: string;
 email?: string;
 iat?: number;
 exp?: number;
}

declare module "hono" {
 interface ContextVariableMap {
 user: AuthUser;
 }
}

const secret = new TextEncoder().encode(config.JWT_SECRET);

export async function authMiddleware(c: Context, next: Next) {
 const auth = c.req.header("authorization");
 if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
 return c.json(
 {
 code:401,
 message:"missing or invalid Authorization header",
 },
401
 );
 }
 const token = auth.slice(7).trim();
 try {
 const { payload } = await jwtVerify(token, secret, {
 issuer: config.JWT_ISSUER,
 audience: config.JWT_AUDIENCE,
 });
 c.set("user", {
 sub: String(payload.sub),
 role: Number(payload.role ??1),
 phone: payload.phone as string | undefined,
 email: payload.email as string | undefined,
 iat: payload.iat as number | undefined,
 exp: payload.exp as number | undefined,
 });
 await next();
 } catch (err) {
 return c.json(
 {
 code:401,
 message:"invalid or expired token",
 detail: err instanceof Error ? err.message : String(err),
 },
401
 );
 }
}

/** 仅管理员（role >=5）放行 */
export async function adminOnly(c: Context, next: Next) {
 const user = c.get("user");
 if (!user || user.role <5) {
 return c.json({ code:403, message:"admin only" },403);
 }
 await next();
}
