/**
 * CRAFT Prompt Framework Types
 * 千机工坊 — 结构化 AI 生成提示词框架
 *
 * CRAFT 五维度：
 *   C (Context)   — 环境、光照、氛围
 *   R (Reference) — 参考图绑定（@image N as X）
 *   A (Action)    — 物理动作、交互
 *   F (Framing)   — 镜头运动、镜头类型、角度
 *   T (Timing)    — 逐秒节奏
 */

// =============================================================================
// 核心类型
// =============================================================================

export interface CraftPrompt {
  /** C — 环境/光照/氛围描述 */
  context: string;
  /** R — 参考图绑定语句 */
  reference: string;
  /** A — 动作/交互描述 */
  action: string;
  /** F — 镜头/构图描述 */
  framing: string;
  /** T — 时间节奏描述（视频专用；图片为空串） */
  timing: string;
  /** 五段拼合后的完整提示词 */
  fullPrompt: string;
}

export interface CraftGenerationRequest {
  /** 用户的简单描述 */
  description: string;
  /** 任务类型：图片 or 视频 */
  taskType: "image" | "video";
  /** 角色参考图列表 */
  characters?: Array<{
    name: string;
    referenceImageUrl: string;
    referenceIndex: number; // @image N
  }>;
  /** 场景参考图列表 */
  scenes?: Array<{
    name: string;
    referenceImageUrl: string;
    referenceIndex: number;
  }>;
  /** 情绪标签：紧张/温馨/战斗/etc */
  mood?: string;
  /** 视觉风格：anime/realistic/watercolor/etc */
  artStyle?: string;
  /** 视频时长（秒），用于 Timing 分段 */
  duration?: number;
  /** 指定镜头运动 ID（来自 CAMERA_MOVEMENTS）；不传则使用默认 */
  cameraMovementId?: string;
}

// =============================================================================
// 镜头运动库
// =============================================================================

export interface CameraMovement {
  id: string;
  nameZh: string;
  nameEn: string;
  description: string;
  promptTemplate: string;
}

export const CAMERA_MOVEMENTS: CameraMovement[] = [
  {
    id: "push_in",
    nameZh: "推进",
    nameEn: "Dolly In",
    description: "镜头向主体靠近",
    promptTemplate: "slow dolly push-in, getting closer to the subject",
  },
  {
    id: "pull_out",
    nameZh: "拉远",
    nameEn: "Dolly Out",
    description: "镜头远离主体",
    promptTemplate: "slow dolly pull-out, revealing the wider scene",
  },
  {
    id: "pan_left",
    nameZh: "左摇",
    nameEn: "Pan Left",
    description: "镜头水平向左移动",
    promptTemplate: "smooth pan left, following the action",
  },
  {
    id: "pan_right",
    nameZh: "右摇",
    nameEn: "Pan Right",
    description: "镜头水平向右移动",
    promptTemplate: "smooth pan right, revealing new elements",
  },
  {
    id: "tilt_up",
    nameZh: "上摇",
    nameEn: "Tilt Up",
    description: "镜头垂直向上",
    promptTemplate: "slow tilt up, revealing the height",
  },
  {
    id: "tilt_down",
    nameZh: "下摇",
    nameEn: "Tilt Down",
    description: "镜头垂直向下",
    promptTemplate: "slow tilt down, grounding the scene",
  },
  {
    id: "tracking",
    nameZh: "跟拍",
    nameEn: "Tracking Shot",
    description: "镜头跟随运动主体",
    promptTemplate: "tracking shot following the subject from behind",
  },
  {
    id: "orbit",
    nameZh: "环绕",
    nameEn: "Orbit",
    description: "镜头围绕主体旋转",
    promptTemplate: "slow 180-degree orbit around the subject",
  },
  {
    id: "crane_up",
    nameZh: "升降",
    nameEn: "Crane Up",
    description: "镜头升起",
    promptTemplate: "crane shot rising from ground level to overhead",
  },
  {
    id: "handheld",
    nameZh: "手持",
    nameEn: "Handheld",
    description: "手持摄影的轻微晃动",
    promptTemplate: "subtle handheld movement, documentary feel",
  },
  {
    id: "static",
    nameZh: "固定",
    nameEn: "Static",
    description: "固定机位不动",
    promptTemplate: "locked-off static shot, no camera movement",
  },
  {
    id: "zoom_in",
    nameZh: "变焦推",
    nameEn: "Zoom In",
    description: "镜头变焦推近",
    promptTemplate: "slow optical zoom in, compressing the background",
  },
];

// =============================================================================
// 情绪预设
// =============================================================================

export interface MoodPreset {
  id: string;
  nameZh: string;
  contextKeywords: string[];
  lightingKeywords: string[];
  colorKeywords: string[];
}

export const MOOD_PRESETS: MoodPreset[] = [
  {
    id: "tense",
    nameZh: "紧张",
    contextKeywords: ["dim corridor", "flickering lights", "shadows"],
    lightingKeywords: ["low-key lighting", "harsh shadows", "cold blue"],
    colorKeywords: ["desaturated", "cold tones", "dark"],
  },
  {
    id: "warm",
    nameZh: "温馨",
    contextKeywords: ["cozy room", "golden hour", "soft textures"],
    lightingKeywords: ["warm golden light", "soft diffused", "candlelight"],
    colorKeywords: ["warm tones", "golden", "soft pastels"],
  },
  {
    id: "battle",
    nameZh: "战斗",
    contextKeywords: ["open battlefield", "dust and debris", "dramatic sky"],
    lightingKeywords: ["high contrast", "dramatic rim light", "explosive flashes"],
    colorKeywords: ["saturated", "high contrast", "red and orange"],
  },
  {
    id: "sad",
    nameZh: "悲伤",
    contextKeywords: ["rainy street", "empty room", "overcast sky"],
    lightingKeywords: ["overcast", "flat lighting", "muted light"],
    colorKeywords: ["desaturated blues", "gray tones", "muted"],
  },
  {
    id: "cheerful",
    nameZh: "欢快",
    contextKeywords: ["bright sunny day", "colorful environment", "open space"],
    lightingKeywords: ["bright natural light", "vibrant", "even lighting"],
    colorKeywords: ["vibrant colors", "bright", "saturated"],
  },
  {
    id: "mystery",
    nameZh: "悬疑",
    contextKeywords: ["fog-covered", "dimly lit", "unknown corners"],
    lightingKeywords: ["chiaroscuro", "single light source", "deep shadows"],
    colorKeywords: ["dark greens", "deep purples", "muted"],
  },
  {
    id: "epic",
    nameZh: "史诗",
    contextKeywords: ["vast landscape", "towering structures", "dramatic clouds"],
    lightingKeywords: ["god rays", "golden hour", "volumetric light"],
    colorKeywords: ["rich warm tones", "golden", "deep shadows"],
  },
  {
    id: "scifi",
    nameZh: "科幻",
    contextKeywords: ["futuristic interior", "holographic displays", "metal surfaces"],
    lightingKeywords: ["neon accents", "cool blue ambient", "rim lighting"],
    colorKeywords: ["cyan and magenta", "cool blues", "metallic"],
  },
];

// =============================================================================
// CRAFT Prompt Builder（纯函数，浏览器 + Node 通用）
// =============================================================================

/** 美术风格 → 英文关键词映射 */
const ART_STYLE_KEYWORDS: Record<string, string> = {
  anime: "anime art style, cel-shaded, vibrant lineart",
  realistic: "photorealistic, cinematic, detailed skin texture",
  watercolor: "watercolor painting style, soft edges, paint bleeds",
  pixel: "pixel art, 16-bit, retro game aesthetic",
  ink_painting: "traditional Chinese ink painting, sumi-e, monochrome washes",
  comic_western: "western comic book style, bold inks, halftone dots",
  manhua_chinese: "Chinese manhua style, clean linework, dynamic poses",
  realistic_3d: "3D rendered, subsurface scattering, Unreal Engine quality",
};

/** 查找情绪预设（按 id 或中文名称匹配） */
function findMoodPreset(mood: string | undefined): MoodPreset | null {
  if (!mood) return null;
  const key = mood.trim().toLowerCase();
  return MOOD_PRESETS.find((p) => p.id === key || p.nameZh === key) ?? null;
}

/** 查找镜头运动（按 id） */
function findCameraMovement(id: string | undefined): CameraMovement | null {
  if (!id) return null;
  return CAMERA_MOVEMENTS.find((m) => m.id === id) ?? null;
}

/**
 * C — Context
 * 合成：美术风格 + 情绪预设（context + lighting + color） + 用户描述
 */
function buildContext(req: CraftGenerationRequest): string {
  const parts: string[] = [];

  if (req.artStyle) {
    const kw = ART_STYLE_KEYWORDS[req.artStyle];
    if (kw) parts.push(kw);
  }

  const mood = findMoodPreset(req.mood);
  if (mood) {
    parts.push(mood.contextKeywords.join(", "));
    parts.push(mood.lightingKeywords.join(", "));
    parts.push(mood.colorKeywords.join(", "));
  }

  if (req.description) {
    parts.push(req.description);
  }

  return parts.join(". ") || "neutral scene, even lighting";
}

/**
 * R — Reference
 * 生成形如 "@image 1 as 林启 (character), @image 2 as 废墟 (scene)" 的绑定语句
 */
function buildReference(req: CraftGenerationRequest): string {
  const refs: string[] = [];

  for (const ch of req.characters ?? []) {
    refs.push(`@image ${ch.referenceIndex} as ${ch.name} (character appearance)`);
  }

  for (const sc of req.scenes ?? []) {
    refs.push(`@image ${sc.referenceIndex} as ${sc.name} (scene/background)`);
  }

  return refs.join(", ") || "";
}

/**
 * A — Action
 * 从用户描述中提取动作意图；若描述中无明确动作则提供通用默认
 */
function buildAction(req: CraftGenerationRequest): string {
  const actionVerbs = [
    "走", "跑", "转身", "看", "拿", "推", "拉", "跳", "飞",
    "站", "坐", "挥", "举", "握", "扔", "挡", "闪",
    "walk", "run", "turn", "look", "grab", "push", "pull",
    "jump", "fly", "stand", "sit", "wave", "raise", "throw",
  ];

  const desc = req.description || "";
  const hasAction = actionVerbs.some((v) => desc.includes(v));

  if (hasAction) {
    return desc;
  }

  return desc
    ? `${desc}, subtle character movement, natural breathing`
    : "character standing still, subtle idle animation";
}

/**
 * F — Framing
 * 从镜头运动库选取，或根据任务类型给出默认构图
 */
function buildFraming(req: CraftGenerationRequest): string {
  const camera = findCameraMovement(req.cameraMovementId);

  if (camera) {
    return camera.promptTemplate;
  }

  if (req.taskType === "video") {
    return "medium shot, slow dolly push-in, shallow depth of field";
  }
  return "medium shot, centered composition, rule of thirds, sharp focus";
}

/**
 * T — Timing
 * 将视频时长按 3 秒一段拆分，生成逐段节奏描述
 */
function buildTiming(req: CraftGenerationRequest): string {
  if (req.taskType !== "video" || !req.duration || req.duration <= 0) {
    return "";
  }

  const segmentLength = 3;
  const segments: string[] = [];
  let elapsed = 0;

  while (elapsed < req.duration) {
    const segEnd = Math.min(elapsed + segmentLength, req.duration);
    const segLabel = `${elapsed}-${segEnd}s`;

    if (elapsed === 0) {
      segments.push(`${segLabel}: establishing wide shot, set the scene`);
    } else if (segEnd >= req.duration) {
      segments.push(`${segLabel}: final beat, hold or slow fade`);
    } else {
      const midIndex = Math.floor(elapsed / segmentLength);
      if (midIndex % 2 === 1) {
        segments.push(`${segLabel}: close-up, emotional detail`);
      } else {
        segments.push(`${segLabel}: medium shot, action progression`);
      }
    }

    elapsed = segEnd;
  }

  return segments.join("; ");
}

/** 将五个维度拼合成一个完整提示词 */
function assembleFullPrompt(p: Omit<CraftPrompt, "fullPrompt">): string {
  const blocks: string[] = [];

  if (p.context) blocks.push(`[Context] ${p.context}`);
  if (p.reference) blocks.push(`[Reference] ${p.reference}`);
  if (p.action) blocks.push(`[Action] ${p.action}`);
  if (p.framing) blocks.push(`[Framing] ${p.framing}`);
  if (p.timing) blocks.push(`[Timing] ${p.timing}`);

  return blocks.join("\n");
}

/**
 * 根据 CraftGenerationRequest 构建完整 CraftPrompt
 */
export function buildCraftPrompt(req: CraftGenerationRequest): CraftPrompt {
  const context = buildContext(req);
  const reference = buildReference(req);
  const action = buildAction(req);
  const framing = buildFraming(req);
  const timing = buildTiming(req);

  const partial = { context, reference, action, framing, timing };
  const fullPrompt = assembleFullPrompt(partial);

  return { ...partial, fullPrompt };
}
