/**
 * 配乐模块 API 路由（API-9 ~ API-10）
 *
 * 派单51：谢擎 | 日期：2026-06-25
 *
 * API-9: POST /v1/creative/music/video-analyze   - 视频分析配乐（节奏/情绪/转场→3段候选配乐）
 * API-10: POST /v1/creative/music/translate      - 音乐需求自然语言翻译（情绪描述→BPM/调式/乐器+prompt）
 * P1 (派单53):
 * ENH-10: POST /v1/creative/music/lyrics          - AI写词（主题+情感→3版歌词）
 */

import { Hono } from "hono";
import { z } from "zod";
import { requireUser, type AppEnv } from "../middleware/auth.js";
import { aiRouterClient as aiRouter } from "../clients/ai-router.js";
import { assetClient } from "../clients/asset.js";
import { ErrorCodes } from "@manhuaworks/shared";

import {
  VIDEO_MUSIC_ANALYZE_SYSTEM_PROMPT,
  VIDEO_MUSIC_ANALYZE_USER_PROMPT,
  MUSIC_TRANSLATE_SYSTEM_PROMPT,
  MUSIC_TRANSLATE_USER_PROMPT,
  MOOD_TO_MUSIC_PARAMS,
} from "../prompts/music.js";
// P1 (派单53)
import {
  LYRICS_SYSTEM_PROMPT,
  LYRICS_USER_PROMPT,
} from "../prompts/lyrics.js";

import type {
  VideoMusicAnalyzeResponse,
  MusicTranslateResponse,
  // P1 (派单53)
  LyricsGenerateResponse,
  // P2 (派单55)
  BgmLibraryQueryRequest,
  BgmLibraryResponse,
  BgmTrack,
} from "./types.js";

// ---- Zod Schemas ----

const VideoMusicAnalyzeSchema = z.object({
  duration: z.number().min(1).max(3600),
  tempo: z.enum(["fast", "medium", "slow"]),
  moodPrimary: z.string().min(1).max(50),
  moodSecondary: z.string().max(50).default(""),
  segments: z
    .array(
      z.object({
        startTime: z.number().min(0),
        endTime: z.number().min(0),
        type: z.string().min(1),
        intensity: z.enum(["low", "medium", "high"]),
      }),
    )
    .default([]),
});

const MusicTranslateSchema = z.object({
  description: z.string().min(1).max(500),
  duration: z.number().int().min(5).max(600).optional(),
  additionalNotes: z.string().max(500).optional(),
});

// P1: ENH-10 AI写词
const LyricsGenerateSchema = z.object({
  theme: z.string().min(1).max(200),
  keywords: z.string().max(500).optional(),
  emotion: z.string().min(1).max(100),
  style: z.string().max(100).optional(),
  length: z.enum(["short", "medium", "full"]).default("medium"),
});

// P2 (派单55): ENH-20 BGM素材库查询
const BgmLibraryQuerySchema = z.object({
  mood: z.string().max(50).optional(),
  minDuration: z.number().int().min(0).optional(),
  maxDuration: z.number().int().min(0).optional(),
  style: z.string().max(50).optional(),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(20),
});

// ---- Router ----

export const musicRoutes = new Hono<AppEnv>();

// ---- 情绪参考速查 ----
musicRoutes.get("/mood-reference", (c) => {
  return c.json({
    code: 0,
    message: "ok",
    data: MOOD_TO_MUSIC_PARAMS,
  });
});

// ---- P2 (派单55): ENH-20 BGM素材库查询 ----
musicRoutes.get("/bgm-library", async (c) => {
  const user = requireUser(c);
  const query: BgmLibraryQueryRequest = BgmLibraryQuerySchema.parse(c.req.query());

  try {
    // 从 asset-service 查询所有 audio 类型的资产
    const projectId = user.userId; // 使用用户ID作为查询范围
    const assetResult = await assetClient.listByProject(projectId, "audio");

    let tracks: BgmTrack[] = (assetResult.assets ?? []).map((asset) => {
      const meta = (asset as unknown as Record<string, unknown> & { payload?: Record<string, unknown> }).payload ?? {};
      return {
        assetId: asset.id,
        title: (meta.title as string) ?? "未命名配乐",
        durationSeconds: (meta.durationSeconds as number) ?? 0,
        mood: (meta.mood as string) ?? "",
        moodSecondary: meta.moodSecondary as string | undefined,
        style: (meta.style as string) ?? "",
        bpm: meta.bpm as number | undefined,
        key: meta.key as string | undefined,
        instruments: meta.instruments as string[] | undefined,
        audioUrl: asset.url,
        createdAt: new Date(asset.createdAt).toISOString(),
        usageCount: (meta.usageCount as number) ?? 0,
      };
    });

    // 前端筛选（asset-service 没有 mood/style 过滤字段时，由 orche 层做）
    if (query.mood) {
      const moodLower = query.mood.toLowerCase();
      tracks = tracks.filter((t) =>
        t.mood.toLowerCase().includes(moodLower) ||
        (t.moodSecondary?.toLowerCase().includes(moodLower)),
      );
    }
    if (query.style) {
      const styleLower = query.style.toLowerCase();
      tracks = tracks.filter((t) => t.style.toLowerCase().includes(styleLower));
    }
    if (query.minDuration !== undefined) {
      tracks = tracks.filter((t) => t.durationSeconds >= (query.minDuration ?? 0));
    }
    if (query.maxDuration !== undefined) {
      tracks = tracks.filter((t) => t.durationSeconds <= (query.maxDuration ?? Infinity));
    }

    // 提取可选筛选维度
    const allMoods = [...new Set(tracks.map((t) => t.mood).filter(Boolean))];
    const allStyles = [...new Set(tracks.map((t) => t.style).filter(Boolean))];

    const total = tracks.length;
    const paged = tracks.slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 20));

    const response: BgmLibraryResponse = {
      tracks: paged,
      total,
      offset: query.offset ?? 0,
      limit: query.limit ?? 20,
      hasMore: (query.offset ?? 0) + (query.limit ?? 20) < total,
      filterOptions: {
        moods: allMoods,
        styles: allStyles,
      },
    };

    return c.json({
      code: 0,
      message: "ok",
      data: response,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[music/bgm-library] error: ${msg}\n`);
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "BGM素材库查询服务暂不可用",
    }, 502);
  }
});

// ---- API-9: 视频分析配乐 ----
musicRoutes.post("/video-analyze", async (c) => {
  const user = requireUser(c);
  const body = VideoMusicAnalyzeSchema.parse(await c.req.json());

  const userPrompt = VIDEO_MUSIC_ANALYZE_USER_PROMPT({
    duration: body.duration,
    tempo: body.tempo,
    moodPrimary: body.moodPrimary,
    moodSecondary: body.moodSecondary,
    segments: body.segments,
  });

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: VIDEO_MUSIC_ANALYZE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 3000,
      taskTag: "music-video-analyze",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as VideoMusicAnalyzeResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[music/video-analyze] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "视频配乐分析服务暂不可用",
    }, 502);
  }
});

// ---- API-10: 音乐需求自然语言翻译 ----
musicRoutes.post("/translate", async (c) => {
  const user = requireUser(c);
  const body = MusicTranslateSchema.parse(await c.req.json());

  const userPrompt = MUSIC_TRANSLATE_USER_PROMPT(
    body.description,
    body.duration,
    body.additionalNotes,
  );

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: MUSIC_TRANSLATE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5, // 翻译任务需要准确性
      maxTokens: 2000,
      taskTag: "music-translate",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as MusicTranslateResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[music/translate] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "音乐需求翻译服务暂不可用",
    }, 502);
  }
});

// ---- P1 (派单53): ENH-10 AI写词 ----
musicRoutes.post("/lyrics", async (c) => {
  const user = requireUser(c);
  const body = LyricsGenerateSchema.parse(await c.req.json());

  const userPrompt = LYRICS_USER_PROMPT({
    theme: body.theme,
    keywords: body.keywords,
    emotion: body.emotion,
    style: body.style,
    length: body.length,
  });

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: LYRICS_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.85, // 创意任务需要适度温度
      maxTokens: 3500,
      taskTag: "music-lyrics",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as LyricsGenerateResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[music/lyrics] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "AI写词服务暂不可用",
    }, 502);
  }
});
