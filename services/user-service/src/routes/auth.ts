/**
 * 鉴权路由 - SSO 雏形
 *
 *  POST /api/v1/auth/send-code   发送手机验证码（mock）
 *  POST /api/v1/auth/login       手机号 + 验证码 登录（自动注册）
 *  POST /api/v1/auth/register    邮箱 + 密码 注册
 *  POST /api/v1/auth/login-pwd   邮箱 + 密码 登录
 *  GET  /api/v1/auth/me          拿当前用户信息
 */

import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, subscriptions, quotas } from "../db/schema.js";
import { sendCode, verifyCode } from "../lib/sms.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { signToken } from "../lib/jwt.js";
import { authMiddleware } from "../lib/auth.js";

const auth = new Hono();

/* ---------------- 1. 发送验证码 ---------------- */
const sendCodeSchema = z.object({
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "invalid_cn_phone"),
});

auth.post("/send-code", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = sendCodeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 400, message: "invalid params", issues: parsed.error.flatten() },
      400
    );
  }
  const result = await sendCode(parsed.data.phone);
  if (!result.ok) {
    return c.json({ code: 429, message: result.reason }, 429);
  }
  return c.json({
    code: 0,
    message: "ok",
    data: {
      phone: parsed.data.phone,
      ttl: 300,
      // mock 模式才返回 code（仅 dev/staging 可见）
      ...(result.mockCode ? { mock_code: result.mockCode } : {}),
    },
  });
});

/* ---------------- 2. 手机号验证码登录/注册 ---------------- */
const loginCodeSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/),
  code: z.string().length(6),
  display_name: z.string().max(50).optional(),
});

auth.post("/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = loginCodeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 400, message: "invalid params" }, 400);
  }
  const { phone, code, display_name } = parsed.data;

  const verify = verifyCode(phone, code);
  if (!verify.ok) {
    return c.json({ code: 401, message: verify.reason }, 401);
  }

  // 查找 / 创建用户（SSO 雏形：首次登录即注册）
  let user = (
    await db.select().from(users).where(eq(users.phone, phone)).limit(1)
  )[0];

  if (!user) {
    const inserted = await db
      .insert(users)
      .values({
        phone,
        displayName: display_name ?? `User_${phone.slice(-4)}`,
        role: 1,
        status: 1,
      })
      .returning();
    user = inserted[0]!;

    // 默认 free 订阅 + 默认配额
    await db.insert(subscriptions).values({
      userId: user.id,
      plan: "free",
    });
    await db.insert(quotas).values({ userId: user.id });
  } else if (user.status === 0) {
    return c.json({ code: 403, message: "user disabled" }, 403);
  }

  const token = await signToken({
    sub: user.id,
    role: user.role,
    phone: user.phone ?? undefined,
  });

  return c.json({
    code: 0,
    message: "ok",
    data: {
      token,
      user: {
        id: user.id,
        phone: user.phone,
        display_name: user.displayName,
        role: user.role,
      },
    },
  });
});

/* ---------------- 3. 邮箱密码注册 ---------------- */
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
  display_name: z.string().min(1).max(50),
});

auth.post("/register", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 400, message: "invalid params", issues: parsed.error.flatten() },
      400
    );
  }
  const { email, password, display_name } = parsed.data;

  const exists = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  if (exists) {
    return c.json({ code: 409, message: "email already registered" }, 409);
  }

  const passwordHash = await hashPassword(password);
  const inserted = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      displayName: display_name,
      role: 1,
      status: 1,
    })
    .returning();
  const user = inserted[0]!;

  await db.insert(subscriptions).values({ userId: user.id, plan: "free" });
  await db.insert(quotas).values({ userId: user.id });

  const token = await signToken({
    sub: user.id,
    role: user.role,
    email: user.email ?? undefined,
  });

  return c.json(
    {
      code: 0,
      message: "registered",
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.displayName,
          role: user.role,
        },
      },
    },
    201
  );
});

/* ---------------- 4. 邮箱密码登录 ---------------- */
const loginPwdSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

auth.post("/login-pwd", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = loginPwdSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 400, message: "invalid params" }, 400);
  }
  const { email, password } = parsed.data;

  const user = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  if (!user || !user.passwordHash) {
    return c.json({ code: 401, message: "invalid credentials" }, 401);
  }
  if (user.status === 0) {
    return c.json({ code: 403, message: "user disabled" }, 403);
  }
  const pass = await verifyPassword(password, user.passwordHash);
  if (!pass) {
    return c.json({ code: 401, message: "invalid credentials" }, 401);
  }
  const token = await signToken({
    sub: user.id,
    role: user.role,
    email: user.email ?? undefined,
  });
  return c.json({
    code: 0,
    message: "ok",
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.displayName,
        role: user.role,
      },
    },
  });
});

/* ---------------- 5. 当前用户 ---------------- */
auth.get("/me", authMiddleware, async (c) => {
  const u = c.get("user");
  const rows = await db.select().from(users).where(eq(users.id, u.sub)).limit(1);
  const user = rows[0];
  if (!user) return c.json({ code: 404, message: "user not found" }, 404);

  return c.json({
    code: 0,
    message: "ok",
    data: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      role: user.role,
      status: user.status,
      created_at: user.createdAt,
    },
  });
});

export default auth;
