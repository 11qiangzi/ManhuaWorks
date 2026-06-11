/**
 * users CRUD
 *
 *  GET    /api/v1/users           分页列表（admin only）
 *  GET    /api/v1/users/:id       详情
 *  PATCH  /api/v1/users/:id       更新（自己 or admin）
 *  DELETE /api/v1/users/:id       禁用（soft delete，admin only）
 *  GET    /api/v1/users/me/profile  自己
 */

import { Hono } from "hono";
import { z } from "zod";
import { and, eq, desc, count } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { authMiddleware, adminOnly } from "../lib/auth.js";

const usersRoute = new Hono();
usersRoute.use("*", authMiddleware);

/* GET /api/v1/users */
usersRoute.get("/", adminOnly, async (c) => {
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("page_size") ?? "20")));
  const offset = (page - 1) * pageSize;

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(users),
  ]);

  return c.json({
    code: 0,
    message: "ok",
    data: {
      list: rows.map((u) => ({
        id: u.id,
        phone: u.phone,
        email: u.email,
        display_name: u.displayName,
        role: u.role,
        status: u.status,
        created_at: u.createdAt,
      })),
      page,
      page_size: pageSize,
      total: Number(totalRow[0]?.value ?? 0),
    },
  });
});

/* GET /api/v1/users/me/profile */
usersRoute.get("/me/profile", async (c) => {
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
      updated_at: user.updatedAt,
    },
  });
});

/* GET /api/v1/users/:id */
usersRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  const u = c.get("user");
  if (u.sub !== id && u.role < 5) {
    return c.json({ code: 403, message: "forbidden" }, 403);
  }
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
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

/* PATCH /api/v1/users/:id */
const updateUserSchema = z.object({
  display_name: z.string().min(1).max(50).optional(),
  avatar_url: z.string().url().max(500).optional(),
  role: z.number().int().min(1).max(5).optional(),
  status: z.number().int().min(0).max(1).optional(),
});

usersRoute.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const u = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 400, message: "invalid params" }, 400);
  }
  const patch: Record<string, unknown> = {};
  if (parsed.data.display_name !== undefined) patch.displayName = parsed.data.display_name;
  if (parsed.data.avatar_url !== undefined) patch.avatarUrl = parsed.data.avatar_url;
  if (parsed.data.role !== undefined) {
    if (u.role < 5) return c.json({ code: 403, message: "admin only for role" }, 403);
    patch.role = parsed.data.role;
  }
  if (parsed.data.status !== undefined) {
    if (u.role < 5) return c.json({ code: 403, message: "admin only for status" }, 403);
    patch.status = parsed.data.status;
  }
  if (u.sub !== id && u.role < 5) {
    return c.json({ code: 403, message: "forbidden" }, 403);
  }
  if (Object.keys(patch).length === 0) {
    return c.json({ code: 400, message: "empty patch" }, 400);
  }
  const updated = await db
    .update(users)
    .set(patch as any)
    .where(eq(users.id, id))
    .returning();
  if (updated.length === 0) return c.json({ code: 404, message: "user not found" }, 404);
  return c.json({ code: 0, message: "ok", data: { id: updated[0]!.id } });
});

/* DELETE /api/v1/users/:id  —— soft delete: status=0 */
usersRoute.delete("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ code: 400, message: "missing id" }, 400);
  const updated = await db
    .update(users)
    .set({ status: 0 })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (updated.length === 0) return c.json({ code: 404, message: "user not found" }, 404);
  return c.json({ code: 0, message: "disabled", data: { id: updated[0]!.id } });
});

export default usersRoute;
