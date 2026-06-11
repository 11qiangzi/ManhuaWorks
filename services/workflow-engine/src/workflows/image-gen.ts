/**
 * 图像生成工作流（image-gen）
 * 流程：sceneDesign + 风格资产 + 角色卡 → 调 ai-router 出图
 *
 * DAG:
 *   [build_prompt] ─→ [call_ai_router] ─→ [upload] ─→ [validate]
 */

import axios from 'axios';
import { runDAG, type WorkflowNode, type DAGResult } from '../orchestrator/dag.js';
import { saveSnapshot } from '../orchestrator/checkpoint.js';
import { withRetry } from '../orchestrator/retry.js';
import { config } from '../config.js';
import { getArtStyle } from '../assets/art-styles.js';
import type { SceneDesign } from './scene.js';
import type { CharacterProfile } from './character.js';

export interface ImageGenInput {
  sceneDesign: SceneDesign;
  artStyle: string;
  characters: CharacterProfile[];
  /** 比例 1:1 / 16:9 / 9:16 */
  aspectRatio?: '1:1' | '16:9' | '9:16' | '3:2' | '2:3';
  /** 几张候选 */
  numImages?: number;
  /** 是否要锁脸引用 */
  useCharacterReference?: boolean;
}

export interface ImageGenOutput {
  shotId: string;
  imageUrls: string[];
  prompt: string;
  styleId: string;
  durationMs: number;
}

async function buildPrompt(
  input: ImageGenInput,
  _ctx: unknown
): Promise<{ finalPrompt: string }> {
  return withRetry(async () => {
    const style = getArtStyle(input.artStyle);
    const prefix = style?.prefixPrompt ?? '';
    const charRef = input.useCharacterReference && input.characters.length > 0
      ? input.characters.map((c) => c.name).join(', ') + ', '
      : '';
    const finalPrompt = `${prefix}${charRef}${input.sceneDesign.imagePrompt}`;
    return { finalPrompt };
  });
}

async function callAiRouter(
  input: ImageGenInput,
  ctx: Record<string, unknown>
): Promise<{ imageUrls: string[] }> {
  return withRetry(async () => {
    const { finalPrompt } = ctx['build_prompt'] as { finalPrompt: string };
    const res = await axios.post(
      `${config.aiRouter.url}/v1/image/generate`,
      {
        prompt: finalPrompt,
        negativePrompt: 'blurry, low quality, deformed, extra fingers, watermark, text',
        width: input.aspectRatio === '16:9' ? 1280 : input.aspectRatio === '9:16' ? 720 : 1024,
        height: input.aspectRatio === '16:9' ? 720 : input.aspectRatio === '9:16' ? 1280 : 1024,
        numImages: input.numImages ?? 1,
        style: input.artStyle,
        characterReferences: input.useCharacterReference
          ? input.characters.filter((c) => c.faceImageUrl).map((c) => c.faceImageUrl!)
          : [],
      },
      { timeout: config.aiRouter.timeoutMs }
    );
    const data = res.data as { images?: { url: string }[] };
    const urls = (data.images ?? []).map((i) => i.url);
    if (urls.length === 0) throw new Error('AI router returned no images');
    return { imageUrls: urls };
  });
}

/** 节点 3：上传到对象存储（demo：跳过，直接返回原 URL） */
async function uploadImages(
  input: ImageGenInput,
  ctx: Record<string, unknown>
): Promise<{ storedUrls: string[] }> {
  return withRetry(async () => {
    const { imageUrls } = ctx['call_ai_router'] as { imageUrls: string[] };
    // TODO: 上传到 OSS / S3
    return { storedUrls: imageUrls };
  });
}

async function validate(
  input: ImageGenInput,
  ctx: Record<string, unknown>
): Promise<ImageGenOutput> {
  const { finalPrompt } = ctx['build_prompt'] as { finalPrompt: string };
  const { storedUrls } = ctx['upload_images'] as { storedUrls: string[] };
  if (storedUrls.length === 0) throw new Error('No images after upload');
  return {
    shotId: input.sceneDesign.shotId,
    imageUrls: storedUrls,
    prompt: finalPrompt,
    styleId: input.artStyle,
    durationMs: 0, // 真实场景由 call_ai_router 内部计时
  };
}

export async function runImageGenWorkflow(
  runId: string,
  input: ImageGenInput
): Promise<DAGResult> {
  await saveSnapshot({
    runId,
    workflow: 'image-gen',
    status: 'running',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: {},
    inputs: input as unknown as Record<string, unknown>,
  });

  const nodes: WorkflowNode[] = [
    { id: 'build_prompt', name: '组装 prompt', run: async () => buildPrompt(input, {}), timeoutMs: 30_000 },
    { id: 'call_ai_router', name: '调 ai-router', dependsOn: ['build_prompt'], run: async (ctx) => callAiRouter(input, ctx as Record<string, unknown>), timeoutMs: 300_000 },
    { id: 'upload_images', name: '上传存储', dependsOn: ['call_ai_router'], run: async (ctx) => uploadImages(input, ctx as Record<string, unknown>), timeoutMs: 60_000 },
    { id: 'validate', name: '校验', dependsOn: ['upload_images'], run: async (ctx) => validate(input, ctx as Record<string, unknown>), timeoutMs: 10_000 },
  ];

  const result = await runDAG(runId, nodes, { maxParallel: 1, failFast: true });
  await saveSnapshot({
    runId,
    workflow: 'image-gen',
    status: result.success ? 'success' : 'failed',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: result.statuses as never,
    inputs: input as unknown as Record<string, unknown>,
  });
  return result;
}
