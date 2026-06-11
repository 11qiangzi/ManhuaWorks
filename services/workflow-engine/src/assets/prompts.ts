/**
 * 视频 prompt 库 4 套（导入自 Toonflow）
 * 来源：D:\ManhuaWorks\assets\prompts\video\
 *
 * 4 套对应 4 种视频生成模式：
 * 1. seedance2 Multi-parameter Mode
 * 2. universal First-and-Last-Frame Mode
 * 3. universal Multi-parameter Mode
 * 4. wan2.6 Single-image First-Frame Mode
 */

export type VideoPromptMode =
  | 'seedance2_multi_param'
  | 'universal_first_last'
  | 'universal_multi_param'
  | 'wan26_single_first';

export interface VideoPromptTemplate {
  mode: VideoPromptMode;
  name: string;
  /** 模板：占位符 {{shot}} {{style}} {{action}} {{camera}} {{mood}} */
  template: string;
  /** 默认参数（无占位符时使用） */
  defaults: {
    camera?: string;
    motion?: string;
    duration?: number;
  };
  /** 适合的故事类型 */
  bestFor: string[];
}

export const VIDEO_PROMPTS: VideoPromptTemplate[] = [
  {
    mode: 'seedance2_multi_param',
    name: 'Seedance 2.0 · Multi-parameter Mode',
    template: `[{{style}}] {{action}} in {{scene}}. Camera: {{camera}}. Mood: {{mood}}. Cinematic, smooth motion, 24fps, high detail.`,
    defaults: {
      camera: 'medium shot, slow dolly in',
      motion: 'smooth, 24fps',
      duration: 5,
    },
    bestFor: ['hot_blooded_action', 'xianxia_fantasy', 'scifi_post_apocalypse'],
  },
  {
    mode: 'universal_first_last',
    name: 'Universal · First-and-Last-Frame Mode',
    template: `Transform from [first_frame: {{firstFrame}}] to [last_frame: {{lastFrame}}]. {{action}}. Style: {{style}}. Motion: {{motion}}.`,
    defaults: {
      motion: 'natural morphing',
      duration: 4,
    },
    bestFor: ['sweet_romance_novel', 'family_warmth', 'coming_of_age'],
  },
  {
    mode: 'universal_multi_param',
    name: 'Universal · Multi-parameter Mode',
    template: `{{style}} shot. Action: {{action}}. Subject: {{subject}}. Camera: {{camera}}. Lighting: {{lighting}}. Duration: {{duration}}s.`,
    defaults: {
      camera: 'eye level, static',
      duration: 5,
    },
    bestFor: ['urban_workplace_drama', 'psychological_drama'],
  },
  {
    mode: 'wan26_single_first',
    name: 'Wan 2.6 · Single-image First-Frame Mode',
    template: `Animate from this image: {{firstFrame}}. {{action}}. Maintain character appearance and scene composition. {{style}}.`,
    defaults: {
      duration: 4,
    },
    bestFor: ['character_intro', 'scene_establishing', 'all'],
  },
];

export function getVideoPrompt(mode: VideoPromptMode): VideoPromptTemplate | undefined {
  return VIDEO_PROMPTS.find((p) => p.mode === mode);
}

/** 把模板和变量拼成最终 prompt（缺失的占位符用 defaults 兜底） */
export function renderVideoPrompt(
  mode: VideoPromptMode,
  vars: Record<string, string | number>
): string {
  const tpl = getVideoPrompt(mode);
  if (!tpl) throw new Error(`Unknown video prompt mode: ${mode}`);
  let out = tpl.template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, String(v));
  }
  // 残留占位符用 defaults 替换
  out = out.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const def = (tpl.defaults as Record<string, unknown>)[key];
    return def !== undefined ? String(def) : '';
  });
  return out;
}
