/**
 * quotas CRUD + 自动重置
 *
 *  GET    /api/v1/quotas/me            当前用户配额
 *  PUT    /api/v1/quotas/me            调整配额（admin only / 计费回调）
 *  POST   /api/v1/quotas/me/reset      手动重置（admin only）
 *  POST   /api/v1/quotas/me/consume    消费（内部用，Billing 回调）
 *
 *  自动重置：
 *    启动一个 setInterval 定时器，扫描 reset_at <= now() 的记录
 *    把 used_* 清零，reset_at = now() + 1 month
 */

import { Hono } from "hono";
import { z } from "zod";
import { eq, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { quotas } from "../db/schema.js";
import { authMiddleware, adminOnly } from "../lib/auth.js";
import { env } from "../lib/env.js";

const quotasRoute = new Hono();
quotasRoute.use("*", authMiddleware);

/* GET /me */
quotasRoute.get("/me", async (c) => {
  const u = c.get("user");
  let rows = await db
    .select()
    .from(quotas)
    .where(eq(quotas.userId, u.sub))
    .limit(1);
  if (rows.length === 0) {
    const inserted = await db.insert(quotas).values({ userId: u.sub }).returning();
    rows = inserted;
  }
  const q = rows[0]!;
  return c.json({
    code: 0,
    message: "ok",
    data: {
      ...q,
      // 业务额外字段：剩余
      remaining_tokens: q.monthlyTokens - q.usedTokens,
      remaining_images: q.monthlyImages - q.usedImages,
      remaining_videos: q.monthlyVideos - q.usedVideos,
    },
  });
});

/* PUT /me —— 调整配额（admin / billing） */
const adjustSchema = z.object({
  monthly_tokens: z.number().int().min(0).optional(),
  monthly_images: z.number().int().min(0).optional(),
  monthly_videos: z.number().int().min(0).optional(),
  reset_at: z.string().datetime().optional(),
});

quotasRoute.put("/me", adminOnly, async (c) => {
  const u = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 400, message: "invalid params" }, 400);
  }
  const patch: Record<string, unknown> = {};
  if (parsed.data.monthly_tokens !== undefined) patch.monthlyTokens = parsed.data.monthly_tokens;
  if (parsed.data.monthly_images !== undefined) patch.monthlyImages = parsed.data.monthly_images;
  if (parsed.data.monthly_videos !== undefined) patch.monthlyVideos = parsed.data.monthly_videos;
  if (parsed.data.reset_at) patch.resetAt = new Date(parsed.data.reset_at);
  if (Object.keys(patch).length === 0) return c.json({ code: 400, message: "empty patch" }, 400);

  const existing = (
    await db.select().from(quotas).where(eq(quotas.userId, u.sub)).limit(1)
  )[0];
  if (!existing) {
    const inserted = await db
      .insert(quotas)
      .values({ userId: u.sub, ...(patch as any) })
      .returning();
    return c.json({ code: 0, message: "created", data: inserted[0] });
  }
  const updated = await db
    .update(quotas)
    .set(patch as any)
    .where(eq(quotas.userId, u.sub))
    .returning();
  return c.json({ code: 0, message: "ok", data: updated[0] });
});

/* POST /me/reset —— 手动重置 */
quotasRoute.post("/me/reset", adminOnly, async (c) => {
  const u = c.get("user");
  const updated = await db
    .update(quotas)
    .set({
      usedTokens: 0,
      usedImages: 0,
      usedVideos: 0,
      resetAt: new Date(Date.now() + 30 * 86400000),
    })
    .where(eq(quotas.userId, u.sub))
    .returning();
  if (updated.length === 0) return c.json({ code: 404, message: "quota not found" }, 404);
  return c.json({ code: 0, message: "reset", data: updated[0] });
});

/* POST /me/consume —— 消费配额（内部 / billing 回调） */
const consumeSchema = z.object({
  type: z.enum(["tokens", "images", "videos"]),
  amount: z.number().int().min(1).max(1000000),
});

quotasRoute.post("/me/consume", async (c) => {
  const u = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const parsed = consumeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 400, message: "invalid params" }, 400);
  }
  const { type, amount } = parsed.data;

  // 先取出来判断剩余
  const existing = (
    await db.select().from(quotas).where(eq(quotas.userId, u.sub)).limit(1)
  )[0];
  if (!existing) {
    return c.json({ code: 404, message: "quota not found" }, 404);
  }

  const field =
    type === "tokens"
      ? { used: existing.usedTokens, monthly: existing.monthlyTokens, col: "used_tokens" }
      : type === "images"
      ? { used: existing.usedImages, monthly: existing.monthlyImages, col: "used_images" }
      : { used: existing.usedVideos, monthly: existing.monthlyVideos, col: "used_videos" };

  if (field.used + amount > field.monthly) {
    return c.json(
      {
        code: 429,
        message: "quota_exceeded",
        data: {
          type,
          monthly: field.monthly,
          used: field.used,
          requested: amount,
        },
      },
      429
    );
  }

  // 原子更新：原值 + amount 同时校验不超过 monthly（避免并发）
  const updateSet: Record<string, unknown> = {};
  updateSet[field.col] = field.used + amount;

  const updated = await db
    .update(quotas)
    .set(updateSet as any)
    .where(eq(quotas.userId, u.sub))
    .returning();

  return c.json({
    code: 0,
    message: "ok",
    data: { type, consumed: amount, quota: updated[0] },
  });
});

/* ------------------------------------------------------------------ */
/*  自动重置：定时任务                                                 */
/* ------------------------------------------------------------------ */
export function startQuotaResetCron(): () => void {
  const tick = async () => {
    try {
      const now = new Date();
      const due = await db
        .select()
        .from(quotas)
        .where(lte(quotas.resetAt, now));
      if (due.length === 0) return;
      // eslint-disable-next-line no-console
      console.log(`[quota-reset] due=${due.length}`);
      for (const q of due) {
        await db
          .update(quotas)
          .set({
            usedTokens: 0,
            usedImages: 0,
            usedVideos: 0,
            resetAt: new Date(Date.now() + 30 * 86400000),
          })
          .where(eq(quotas.userId, q.userId));
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[quota-reset] error:", err);
    }
  };

  // 启动时跑一次，之后每 N 秒跑一次
  void tick();
  const timer = setInterval(tick, env.QUOTA_RESET_INTERVAL_SEC * 1000);
  return () => clearInterval(timer);
}

export default quotasRoute;
