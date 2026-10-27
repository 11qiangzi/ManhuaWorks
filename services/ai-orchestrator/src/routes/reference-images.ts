/**
 * 参考图管理 API 路由
 * 千机工坊 — ai-orchestrator
 *
 * GET    /            — 列表查询（支持 ?type=character|scene&projectId=xxx 过滤）
 * POST   /            — 上传参考图元数据
 * DELETE /:id         — 删除参考图
 */

import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { ErrorCodes } from "@manhuaworks/shared";
import type { AppEnv } from "../middleware/auth.js";

// ------------------------------------------------------------------ //
//  Types & Store
// ------------------------------------------------------------------ //

export interface ReferenceImage {
  id: string;
  name: string;
  type: "character" | "scene";
  projectId?: string;
  url: string;
  tags: string[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

const store = new Map<string, ReferenceImage>();

// ------------------------------------------------------------------ //
//  Zod Schema
// ------------------------------------------------------------------ //

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["character", "scene"]),
  projectId: z.string().max(100).optional(),
  url: z.string().min(1),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// ------------------------------------------------------------------ //
//  Router
// ------------------------------------------------------------------ //

export const referenceImageRoutes = new Hono<AppEnv>();

// GET / — 列表查询
referenceImageRoutes.get("/", (c) => {
  const { type, projectId } = c.req.query();

  let items = Array.from(store.values());

  if (type) {
    items = items.filter((img) => img.type === type);
  }
  if (projectId) {
    items = items.filter((img) => img.projectId === projectId);
  }

  // 按创建时间倒序
  items.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

  return c.json({ code: 0, message: "ok", data: { items, total: items.length } });
});

// POST / — 上传参考图元数据
referenceImageRoutes.post("/", async (c) => {
  const user = c.get("user");
  let body: z.infer<typeof CreateSchema>;

  try {
    body = CreateSchema.parse(await c.req.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ code: ErrorCodes.BAD_REQUEST, message: msg }, 400);
  }

  const now = new Date().toISOString();
  const id = `ref-${nanoid(12)}`;

  const record: ReferenceImage = {
    id,
    name: body.name,
    type: body.type,
    projectId: body.projectId,
    url: body.url,
    tags: body.tags ?? [],
    userId: user?.userId ?? "anonymous",
    createdAt: now,
    updatedAt: now,
  };

  store.set(id, record);

  return c.json({ code: 0, message: "ok", data: record }, 201);
});

// DELETE /:id — 删除参考图
referenceImageRoutes.delete("/:id", (c) => {
  const id = c.req.param("id");

  if (!store.has(id)) {
    return c.json({ code: ErrorCodes.NOT_FOUND, message: "参考图不存在" }, 404);
  }

  store.delete(id);

  return c.json({ code: 0, message: "ok", data: { id, deleted: true } });
});
