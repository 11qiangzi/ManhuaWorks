/**
 * 12 语言预设（presets/languages.ts）
 *
 * 应用场景：
 *   - auto-translate 目标语种
 *   - TTS 配音语种
 *   - 字幕烧录
 *   - 双语字幕（primary + secondary 拼写）
 */

export type LanguageKey =
  | "en"
  | "ja"
  | "ko"
  | "fr"
  | "de"
  | "es"
  | "ru"
  | "ar"
  | "hi"
  | "pt"
  | "it"
  | "zh-TW";

/** 12 语言 + 标签 + TTS 引擎偏好 */
export interface LanguagePreset {
  key: LanguageKey;
  /** ISO 639-1/639-3（与 ai-helper / volcengine tts 对齐） */
  iso: string;
  /** 中文显示名 */
  label: string;
  /** 英文 / 母语显示名 */
  nativeName: string;
  /** 是否需要额外 font（字幕烧录） */
  needsSpecialFont: boolean;
  /** 推荐字体（subtitle 烧录用） */
  recommendedFont: string;
  /** 推荐 TTS 供应商（按质量排序） */
  recommendedTts: Array<"volcengine" | "aliyun" | "elevenlabs" | "edge-tts">;
  /** TTS 语速（1=原速，0.85=快，1.15=慢） */
  ttsSpeed: number;
  /** TTS 音调（1=原调，0.9=低，1.1=高） */
  ttsPitch: number;
  /** 翻译 prompt 模板（ai-helper translate 用） */
  translateHint: string;
  /** 字幕方向（'ltr' / 'rtl'，阿拉伯语特殊） */
  textDirection: "ltr" | "rtl";
  /** 单字平均成本系数（相对值，1.0 = 英文基线） */
  costMultiplier: number;
  /** 翻译+配音平均时延系数（1.0 = 英文基线） */
  speedMultiplier: number;
}

export const LANGUAGE_PRESETS: Record<LanguageKey, LanguagePreset> = {
  en: {
    key: "en",
    iso: "en-US",
    label: "英语",
    nativeName: "English",
    needsSpecialFont: false,
    recommendedFont: "NotoSans",
    recommendedTts: ["volcengine", "elevenlabs", "edge-tts", "aliyun"],
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
    translateHint: "Translate to natural conversational English, suitable for video dubbing.",
    textDirection: "ltr",
    costMultiplier: 1.0,
    speedMultiplier: 1.0,
  },
  ja: {
    key: "ja",
    iso: "ja-JP",
    label: "日语",
    nativeName: "日本語",
    needsSpecialFont: false,
    recommendedFont: "NotoSansJP",
    recommendedTts: ["volcengine", "elevenlabs", "aliyun", "edge-tts"],
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
    translateHint: "Translate to natural anime-style Japanese, polite form (です/ます) for narration.",
    textDirection: "ltr",
    costMultiplier: 1.05,
    speedMultiplier: 1.05,
  },
  ko: {
    key: "ko",
    iso: "ko-KR",
    label: "韩语",
    nativeName: "한국어",
    needsSpecialFont: false,
    recommendedFont: "NotoSansKR",
    recommendedTts: ["volcengine", "aliyun", "elevenlabs", "edge-tts"],
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
    translateHint: "Translate to natural Korean (한국어), polite speech form for drama narration.",
    textDirection: "ltr",
    costMultiplier: 1.05,
    speedMultiplier: 1.05,
  },
  fr: {
    key: "fr",
    iso: "fr-FR",
    label: "法语",
    nativeName: "Français",
    needsSpecialFont: false,
    recommendedFont: "NotoSans",
    recommendedTts: ["elevenlabs", "volcengine", "aliyun", "edge-tts"],
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
    translateHint: "Traduire en français naturel et conversationnel, adapté au doublage vidéo.",
    textDirection: "ltr",
    costMultiplier: 1.1,
    speedMultiplier: 1.1,
  },
  de: {
    key: "de",
    iso: "de-DE",
    label: "德语",
    nativeName: "Deutsch",
    needsSpecialFont: false,
    recommendedFont: "NotoSans",
    recommendedTts: ["elevenlabs", "volcengine", "aliyun", "edge-tts"],
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
    translateHint: "Ins Deutsche übersetzen, natürlich und gesprächstauglich für Synchronisation.",
    textDirection: "ltr",
    costMultiplier: 1.1,
    speedMultiplier: 1.1,
  },
  es: {
    key: "es",
    iso: "es-ES",
    label: "西班牙语",
    nativeName: "Español",
    needsSpecialFont: false,
    recommendedFont: "NotoSans",
    recommendedTts: ["volcengine", "elevenlabs", "aliyun", "edge-tts"],
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
    translateHint: "Traducir al español natural y conversacional, adecuado para doblaje de video.",
    textDirection: "ltr",
    costMultiplier: 1.05,
    speedMultiplier: 1.05,
  },
  ru: {
    key: "ru",
    iso: "ru-RU",
    label: "俄语",
    nativeName: "Русский",
    needsSpecialFont: true,
    recommendedFont: "NotoSans",
    recommendedTts: ["elevenlabs", "volcengine", "aliyun", "edge-tts"],
    ttsSpeed: 0.95,
    ttsPitch: 1.0,
    translateHint: "Переведите на естественный разговорный русский язык, подходящий для озвучки видео.",
    textDirection: "ltr",
    costMultiplier: 1.15,
    speedMultiplier: 1.15,
  },
  ar: {
    key: "ar",
    iso: "ar-SA",
    label: "阿拉伯语",
    nativeName: "العربية",
    needsSpecialFont: true,
    recommendedFont: "NotoSansArabic",
    recommendedTts: ["elevenlabs", "volcengine", "aliyun"],
    ttsSpeed: 0.95,
    ttsPitch: 1.0,
    translateHint: "ترجم إلى اللغة العربية الطبيعية، مناسبة لترجمة الفيديو.",
    textDirection: "rtl",
    costMultiplier: 1.2,
    speedMultiplier: 1.25,
  },
  hi: {
    key: "hi",
    iso: "hi-IN",
    label: "印地语",
    nativeName: "हिन्दी",
    needsSpecialFont: true,
    recommendedFont: "NotoSansDevanagari",
    recommendedTts: ["elevenlabs", "volcengine", "aliyun"],
    ttsSpeed: 0.95,
    ttsPitch: 1.0,
    translateHint: "Translate to natural Hindi, suitable for video dubbing.",
    textDirection: "ltr",
    costMultiplier: 1.1,
    speedMultiplier: 1.15,
  },
  pt: {
    key: "pt",
    iso: "pt-BR",
    label: "葡萄牙语",
    nativeName: "Português",
    needsSpecialFont: false,
    recommendedFont: "NotoSans",
    recommendedTts: ["elevenlabs", "volcengine", "aliyun", "edge-tts"],
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
    translateHint: "Traduza para português natural e conversacional, adequado para dublagem de vídeo.",
    textDirection: "ltr",
    costMultiplier: 1.05,
    speedMultiplier: 1.05,
  },
  it: {
    key: "it",
    iso: "it-IT",
    label: "意大利语",
    nativeName: "Italiano",
    needsSpecialFont: false,
    recommendedFont: "NotoSans",
    recommendedTts: ["elevenlabs", "volcengine", "aliyun", "edge-tts"],
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
    translateHint: "Traduci in italiano naturale e colloquiale, adatto al doppiaggio video.",
    textDirection: "ltr",
    costMultiplier: 1.05,
    speedMultiplier: 1.05,
  },
  "zh-TW": {
    key: "zh-TW",
    iso: "zh-TW",
    label: "繁体中文",
    nativeName: "繁體中文",
    needsSpecialFont: false,
    recommendedFont: "NotoSansTC",
    recommendedTts: ["volcengine", "aliyun", "elevenlabs"],
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
    translateHint: "翻譯成自然道地的繁體中文，適合影片配音使用。",
    textDirection: "ltr",
    costMultiplier: 0.9,
    speedMultiplier: 0.9,
  },
};

/** 12 语言顺序（UI 列表 / 性能基准用） */
export const LANGUAGE_KEYS: LanguageKey[] = [
  "en",
  "ja",
  "ko",
  "fr",
  "de",
  "es",
  "ru",
  "ar",
  "hi",
  "pt",
  "it",
  "zh-TW",
];

/** 选语言 */
export function pickLanguagePreset(k: LanguageKey): LanguagePreset {
  return LANGUAGE_PRESETS[k];
}

/** 列表用 */
export function listLanguagePresets(): LanguagePreset[] {
  return LANGUAGE_KEYS.map((k) => LANGUAGE_PRESETS[k]);
}

/** 字幕烧录：根据语种选字体 */
export function pickSubtitleFont(k: LanguageKey): string {
  return LANGUAGE_PRESETS[k].recommendedFont;
}

/** 是否 RTL（影响字幕渲染） */
export function isRtl(k: LanguageKey): boolean {
  return LANGUAGE_PRESETS[k].textDirection === "rtl";
}

/** 双语字幕：拼接 primary + secondary */
export function buildBilingualSrt(
  primary: Array<{ index: number; start: string; end: string; text: string }>,
  secondary: Array<{ text: string }>,
  primaryLang: LanguageKey,
  secondaryLang: LanguageKey,
): string {
  const p = pickLanguagePreset(primaryLang);
  const s = pickLanguagePreset(secondaryLang);
  return primary
    .map((line, i) => {
      const sec = secondary[i]?.text ?? "";
      return `${line.index}\n${line.start} --> ${line.end}\n${line.text}\n${sec}\n(${p.label} / ${s.label})`;
    })
    .join("\n\n");
}
