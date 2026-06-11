/**
 * 视频生成工作流（video-gen）
 * 流程：shot 描述 + 风格 → 选 mode → 组 prompt → 调 ai-router 视频接口
 *
 * DAG:
 *   [select_mode] ─┐
 *   [build_prompt] ┴─→ [call_ai_router] ─→ [extract_frame]
 */

import axios from 'axios';
import { runDAG, type WorkflowNode, type DAGResult } from '../orchestrator/dag.js';
import { saveSnapshot } from '../orchestrator/checkpoint.js';
import { withRetry } from '../orchestrator/retry.js';
import { config } from '../config.js';
import { getVideoPrompt, renderVideoPrompt, type VideoPromptMode } from '../assets/prompts.js';
import { getArtStyle } from '../assets/art-styles.js';
import type { SceneDesign } from './scene.js';

export interface VideoGenInput {
  sceneDesign: SceneDesign;
  artStyle: string;
  /** 视频模式：4 选 1 */
  mode?: VideoPromptMode;
  /** 第一帧图 URL（首尾帧模式必需） */
  firstFrameUrl?: string;
  /** 尾帧图 URL（首尾帧模式可选） */
  lastFrameUrl?: string;
  /** 视频秒数（4-10） */
  durationSec?: number;
  /** 比例 */
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface VideoGenOutput {
  shotId: string;
  videoUrl: string;
  mode: VideoPromptMode;
  prompt: string;
  durationSec: number;
}

async function selectMode(
  input: VideoGenInput,
  _ctx: unknown
): Promise<{ mode: VideoPromptMode }> {
  return withRetry(async () => {
    // 智能选择：首尾帧都有 → universal_first_last
    // 只有首帧 → wan26_single_first
    // 都没有 → seedance2 multi-param
    let mode = input.mode;
    if (!mode) {
      if (input.firstFrameUrl && input.lastFrameUrl) mode = 'universal_first_last';
      else if (input.firstFrameUrl) mode = 'wan26_single_first';
      else mode = 'seedance2_multi_param';
    }
    const tpl = getVideoPrompt(mode);
    if (!tpl) throw new Error(`Unknown video mode: ${mode}`);
    return { mode };
  });
}

async function buildPrompt(
  input: VideoGenInput,
  ctx: Record<string, unknown>
): Promise<{ prompt: string }> {
  return withRetry(async () => {
    const { mode } = ctx['select_mode'] as { mode: VideoPromptMode };
    const style = getArtStyle(input.artStyle);
    const prompt = renderVideoPrompt(mode, {
      style: style?.name ?? input.artStyle,
      action: input.sceneDesign.imagePrompt,
      scene: input.sceneDesign.environment.location,
      camera: input.sceneDesign.composition.shotType,
      mood: input.sceneDesign.mood.emotion,
      duration: input.durationSec ?? 5,
      firstFrame: input.firstFrameUrl ?? '',
      lastFrame: input.lastFrameUrl ?? '',
      subject: '',
      lighting: `${input.sceneDesign.lighting.colorTemp} ${input.sceneDesign.lighting.intensity}`,
    });
    return { prompt };
  });
}

async function callAiRouter(
  input: VideoGenInput,
  ctx: Record<string, unknown>
): Promise<{ videoUrl: string }> {
  return withRetry(async () => {
    const { mode } = ctx['select_mode'] as { mode: VideoPromptMode };
    const { prompt } = ctx['build_prompt'] as { prompt: string };
    const res = await axios.post(
      `${config.aiRouter.url}/v1/video/generate`,
      {
        mode,
        prompt,
        firstFrameUrl: input.firstFrameUrl,
        lastFrameUrl: input.lastFrameUrl,
        durationSec: input.durationSec ?? 5,
        aspectRatio: input.aspectRatio ?? '16:9',
        style: input.artStyle,
      },
      { timeout: config.aiRouter.timeoutMs * 4 } // 视频生成慢
    );
    const url = (res.data as { videoUrl?: string }).videoUrl;
    if (!url) throw new Error('AI router returned no video URL');
    return { videoUrl: url };
  });
}

async function extractFrame(
  input: VideoGenInput,
  ctx: Record<string, unknown>
): Promise<VideoGenOutput> {
  return withRetry(async () => {
    const { videoUrl } = ctx['call_ai_router'] as { videoUrl: string };
    const { mode } = ctx['select_mode'] as { mode: VideoPromptMode };
    const { prompt } = ctx['build_prompt'] as { prompt: string };
    return {
      shotId: input.sceneDesign.shotId,
      videoUrl,
      mode,
      prompt,
      durationSec: input.durationSec ?? 5,
    };
  });
}

export async function runVideoGenWorkflow(
  runId: string,
  input: VideoGenInput
): Promise<DAGResult> {
  await saveSnapshot({
    runId,
    workflow: 'video-gen',
    status: 'running',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: {},
    inputs: input as unknown as Record<string, unknown>,
  });

  const nodes: WorkflowNode[] = [
    { id: 'select_mode', name: '选视频模式', run: async () => selectMode(input, {}), timeoutMs: 10_000 },
    { id: 'build_prompt', name: '组装 prompt', run: async () => buildPrompt(input, { select_mode: { mode: input.mode ?? 'seedance2_multi_param' } }), timeoutMs: 30_000 },
    { id: 'call_ai_router', name: '调视频生成', dependsOn: ['select_mode', 'build_prompt'], run: async (ctx) => callAiRouter(input, ctx as Record<string, unknown>), timeoutMs: 600_000 },
    { id: 'extract_frame', name: '提取首帧', dependsOn: ['call_ai_router'], run: async (ctx) => extractFrame(input, ctx as Record<string, unknown>), timeoutMs: 30_000 },
  ];

  const result = await runDAG(runId, nodes, { maxParallel: 1, failFast: true });
  await saveSnapshot({
    runId,
    workflow: 'video-gen',
    status: result.success ? 'success' : 'failed',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: result.statuses as never,
    inputs: input as unknown as Record<string, unknown>,
  });
  return result;
}
