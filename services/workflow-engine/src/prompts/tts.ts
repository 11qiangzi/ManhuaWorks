/**
 * TTS 情绪 prompt 模板（5 套：平静 / 激昂 / 悲伤 / 悬疑 / 欢快）
 *
 * 喂给 TTS 引擎的 SSML / 风格标签 / 参数
 *
 * 设计原则：
 *   - 用 (provider, styleId) 表达风格，因为不同 TTS 引擎（豆包/微软/火山）style 命名不一样
 *   - 给出推荐：speechRate / pitch / volume / emotion intensity
 *   - 给出 SSML <break> / <prosody> 片段，引擎不支持就静默忽略
 */

export type TTSEmotion = 'calm' | 'excited' | 'sad' | 'mystery' | 'cheerful';

export interface TTSEmotionTemplate {
  emotion: TTSEmotion;
  name: string;
  nameZh: string;
  /** 豆包 / ByteDance TTS style */
  doubaoStyle: string;
  /** 微软 Azure TTS style */
  azureStyle: string;
  /** 火山引擎 TTS emotion */
  volcengineEmotion: string;
  /** 推荐语速 0.5 - 2.0 */
  rate: number;
  /** 推荐 pitch -12 - 12 (semitones) */
  pitch: number;
  /** 推荐音量 0-1 */
  volume: number;
  /** 情绪强度 0-1 */
  intensity: number;
  /** SSML 包裹（部分引擎） */
  ssmlWrap: (text: string) => string;
  /** 适合的故事类型 */
  compatibleStoryTypes: string[];
}

const breakTag = (ms: number): string => `<break time="${ms}ms"/>`;
const prosody = (text: string, rate: string, pitch: string, vol: string): string =>
  `<prosody rate="${rate}" pitch="${pitch}" volume="${vol}">${text}</prosody>`;

export const TTS_EMOTIONS: Record<TTSEmotion, TTSEmotionTemplate> = {
  calm: {
    emotion: 'calm',
    name: 'Calm',
    nameZh: '平静',
    doubaoStyle: 'neutral',
    azureStyle: 'calm',
    volcengineEmotion: 'neutral',
    rate: 1.0,
    pitch: 0,
    volume: 0.85,
    intensity: 0.3,
    ssmlWrap: (t) => prosody(t, '0%', '+0st', '+0dB'),
    compatibleStoryTypes: ['family_warmth', 'coming_of_age', 'psychological_drama'],
  },
  excited: {
    emotion: 'excited',
    name: 'Excited',
    nameZh: '激昂',
    doubaoStyle: 'excited',
    azureStyle: 'excited',
    volcengineEmotion: 'angry',
    rate: 1.15,
    pitch: 2,
    volume: 1.0,
    intensity: 0.9,
    ssmlWrap: (t) => `${breakTag(80)}${prosody(t, '+15%', '+2st', '+3dB')}${breakTag(120)}`,
    compatibleStoryTypes: ['hot_blooded_action', 'xianxia_fantasy', 'scifi_post_apocalypse'],
  },
  sad: {
    emotion: 'sad',
    name: 'Sad',
    nameZh: '悲伤',
    doubaoStyle: 'sad',
    azureStyle: 'sad',
    volcengineEmotion: 'sad',
    rate: 0.85,
    pitch: -2,
    volume: 0.7,
    intensity: 0.7,
    ssmlWrap: (t) => `${breakTag(200)}${prosody(t, '-15%', '-2st', '-2dB')}${breakTag(300)}`,
    compatibleStoryTypes: ['family_warmth', 'psychological_drama', 'sweet_romance_novel'],
  },
  mystery: {
    emotion: 'mystery',
    name: 'Mystery',
    nameZh: '悬疑',
    doubaoStyle: 'whisper',
    azureStyle: 'terrified',
    volcengineEmotion: 'surprised',
    rate: 0.9,
    pitch: -1,
    volume: 0.75,
    intensity: 0.6,
    ssmlWrap: (t) => `${breakTag(150)}${prosody(t, '-10%', '-1st', '-1dB')}${breakTag(180)}`,
    compatibleStoryTypes: ['mystery_thriller', 'horror_supernatural'],
  },
  cheerful: {
    emotion: 'cheerful',
    name: 'Cheerful',
    nameZh: '欢快',
    doubaoStyle: 'cheerful',
    azureStyle: 'cheerful',
    volcengineEmotion: 'happy',
    rate: 1.08,
    pitch: 1,
    volume: 0.9,
    intensity: 0.7,
    ssmlWrap: (t) => `${breakTag(60)}${prosody(t, '+8%', '+1st', '+1dB')}${breakTag(60)}`,
    compatibleStoryTypes: ['comedy_humor', 'sweet_romance_novel', 'family_warmth'],
  },
};

export function getTTSEmotion(emotion: TTSEmotion): TTSEmotionTemplate {
  return TTS_EMOTIONS[emotion];
}

/** 根据 storyType + shot mood 自动推荐 */
export function recommendEmotion(storyType: string, hint?: string): TTSEmotion {
  if (hint) {
    const h = hint.toLowerCase();
    if (h.includes('angry') || h.includes('excited') || h.includes('fury')) return 'excited';
    if (h.includes('sad') || h.includes('cry') || h.includes('tear')) return 'sad';
    if (h.includes('happy') || h.includes('smile') || h.includes('laugh')) return 'cheerful';
    if (h.includes('dark') || h.includes('mystery') || h.includes('suspense')) return 'mystery';
  }
  for (const tpl of Object.values(TTS_EMOTIONS)) {
    if (tpl.compatibleStoryTypes.includes(storyType)) return tpl.emotion;
  }
  return 'calm';
}
