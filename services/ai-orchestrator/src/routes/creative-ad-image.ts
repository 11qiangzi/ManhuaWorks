/**
 * 广告图模块 API 路由（ENH-9）
 *
 * 派单53：谢擎 | 日期：2026-06-25 — P1 UX增强
 *
 * ENH-9: POST /v1/creative/ad-image/text-poster - 纯文案海报prompt生成
 *         输入标题/副标题/CTA/风格 → 生成排版海报的图生文prompt + 设计系统
 */

import { Hono } from "hono";
import { z } from "zod";
import { requireUser, type AppEnv } from "../middleware/auth.js";
import { aiRouterClient as aiRouter } from "../clients/ai-router.js";
import { ErrorCodes } from "@manhuaworks/shared";

import {
  TEXT_POSTER_SYSTEM_PROMPT,
  TEXT_POSTER_USER_PROMPT,
} from "../prompts/text-poster.js";

import type { TextPosterResponse } from "./types.js";

// ---- Zod Schema ----

const TextPosterSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  cta: z.string().max(100).optional(),
  style: z.string().min(1).max(100),
  brandName: z.string().max(100).optional(),
  additionalNotes: z.string().max(500).optional(),
});

// ---- Router ----

export const adImageRoutes = new Hono<AppEnv>();

// ---- ENH-9: 纯文案海报prompt生成 ----
adImageRoutes.post("/text-poster", async (c) => {
  const user = requireUser(c);
  const body = TextPosterSchema.parse(await c.req.json());

  const userPrompt = TEXT_POSTER_USER_PROMPT({
    title: body.title,
    subtitle: body.subtitle,
    cta: body.cta,
    style: body.style,
    brandName: body.brandName,
    additionalNotes: body.additionalNotes,
  });

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: TEXT_POSTER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.75, // 创意设计任务，适度温度
      maxTokens: 2500,
      taskTag: "ad-image-text-poster",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as TextPosterResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[ad-image/text-poster] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "纯文案海报生成服务暂不可用",
    }, 502);
  }
});
