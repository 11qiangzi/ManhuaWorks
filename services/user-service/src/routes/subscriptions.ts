/**
 * subscriptions CRUD
 *
 *  GET    /api/v1/subscriptions/me         当前用户订阅
 *  PUT    /api/v1/subscriptions/me         升级/降级（创建或更新）
 *  PATCH  /api/v1/subscriptions/me/renew   续费 / 改 auto_renew
 *  DELETE /api/v1/subscriptions/me         退订（置为 free，到期时间 = 当前）
 *  GET    /api/v1/subscriptions            全部订阅（admin only）
 */

import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { subscriptions } from "../db/schema.js";
import { authMiddleware, adminOnly } from "../lib/auth.js";

const sub = new Hono();
sub.use("*", authMiddleware);

const planEnum = z.enum(["free", "pro", "team"]);

/* GET /me */
sub.get("/me", async (c) => {
  const u = c.get("user");
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, u.sub))
    .limit(1);
  if (rows.length === 0) {
    // 自动初始化 free
    const inserted = await db
      .insert(subscriptions)
      .values({ userId: u.sub, plan: "free" })
      .returning();
    return c.json({ code: 0, message: "ok", data: inserted[0] });
  }
  return c.json({ code: 0, message: "ok", data: rows[0] });
});

/* PUT /me —— 升级/降级（UPSERT） */
const upsertSchema = z.object({
  plan: planEnum,
  expires_at: z.string().datetime().optional(), // ISO 8601
  auto_renew: z.boolean().optional(),
});

sub.put("/me", async (c) => {
  const u = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 400, message: "invalid params" }, 400);
  }
  const existing = (
    await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, u.sub))
      .limit(1)
  )[0];

  if (!existing) {
    const inserted = await db
      .insert(subscriptions)
      .values({
        userId: u.sub,
        plan: parsed.data.plan,
        expiresAt: parsed.data.expires_at ? new Date(parsed.data.expires_at) : null,
        autoRenew: parsed.data.auto_renew ?? false,
      })
      .returning();
    return c.json({ code: 0, message: "created", data: inserted[0] });
  }

  const updated = await db
    .update(subscriptions)
    .set({
      plan: parsed.data.plan,
      expiresAt: parsed.data.expires_at ? new Date(parsed.data.expires_at) : existing.expiresAt,
      autoRenew: parsed.data.auto_renew ?? existing.autoRenew,
    })
    .where(eq(subscriptions.userId, u.sub))
    .returning();
  return c.json({ code: 0, message: "ok", data: updated[0] });
});

/* PATCH /me/renew —— 续费（延长 expires_at）/ 改 auto_renew */
const renewSchema = z.object({
  extend_days: z.number().int().min(1).max(3650).optional(),
  expires_at: z.string().datetime().optional(),
  auto_renew: z.boolean().optional(),
});

sub.patch("/me/renew", async (c) => {
  const u = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const parsed = renewSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 400, message: "invalid params" }, 400);
  }
  const existing = (
    await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, u.sub))
      .limit(1)
  )[0];
  if (!existing) {
    return c.json({ code: 404, message: "subscription not found" }, 404);
  }
  let expiresAt = existing.expiresAt ?? new Date();
  if (parsed.data.expires_at) {
    expiresAt = new Date(parsed.data.expires_at);
  } else if (parsed.data.extend_days) {
    expiresAt = new Date(expiresAt.getTime() + parsed.data.extend_days * 86400000);
  }
  const updated = await db
    .update(subscriptions)
    .set({
      expiresAt,
      autoRenew: parsed.data.auto_renew ?? existing.autoRenew,
    })
    .where(eq(subscriptions.userId, u.sub))
    .returning();
  return c.json({ code: 0, message: "ok", data: updated[0] });
});

/* DELETE /me —— 退订（plan=free，auto_renew=false） */
sub.delete("/me", async (c) => {
  const u = c.get("user");
  const updated = await db
    .update(subscriptions)
    .set({ plan: "free", autoRenew: false })
    .where(eq(subscriptions.userId, u.sub))
    .returning();
  if (updated.length === 0) {
    return c.json({ code: 404, message: "subscription not found" }, 404);
  }
  return c.json({ code: 0, message: "cancelled", data: updated[0] });
});

/* GET / —— 管理员看全部 */
sub.get("/", adminOnly, async (c) => {
  const rows = await db.select().from(subscriptions);
  return c.json({ code: 0, message: "ok", data: { list: rows, total: rows.length } });
});

export default sub;
