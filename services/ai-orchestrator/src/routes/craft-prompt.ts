/**
 * CRAFT Prompt API 路由
 * 千机工坊 — ai-orchestrator
 *
 * POST /build              — 构建 CRAFT 提示词
 * GET  /camera-movements   — 获取镜头运动库
 * GET  /mood-presets       — 获取情绪预设
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  buildCraftPrompt,
  CAMERA_MOVEMENTS,
  MOOD_PRESETS,
  type CraftGenerationRequest,
} from "@manhuaworks/shared-types";
import type { AppEnv } from "../middleware/auth.js";

// ------------------------------------------------------------------ //
//  Zod Schema
// ------------------------------------------------------------------ //

const CraftRequestSchema = z.object({
  description: z.string().min(1).max(2000),
  taskType: z.enum(["image", "video"]),
  characters: z
    .array(
      z.object({
        name: z.string().min(1),
        referenceImageUrl: z.string(),
        referenceIndex: z.number().int().min(1),
      }),
    )
    .optional(),
  scenes: z
    .array(
      z.object({
        name: z.string().min(1),
        referenceImageUrl: z.string(),
        referenceIndex: z.number().int().min(1),
      }),
    )
    .optional(),
  mood: z.string().max(50).optional(),
  artStyle: z.string().max(50).optional(),
  duration: z.number().int().min(1).max(300).optional(),
  cameraMovementId: z.string().max(50).optional(),
});

// ------------------------------------------------------------------ //
//  Router
// ------------------------------------------------------------------ //

export const craftPromptRoutes = new Hono<AppEnv>();

craftPromptRoutes.post("/build", async (c) => {
  const body = CraftRequestSchema.parse(await c.req.json()) as CraftGenerationRequest;
  const prompt = buildCraftPrompt(body);
  return c.json({ code: 0, message: "ok", data: prompt });
});

craftPromptRoutes.get("/camera-movements", (c) => {
  return c.json({ code: 0, message: "ok", data: CAMERA_MOVEMENTS });
});

craftPromptRoutes.get("/mood-presets", (c) => {
  return c.json({ code: 0, message: "ok", data: MOOD_PRESETS });
});
