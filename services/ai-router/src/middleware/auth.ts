// JWT 验证 + 用户识别
// 用 jose 校验 HS256 签名的 token。

import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";
import { config } from "../config.js";

export interface AuthUser {
  userId: string;
  email?: string;
  roles?: string[];
}

export type AppEnv = {
  Variables: {
    user?: AuthUser;
    requestId: string;
  };
};

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(config.jwtSecret);
}

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  // 如果 trustInternalMiddleware 已通过 x-internal-user 设置了用户，跳过 JWT
  if (c.get("user")) {
    await next();
    return;
  }

  const header = c.req.header("authorization");
  if (!header) {
    return c.json(
      { error: "missing authorization header", code: "auth_required" },
      401,
    );
  }
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) {
    return c.json(
      { error: "invalid authorization header", code: "auth_format" },
      401,
    );
  }
  const token = m[1]!;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    const sub = typeof payload.sub === "string" ? payload.sub : undefined;
    if (!sub) {
      return c.json(
        { error: "token missing sub", code: "auth_invalid" },
        401,
      );
    }
    const user: AuthUser = {
      userId: sub,
      email: typeof payload.email === "string" ? (payload.email as string) : undefined,
      roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : undefined,
    };
    c.set("user", user);
  } catch (err) {
    return c.json(
      {
        error: "invalid token",
        code: "auth_invalid",
        detail: err instanceof Error ? err.message : "unknown",
      },
      401,
    );
  }

  await next();
});

/** 内部调用专用：跳过 JWT（service-to-service 信任网关层） */
export const trustInternalMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const userId = c.req.header("x-internal-user");
  if (userId) {
    c.set("user", { userId });
  }
  await next();
});
