/**
 * 多语翻译（translate）
 *
 * 用途：把中文漫画剧本/对话翻译为多语种，支持英/日/韩/西
 *
 * 输入：{ text, source, targets: ['en','ja','ko','es'] }
 * 输出：{ translations: { en: { text, srt? }, ja: ..., ko: ..., es: ... } }
 *
 * 关键能力：subtitleExport=true 时，按句号/换行/指定 cue 数自动生成 SRT 字幕。
 */

import { z } from 'zod';
import { callChat, extractJson } from '../llm-client.js';

export const SUPPORTED_LANGS = ['en', 'ja', 'ko', 'es'] as const;
export type TargetLang = (typeof SUPPORTED_LANGS)[number];

export const TranslateInputSchema = z.object({
  /** 原文（中文） */
  text: z.string().min(1).max(50_000),
  /** 源语言（目前仅支持 zh，但保留扩展） */
  source: z.enum(['zh', 'en', 'ja', 'ko', 'es']).default('zh'),
  /** 目标语言列表 */
  targets: z.array(z.enum(SUPPORTED_LANGS)).min(1).max(4),
  /** 翻译模式：dialogue（漫画对话，口语化） / narration（旁白，文学化） / subtitle（字幕，短促） */
  mode: z.enum(['dialogue', 'narration', 'subtitle']).optional(),
  /** 是否同时生成 SRT 字幕（仅在 mode=subtitle 时有意义） */
  subtitleExport: z.boolean().optional(),
  /** 字幕单条最大字符数（默认 42，按主流字幕规范） */
  subtitleMaxChars: z.number().int().min(10).max(80).optional(),
});
export type TranslateInput = z.infer<typeof TranslateInputSchema>;

export interface SrtCue {
  /** 序号 */
  index: number;
  /** "00:00:01,000 --> 00:00:03,500" 格式 */
  timecode: string;
  text: string;
}

export interface TranslationResult {
  lang: TargetLang;
  text: string;
  srt?: string;
  cues?: SrtCue[];
}

export interface TranslateResult {
  source: TranslateInput['source'];
  mode: 'dialogue' | 'narration' | 'subtitle';
  translations: TranslationResult[];
  meta?: Record<string, unknown>;
}

const MODE_GUIDE: Record<NonNullable<TranslateInput['mode']>, string> = {
  dialogue: '口语化、语气词保留（如"啊/吧/嘛"），便于 TTS 朗读；长度可略长于原文。',
  narration: '文学化、书面语，保留原文意境；适合漫画旁白 / 内心独白。',
  subtitle: '短促、清晰、单行 ≤ 指定字符数；适合视频字幕。',
};

const SYSTEM_PREFIX = '【多语翻译】';

/**
 * 多语翻译一次 prompt 拿全，避免 N 次串行调用。
 * LLM 直接返回 JSON 对象，key 是 lang，value 是 { text, srt? }。
 */
const USER_TEMPLATE = (
  text: string,
  targets: TargetLang[],
  mode: NonNullable<TranslateInput['mode']>,
  subtitleExport: boolean,
  subtitleMaxChars: number
) => `
请将以下中文文本翻译为指定语种。

源语言：zh
目标语种：${targets.join(', ')}
翻译模式：${mode}
${MODE_GUIDE[mode]}
${subtitleExport && mode === 'subtitle' ? `字幕：按句号/换行/语气切分，单条 ≤ ${subtitleMaxChars} 字符；同步输出 SRT 格式（timecode 占位 00:00:00,000 --> 00:00:00,000，由后端替换）` : '字幕：否'}

【原文】
"""
${text}
"""

【输出要求】
 1) 仅输出 JSON；
 2) 顶层结构：{ "translations": { "${targets[0]}": { "text": "...", "srt": "..." }, "${targets[1] ?? '_'}": { ... } } }；
 3) 每个目标语种都必须出现，缺一不可；
 4) text 是译文，保留原文换行结构；
 5) srt 仅在 mode=subtitle 且 subtitleExport=true 时输出，标准 SRT 文本（用占位 timecode，正式导出由后端做时间码绑定）；
 6) 专有名词（角色名 / 招式名 / 地点）按目标语种习惯翻译或保留音译，首次出现加注原文。

【开始输出】
`;

function buildSrtFromText(text: string, maxChars: number): { srt: string; cues: SrtCue[] } {
  // 简单切分：按换行 / 句号 / 问号 / 感叹号
  const raw = text
    .split(/(?<=[.!?。！？])\s*|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // 长句二次切分
  const split: string[] = [];
  for (const s of raw) {
    if (Array.from(s).length <= maxChars) {
      split.push(s);
      continue;
    }
    // 按逗号 / 空格 / 短句再次切
    const parts = s.split(/[,，;；]\s*/);
    let buf = '';
    for (const p of parts) {
      if (Array.from(buf + p).length > maxChars && buf) {
        split.push(buf);
        buf = p;
      } else {
        buf = buf ? `${buf}, ${p}` : p;
      }
    }
    if (buf) split.push(buf);
  }

  // 估算每条时长：3.5s 起步 + 每 8 字符 1s，封顶 7s
  const cues: SrtCue[] = [];
  let cursor = 0; // 秒
  split.forEach((line, i) => {
    const chars = Array.from(line).length;
    const dur = Math.min(7, Math.max(2, 2 + chars / 12));
    const start = formatSrtTime(cursor);
    const end = formatSrtTime(cursor + dur);
    cues.push({ index: i + 1, timecode: `${start} --> ${end}`, text: line });
    cursor += dur;
  });

  const srt = cues.map((c) => `${c.index}\n${c.timecode}\n${c.text}\n`).join('\n');
  return { srt, cues };
}

function formatSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec - Math.floor(sec)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}
function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

export async function runTranslate(input: TranslateInput): Promise<TranslateResult> {
  const mode = input.mode ?? 'dialogue';
  const subtitleExport = input.subtitleExport ?? false;
  const subtitleMaxChars = input.subtitleMaxChars ?? 42;

  const system = SYSTEM_PREFIX;
  const user = USER_TEMPLATE(input.text, input.targets, mode, subtitleExport, subtitleMaxChars);

  const res = await callChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { taskTag: 'helper:translate', temperature: 0.4 }
  );

  const parsed = extractJson<{ translations?: Record<string, { text?: string; srt?: string }> }>(
    res.content
  );

  const translations: TranslationResult[] = input.targets.map((lang) => {
    const raw = parsed.translations?.[lang];
    let text = raw?.text ?? '';
    let srt: string | undefined;
    let cues: SrtCue[] | undefined;
    if (subtitleExport && mode === 'subtitle') {
      const out = buildSrtFromText(text, subtitleMaxChars);
      srt = out.srt;
      cues = out.cues;
    }
    return { lang, text, srt, cues };
  });

  return {
    source: input.source,
    mode,
    translations,
    meta: res.meta,
  };
}
