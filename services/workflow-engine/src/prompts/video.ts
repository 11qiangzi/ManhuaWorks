/**
 * 视频 prompt 模板（4 套：电影感 / 动漫感 / 动作 / 慢镜头）
 *
 * 与 assets/prompts.ts 不同：assets/prompts.ts 是按生成模式（first-last / multi-param）
 * 划分的；这里是按视觉风格 + 节奏划分的。
 *
 * 用法：renderVideoPrompt() 把变量插值 → 喂给 video-gen 节点 → ai-router
 */

export type VideoStyle = 'cinematic' | 'anime' | 'action' | 'slow_motion';

export interface VideoPromptTemplate {
  style: VideoStyle;
  name: string;
  nameZh: string;
  prefix: string;
  suffix: string;
  /** 默认相机运动 */
  defaultCamera: string;
  /** 默认时长（秒） */
  defaultDuration: number;
  /** 默认 motion strength 0-1 */
  defaultMotion: number;
  /** 推荐 fps */
  defaultFps: number;
  /** 适合的故事类型 */
  compatibleStoryTypes: string[];
  /** 风格与动作冲突提示（用于回退） */
  fallbackStyle?: VideoStyle;
}

export const VIDEO_STYLES: Record<VideoStyle, VideoPromptTemplate> = {
  cinematic: {
    style: 'cinematic',
    name: 'Cinematic',
    nameZh: '电影感',
    prefix: 'cinematic shot, film grain, anamorphic lens, professional cinematography,',
    suffix: 'color graded, 24fps, shallow depth of field, blockbuster quality, masterpiece',
    defaultCamera: 'slow dolly or steadicam, motivated by subject motion',
    defaultDuration: 5,
    defaultMotion: 0.5,
    defaultFps: 24,
    compatibleStoryTypes: ['urban_workplace_drama', 'psychological_drama', 'mystery_thriller'],
  },
  anime: {
    style: 'anime',
    name: 'Anime',
    nameZh: '动漫感',
    prefix: 'anime style animation, cel shaded, vibrant colors, hand-drawn feel,',
    suffix: 'anime production quality, key frames, in-betweens, dynamic composition, sakuga style',
    defaultCamera: 'pan, zoom, or rotation matching the action',
    defaultDuration: 4,
    defaultMotion: 0.7,
    defaultFps: 24,
    compatibleStoryTypes: ['xianxia_fantasy', 'sweet_romance_novel', 'comedy_humor'],
  },
  action: {
    style: 'action',
    name: 'Action',
    nameZh: '动作',
    prefix: 'high-octane action, dynamic camera, motion blur, impact frames,',
    suffix: 'speed ramps, smash cuts, kinetic energy, adrenaline, hollywood stunt quality',
    defaultCamera: 'whip pan, crash zoom, hand-held, or fast dolly',
    defaultDuration: 3,
    defaultMotion: 0.95,
    defaultFps: 30,
    compatibleStoryTypes: ['hot_blooded_action', 'scifi_post_apocalypse', 'xianxia_fantasy'],
    fallbackStyle: 'cinematic',
  },
  slow_motion: {
    style: 'slow_motion',
    name: 'Slow Motion',
    nameZh: '慢镜头',
    prefix: 'slow motion shot, high frame rate capture, super detailed,',
    suffix: 'time stretching, fluid dynamics, particle effects, dreamlike, emotional peak',
    defaultCamera: 'locked or slowly orbiting around subject',
    defaultDuration: 4,
    defaultMotion: 0.3,
    defaultFps: 60,
    compatibleStoryTypes: ['family_warmth', 'sweet_romance_novel', 'psychological_drama', 'horror_supernatural'],
  },
};

export function getVideoStyle(style: VideoStyle): VideoPromptTemplate {
  return VIDEO_STYLES[style];
}

/** 从 storyType + shot 关键词自动推荐 */
export function recommendVideoStyle(storyType: string, hint?: string): VideoStyle {
  const h = (hint ?? '').toLowerCase();
  if (h.includes('slow') || h.includes('emotional') || h.includes('peak') || h.includes('reveal')) return 'slow_motion';
  if (h.includes('action') || h.includes('fight') || h.includes('battle') || h.includes('chase') || h.includes('impact')) return 'action';
  if (h.includes('anime') || h.includes('cute') || h.includes('magic')) return 'anime';
  for (const tpl of Object.values(VIDEO_STYLES)) {
    if (tpl.compatibleStoryTypes.includes(storyType)) return tpl.style;
  }
  return 'cinematic';
}

/** 渲染最终 prompt */
export function renderVideoPrompt(
  style: VideoStyle,
  vars: {
    subject: string;
    action: string;
    location: string;
    mood?: string;
    camera?: string;
    duration?: number;
  }
): string {
  const tpl = VIDEO_STYLES[style];
  const cam = vars.camera ?? tpl.defaultCamera;
  const dur = vars.duration ?? tpl.defaultDuration;
  const moodPart = vars.mood ? `, ${vars.mood} mood` : '';
  return [
    tpl.prefix,
    `${vars.subject} ${vars.action} at ${vars.location}${moodPart},`,
    `Camera: ${cam},`,
    `Duration: ${dur}s,`,
    `Motion strength: ${tpl.defaultMotion},`,
    tpl.suffix,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
