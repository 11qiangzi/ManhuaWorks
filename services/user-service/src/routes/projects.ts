/**
 * projects CRUD
 *
 *  GET    /api/v1/projects         当前用户的项目列表（分页）
 *  GET    /api/v1/projects/:id     详情
 *  POST   /api/v1/projects         新建
 *  PATCH  /api/v1/projects/:id     更新
 *  DELETE /api/v1/projects/:id     删除
 */

import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, count } from "drizzle-orm";
import { db } from "../db/client.js";
import { projects } from "../db/schema.js";
import { authMiddleware } from "../lib/auth.js";

const projectsRoute = new Hono();
projectsRoute.use("*", authMiddleware);

/* GET /api/v1/projects */
projectsRoute.get("/", async (c) => {
  const u = c.get("user");
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("page_size") ?? "20")));
  const status = c.req.query("status"); // 可选过滤
  const offset = (page - 1) * pageSize;

  const conds = [eq(projects.userId, u.sub)];
  if (status !== undefined) conds.push(eq(projects.status, Number(status)));

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(and(...conds))
      .orderBy(desc(projects.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(projects).where(and(...conds)),
  ]);

  return c.json({
    code: 0,
    message: "ok",
    data: {
      list: rows,
      page,
      page_size: pageSize,
      total: Number(totalRow[0]?.value ?? 0),
    },
  });
});

/* GET /api/v1/projects/:id */
projectsRoute.get("/:id", async (c) => {
  const u = c.get("user");
  const id = c.req.param("id");
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, u.sub)))
    .limit(1);
  const p = rows[0];
  if (!p) return c.json({ code: 404, message: "project not found" }, 404);
  return c.json({ code: 0, message: "ok", data: p });
});

/* POST /api/v1/projects */
const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  art_style: z.string().max(50).optional(),
  story_type: z.string().max(50).optional(),
  cover_url: z.string().url().optional(),
});

projectsRoute.post("/", async (c) => {
  const u = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 400, message: "invalid params", issues: parsed.error.flatten() }, 400);
  }
  const inserted = await db
    .insert(projects)
    .values({
      userId: u.sub,
      title: parsed.data.title,
      description: parsed.data.description,
      artStyle: parsed.data.art_style,
      storyType: parsed.data.story_type,
      coverUrl: parsed.data.cover_url,
      status: 0,
    })
    .returning();
  return c.json({ code: 0, message: "created", data: inserted[0] }, 201);
});

/* PATCH /api/v1/projects/:id */
const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  art_style: z.string().max(50).optional(),
  story_type: z.string().max(50).optional(),
  cover_url: z.string().url().optional(),
  status: z.number().int().min(0).max(3).optional(),
});

projectsRoute.patch("/:id", async (c) => {
  const u = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 400, message: "invalid params" }, 400);
  }
  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.art_style !== undefined) patch.artStyle = parsed.data.art_style;
  if (parsed.data.story_type !== undefined) patch.storyType = parsed.data.story_type;
  if (parsed.data.cover_url !== undefined) patch.coverUrl = parsed.data.cover_url;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (Object.keys(patch).length === 0) return c.json({ code: 400, message: "empty patch" }, 400);

  const updated = await db
    .update(projects)
    .set(patch as any)
    .where(and(eq(projects.id, id), eq(projects.userId, u.sub)))
    .returning();
  if (updated.length === 0) return c.json({ code: 404, message: "project not found" }, 404);
  return c.json({ code: 0, message: "ok", data: updated[0] });
});

/* DELETE /api/v1/projects/:id */
projectsRoute.delete("/:id", async (c) => {
  const u = c.get("user");
  const id = c.req.param("id");
  const deleted = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, u.sub)))
    .returning({ id: projects.id });
  if (deleted.length === 0) return c.json({ code: 404, message: "project not found" }, 404);
  return c.json({ code: 0, message: "deleted", data: { id: deleted[0]!.id } });
});

export default projectsRoute;
