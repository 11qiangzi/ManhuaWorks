/**
 * BYOK API Key CRUD
 *
 *路由：
 * POST /v1/keys 新增（或覆盖同 provider的 key）
 * GET /v1/keys列出当前用户的所有 key（不返回密文）
 * GET /v1/keys/:id详情（不返回密文，但返回 hint）
 * PATCH /v1/keys/:id 更新密文 / hint
 * DELETE /v1/keys/:id 删除
 * POST /v1/keys/:id/validate立即调一次 provider API验证
 * POST /v1/keys/:id/rotate标记"已轮换"（实际更新 updated_at）
 *
 * 安全：
 * -任何路由都不返回明文 key
 * -加密存储（AES-256-GCM + HKDF）
 * -每次写操作都写审计
 */

import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { userApiKeys } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { encryptApiKey, decryptApiKey } from "../crypto/aes.js";
import { makeKeyHint } from "../crypto/key-derivation.js";
import { extractRequestMeta, recordAudit } from "./audit.js";
import { validateApiKey } from "./validator.js";
import { getKeyAgeStatus } from "./rotation.js";

const keysRoute = new Hono();
keysRoute.use("*", authMiddleware);

/* ──────────────────────── POST /v1/keys ──────────────────────── */
const createSchema = z.object({
 provider: z.string().min(2).max(50),
 api_key: z.string().min(8).max(500), // 用户给的明文
 alias: z.string().max(50).optional(), //任务里没列，但实际需要（hint）
});
keysRoute.post("/", async (c) => {
 const user = c.get("user");
 const body = await c.req.json().catch(() => null);
 const parsed = createSchema.safeParse(body);
 if (!parsed.success) {
 return c.json(
 {
 code:400,
 message:"invalid_body",
 detail: parsed.error.flatten(),
 },
400
 );
 }
 const { provider, api_key, alias } = parsed.data;
 const hint = alias ?? makeKeyHint(api_key);

 //加密
 const encrypted = encryptApiKey(api_key, user.sub, provider);

 // upsert：同 user+provider已有则覆盖
 const existing = await db
 .select({ id: userApiKeys.id })
 .from(userApiKeys)
 .where(
 and(
 eq(userApiKeys.userId, user.sub),
 eq(userApiKeys.provider, provider)
 )
 )
 .limit(1);

 let id: string;
 if (existing.length >0 && existing[0]) {
 id = existing[0].id;
 await db
 .update(userApiKeys)
 .set({
 apiKeyEncrypted: Buffer.from(encrypted, "base64"),
 apiKeyHint: hint,
 lastError: null,
 })
 .where(eq(userApiKeys.id, id));
 } else {
 const inserted = await db
 .insert(userApiKeys)
 .values({
 userId: user.sub,
 provider,
 apiKeyEncrypted: Buffer.from(encrypted, "base64"),
 apiKeyHint: hint,
 })
 .returning({ id: userApiKeys.id });
 id = inserted[0]!.id;
 }

 const meta = extractRequestMeta(c);
 recordAudit({
 userId: user.sub,
 apiKeyId: id,
 action: "create",
 provider,
 ip: meta.ip,
 userAgent: meta.userAgent,
 detail: { hint, upsert: existing.length >0 },
 });

 return c.json({
 code:0,
 message:"ok",
 data: {
 id,
 provider,
 api_key_hint: hint,
 created: existing.length ===0,
 },
 });
});

/* ──────────────────────── GET /v1/keys ──────────────────────── */
keysRoute.get("/", async (c) => {
 const user = c.get("user");
 const rows = await db
 .select()
 .from(userApiKeys)
 .where(eq(userApiKeys.userId, user.sub))
 .orderBy(desc(userApiKeys.createdAt));

 const meta = extractRequestMeta(c);
 recordAudit({
 userId: user.sub,
 action: "read",
 ip: meta.ip,
 userAgent: meta.userAgent,
 detail: { scope: "list", count: rows.length },
 });

 return c.json({
 code:0,
 message:"ok",
 data: rows.map((k) => toPublic(k)),
 });
});

/* ──────────────────────── GET /v1/keys/:id ──────────────────────── */
keysRoute.get("/:id", async (c) => {
 const user = c.get("user");
 const id = c.req.param("id");
 const rows = await db
 .select()
 .from(userApiKeys)
 .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, user.sub)))
 .limit(1);
 const row = rows[0];
 if (!row) {
 return c.json({ code:404, message:"key_not_found" },404);
 }

 const meta = extractRequestMeta(c);
 recordAudit({
 userId: user.sub,
 apiKeyId: id,
 action: "read",
 provider: row.provider,
 ip: meta.ip,
 userAgent: meta.userAgent,
 });

 return c.json({ code:0, message:"ok", data: toPublic(row) });
});

/* ──────────────────────── PATCH /v1/keys/:id ──────────────────────── */
const patchSchema = z.object({
 api_key: z.string().min(8).max(500).optional(),
 alias: z.string().max(50).optional(),
});
keysRoute.patch("/:id", async (c) => {
 const user = c.get("user");
 const id = c.req.param("id");
 const body = await c.req.json().catch(() => null);
 const parsed = patchSchema.safeParse(body);
 if (!parsed.success) {
 return c.json(
 { code:400, message:"invalid_body", detail: parsed.error.flatten() },
400
 );
 }
 const rows = await db
 .select()
 .from(userApiKeys)
 .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, user.sub)))
 .limit(1);
 const row = rows[0];
 if (!row) {
 return c.json({ code:404, message:"key_not_found" },404);
 }

 const updates: Partial<typeof userApiKeys.$inferInsert> = {};
 if (parsed.data.api_key) {
 const enc = encryptApiKey(parsed.data.api_key, user.sub, row.provider);
 updates.apiKeyEncrypted = Buffer.from(enc, "base64");
 updates.apiKeyHint = parsed.data.alias ?? makeKeyHint(parsed.data.api_key);
 updates.lastError = null;
 } else if (parsed.data.alias) {
 updates.apiKeyHint = parsed.data.alias;
 }
 if (Object.keys(updates).length ===0) {
 return c.json({ code:400, message:"nothing_to_update" },400);
 }

 await db.update(userApiKeys).set(updates).where(eq(userApiKeys.id, id));

 const meta = extractRequestMeta(c);
 recordAudit({
 userId: user.sub,
 apiKeyId: id,
 action: "update",
 provider: row.provider,
 ip: meta.ip,
 userAgent: meta.userAgent,
 detail: { fields: Object.keys(updates) },
 });

 return c.json({
 code:0,
 message:"ok",
 data: { id, api_key_hint: updates.apiKeyHint ?? row.apiKeyHint },
 });
});

/* ──────────────────────── DELETE /v1/keys/:id ──────────────────────── */
keysRoute.delete("/:id", async (c) => {
 const user = c.get("user");
 const id = c.req.param("id");
 const rows = await db
 .select()
 .from(userApiKeys)
 .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, user.sub)))
 .limit(1);
 const row = rows[0];
 if (!row) {
 return c.json({ code:404, message:"key_not_found" },404);
 }

 await db.delete(userApiKeys).where(eq(userApiKeys.id, id));

 const meta = extractRequestMeta(c);
 recordAudit({
 userId: user.sub,
 apiKeyId: id,
 action: "delete",
 provider: row.provider,
 ip: meta.ip,
 userAgent: meta.userAgent,
 });

 return c.json({ code:0, message:"ok", data: { id, deleted: true } });
});

/* ─────────────────── POST /v1/keys/:id/validate ─────────────────── */
keysRoute.post("/:id/validate", async (c) => {
 const user = c.get("user");
 const id = c.req.param("id");
 const rows = await db
 .select()
 .from(userApiKeys)
 .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, user.sub)))
 .limit(1);
 const row = rows[0];
 if (!row) {
 return c.json({ code:404, message:"key_not_found" },404);
 }

 // 解密 →调 provider → 更新 last_used_at / last_error
 const plaintext = decryptApiKey(
 row.apiKeyEncrypted.toString("base64"),
 user.sub,
 row.provider
 );

 const result = await validateApiKey(row.provider, plaintext);

 await db
 .update(userApiKeys)
 .set({
 lastUsedAt: result.ok ? new Date() : row.lastUsedAt,
 lastError: result.ok ? null : result.error ?? "unknown_error",
 })
 .where(eq(userApiKeys.id, id));

 const meta = extractRequestMeta(c);
 recordAudit({
 userId: user.sub,
 apiKeyId: id,
 action: "validate",
 provider: row.provider,
 ip: meta.ip,
 userAgent: meta.userAgent,
 detail: { ok: result.ok, latencyMs: result.latencyMs },
 });

 return c.json({
 code: result.ok ?0 :4001,
 message: result.ok ?"ok" :"validation_failed",
 data: {
 id,
 provider: row.provider,
 ok: result.ok,
 latency_ms: result.latencyMs,
 error: result.error,
 },
 });
});

/* ─────────────────── POST /v1/keys/:id/rotate ─────────────────── */
keysRoute.post("/:id/rotate", async (c) => {
 const user = c.get("user");
 const id = c.req.param("id");
 const rows = await db
 .select()
 .from(userApiKeys)
 .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, user.sub)))
 .limit(1);
 const row = rows[0];
 if (!row) {
 return c.json({ code:404, message:"key_not_found" },404);
 }

 //单纯轮换 = 不换 key内容，只 touch updated_at + 清错误
 await db
 .update(userApiKeys)
 .set({ lastError: null })
 .where(eq(userApiKeys.id, id));

 const meta = extractRequestMeta(c);
 recordAudit({
 userId: user.sub,
 apiKeyId: id,
 action: "rotate",
 provider: row.provider,
 ip: meta.ip,
 userAgent: meta.userAgent,
 detail: { manual: true },
 });

 return c.json({ code:0, message:"ok", data: { id, rotated: true } });
});

/* ───────────────────工具 ─────────────────── */

function toPublic(k: typeof userApiKeys.$inferSelect) {
 const age = getKeyAgeStatus(k.updatedAt);
 return {
 id: k.id,
 provider: k.provider,
 api_key_hint: k.apiKeyHint,
 last_used_at: k.lastUsedAt,
 last_error: k.lastError,
 age_days: age.ageDays,
 needs_rotation: age.needsRotation,
 hard_expired: age.hardExpired,
 created_at: k.createdAt,
 updated_at: k.updatedAt,
 };
}

export default keysRoute;
