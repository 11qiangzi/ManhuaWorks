/**
 * 故事模块 API 路由（API-1 ~ API-4）
 *
 * 派单51：谢擎 | 日期：2026-06-25
 *
 * API-1: POST /v1/creative/story/inspiration  - AI创意灵感生成
 * API-2: POST /v1/creative/story/template     - 故事模板扩展大纲
 * API-3: POST /v1/creative/story/worldview/extract - 世界观提取+补充
 * API-3: POST /v1/creative/story/worldview/enrich  - 单项世界观完善
 * API-4: POST /v1/creative/story/chapter/generate  - 逐章生成
 * API-4: POST /v1/creative/story/chapter/revise    - 修改本章
 * API-4: POST /v1/creative/story/chapter/regenerate - 重新生成本章
 */

import { Hono } from "hono";
import { z } from "zod";
import { requireUser, type AppEnv } from "../middleware/auth.js";
import { aiRouterClient as aiRouter } from "../clients/ai-router.js";
import { ErrorCodes } from "@manhuaworks/shared";

import {
  STORY_INSPIRATION_SYSTEM_PROMPT,
  STORY_INSPIRATION_USER_PROMPT,
  STORY_INSPIRATION_REFRESH_PROMPT,
} from "../prompts/story-inspiration.js";
import {
  STORY_TEMPLATES,
  STORY_TEMPLATE_SYSTEM_PROMPT,
  STORY_TEMPLATE_USER_PROMPT,
} from "../prompts/story-template.js";
import {
  WORLDVIEW_EXTRACT_SYSTEM_PROMPT,
  WORLDVIEW_EXTRACT_USER_PROMPT,
  WORLDVIEW_ENRICH_SYSTEM_PROMPT,
  WORLDVIEW_ENRICH_USER_PROMPT,
} from "../prompts/worldview.js";
import {
  CHAPTER_GENERATE_SYSTEM_PROMPT,
  CHAPTER_GENERATE_USER_PROMPT,
  CHAPTER_REVISE_USER_PROMPT,
  CHAPTER_REGENERATE_USER_PROMPT,
} from "../prompts/chapter-generate.js";
// P1 (派单53) ENH-2: 参考作品分析
import {
  REFERENCE_ANALYZE_SYSTEM_PROMPT,
  REFERENCE_ANALYZE_USER_PROMPT,
} from "../prompts/reference-analyze.js";
// P2 (派单55) ENH-12: 多视角叙事
import {
  MULTI_POV_DETECT_SYSTEM_PROMPT,
  MULTI_POV_DETECT_USER_PROMPT,
  MULTI_POV_STRUCTURE_SYSTEM_PROMPT,
  MULTI_POV_STRUCTURE_USER_PROMPT,
} from "../prompts/multi-perspective.js";

import type {
  StoryInspirationItem,
  StoryInspirationResponse,
  StoryTemplateDefinition,
  TemplateOutlineResponse,
  WorldviewExtractResponse,
  WorldviewEnrichResponse,
  ChapterGenerateRequest,
  ChapterGenerateResponse,
  ChapterReviseRequest,
  ChapterRegenerateRequest,
  // P1 (派单53)
  ReferenceAnalyzeRequest,
  ReferenceAnalyzeResponse,
  // P2 (派单55)
  MultiPovDetectRequest,
  MultiPovDetectResponse,
  MultiPovStructureRequest,
  MultiPovStructureResponse,
} from "./types.js";

// ---- Zod Schemas ----

// P2 (派单55): ENH-12 多视角叙事
const MultiPovDetectSchema = z.object({
  outline: z.string().min(20).max(10000),
  characters: z.string().max(5000).default(""),
});

const MultiPovStructureSchema = z.object({
  outline: z.string().min(20).max(10000),
  characters: z.string().max(5000).default(""),
  povAssignments: z.string().min(1).max(3000),
  mode: z.enum(["alternating", "parallel", "split_arc"]),
});

// P1 (派单53): ENH-2 参考作品分析
const ReferenceAnalyzeSchema = z.object({
  link: z.string().url().optional(),
  bookName: z.string().min(1).max(200).optional(),
  author: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
});

const InspirationSchema = z.object({
  /** "换一批"标记 */
  refresh: z.boolean().default(false),
});

const TemplateSchema = z.object({
  templateId: z.string().min(1),
  userInput: z.string().max(500).optional(),
});

const WorldviewExtractSchema = z.object({
  outlineText: z.string().min(20).max(10000),
});

const WorldviewEnrichSchema = z.object({
  dimension: z.enum(["era", "geography", "powerSystem", "social", "coreConflict"]),
  currentText: z.string().min(1).max(2000),
});

const ChapterGenerateSchema = z.object({
  projectId: z.string().optional(),
  chapterNumber: z.number().int().min(1),
  chapterTitle: z.string().max(200).optional(),
  outline: z.string().min(20).max(10000),
  worldview: z.string().max(5000).default(""),
  characters: z.string().max(5000).default(""),
  previousChapterSummary: z.string().max(2000).optional(),
  storyType: z.string().max(50).optional(),
  styleNote: z.string().max(500).optional(),
});

const ChapterReviseSchema = z.object({
  originalContent: z.string().min(100).max(20000),
  revisionNote: z.string().min(1).max(1000),
});

const ChapterRegenerateSchema = z.object({
  chapterNumber: z.number().int().min(1),
  outline: z.string().min(20).max(10000),
  worldview: z.string().max(5000).default(""),
  characters: z.string().max(5000).default(""),
  previousChapterSummary: z.string().max(2000).optional(),
  storyType: z.string().max(50).optional(),
  avoidPattern: z.string().min(1).max(500),
});

// ---- Router ----

export const storyRoutes = new Hono<AppEnv>();

// ---- P2 (派单55): ENH-12 多视角叙事 - 检测多主角 ----
storyRoutes.post("/multi-perspective/detect", async (c) => {
  const user = requireUser(c);
  const body = MultiPovDetectSchema.parse(await c.req.json()) as MultiPovDetectRequest;

  const userPrompt = MULTI_POV_DETECT_USER_PROMPT(body.outline, body.characters);

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: MULTI_POV_DETECT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      maxTokens: 2000,
      taskTag: "story-multi-pov-detect",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as MultiPovDetectResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[story/multi-perspective/detect] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "多视角检测服务暂不可用",
    }, 502);
  }
});

// ---- P2 (派单55): ENH-12 多视角叙事 - 生成章节结构 ----
storyRoutes.post("/multi-perspective/structure", async (c) => {
  const user = requireUser(c);
  const body = MultiPovStructureSchema.parse(await c.req.json()) as MultiPovStructureRequest;

  const userPrompt = MULTI_POV_STRUCTURE_USER_PROMPT(
    body.outline,
    body.characters,
    body.povAssignments,
    body.mode,
  );

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: MULTI_POV_STRUCTURE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.75,
      maxTokens: 4000,
      taskTag: "story-multi-pov-structure",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as MultiPovStructureResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[story/multi-perspective/structure] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "多视角章节结构生成服务暂不可用",
    }, 502);
  }
});

// ---- P1 (派单53): ENH-2 参考作品风格分析 ----
storyRoutes.post("/reference-analyze", async (c) => {
  const user = requireUser(c);
  const body = ReferenceAnalyzeSchema.parse(await c.req.json()) as ReferenceAnalyzeRequest;

  if (!body.bookName && !body.link && !body.description) {
    return c.json({
      code: ErrorCodes.BAD_REQUEST,
      message: "至少需要提供 bookName、link 或 description 之一",
    }, 400);
  }

  const userPrompt = REFERENCE_ANALYZE_USER_PROMPT({
    link: body.link,
    bookName: body.bookName,
    description: body.description,
    author: body.author,
  });

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: REFERENCE_ANALYZE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6, // 分析任务需要精准
      maxTokens: 3000,
      taskTag: "story-reference-analyze",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as ReferenceAnalyzeResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[story/reference-analyze] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "参考作品分析服务暂不可用",
    }, 502);
  }
});

// ---- API-1: AI创意灵感生成 ----
storyRoutes.post("/inspiration", async (c) => {
  const user = requireUser(c);
  const body = InspirationSchema.parse(await c.req.json());

  const userPrompt = body.refresh
    ? STORY_INSPIRATION_REFRESH_PROMPT
    : STORY_INSPIRATION_USER_PROMPT;

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: STORY_INSPIRATION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9, // 创意任务需要高温度增加多样性
      maxTokens: 2000,
      taskTag: "story-inspiration",
    });

    // 解析JSON返回
    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as StoryInspirationItem[];

    const data: StoryInspirationResponse = {
      inspirations: Array.isArray(parsed) ? parsed.slice(0, 5) : [],
      refreshed: body.refresh,
    };

    return c.json({
      code: 0,
      message: "ok",
      data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // JSON解析失败或其他错误
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    process.stderr.write(`[story/inspiration] error: ${msg}\n`);
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "灵感生成服务暂不可用",
    }, 502);
  }
});

// ---- API-2: 故事模板大纲生成 ----
storyRoutes.get("/templates", (c) => {
  return c.json({
    code: 0,
    message: "ok",
    data: STORY_TEMPLATES as StoryTemplateDefinition[],
  });
});

storyRoutes.post("/template", async (c) => {
  const user = requireUser(c);
  const body = TemplateSchema.parse(await c.req.json());

  // 查找模板
  const template = STORY_TEMPLATES.find((t) => t.id === body.templateId);
  if (!template) {
    return c.json({
      code: ErrorCodes.NOT_FOUND,
      message: `模板不存在: ${body.templateId}`,
    }, 404);
  }

  const userPrompt = STORY_TEMPLATE_USER_PROMPT(
    template.id,
    template.name,
    body.userInput,
  );

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: STORY_TEMPLATE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      maxTokens: 3000,
      taskTag: "story-template",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as TemplateOutlineResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[story/template] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "模板大纲生成服务暂不可用",
    }, 502);
  }
});

// ---- API-3: 世界观提取+补充 ----
storyRoutes.post("/worldview/extract", async (c) => {
  const user = requireUser(c);
  const body = WorldviewExtractSchema.parse(await c.req.json());

  const userPrompt = WORLDVIEW_EXTRACT_USER_PROMPT(body.outlineText);

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: WORLDVIEW_EXTRACT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6, // 分析任务用较低温度保证准确性
      maxTokens: 2500,
      taskTag: "story-worldview-extract",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as WorldviewExtractResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[story/worldview/extract] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "世界观提取服务暂不可用",
    }, 502);
  }
});

storyRoutes.post("/worldview/enrich", async (c) => {
  const user = requireUser(c);
  const body = WorldviewEnrichSchema.parse(await c.req.json());

  const userPrompt = WORLDVIEW_ENRICH_USER_PROMPT(body.dimension, body.currentText);

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: WORLDVIEW_ENRICH_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 1500,
      taskTag: "story-worldview-enrich",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as WorldviewEnrichResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[story/worldview/enrich] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "世界观完善服务暂不可用",
    }, 502);
  }
});

// ---- API-4: 逐章生成 ----
storyRoutes.post("/chapter/generate", async (c) => {
  const user = requireUser(c);
  const body = ChapterGenerateSchema.parse(await c.req.json());

  const params: ChapterGenerateRequest = {
    chapterNumber: body.chapterNumber,
    chapterTitle: body.chapterTitle,
    outline: body.outline,
    worldview: body.worldview,
    characters: body.characters,
    previousChapterSummary: body.previousChapterSummary,
    storyType: body.storyType,
    styleNote: body.styleNote,
  };
  const userPrompt = CHAPTER_GENERATE_USER_PROMPT(params);

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: CHAPTER_GENERATE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.85,
      maxTokens: 6000, // 生成≥2000字需要较大token预算
      taskTag: "story-chapter-generate",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as ChapterGenerateResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[story/chapter/generate] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "章节生成服务暂不可用",
    }, 502);
  }
});

storyRoutes.post("/chapter/revise", async (c) => {
  const user = requireUser(c);
  const body = ChapterReviseSchema.parse(await c.req.json());

  const userPrompt = CHAPTER_REVISE_USER_PROMPT(
    body.originalContent,
    body.revisionNote,
  );

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: CHAPTER_GENERATE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6, // 修改任务精度>创意
      maxTokens: 6000,
      taskTag: "story-chapter-revise",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as ChapterGenerateResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[story/chapter/revise] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "章节修改服务暂不可用",
    }, 502);
  }
});

storyRoutes.post("/chapter/regenerate", async (c) => {
  const user = requireUser(c);
  const body = ChapterRegenerateSchema.parse(await c.req.json());

  const userPrompt = CHAPTER_REGENERATE_USER_PROMPT({
    chapterNumber: body.chapterNumber,
    outline: body.outline,
    worldview: body.worldview,
    characters: body.characters,
    previousChapterSummary: body.previousChapterSummary,
    storyType: body.storyType,
    avoidPattern: body.avoidPattern,
  });

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: CHAPTER_GENERATE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.95, // 重新生成需要更高温度确保不同
      maxTokens: 6000,
      taskTag: "story-chapter-regenerate",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as ChapterGenerateResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[story/chapter/regenerate] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "章节重生成服务暂不可用",
    }, 502);
  }
});
