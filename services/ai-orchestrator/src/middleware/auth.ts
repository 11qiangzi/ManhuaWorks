/**
 * 鉴权中间件
 * 支持 api-key / jwt / none（仅 dev）三种模式。
 * 通过后把 user 注入 context，供后续 cost-tracker / quota 使用。
 */

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

/** JWT 简化版解码（不签名校验，留给 api-gateway 兜底） */
function decodeJwtPayload(token: string): { sub?: string; tier?: UserTier; byok?: boolean } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
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
    const payload = decodeJwtPayload(token);
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
