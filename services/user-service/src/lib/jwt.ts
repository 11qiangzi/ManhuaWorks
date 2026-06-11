/**
 * JWT 签发 + 验证
 * 使用 jose（更现代、edge-friendly、Hono 友好），避免 jsonwebtoken 的老依赖。
 */

import { SignJWT, jwtVerify } from "jose";
import { env } from "./env.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = "manhuaworks";
const AUDIENCE = "manhuaworks-api";

export interface JwtPayload {
  sub: string; // user_id (UUID)
  role: number;
  phone?: string;
  email?: string;
  // 标准字段
  iat?: number;
  exp?: number;
}

export async function signToken(
  payload: Omit<JwtPayload, "iat" | "exp">,
  expiresIn: string = env.JWT_EXPIRES_IN
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setSubject(payload.sub)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return {
    sub: String(payload.sub),
    role: Number(payload.role ?? 1),
    phone: payload.phone as string | undefined,
    email: payload.email as string | undefined,
    iat: payload.iat as number | undefined,
    exp: payload.exp as number | undefined,
  };
}
