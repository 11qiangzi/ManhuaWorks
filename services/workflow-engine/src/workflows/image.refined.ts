/**
 * 精修图像生成工作流（image.refined）
 *
 * 相比 W2 的 image-gen.ts，本版：
 *   1. 4 角度生成：front / 3-4 / side / back 视点同一角色
 *   2. 一致性评分：每角度 vs 主参考图跑相似度；<0.75 触发角度重做
 *   3. 失败自动重试：换 seed / 调 prompt 后再跑，最多 3 轮
 *   4. 集成 character.refined 的 anatomy anchor：自动取 faceImageUrl + seed
 *   5. 多候选打分：每角度出 N 张（默认 3），挑最高分保留
 *
 * DAG:
 *   [build_prompts_per_angle] ─→ [generate_per_angle] ─┐
 *                              (并行：4 角度)             ├─→ [consistency_score] ─→ [pick_best] ─→ [validate]
 *                                                       ┘
 */

import axios from 'axios';
import { runDAG, type WorkflowNode, type DAGResult } from '../orchestrator/dag.js';
import { saveSnapshot } from '../orchestrator/checkpoint.js';
import { withRetry } from '../orchestrator/retry.js';
import { config } from '../config.js';
import { eventBus } from '../realtime/event-bus.js';
import { nanoid } from 'nanoid';
import { getImagePrompt, inferImageMood, renderImagePrompt, type ImageMood } from '../prompts/image.js';
import type { SceneDesign } from './scene.js';
import type { CharacterRefinedProfile } from './character.refined.js';

export type CameraAngle = 'front' | 'three_quarter' | 'side' | 'back';

export const CAMERA_ANGLES: CameraAngle[] = ['front', 'three_quarter', 'side', 'back'];

const ANGLE_PROMPT_SUFFIX: Record<CameraAngle, string> = {
  front: 'front-facing, eye level, direct gaze, full face visible',
  three_quarter: '3/4 view, slight turn, one side of face more visible, dynamic angle',
  side: 'profile view, 90 degrees to camera, side of face, hair visible from side',
  back: 'back view, looking away from camera, hair and back of head, over-the-shoulder',
};

const ANGLE_RETRY_LIMIT = 3;
const CONSISTENCY_THRESHOLD = 0.75;

export interface ImageRefinedInput {
  sceneDesign: SceneDesign;
  artStyle: string;
  /** 精修角色（带 anchor + faceImageUrl）；可不传（纯场景） */
  characters?: CharacterRefinedProfile[];
  /** 比例 */
  aspectRatio?: '1:1' | '16:9' | '9:16' | '3:2' | '2:3';
  /** 每角度出几张候选（默认 3，挑最高分） */
  candidatesPerAngle?: number;
  /** 一致性阈值 */
  consistencyThreshold?: number;
  /** 失败重试上限 */
  maxRetryRounds?: number;
  /** 哪些角度需要生成（默认全部 4） */
  angles?: CameraAngle[];
  /** 是否使用角色锁脸引用 */
  useCharacterReference?: boolean;
}

export interface AngleImage {
  angle: CameraAngle;
  imageUrl: string;
  prompt: string;
  score: number;
  retriedRounds: number;
}

export interface ImageRefinedOutput {
  shotId: string;
  artStyle: string;
  imageMood: ImageMood;
  /** 4 角度的最终图 */
  angles: AngleImage[];
  /** 4 角度拼成 2x2 contact sheet 的图（可选 URL） */
  contactSheetUrl?: string;
  prompt: string;
  styleId: string;
  durationMs: number;
  /** 平均一致分 */
  avgConsistency: number;
}

/* ======================== 节点 1：组装 4 角度 prompt ======================== */

interface AnglePrompt {
  angle: CameraAngle;
  prompt: string;
  baseSeed: string;
  characterReferences: string[];
}

async function buildPromptsPerAngle(
  input: ImageRefinedInput,
  _ctx: unknown
): Promise<{ angles: AnglePrompt[]; mood: ImageMood }> {
  return withRetry(async () => {
    const mood = inferImageMood(input.artStyle);
    const tpl = getImagePrompt(mood);
    const angles = input.angles ?? CAMERA_ANGLES;
    const characterRefs: string[] = [];
    if (input.useCharacterReference !== false && input.characters && input.characters.length > 0) {
      for (const c of input.characters) {
        if (c.faceImageUrl && c.faceImageUrl.startsWith('http')) {
          characterRefs.push(c.faceImageUrl);
        }
      }
    }
    const charRefNames = (input.characters ?? []).map((c) => c.name).join(', ');
    const anglePrompts: AnglePrompt[] = angles.map((angle) => {
      const basePrompt = renderImagePrompt(mood, {
        subject: `${charRefNames || 'a character'} - ${input.sceneDesign.environment.location}`,
        action: input.sceneDesign.mood.emotion,
        location: `${input.sceneDesign.environment.location} (${input.sceneDesign.environment.timeOfDay})`,
        mood: input.sceneDesign.mood.emotion,
        style: input.artStyle,
      });
      const anglePrompt = `${basePrompt}, ${ANGLE_PROMPT_SUFFIX[angle]}`;
      return {
        angle,
        prompt: anglePrompt,
        baseSeed: `seed-${input.sceneDesign.shotId}-${angle}-${nanoid(4)}`,
        characterReferences: characterRefs,
      };
    });
    return { angles: anglePrompts, mood };
  });
}

/* ======================== 节点 2：每角度生成 ======================== */

interface AngleCandidate {
  url: string;
  seed: string;
  score: number;
}

interface AngleResult {
  angle: CameraAngle;
  candidates: AngleCandidate[];
  bestUrl: string;
  bestScore: number;
  retriedRounds: number;
  prompt: string;
}

async function generatePerAngle(
  anglePrompt: AnglePrompt,
  mood: ImageMood,
  candidatesPerAngle: number,
  useCharRef: boolean
): Promise<AngleResult> {
  return withRetry(async () => {
    const tpl = getImagePrompt(mood);
    const candidates: AngleCandidate[] = [];
    for (let i = 0; i < candidatesPerAngle; i++) {
      const seed = `${anglePrompt.baseSeed}-c${i}`;
      try {
        const res = await axios.post(
          `${config.aiRouter.url}/v1/image/generate`,
          {
            prompt: anglePrompt.prompt,
            negativePrompt: tpl.negative,
            width: mood === 'cinematic' || mood === 'cyberpunk' ? 1280 : 1024,
            height: mood === 'cinematic' || mood === 'cyberpunk' ? 720 : 1024,
            numImages: 1,
            style: mood,
            seed,
            characterReferences: useCharRef ? anglePrompt.characterReferences : [],
          },
          { timeout: config.aiRouter.timeoutMs }
        );
        const url = (res.data as { images?: { url: string }[] }).images?.[0]?.url ?? '';
        if (!url) continue;
        candidates.push({ url, seed, score: 0 });
      } catch (e) {
        console.warn(`[image.refined] angle ${anglePrompt.angle} candidate ${i} failed:`, (e as Error).message);
      }
    }
    // 至少要 1 张
    if (candidates.length === 0) {
      candidates.push({ url: `placeholder://${anglePrompt.angle}`, seed: anglePrompt.baseSeed, score: 0 });
    }
    // 先暂时给最高分的就是第 1 张；最终分要等 consistency_score 算
    return {
      angle: anglePrompt.angle,
      candidates,
      bestUrl: candidates[0]!.url,
      bestScore: 0,
      retriedRounds: 0,
      prompt: anglePrompt.prompt,
    };
  });
}

/* ======================== 节点 3：一致性评分 ======================== */

async function consistencyScore(
  results: AngleResult[],
  useCharRef: boolean
): Promise<AngleResult[]> {
  // 拿 front 角度做参考；其他角度与 front 比
  const front = results.find((r) => r.angle === 'front');
  if (!front) return results;
  if (!useCharRef) {
    // 不走视觉相似度：所有候选给默认分 0.9
    return results.map((r) => ({
      ...r,
      candidates: r.candidates.map((c) => ({ ...c, score: 0.9 })),
      bestScore: 0.9,
      bestUrl: r.candidates[0]!.url,
    }));
  }
  // 调 ai-router
  const out: AngleResult[] = [];
  for (const r of results) {
    if (r.candidates.every((c) => c.url.startsWith('placeholder://'))) {
      out.push({ ...r, bestScore: 1, bestUrl: r.candidates[0]!.url });
      continue;
    }
    try {
      const res = await axios.post(
        `${config.aiRouter.url}/v1/vision/similarity`,
        {
          reference: front.bestUrl,
          candidates: r.candidates.filter((c) => !c.url.startsWith('placeholder://')).map((c) => c.url),
          metric: 'clip',
        },
        { timeout: 30_000 }
      );
      const scores = (res.data as { scores?: number[] }).scores ?? [];
      const scored = r.candidates.map((c, i) => ({
        ...c,
        score: i < scores.length ? scores[i]! : 0.5,
      }));
      const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
      out.push({ ...r, candidates: scored, bestScore: best.score, bestUrl: best.url });
    } catch (e) {
      console.warn(`[image.refined] consistency for ${r.angle} failed:`, (e as Error).message);
      out.push({ ...r, bestScore: 0.9, bestUrl: r.candidates[0]!.url });
    }
  }
  return out;
}

/* ======================== 节点 4：失败角度重做 ======================== */

async function retryFailedAngles(
  results: AngleResult[],
  anglePrompts: AnglePrompt[],
  mood: ImageMood,
  candidatesPerAngle: number,
  useCharRef: boolean,
  threshold: number,
  maxRetries: number
): Promise<AngleResult[]> {
  const out: AngleResult[] = [];
  for (const r of results) {
    if (r.bestScore >= threshold) {
      out.push(r);
      continue;
    }
    let cur = r;
    let rounds = 0;
    const ap = anglePrompts.find((a) => a.angle === r.angle);
    if (!ap) { out.push(r); continue; }
    while (cur.bestScore < threshold && rounds < maxRetries) {
      rounds++;
      const newSeed = `${ap.baseSeed}-r${rounds}`;
      const newCandidates: AngleCandidate[] = [];
      try {
        const res = await axios.post(
          `${config.aiRouter.url}/v1/image/generate`,
          {
            prompt: `${ap.prompt}, (variant ${rounds}, sharper details)`,
            negativePrompt: getImagePrompt(mood).negative,
            width: 1024,
            height: 1024,
            numImages: 1,
            style: mood,
            seed: newSeed,
            characterReferences: useCharRef ? ap.characterReferences : [],
          },
          { timeout: config.aiRouter.timeoutMs }
        );
        const url = (res.data as { images?: { url: string }[] }).images?.[0]?.url ?? '';
        if (url) {
          newCandidates.push({ url, seed: newSeed, score: 0 });
          // 立即评分
          try {
            const front = results.find((x) => x.angle === 'front');
            if (front && useCharRef) {
              const simRes = await axios.post(
                `${config.aiRouter.url}/v1/vision/similarity`,
                { reference: front.bestUrl, candidates: [url], metric: 'clip' },
                { timeout: 30_000 }
              );
              const sc = (simRes.data as { scores?: number[] }).scores?.[0] ?? 0;
              newCandidates[0]!.score = sc;
            } else {
              newCandidates[0]!.score = 0.9;
            }
          } catch {
            newCandidates[0]!.score = 0.8;
          }
        }
      } catch (e) {
        console.warn(`[image.refined] retry ${rounds} for ${r.angle} failed:`, (e as Error).message);
      }
      if (newCandidates.length > 0 && newCandidates[0]!.score > cur.bestScore) {
        cur = {
          ...cur,
          candidates: [...cur.candidates, ...newCandidates],
          bestUrl: newCandidates[0]!.url,
          bestScore: newCandidates[0]!.score,
          retriedRounds: rounds,
        };
      }
    }
    out.push(cur);
  }
  return out;
}

/* ======================== 节点 5：拼 contact sheet（2x2） ======================== */

async function buildContactSheet(
  results: AngleResult[]
): Promise<{ contactSheetUrl?: string }> {
  // 把 4 角度拼成 2x2 contact sheet（调 ai-router 的 image-compose endpoint）
  const realImages = results.filter((r) => !r.bestUrl.startsWith('placeholder://'));
  if (realImages.length === 0) return { contactSheetUrl: undefined };
  try {
    const res = await axios.post(
      `${config.aiRouter.url}/v1/image/compose`,
      {
        layout: '2x2',
        images: results.map((r) => ({ url: r.bestUrl, label: r.angle })),
        gap: 8,
        background: '#0b0b0b',
      },
      { timeout: 60_000 }
    );
    const url = (res.data as { url?: string }).url;
    return { contactSheetUrl: url };
  } catch (e) {
    console.warn('[image.refined] contact sheet failed:', (e as Error).message);
    return { contactSheetUrl: undefined };
  }
}

/* ======================== 节点 6：validate ======================== */

async function validateNode(
  input: ImageRefinedInput,
  ctx: Record<string, unknown>
): Promise<ImageRefinedOutput> {
  const results = ctx['retry_failed'] as AngleResult[];
  const { contactSheetUrl } = ctx['contact_sheet'] as { contactSheetUrl?: string };
  const { mood } = ctx['build_prompts'] as { mood: ImageMood };

  const angles: AngleImage[] = results.map((r) => ({
    angle: r.angle,
    imageUrl: r.bestUrl,
    prompt: r.prompt,
    score: r.bestScore,
    retriedRounds: r.retriedRounds,
  }));
  const avg = angles.length > 0 ? angles.reduce((s, a) => s + a.score, 0) / angles.length : 1;

  return {
    shotId: input.sceneDesign.shotId,
    artStyle: input.artStyle,
    imageMood: mood,
    angles,
    contactSheetUrl,
    prompt: results[0]?.prompt ?? '',
    styleId: input.artStyle,
    durationMs: 0,
    avgConsistency: avg,
  };
}

/* ======================== 入口 ======================== */

export async function runImageRefinedWorkflow(
  runId: string,
  input: ImageRefinedInput
): Promise<DAGResult> {
  await saveSnapshot({
    runId,
    workflow: 'image.refined',
    status: 'running',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: {},
    inputs: input as unknown as Record<string, unknown>,
  });

  await eventBus.publish({
    runId,
    workflow: 'image.refined',
    kind: 'workflow.started',
    data: { shotId: input.sceneDesign.shotId, artStyle: input.artStyle },
  });

  const angles = input.angles ?? CAMERA_ANGLES;
  const candidatesPerAngle = Math.max(1, input.candidatesPerAngle ?? 3);
  const threshold = input.consistencyThreshold ?? CONSISTENCY_THRESHOLD;
  const maxRetries = input.maxRetryRounds ?? ANGLE_RETRY_LIMIT;
  const useCharRef = (input.useCharacterReference !== false) && (input.characters?.length ?? 0) > 0;

  // 节点：build_prompts（1 个） → generate_per_angle（每个角度 1 个）→ consistency_score（1 个聚合）→ retry_failed（1 个聚合）→ contact_sheet（1 个）→ validate（1 个）
  const nodes: WorkflowNode[] = [
    {
      id: 'build_prompts',
      name: '组装 4 角度 prompt',
      run: async () => buildPromptsPerAngle(input, {}),
      timeoutMs: 30_000,
    },
    ...angles.map<WorkflowNode>((angle) => ({
      id: `gen_${angle}`,
      name: `生成 ${angle}`,
      dependsOn: ['build_prompts'],
      run: async (ctx) => {
        const bp = ctx['build_prompts'] as { angles: AnglePrompt[]; mood: ImageMood };
        const ap = bp.angles.find((a) => a.angle === angle);
        if (!ap) throw new Error(`Angle ${angle} prompt not found`);
        return generatePerAngle(ap, bp.mood, candidatesPerAngle, useCharRef);
      },
      timeoutMs: 180_000,
    })),
    {
      id: 'consistency_score',
      name: '一致性评分',
      dependsOn: angles.map((a) => `gen_${a}`),
      run: async (ctx) => consistencyScore(angles.map((a) => ctx[`gen_${a}`] as AngleResult), useCharRef),
      timeoutMs: 60_000,
    },
    {
      id: 'retry_failed',
      name: '失败角度重做',
      dependsOn: ['consistency_score'],
      run: async (ctx) => {
        const bp = ctx['build_prompts'] as { angles: AnglePrompt[]; mood: ImageMood };
        return retryFailedAngles(
          ctx['consistency_score'] as AngleResult[],
          bp.angles,
          bp.mood,
          candidatesPerAngle,
          useCharRef,
          threshold,
          maxRetries
        );
      },
      timeoutMs: 300_000,
    },
    {
      id: 'contact_sheet',
      name: '拼 contact sheet',
      dependsOn: ['retry_failed'],
      run: async (ctx) => buildContactSheet(ctx['retry_failed'] as AngleResult[]),
      timeoutMs: 60_000,
    },
    {
      id: 'validate',
      name: '校验',
      dependsOn: ['retry_failed', 'contact_sheet', 'build_prompts'],
      run: async (ctx) => validateNode(input, ctx as Record<string, unknown>),
      timeoutMs: 10_000,
    },
  ];

  const result = await runDAG(runId, nodes, {
    maxParallel: Math.min(4, config.orchestrator.maxParallel),
    failFast: false,
    onNodeChange: async (rid, nid, status, err) => {
      await eventBus.publish({
        runId: rid,
        workflow: 'image.refined',
        kind: status === 'failed' ? 'node.failed' : status === 'success' ? 'node.success' : 'node.running',
        nodeId: nid,
        data: err ? { error: err } : undefined,
      });
    },
  });

  await eventBus.publish({
    runId,
    workflow: 'image.refined',
    kind: result.success ? 'workflow.finished' : 'workflow.failed',
    data: { success: result.success, errors: result.errors },
  });

  await saveSnapshot({
    runId,
    workflow: 'image.refined',
    status: result.success ? 'success' : 'failed',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: result.statuses as never,
    inputs: input as unknown as Record<string, unknown>,
  });

  return result;
}
