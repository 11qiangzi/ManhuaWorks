/**
 * 语音合成工作流（tts）
 * 4 家预置 TTS：edge-tts / volcengine / aliyun / elevenlabs
 * 通过 ai-router 统一调用，避免在 workflow-engine 里直接对接 4 套 SDK
 *
 * DAG:
 *   [select_voice] ─┐
 *   [chunk_text] ───┼─→ [call_ai_router] ─→ [merge_audios]
 */

import axios from 'axios';
import { runDAG, type WorkflowNode, type DAGResult } from '../orchestrator/dag.js';
import { saveSnapshot } from '../orchestrator/checkpoint.js';
import { withRetry } from '../orchestrator/retry.js';
import { config } from '../config.js';

export type TTSProvider = 'edge-tts' | 'volcengine' | 'aliyun' | 'elevenlabs';

export interface TTSInput {
  text: string;
  provider: TTSProvider;
  voiceId?: string;
  /** 语速 0.5-2.0 */
  rate?: number;
  /** 音调 0.5-2.0 */
  pitch?: number;
  /** 情绪 */
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited';
  /** 输出格式 */
  format?: 'mp3' | 'wav' | 'ogg';
}

export interface TTSOutput {
  audioUrl: string;
  provider: TTSProvider;
  durationSec: number;
  text: string;
}

interface VoiceInfo {
  defaultVoice: string;
  supportedEmotions: string[];
  maxTextLen: number;
}

const PROVIDER_INFO: Record<TTSProvider, VoiceInfo> = {
  'edge-tts': {
    defaultVoice: 'zh-CN-XiaoxiaoNeural',
    supportedEmotions: ['neutral', 'happy', 'sad', 'angry'],
    maxTextLen: 10_000,
  },
  volcengine: {
    defaultVoice: 'BV001_streaming',
    supportedEmotions: ['neutral', 'happy', 'sad', 'angry', 'excited'],
    maxTextLen: 5_000,
  },
  aliyun: {
    defaultVoice: 'zhitian_emo',
    supportedEmotions: ['neutral', 'happy', 'sad', 'angry'],
    maxTextLen: 5_000,
  },
  elevenlabs: {
    defaultVoice: 'pNInz6obpgDQGcFmaJgB', // Adam
    supportedEmotions: ['neutral', 'happy', 'sad', 'angry', 'excited'],
    maxTextLen: 20_000,
  },
};

async function selectVoice(
  input: TTSInput,
  _ctx: unknown
): Promise<{ voiceId: string; provider: TTSProvider }> {
  return withRetry(async () => {
    const info = PROVIDER_INFO[input.provider];
    if (!info) throw new Error(`Unknown TTS provider: ${input.provider}`);
    return { voiceId: input.voiceId ?? info.defaultVoice, provider: input.provider };
  });
}

async function chunkText(
  input: TTSInput,
  _ctx: unknown
): Promise<{ chunks: string[] }> {
  return withRetry(async () => {
    const info = PROVIDER_INFO[input.provider];
    const maxLen = info.maxTextLen;
    const chunks: string[] = [];
    let cur = '';
    // 按标点切
    const sentences = input.text.split(/(?<=[。！？!?\n])/g);
    for (const s of sentences) {
      if ((cur + s).length > maxLen) {
        if (cur) chunks.push(cur);
        cur = s;
      } else {
        cur += s;
      }
    }
    if (cur) chunks.push(cur);
    if (chunks.length === 0) chunks.push(input.text);
    return { chunks };
  });
}

async function callAiRouter(
  input: TTSInput,
  ctx: Record<string, unknown>
): Promise<{ audioUrls: string[] }> {
  return withRetry(async () => {
    const { chunks } = ctx['chunk_text'] as { chunks: string[] };
    const { voiceId } = ctx['select_voice'] as { voiceId: string };
    // 并行调 N 个 chunk
    const res = await Promise.all(
      chunks.map((c) =>
        axios.post(
          `${config.aiRouter.url}/v1/tts/synthesize`,
          {
            provider: input.provider,
            text: c,
            voiceId,
            rate: input.rate ?? 1.0,
            pitch: input.pitch ?? 1.0,
            emotion: input.emotion ?? 'neutral',
            format: input.format ?? 'mp3',
          },
          { timeout: config.aiRouter.timeoutMs }
        )
      )
    );
    const urls = res.map((r) => (r.data as { audioUrl: string }).audioUrl);
    return { audioUrls: urls };
  });
}

async function mergeAudios(
  input: TTSInput,
  ctx: Record<string, unknown>
): Promise<TTSOutput> {
  return withRetry(async () => {
    const { audioUrls } = ctx['call_ai_router'] as { audioUrls: string[] };
    if (audioUrls.length === 0) throw new Error('No audio generated');
    // 单段直接返回；多段需要 merge（demo：返回 first）
    const audioUrl = audioUrls[0]!;
    // 粗略估算：中文 4 字/秒
    const durationSec = Math.max(1, Math.round(input.text.length / 4));
    return {
      audioUrl,
      provider: input.provider,
      durationSec,
      text: input.text,
    };
  });
}

export async function runTTSWorkflow(
  runId: string,
  input: TTSInput
): Promise<DAGResult> {
  await saveSnapshot({
    runId,
    workflow: 'tts',
    status: 'running',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: {},
    inputs: input as unknown as Record<string, unknown>,
  });

  const nodes: WorkflowNode[] = [
    { id: 'select_voice', name: '选声纹', run: async () => selectVoice(input, {}), timeoutMs: 10_000 },
    { id: 'chunk_text', name: '文本切片', run: async () => chunkText(input, {}), timeoutMs: 10_000 },
    { id: 'call_ai_router', name: '调 TTS', dependsOn: ['select_voice', 'chunk_text'], run: async (ctx) => callAiRouter(input, ctx as Record<string, unknown>), timeoutMs: 120_000 },
    { id: 'merge_audios', name: '合并音频', dependsOn: ['call_ai_router'], run: async (ctx) => mergeAudios(input, ctx as Record<string, unknown>), timeoutMs: 30_000 },
  ];

  const result = await runDAG(runId, nodes, { maxParallel: 2 });
  await saveSnapshot({
    runId,
    workflow: 'tts',
    status: result.success ? 'success' : 'failed',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: result.statuses as never,
    inputs: input as unknown as Record<string, unknown>,
  });
  return result;
}

export { PROVIDER_INFO };
