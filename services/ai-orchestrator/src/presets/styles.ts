/**
 * 12 风格预设（presets/styles.ts）
 *
 * 三层结构：
 *   - StylePreset         完整预设（prompt + 后期 + 评分）
 *   - StyleKey            12 个 enum 键
 *   - STYLE_PRESETS       12 风格总表
 *   - STYLE_COMPATIBILITY 风格混合矩阵（混搭白名单）
 *
 * 用途：
 *   - novel-to-drama / style-transfer / character-replace / episode-batch
 *     都用 STYLE_PRESETS[style].prompt 后缀，强化 prompt 一致性
 *   - 多风格混合：选 mixA / mixB（pick(0.5,0.5) 融合 prompt）
 */

export type StyleKey =
  | "anime"
  | "realistic_3d"
  | "cyberpunk"
  | "ink_painting"
  | "disney"
  | "ghibli"
  | "manhua_chinese"
  | "comic_western"
  | "realistic_photo"
  | "cel_shading"      // 二次元
  | "render_3d"        // 3D
  | "cyber";           // 赛博（cyberpunk 别名）

/** 后期色调 / 渲染参数（供 video-gen / compose 调参用） */
export interface StylePostProcess {
  /** 调色温（K）；0=不调，>5500 冷，<5500 暖 */
  colorTemperatureK: number;
  /** 饱和度 0..2（1=原色） */
  saturation: number;
  /** 对比度 0..2 */
  contrast: number;
  /** 锐度 0..2 */
  sharpness: number;
  /** 噪点 0..1（0=无） */
  grain: number;
  /** 暗角 0..1 */
  vignette: number;
  /** fps（视频） */
  fps: 24 | 30 | 60;
}

export interface StylePreset {
  key: StyleKey;
  /** 中文显示名 */
  label: string;
  /** 英文显示名 */
  labelEn: string;
  /** 风格描述（用户能看的简短文案） */
  description: string;
  /** 注入到 image-gen / video-gen 的 prompt 模板（含占位 {subject}） */
  prompt: string;
  /** 负向 prompt（避免出现的内容） */
  negativePrompt: string;
  /** 推荐分辨率 */
  resolution: { width: number; height: number };
  /** 推荐视频时长（s） */
  recommendedDuration: number;
  /** 后期参数 */
  postProcess: StylePostProcess;
  /** 推荐艺术风格（workflow-engine 的 ArtStyle） */
  workflowArtStyle:
    | "anime"
    | "manhua_chinese"
    | "realistic_3d"
    | "watercolor"
    | "pixel"
    | "ink_painting"
    | "comic_western";
  /** 单图成本系数（相对值，1.0 = anime 基线） */
  costMultiplier: number;
  /** 单帧生成耗时系数（相对值，1.0 = anime 基线） */
  speedMultiplier: number;
  /** 0..1 质量评分（用于 quality mode 排序） */
  qualityScore: number;
  /** 标签 */
  tags: string[];
}

export const STYLE_PRESETS: Record<StyleKey, StylePreset> = {
  anime: {
    key: "anime",
    label: "日式动漫",
    labelEn: "Anime",
    description: "经典日式动漫，鲜艳色彩 + 清晰线条 + 表情夸张",
    prompt:
      "{subject}, anime style, cel-shaded, vibrant colors, clean lineart, expressive eyes, studio ghibli inspired, light rim lighting, high quality illustration, 2d",
    negativePrompt: "realistic photo, 3d render, noisy, blurry, lowres, deformed hands, extra fingers",
    resolution: { width: 1024, height: 1024 },
    recommendedDuration: 5,
    postProcess: { colorTemperatureK: 5600, saturation: 1.15, contrast: 1.1, sharpness: 1.05, grain: 0.02, vignette: 0.1, fps: 24 },
    workflowArtStyle: "anime",
    costMultiplier: 1.0,
    speedMultiplier: 1.0,
    qualityScore: 0.85,
    tags: ["anime", "2d", "cel"],
  },
  realistic_3d: {
    key: "realistic_3d",
    label: "写实3D",
    labelEn: "Realistic 3D",
    description: "Unreal Engine 5 级别写实 3D 渲染，电影质感",
    prompt:
      "{subject}, unreal engine 5, octane render, hyper realistic, cinematic lighting, depth of field, ray tracing, global illumination, 8k, pbr materials, photorealistic 3d",
    negativePrompt: "2d flat, anime, low poly, cartoon, sketch, lineart",
    resolution: { width: 1280, height: 720 },
    recommendedDuration: 6,
    postProcess: { colorTemperatureK: 5200, saturation: 1.0, contrast: 1.2, sharpness: 1.15, grain: 0.05, vignette: 0.18, fps: 30 },
    workflowArtStyle: "realistic_3d",
    costMultiplier: 1.6,
    speedMultiplier: 1.4,
    qualityScore: 0.95,
    tags: ["3d", "realistic", "cinematic"],
  },
  cyberpunk: {
    key: "cyberpunk",
    label: "赛博朋克",
    labelEn: "Cyberpunk",
    description: "霓虹灯 + 赛博城市 + 紫蓝调 + 高对比",
    prompt:
      "{subject}, cyberpunk 2077 inspired, neon lights, rain-soaked streets, purple and cyan color grading, holographic billboards, futuristic dystopian city, high contrast, blade runner aesthetic",
    negativePrompt: "natural daylight, pastoral, rural, anime cute style, low contrast",
    resolution: { width: 1280, height: 720 },
    recommendedDuration: 5,
    postProcess: { colorTemperatureK: 6500, saturation: 1.4, contrast: 1.3, sharpness: 1.1, grain: 0.08, vignette: 0.25, fps: 30 },
    workflowArtStyle: "realistic_3d",
    costMultiplier: 1.5,
    speedMultiplier: 1.3,
    qualityScore: 0.92,
    tags: ["cyber", "neon", "sci-fi"],
  },
  ink_painting: {
    key: "ink_painting",
    label: "国风水墨",
    labelEn: "Chinese Ink Wash",
    description: "中国传统水墨画，留白写意，墨色浓淡",
    prompt:
      "{subject}, Chinese ink wash painting, shuimo, monochrome, traditional brush strokes, rice paper texture, minimalist composition, calligraphy inspired, wabi-sabi, masterpiece",
    negativePrompt: "colorful, neon, 3d render, photorealistic, anime cel",
    resolution: { width: 1024, height: 1024 },
    recommendedDuration: 6,
    postProcess: { colorTemperatureK: 5000, saturation: 0.4, contrast: 0.95, sharpness: 0.9, grain: 0.12, vignette: 0.2, fps: 24 },
    workflowArtStyle: "ink_painting",
    costMultiplier: 1.1,
    speedMultiplier: 1.05,
    qualityScore: 0.88,
    tags: ["ink", "traditional", "monochrome"],
  },
  disney: {
    key: "disney",
    label: "迪士尼",
    labelEn: "Disney",
    description: "迪士尼 3D 风格，Q 萌角色 + 鲜艳色彩 + 大眼睛",
    prompt:
      "{subject}, disney pixar 3d style, big expressive eyes, smooth skin, vibrant saturated colors, soft volumetric lighting, charming character, pixar render, dreamworks quality",
    negativePrompt: "realistic photo, anime 2d, dark horror, gritty, low quality",
    resolution: { width: 1024, height: 1024 },
    recommendedDuration: 5,
    postProcess: { colorTemperatureK: 5500, saturation: 1.25, contrast: 1.05, sharpness: 1.0, grain: 0.0, vignette: 0.05, fps: 30 },
    workflowArtStyle: "realistic_3d",
    costMultiplier: 1.4,
    speedMultiplier: 1.2,
    qualityScore: 0.9,
    tags: ["disney", "3d", "family"],
  },
  ghibli: {
    key: "ghibli",
    label: "吉卜力",
    labelEn: "Studio Ghibli",
    description: "宫崎骏手绘风，温暖治愈，田园诗意",
    prompt:
      "{subject}, studio ghibli style, hayao miyazaki inspired, hand-painted, soft pastel colors, lush nature, gentle atmosphere, countryside, whimsical, watercolor textures",
    negativePrompt: "neon, cyber, 3d render, photorealistic, dark gritty",
    resolution: { width: 1024, height: 1024 },
    recommendedDuration: 6,
    postProcess: { colorTemperatureK: 5400, saturation: 0.95, contrast: 0.95, sharpness: 0.95, grain: 0.06, vignette: 0.12, fps: 24 },
    workflowArtStyle: "watercolor",
    costMultiplier: 1.15,
    speedMultiplier: 1.1,
    qualityScore: 0.91,
    tags: ["ghibli", "hand-drawn", "warm"],
  },
  manhua_chinese: {
    key: "manhua_chinese",
    label: "国漫",
    labelEn: "Chinese Manhua",
    description: "国产漫画风，仙侠玄幻常用，墨线 + 浅彩",
    prompt:
      "{subject}, chinese manhua style, xianxia inspired, ink outlines with light color fill, flowing robes, traditional chinese aesthetic, immortal cultivation theme, dynamic pose, high quality",
    negativePrompt: "western comic, realistic, neon, cyber, low quality",
    resolution: { width: 1024, height: 1024 },
    recommendedDuration: 5,
    postProcess: { colorTemperatureK: 5300, saturation: 1.1, contrast: 1.05, sharpness: 1.1, grain: 0.04, vignette: 0.1, fps: 24 },
    workflowArtStyle: "manhua_chinese",
    costMultiplier: 1.05,
    speedMultiplier: 1.05,
    qualityScore: 0.87,
    tags: ["manhua", "xianxia", "chinese"],
  },
  comic_western: {
    key: "comic_western",
    label: "漫画",
    labelEn: "Western Comic",
    description: "欧美漫画，bold lines + halftone + 鲜艳填色",
    prompt:
      "{subject}, western comic book style, marvel dc inspired, bold ink lines, halftone shading, dynamic action pose, saturated primary colors, speech bubble ready, graphic novel",
    negativePrompt: "anime cel, watercolor, photo, 3d render, soft pastel",
    resolution: { width: 1024, height: 1024 },
    recommendedDuration: 5,
    postProcess: { colorTemperatureK: 5700, saturation: 1.3, contrast: 1.25, sharpness: 1.15, grain: 0.1, vignette: 0.15, fps: 30 },
    workflowArtStyle: "comic_western",
    costMultiplier: 1.1,
    speedMultiplier: 1.1,
    qualityScore: 0.86,
    tags: ["comic", "western", "halftone"],
  },
  realistic_photo: {
    key: "realistic_photo",
    label: "写实",
    labelEn: "Photorealistic",
    description: "真人照片质感，电影级打光",
    prompt:
      "{subject}, photograph, dslr, 85mm lens, f/1.8, bokeh, natural lighting, skin pores visible, photojournalistic, kodak portra 400, hyper realistic, 8k uhd",
    negativePrompt: "cartoon, anime, 3d render, illustration, painting, sketch",
    resolution: { width: 1280, height: 720 },
    recommendedDuration: 6,
    postProcess: { colorTemperatureK: 5200, saturation: 0.95, contrast: 1.1, sharpness: 1.2, grain: 0.05, vignette: 0.1, fps: 30 },
    workflowArtStyle: "realistic_3d",
    costMultiplier: 1.7,
    speedMultiplier: 1.5,
    qualityScore: 0.93,
    tags: ["photo", "realistic", "live-action"],
  },
  cel_shading: {
    key: "cel_shading",
    label: "二次元",
    labelEn: "Cel-Shading 2D",
    description: "纯二次元，卡通描边 + 平面色块",
    prompt:
      "{subject}, cel shading, 2d animation, clean lineart, flat colors, anime, manga panel, minimal shading, vector look, mobile game art style",
    negativePrompt: "3d render, photoreal, watercolor, oil painting, sketchy",
    resolution: { width: 1024, height: 1024 },
    recommendedDuration: 4,
    postProcess: { colorTemperatureK: 5600, saturation: 1.2, contrast: 1.15, sharpness: 1.1, grain: 0.0, vignette: 0.05, fps: 24 },
    workflowArtStyle: "anime",
    costMultiplier: 0.9,
    speedMultiplier: 0.9,
    qualityScore: 0.82,
    tags: ["cel", "2d", "manga"],
  },
  render_3d: {
    key: "render_3d",
    label: "3D",
    labelEn: "3D Render",
    description: "通用 3D 渲染（介于写实3D 和 迪士尼之间）",
    prompt:
      "{subject}, 3d render, blender cycles, octane, studio lighting, smooth materials, soft shadows, isometric feel, high detail 3d model, pbr",
    negativePrompt: "2d flat, hand-drawn, anime line, photo, sketch",
    resolution: { width: 1024, height: 1024 },
    recommendedDuration: 5,
    postProcess: { colorTemperatureK: 5400, saturation: 1.05, contrast: 1.1, sharpness: 1.1, grain: 0.02, vignette: 0.1, fps: 30 },
    workflowArtStyle: "realistic_3d",
    costMultiplier: 1.3,
    speedMultiplier: 1.2,
    qualityScore: 0.88,
    tags: ["3d", "render", "studio"],
  },
  cyber: {
    key: "cyber",
    label: "赛博",
    labelEn: "Cyber",
    description: "赛博朋克的精简别名（与 cyberpunk 同源）",
    prompt:
      "{subject}, cyber aesthetic, glitch art, holographic, neon outline, electric blue and magenta, synthwave, digital noise, vaporwave color palette",
    negativePrompt: "natural, pastoral, watercolor, traditional, monochrome",
    resolution: { width: 1024, height: 1024 },
    recommendedDuration: 4,
    postProcess: { colorTemperatureK: 6800, saturation: 1.35, contrast: 1.25, sharpness: 1.1, grain: 0.1, vignette: 0.2, fps: 30 },
    workflowArtStyle: "realistic_3d",
    costMultiplier: 1.25,
    speedMultiplier: 1.15,
    qualityScore: 0.84,
    tags: ["cyber", "glitch", "synthwave"],
  },
};

/** 12 风格顺序（用于 UI 列表 / 性能基准） */
export const STYLE_KEYS: StyleKey[] = [
  "anime",
  "realistic_3d",
  "cyberpunk",
  "ink_painting",
  "disney",
  "ghibli",
  "manhua_chinese",
  "comic_western",
  "realistic_photo",
  "cel_shading",
  "render_3d",
  "cyber",
];

/** 风格混合矩阵：哪些风格可以混搭 */
export const STYLE_COMPATIBILITY: Record<StyleKey, StyleKey[]> = {
  anime: ["ghibli", "cel_shading", "disney", "manhua_chinese"],
  realistic_3d: ["disney", "render_3d", "realistic_photo"],
  cyberpunk: ["cyber", "realistic_3d"],
  ink_painting: ["ghibli", "manhua_chinese"],
  disney: ["render_3d", "realistic_3d", "anime"],
  ghibli: ["ink_painting", "anime", "cel_shading"],
  manhua_chinese: ["ink_painting", "anime", "cel_shading"],
  comic_western: ["anime", "cel_shading"],
  realistic_photo: ["realistic_3d"],
  cel_shading: ["anime", "ghibli", "comic_western", "manhua_chinese"],
  render_3d: ["realistic_3d", "disney"],
  cyber: ["cyberpunk", "realistic_3d"],
};

/** 选风格 */
export function pickStylePreset(k: StyleKey): StylePreset {
  return STYLE_PRESETS[k];
}

/** 混搭两个风格（生成混合 prompt） */
export function mixStylePrompts(a: StyleKey, b: StyleKey, weight = 0.5): string {
  const pa = STYLE_PRESETS[a];
  const pb = STYLE_PRESETS[b];
  if (pa.key === pb.key) return pa.prompt;
  // 用同一 {subject} 占位，但 prompt 模板拼接
  // 取 pa 的前半 + pb 的后半（视觉融合）
  const aParts = pa.prompt.split(",").map((s) => s.trim());
  const bParts = pb.prompt.split(",").map((s) => s.trim());
  const aKeep = aParts.slice(0, Math.ceil(aParts.length * weight));
  const bKeep = bParts.slice(Math.floor(bParts.length * (1 - weight)));
  // 去 {subject} 占位（只保留一次）
  const merged = [...aKeep, ...bKeep].filter((p) => p !== "{subject}" && p.length > 0);
  return "{subject}, " + merged.join(", ") + `, blend of ${a} and ${b}, weight=${weight.toFixed(2)}`;
}

/** 校验两个风格能否混合 */
export function canMixStyles(a: StyleKey, b: StyleKey): boolean {
  if (a === b) return true;
  return STYLE_COMPATIBILITY[a].includes(b) || STYLE_COMPATIBILITY[b].includes(a);
}

/** 列表用 */
export function listStylePresets(): StylePreset[] {
  return STYLE_KEYS.map((k) => STYLE_PRESETS[k]);
}
