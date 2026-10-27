/**
 * 鉴权中间件
 * 支持 api-key / jwt / none（仅 dev）三种模式。
 * 通过后把 user 注入 context，供后续 cost-tracker / quota 使用。
 */

import { createHmac } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { ErrorCodes } from "@manhuaworks/shared";
import { config } from "../config.js";

export type UserTier = "guest" | "free" | "pro" | "business" | "enterprise";

export interface AuthUser {
  userId: string;
  tier: UserTier;
  /** 可选 BYOK 启用 */
  byokEnabled?: boolean;
}

export type AppEnv = {
  Variables: {
    user?: AuthUser;
    requestId?: string;
  };
};

declare module "hono" {
  interface ContextVariableMap {
    user?: AuthUser;
    requestId?: string;
  }
}

/** 从请求里抠 API Key 或 Bearer */
function extractToken(authHeader: string | undefined, apiKeyHeader: string | undefined): string | null {
  if (apiKeyHeader && apiKeyHeader.trim().length > 0) return apiKeyHeader.trim();
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  return authHeader.trim();
}

// ─── JWT Secret 安全策略 (P0-1 统一, 与 @manhuaworks/shared 对齐) ───
//
// 生产环境 JWT_SECRET 必须设置，缺失则拒绝启动。
// 开发环境缺失时使用临时密钥 (每次重启变化)，并输出警告。
let _jwtSecretCache: string | null = null;
let _jwtSecretWarned = false;

function getJwtSecretForOrch(): string {
  if (_jwtSecretCache) return _jwtSecretCache;

  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) {
    _jwtSecretCache = secret;
    return secret;
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    throw new Error(
      "[ai-orchestrator] FATAL: JWT_SECRET 环境变量未设置或长度不足16字符。生产环境禁止使用默认密钥。"
    );
  }

  if (!_jwtSecretWarned) {
    console.warn(
      "[ai-orchestrator] WARNING: JWT_SECRET 环境变量未设置，使用临时开发密钥。此密钥每次重启后变化，仅适用于本地调试。请在 .env 中设置 JWT_SECRET。"
    );
    _jwtSecretWarned = true;
  }

  _jwtSecretCache = "dev-only-temporary-key-" + process.pid;
  return _jwtSecretCache;
}

/** JWT 签名验证 + 解码（HMAC-SHA256） */

export function verifyAndDecodeJwt(token: string): { sub?: string; tier?: UserTier; byok?: boolean } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;

  // Verify HMAC-SHA256 signature
  const expected = createHmac("sha256", getJwtSecretForOrch())
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  if (expected !== sigB64) return null;

  try {
    const json = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const obj = JSON.parse(json) as Record<string, unknown>;
    return {
      sub: typeof obj.sub === "string" ? obj.sub : undefined,
      tier: (obj.tier as UserTier | undefined) ?? "free",
      byok: obj.byok === true,
    };
  } catch {
    return null;
  }
}

/** 主鉴权中间件 */
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (config.auth.mode === "none") {
    c.set("user", { userId: "dev-anon", tier: "enterprise" });
    await next();
    return;
  }

  const apiKeyHeader = c.req.header("x-api-key");
  const authHeader = c.req.header("authorization");
  const token = extractToken(authHeader ?? undefined, apiKeyHeader ?? undefined);

  if (!token) {
    return c.json({ code: ErrorCodes.UNAUTHORIZED, message: "未登录" }, 401);
  }

  if (config.auth.mode === "api-key") {
    if (token !== config.auth.apiKey) {
      return c.json({ code: ErrorCodes.UNAUTHORIZED, message: "invalid api key" }, 401);
    }
    // 内部服务账号 → 视为 enterprise
    c.set("user", { userId: "internal", tier: "enterprise" });
  } else if (config.auth.mode === "jwt") {
    const payload = verifyAndDecodeJwt(token);
    if (!payload?.sub) {
      return c.json({ code: ErrorCodes.INVALID_TOKEN, message: "invalid jwt" }, 401);
    }
    c.set("user", {
      userId: payload.sub,
      tier: payload.tier ?? "free",
      byokEnabled: payload.byok,
    });
  }

  await next();
};

/** 注入 requestId（如果上游没传） */
export const requestIdMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const incoming = c.req.header("x-request-id");
  const rid = incoming ?? `orch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  c.set("requestId", rid);
  c.header("x-request-id", rid);
  await next();
};

/** 简易日志中间件 */
export const loggerMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const start = Date.now();
  const rid = c.get("requestId");
  await next();
  const dur = Date.now() - start;
  process.stdout.write(
    `[ai-orchestrator] ${c.req.method} ${c.req.path} rid=${rid} status=${c.res.status} ${dur}ms\n`,
  );
};

/** 工具：取 user，未登录则抛 401（一般不会到这里） */
export function requireUser(c: Context<AppEnv>): AuthUser {
  const u = c.get("user");
  if (!u) throw new Error("user not set");
  return u;
}
