/**
 * 宣传片模块 API 路由（API-6 ~ API-7）
 *
 * 派单51：谢擎 | 日期：2026-06-25
 *
 * API-6: POST /v1/creative/promo/brief   - 智能Brief生成（品牌名+URL+受众+卖点→完整Brief）
 * API-7: POST /v1/creative/promo/scripts - 多脚本方案A/B/C对比
 * P1 (派单53):
 * ENH-6: POST /v1/creative/promo/audience-segment - 受众细分标签+文案调性推荐
 */

import { Hono } from "hono";
import { z } from "zod";
import { requireUser, type AppEnv } from "../middleware/auth.js";
import { aiRouterClient as aiRouter } from "../clients/ai-router.js";
import { ErrorCodes } from "@manhuaworks/shared";

import {
  BRIEF_GENERATE_SYSTEM_PROMPT,
  BRIEF_GENERATE_USER_PROMPT,
  MULTI_SCRIPT_SYSTEM_PROMPT,
  MULTI_SCRIPT_USER_PROMPT,
} from "../prompts/promo-brief.js";

// P1 (派单53)
import { AUDIENCE_SEGMENT_SYSTEM_PROMPT, AUDIENCE_SEGMENT_USER_PROMPT } from "../prompts/audience-segment.js";
// P2 (派单55) ENH-14: 参考视频风格提取
import {
  VIDEO_STYLE_EXTRACT_SYSTEM_PROMPT,
  VIDEO_STYLE_EXTRACT_USER_PROMPT,
} from "../prompts/video-style-extract.js";
// P2 (派单55) ENH-15: TTS配音+字幕同步
import {
  SUBTITLE_SYNC_SYSTEM_PROMPT,
  SUBTITLE_SYNC_USER_PROMPT,
} from "../prompts/narration-subtitle.js";

import type {
  BriefGenerateResponse,
  MultiScriptResponse,
  // P1
  AudienceSegmentResponse,
  // P2 (派单55)
  VideoStyleExtractRequest,
  VideoStyleExtractResponse,
  TtsSubtitleRequest,
  TtsSubtitleResponse,
  SubtitleSegment,
} from "./types.js";

// ---- Zod Schemas ----

const BriefSchema = z.object({
  brandName: z.string().min(1).max(100),
  websiteUrl: z.string().url().optional(),
  websiteContent: z.string().max(5000).optional(),
  targetAudience: z.string().max(1000).optional(),
  sellingPoints: z.string().max(2000).optional(),
});

// P1: ENH-6 受众细分
const AudienceSegmentSchema = z.object({
  parentTag: z.string().min(1).max(50),
  context: z.string().max(1000).optional(),
});

// P2 (派单55): ENH-14 参考视频风格提取
const VideoStyleExtractSchema = z.object({
  videoUrl: z.string().url().optional(),
  platform: z.string().max(50).optional(),
  videoDescription: z.string().max(5000).optional(),
});

// P2 (派单55): ENH-15 TTS配音+字幕同步
const TtsSubtitleSchema = z.object({
  narrationText: z.string().min(1).max(5000),
  voice: z.string().max(50).default("standard_male"),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  tone: z.string().max(50).default("neutral"),
  projectId: z.string().optional(),
});

const MultiScriptSchema = z.object({
  /** Brief JSON字符串（由前端传回） */
  briefJson: z.string().min(10).max(10000),
});

// ---- Router ----

export const promoRoutes = new Hono<AppEnv>();

// ---- P2 (派单55): ENH-14 参考视频风格提取 ----
promoRoutes.post("/video-reference", async (c) => {
  const user = requireUser(c);
  const body = VideoStyleExtractSchema.parse(await c.req.json()) as VideoStyleExtractRequest;

  if (!body.videoUrl && !body.videoDescription) {
    return c.json({
      code: ErrorCodes.BAD_REQUEST,
      message: "至少需要提供 videoUrl 或 videoDescription",
    }, 400);
  }

  const userPrompt = VIDEO_STYLE_EXTRACT_USER_PROMPT(
    body.videoUrl ?? "",
    body.videoDescription ?? "",
    body.platform ?? "",
  );

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: VIDEO_STYLE_EXTRACT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      maxTokens: 2500,
      taskTag: "promo-video-style-extract",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as VideoStyleExtractResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[promo/video-reference] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "参考视频风格提取服务暂不可用",
    }, 502);
  }
});

// ---- P2 (派单55): ENH-15 TTS配音+字幕同步 ----
promoRoutes.post("/tts-subtitle-sync", async (c) => {
  const user = requireUser(c);
  const body = TtsSubtitleSchema.parse(await c.req.json()) as TtsSubtitleRequest;

  try {
    // Step 1: 调用 ai-router TTS 配音生成音频
    const audioResult = await aiRouter.audio({
      prompt: body.narrationText,
      mood: body.tone,
      taskTag: "promo-tts-narration",
    });

    // Step 2: AI辅助生成字幕时间轴
    const wordsPerSecond = (body.speed ?? 1.0) * 4; // 中文基准语速 ≈4字/秒
    const subtitlePrompt = SUBTITLE_SYNC_USER_PROMPT(
      body.narrationText,
      audioResult.durationSeconds,
      wordsPerSecond,
    );

    const subtitleResult = await aiRouter.chat({
      messages: [
        { role: "system", content: SUBTITLE_SYNC_SYSTEM_PROMPT },
        { role: "user", content: subtitlePrompt },
      ],
      temperature: 0.3,
      maxTokens: 2000,
      taskTag: "promo-subtitle-sync",
    });

    const subtitleData = JSON.parse(
      subtitleResult.content.replace(/```json|```/g, "").trim(),
    ) as { segments: SubtitleSegment[]; srtContent: string };

    const response: TtsSubtitleResponse = {
      audioUrl: audioResult.url,
      audioDurationSeconds: audioResult.durationSeconds,
      segments: subtitleData.segments,
      srtContent: subtitleData.srtContent,
      ttsProvider: audioResult.provider,
      voice: body.voice ?? "standard_male",
    };

    return c.json({
      code: 0,
      message: "ok",
      data: response,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[promo/tts-subtitle-sync] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "字幕时间轴生成格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "TTS配音服务暂不可用",
    }, 502);
  }
});

// ---- P1 (派单53): ENH-6 受众细分标签 ----
promoRoutes.post("/audience-segment", async (c) => {
  const user = requireUser(c);
  const body = AudienceSegmentSchema.parse(await c.req.json());

  const userPrompt = AUDIENCE_SEGMENT_USER_PROMPT(body.parentTag, body.context);

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: AUDIENCE_SEGMENT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 3000,
      taskTag: "promo-audience-segment",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as AudienceSegmentResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[promo/audience-segment] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "受众细分分析服务暂不可用",
    }, 502);
  }
});

// ---- API-6: 智能Brief生成 ----
promoRoutes.post("/brief", async (c) => {
  const user = requireUser(c);
  const body = BriefSchema.parse(await c.req.json());

  const userPrompt = BRIEF_GENERATE_USER_PROMPT({
    brandName: body.brandName,
    websiteUrl: body.websiteUrl,
    websiteContent: body.websiteContent,
    targetAudience: body.targetAudience,
    sellingPoints: body.sellingPoints,
  });

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: BRIEF_GENERATE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 2500,
      taskTag: "promo-brief",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as BriefGenerateResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[promo/brief] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "Brief生成服务暂不可用",
    }, 502);
  }
});

// ---- API-7: 多脚本方案A/B/C对比 ----
promoRoutes.post("/scripts", async (c) => {
  const user = requireUser(c);
  const body = MultiScriptSchema.parse(await c.req.json());

  const userPrompt = MULTI_SCRIPT_USER_PROMPT(body.briefJson);

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: MULTI_SCRIPT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.85,
      maxTokens: 5000,
      taskTag: "promo-scripts",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as MultiScriptResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[promo/scripts] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "脚本方案生成服务暂不可用",
    }, 502);
  }
});
