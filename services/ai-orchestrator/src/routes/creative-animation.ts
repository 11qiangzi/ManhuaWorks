/**
 * 动画模块 API 路由（API-5 + ENH-3/4/5）
 *
 * 派单51：谢擎 | 日期：2026-06-25
 * 派单53：谢擎 | 日期：2026-06-25 — P1 UX增强
 *
 * API-5:  POST /v1/creative/animation/analyze          - 多模式分析
 * ENH-3:  POST /v1/creative/animation/character-tags   - 角色外貌标签生成
 * ENH-4:  GET  /v1/creative/animation/storyboard-templates - 分镜模板列表
 * ENH-5:  GET  /v1/creative/animation/progress-stream     - SSE阶段进度推送
 */

import { Hono } from "hono";
import { z } from "zod";
import { requireUser, type AppEnv } from "../middleware/auth.js";
import { aiRouterClient as aiRouter } from "../clients/ai-router.js";
import { ErrorCodes } from "@manhuaworks/shared";

import {
  ANIMATION_ANALYZE_SYSTEM_PROMPT,
  ANIMATION_ANALYZE_USER_PROMPT,
} from "../prompts/animation-analyze.js";
// P1 (派单53)
import {
  CHARACTER_APPEARANCE_SYSTEM_PROMPT,
  CHARACTER_APPEARANCE_USER_PROMPT,
} from "../prompts/character-appearance.js";

import type {
  AnimationAnalyzeResponse,
  // P1
  CharacterAppearanceResponse,
  StoryboardTemplateListResponse,
  GenerationProgress,
} from "./types.js";

// ========== ENH-4: 分镜模板预置数据 ==========
import type { StoryboardTemplate } from "./types.js";

const STORYBOARD_TEMPLATES: StoryboardTemplate[] = [
  {
    id: "dialog-intimate",
    name: "对话·亲密感",
    description: "双人对话场景，适合建立角色情感连接",
    suitableScenes: ["恋人对话", "挚友谈心", "师徒教导", "家庭互动"],
    shotStructure: [
      { order: 1, shotType: "远景", cameraMovement: "缓推", description: "展示环境氛围和角色位置关系", durationHint: "3s" },
      { order: 2, shotType: "中景", cameraMovement: "固定", description: "双人同框，展示互动和肢体语言", durationHint: "4s" },
      { order: 3, shotType: "近景", cameraMovement: "固定", description: "说话者表情+眼神（内心情感外化）", durationHint: "3s" },
      { order: 4, shotType: "近景", cameraMovement: "固定", description: "聆听者反应（共情/惊讶/感动）", durationHint: "2s" },
      { order: 5, shotType: "特写", cameraMovement: "缓推", description: "关键物件或手势特写，强化情感符号", durationHint: "3s" },
      { order: 6, shotType: "远景", cameraMovement: "缓拉", description: "回归环境，两人关系状态收束", durationHint: "3s" },
    ],
    exampleImagePrompt: {
      en: "Two characters sitting on a park bench at golden hour, warm sunlight filtering through trees, soft bokeh background, anime art style, intimate atmosphere",
      zh: "两个角色坐在黄昏公园长椅上，金色阳光透过树叶洒落，柔和虚化背景，日系动画风格，亲密温馨氛围"
    }
  },
  {
    id: "action-fight",
    name: "战斗·高燃",
    description: "快速打斗/追逐场景，强化节奏和视觉冲击力",
    suitableScenes: ["战斗场景", "追逐场面", "技能释放", "激烈对抗"],
    shotStructure: [
      { order: 1, shotType: "特写", cameraMovement: "快速推", description: "角色眼神/蓄力动作，暗示即将爆发", durationHint: "1s" },
      { order: 2, shotType: "中景", cameraMovement: "快速摇镜", description: "攻击动作全过程，动态模糊增强速度感", durationHint: "2s" },
      { order: 3, shotType: "特写", cameraMovement: "固定", description: "被击打/格挡瞬间（冲击力特写）", durationHint: "1s" },
      { order: 4, shotType: "俯拍", cameraMovement: "旋转", description: "大场面战斗全景，多角色交战", durationHint: "3s" },
      { order: 5, shotType: "跟拍", cameraMovement: "快速跟", description: "角色高速移动/冲刺（速度线效果）", durationHint: "2s" },
      { order: 6, shotType: "特写", cameraMovement: "急停", description: "决定性一击，慢动作卡点", durationHint: "2s" },
      { order: 7, shotType: "远景", cameraMovement: "缓拉", description: "战斗结果/余波，烟雾散尽", durationHint: "2s" },
    ],
    exampleImagePrompt: {
      en: "Epic battle scene with dynamic motion blur, two fighters clashing mid-air, energy effects and particle explosions, dramatic lighting, anime action style",
      zh: "史诗战斗场景，动态模糊效果，两名战士在空中交锋，能量特效和粒子爆炸，戏剧性光影，日系动作风格"
    }
  },
  {
    id: "emotional-solo",
    name: "情感·独白",
    description: "单人情感高潮场景，突出内心世界和情绪表达",
    suitableScenes: ["角色独白", "情感爆发", "内心挣扎", "决定性选择"],
    shotStructure: [
      { order: 1, shotType: "远景", cameraMovement: "缓拉", description: "角色孤身处于空旷环境，暗示孤独/渺小", durationHint: "3s" },
      { order: 2, shotType: "中景", cameraMovement: "缓推", description: "角色半身，表情逐渐变化（压抑→释放）", durationHint: "4s" },
      { order: 3, shotType: "特写", cameraMovement: "固定", description: "眼泪/握拳/颤抖等情感细节", durationHint: "2s" },
      { order: 4, shotType: "主观", cameraMovement: "抬头/环视", description: "角色视角看世界（环境/回忆闪回）", durationHint: "3s" },
      { order: 5, shotType: "近景", cameraMovement: "固定", description: "角色做出选择/说出关键台词", durationHint: "3s" },
      { order: 6, shotType: "远景", cameraMovement: "缓拉", description: "角色与环境关系变化，情绪余韵", durationHint: "3s" },
    ],
    exampleImagePrompt: {
      en: "A lone character standing under streetlight at night, rain falling, emotional expression with tear, cinematic lighting with rim light, anime drama style",
      zh: "一个角色孤身站在夜晚路灯下，细雨飘落，带泪的情感表情，电影感逆光照明，日系写实动画风格"
    }
  },
  {
    id: "montage-time",
    name: "蒙太奇·时光",
    description: "时间流逝/场景切换的蒙太奇序列",
    suitableScenes: ["时间跳跃", "成长过程", "平行叙事", "回忆闪回"],
    shotStructure: [
      { order: 1, shotType: "特写", cameraMovement: "固定", description: "标志性物件/画面作为蒙太奇锚点", durationHint: "1s" },
      { order: 2, shotType: "中景", cameraMovement: "快速切", description: "场景A → 场景B 快速切换（用匹配剪辑）", durationHint: "2s" },
      { order: 3, shotType: "特写", cameraMovement: "固定", description: "锚点物件变化（如日历翻页/植物生长）", durationHint: "1s" },
      { order: 4, shotType: "中景", cameraMovement: "快速切", description: "场景C → 场景D（不同季节/年龄段）", durationHint: "2s" },
      { order: 5, shotType: "特写", cameraMovement: "缓推", description: "当前时间点，锚点物件最终状态", durationHint: "2s" },
      { order: 6, shotType: "远景", cameraMovement: "缓拉", description: "新时间线全貌，角色/场景变化展示", durationHint: "3s" },
    ],
    exampleImagePrompt: {
      en: "Montage sequence showing seasonal changes through a window, cherry blossoms → summer rain → autumn leaves → winter snow, soft transitions, anime style",
      zh: "通过一扇窗户展示四季更替的蒙太奇序列，樱花→夏雨→秋叶→冬雪，柔和转场，日系动画风格"
    }
  },
  {
    id: "suspense-reveal",
    name: "悬疑·揭示",
    description: "悬念铺垫→揭示→冲击的高张力序列",
    suitableScenes: ["真相揭露", "身份曝光", "恐怖袭来", "意外转折"],
    shotStructure: [
      { order: 1, shotType: "近景", cameraMovement: "缓推", description: "角色发现异常，表情从平静到警觉", durationHint: "3s" },
      { order: 2, shotType: "主观", cameraMovement: "缓慢移动", description: "角色视角，环境细节（线索暗示）", durationHint: "3s" },
      { order: 3, shotType: "特写", cameraMovement: "固定", description: "关键线索物件/细节（提升悬念）", durationHint: "2s" },
      { order: 4, shotType: "近景", cameraMovement: "固定", description: "角色反应渐进（疑惑→恐惧→震惊）", durationHint: "2s" },
      { order: 5, shotType: "中景", cameraMovement: "急推", description: "真相揭示瞬间（冲击力最大化）", durationHint: "1s" },
      { order: 6, shotType: "远景", cameraMovement: "缓拉", description: "揭示后的新格局，角色反应收束", durationHint: "3s" },
    ],
    exampleImagePrompt: {
      en: "Dark corridor with a single door slightly open, mysterious light spilling out, character standing in shadow, thriller atmosphere, anime suspense style",
      zh: "黑暗走廊中一扇门微开，神秘光线溢出，角色站在阴影中，悬疑惊悚氛围，日系悬疑动画风格"
    }
  },
];

// ---- Zod Schemas ----

const AnimationAnalyzeSchema = z.object({
  mode: z.enum(["novel", "character", "structured", "blank"]),
  input: z.string().max(50000).optional(),
  projectId: z.string().optional(),
});

// P1: ENH-3 角色外貌标签
const CharacterAppearanceSchema = z.object({
  characterName: z.string().min(1).max(50),
  description: z.string().min(5).max(2000),
  artStyle: z.string().max(100).optional(),
  gender: z.string().max(20).optional(),
  age: z.string().max(20).optional(),
});

// ---- Router ----

export const animationRoutes = new Hono<AppEnv>();

// ---- API-5: 多模式分析 ----
animationRoutes.post("/analyze", async (c) => {
  const user = requireUser(c);
  const body = AnimationAnalyzeSchema.parse(await c.req.json());

  const userPrompt = ANIMATION_ANALYZE_USER_PROMPT(body.mode, body.input);

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: ANIMATION_ANALYZE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: body.mode === "blank" ? 0.9 : 0.6,
      maxTokens: body.mode === "novel" ? 6000 : 4000,
      taskTag: "animation-analyze",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as AnimationAnalyzeResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[animation/analyze] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "动画分析服务暂不可用",
    }, 502);
  }
});

// ---- P1: ENH-3 角色外貌标签生成 ----
animationRoutes.post("/character-tags", async (c) => {
  const user = requireUser(c);
  const body = CharacterAppearanceSchema.parse(await c.req.json());

  const userPrompt = CHARACTER_APPEARANCE_USER_PROMPT({
    characterName: body.characterName,
    description: body.description,
    artStyle: body.artStyle,
    gender: body.gender,
    age: body.age,
  });

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: CHARACTER_APPEARANCE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 2000,
      taskTag: "animation-character-tags",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as CharacterAppearanceResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[animation/character-tags] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "角色外貌标签生成服务暂不可用",
    }, 502);
  }
});

// ---- P1: ENH-4 分镜模板列表（预置数据，不调AI）----
animationRoutes.get("/storyboard-templates", (c) => {
  const response: StoryboardTemplateListResponse = {
    templates: STORYBOARD_TEMPLATES,
    total: STORYBOARD_TEMPLATES.length,
    usageTip: "选择模板后，AI按模板结构编排分镜。有\"不使用模板（AI自由发挥）\"选项。",
  };
  return c.json({
    code: 0,
    message: "ok",
    data: response,
  });
});

// ---- P1: ENH-5 SSE阶段进度推送 ----
// 使用标准 EventSource 格式推送动画生成四阶段进度
animationRoutes.get("/progress-stream/:jobId", (c) => {
  const jobId = c.req.param("jobId");

  // 模拟四阶段进度数据（产线接入后替换为真实job数据）
  const stages: GenerationProgress["stages"] = [
    {
      stage: "storyboard_extraction",
      stageLabel: "分镜提取",
      percentage: 0,
      status: "pending",
      detail: "等待开始...",
      timestamp: Date.now(),
    },
    {
      stage: "character_matching",
      stageLabel: "角色匹配",
      percentage: 0,
      status: "pending",
      detail: "等待开始...",
      timestamp: Date.now(),
    },
    {
      stage: "scene_rendering",
      stageLabel: "场景渲染",
      percentage: 0,
      status: "pending",
      detail: "等待开始...",
      timestamp: Date.now(),
    },
    {
      stage: "compositing",
      stageLabel: "合成视频",
      percentage: 0,
      status: "pending",
      detail: "等待开始...",
      timestamp: Date.now(),
    },
  ];

  // SSE 响应头
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no"); // nginx禁用缓冲

  // 创建 ReadableStream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // 发送初始连接确认
      controller.enqueue(
        encoder.encode(`event: connected\ndata: {"jobId":"${jobId}","message":"SSE连接已建立"}\n\n`)
      );

      // 模拟四阶段进度推送
      const stageConfigs = [
        { stage: "storyboard_extraction", label: "分镜提取", total: 12, duration: 3000 },
        { stage: "character_matching", label: "角色匹配", total: 8, duration: 2000 },
        { stage: "scene_rendering", label: "场景渲染", total: 15, duration: 4000 },
        { stage: "compositing", label: "合成视频", total: 5, duration: 1500 },
      ];

      let stageIndex = 0;
      let stepIndex = 0;

      const interval = setInterval(() => {
        if (stageIndex >= stageConfigs.length) {
          // 全部完成
          const done: GenerationProgress = {
            jobId,
            overallProgress: 100,
            currentStage: "completed",
            stages: stages.map((s) => ({
              ...s,
              percentage: 100,
              status: "completed" as const,
              detail: `${s.stageLabel}已完成`,
              timestamp: Date.now(),
            })),
            estimatedRemaining: 0,
          };
          controller.enqueue(
            encoder.encode(`event: progress\ndata: ${JSON.stringify(done)}\n\n`)
          );
          controller.enqueue(encoder.encode(`event: done\ndata: {"jobId":"${jobId}"}\n\n`));
          controller.close();
          clearInterval(interval);
          return;
        }

        const cfg = stageConfigs[stageIndex];

        if (stepIndex === 0) {
          // 阶段开始
          stages[stageIndex] = {
            ...stages[stageIndex],
            status: "active",
            detail: `正在${cfg.label}...`,
            percentage: 0,
            timestamp: Date.now(),
          };
        } else if (stepIndex >= cfg.total) {
          // 阶段完成
          stages[stageIndex] = {
            ...stages[stageIndex],
            status: "completed",
            percentage: 100,
            detail: `${cfg.label}已完成（共${cfg.total}个分镜）`,
            timestamp: Date.now(),
          };
          stageIndex++;
          stepIndex = 0;
          return;
        } else {
          // 阶段进行中
          const pct = Math.round((stepIndex / cfg.total) * 100);
          stages[stageIndex] = {
            ...stages[stageIndex],
            percentage: pct,
            detail: `${cfg.label}：第${stepIndex}/${cfg.total}个`,
            timestamp: Date.now(),
          };
        }

        const overallPct = Math.round(
          ((stageIndex * 100 + stages[stageIndex].percentage) / (stageConfigs.length * 100)) * 100
        );

        const progress: GenerationProgress = {
          jobId,
          overallProgress: Math.min(overallPct, 99),
          currentStage: stages[stageIndex].stage,
          stages,
          estimatedRemaining: Math.round(
            (stageConfigs.length - stageIndex - 0.5) * (cfg.duration / cfg.total) * (cfg.total - stepIndex)
          ),
        };

        controller.enqueue(
          encoder.encode(`event: progress\ndata: ${JSON.stringify(progress)}\n\n`)
        );

        stepIndex++;
      }, 300); // 每300ms推送一次

      // 安全超时（15秒后强制关闭）
      setTimeout(() => {
        clearInterval(interval);
        try {
          const timeout = { jobId, error: "SSE超时，请重新连接获取进度" };
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify(timeout)}\n\n`)
          );
          controller.close();
        } catch {
          // stream already closed
        }
      }, 15000);
    },
  });

  return c.body(stream);
});
