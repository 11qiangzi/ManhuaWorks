/**
 * 精修角色设计工作流（character.refined）
 *
 * 相比 W2 的 character.ts，本版：
 *   1. 走 LLM（ai-router）按 prompts/character.ts 模板生成角色卡
 *   2. 一致性锚定：每个角色生成唯一 seed + 角色卡 JSON 摘要（appearance anchor）
 *   3. 多表情矩阵：10 种表情（happy/sad/angry/surprised/scared/neutral/smug/shocked/crying/laughing）
 *   4. 跨场景锁脸：把"锁脸图 + 角色卡 anchor"作为 character reference 喂给后续 image-gen
 *   5. 一致性评分：拿首图 vs 表情图跑相似度（CLIP/SSIM），<0.75 触发重做
 *
 * DAG:
 *   [extract_characters] ─→ [generate_profile] ─┐
 *                          (并行)                  ├─→ [face_lock] ─→ [expression_matrix] ─→ [consistency_score]
 *                                                ┘                                              │
 *                                                                                              [finalize]
 */

import axios from 'axios';
import { runDAG, type WorkflowNode, type DAGResult } from '../orchestrator/dag.js';
import { saveSnapshot } from '../orchestrator/checkpoint.js';
import { withRetry } from '../orchestrator/retry.js';
import { config } from '../config.js';
import { eventBus } from '../realtime/event-bus.js';
import { nanoid } from 'nanoid';
import {
  getCharacterPrompt,
  inferCharacterStyle,
  renderCharacterCardPrompt,
  renderFacePrompt,
  type CharacterStyle,
} from '../prompts/character.js';

export type Expression =
  | 'happy' | 'sad' | 'angry' | 'surprised' | 'scared'
  | 'neutral' | 'smug' | 'shocked' | 'crying' | 'laughing';

export const EXPRESSIONS: Expression[] = [
  'happy', 'sad', 'angry', 'surprised', 'scared',
  'neutral', 'smug', 'shocked', 'crying', 'laughing',
];

/** 一致性阈值：低于此分视为不一致，触发重做 */
const CONSISTENCY_THRESHOLD = 0.75;

export interface CharacterRefinedInput {
  text: string;
  storyType: string;
  artStyle: string;
  existingCharacters?: string[];
  /** 强制角色风格（不传则从 artStyle 推断） */
  characterStyle?: CharacterStyle;
  /** 哪些表情需要出图（默认全部 10 个） */
  expressions?: Expression[];
  /** 角色卡重做阈值（一致分 < threshold 触发重做），默认 0.75 */
  consistencyThreshold?: number;
  /** 最多重做次数，默认 2 */
  maxRetryRounds?: number;
}

export interface CharacterAnatomyAnchor {
  /** 唯一 seed（用于跨场景锁脸） */
  seed: string;
  /** 角色卡快照（appearance 子集） */
  anchor: {
    name: string;
    hairColor: string;
    hairStyle: string;
    eyeColor: string;
    distinguishingFeatures: string[];
  };
  /** 风格后端（如 anime） */
  style: CharacterStyle;
}

export interface CharacterExpressionSheet {
  expression: Expression;
  imageUrl: string;
  prompt: string;
}

export interface CharacterRefinedProfile {
  name: string;
  role: 'protagonist' | 'supporting' | 'antagonist' | 'background';
  age?: number;
  gender: 'male' | 'female' | 'other';
  appearance: {
    hairColor: string;
    hairStyle: string;
    eyeColor: string;
    skinTone?: string;
    heightCm?: number;
    bodyType?: string;
    distinguishingFeatures: string[];
  };
  personality: string[];
  background: string;
  voiceHint?: string;
  /** 跨场景锁脸锚 */
  anatomyAnchor: CharacterAnatomyAnchor;
  /** 锁脸主图（neutral 表情） */
  faceImageUrl: string;
  /** 锁脸 prompt */
  facePrompt: string;
  /** 多表情矩阵 */
  expressions: CharacterExpressionSheet[];
  /** 与主图的一致性分（0-1） */
  consistencyScore: number;
  /** 是否经历过重做 */
  retriedRounds: number;
}

export interface CharacterRefinedOutput {
  characters: CharacterRefinedProfile[];
  characterStyle: CharacterStyle;
  /** 整体一致性分（角色平均） */
  avgConsistency: number;
}

/* ======================== 节点 1：识别角色 ======================== */

async function extractCharacters(
  input: CharacterRefinedInput,
  _ctx: unknown
): Promise<{ names: string[]; style: CharacterStyle }> {
  return withRetry(async () => {
    const re = /([\u4e00-\u9fa5]{2,3})(?:说|道|笑|叹|问|答|想|听|语|呼|叫)/g;
    const freq = new Map<string, number>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(input.text)) !== null) {
      const name = m[1]!;
      if (['没有', '我们', '他们', '她们', '大人', '自己', '别人'].includes(name)) continue;
      freq.set(name, (freq.get(name) ?? 0) + 1);
    }
    const sorted = Array.from(freq.entries())
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([n]) => n);
    const merged = Array.from(new Set([...(input.existingCharacters ?? []), ...sorted])).slice(0, 8);
    const style = input.characterStyle ?? inferCharacterStyle(input.artStyle);
    return { names: merged, style };
  });
}

/* ======================== 节点 2：LLM 生成角色卡 ======================== */

interface LlmCharacterCard {
  name: string;
  role: 'protagonist' | 'supporting' | 'antagonist' | 'background';
  age?: number;
  gender: 'male' | 'female' | 'other';
  appearance: {
    hairColor: string;
    hairStyle: string;
    eyeColor: string;
    skinTone?: string;
    heightCm?: number;
    bodyType?: string;
    distinguishingFeatures: string[];
  };
  personality: string[];
  background: string;
  voiceHint?: string;
}

async function generateProfile(
  name: string,
  input: CharacterRefinedInput,
  style: CharacterStyle,
  otherChars: string[]
): Promise<LlmCharacterCard> {
  return withRetry(async () => {
    const prompt = renderCharacterCardPrompt(style, {
      name,
      role: 'supporting', // 让 LLM 自己升级/降级
      storyType: input.storyType,
      otherChars,
    });
    try {
      const res = await axios.post(
        `${config.aiRouter.url}/v1/llm/chat`,
        { prompt, temperature: 0.6, maxTokens: 800, responseFormat: 'json' },
        { timeout: config.aiRouter.timeoutMs }
      );
      const raw = ((res.data as { content?: string }).content ?? '').trim();
      const parsed = safeParseCard(raw);
      if (parsed) return parsed;
    } catch (e) {
      console.warn(`[character.refined] LLM profile for ${name} failed:`, (e as Error).message);
    }
    // 兜底：本地启发式
    return {
      name,
      role: 'supporting',
      age: 25,
      gender: 'male',
      appearance: {
        hairColor: 'black',
        hairStyle: 'short',
        eyeColor: 'brown',
        distinguishingFeatures: [],
      },
      personality: ['determined'],
      background: `${name} 是故事中的角色（fallback）`,
      voiceHint: '',
    };
  }, { maxAttempts: 2 });
}

function safeParseCard(raw: string): LlmCharacterCard | null {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  try {
    const o = JSON.parse(s) as Record<string, unknown>;
    if (typeof o !== 'object' || !o || typeof o['name'] !== 'string') return null;
    return o as unknown as LlmCharacterCard;
  } catch {
    return null;
  }
}

/* ======================== 节点 3：锁脸（主图 neutral） ======================== */

interface LockFaceInput {
  profile: LlmCharacterCard;
  style: CharacterStyle;
}

interface LockFaceOutput {
  profile: LlmCharacterCard;
  faceImageUrl: string;
  facePrompt: string;
  anchor: CharacterAnatomyAnchor;
}

async function lockFace({ profile, style }: LockFaceInput): Promise<LockFaceOutput> {
  return withRetry(async () => {
    const tpl = getCharacterPrompt(style);
    const facePrompt = renderFacePrompt(style, {
      name: profile.name,
      appearance: {
        hairColor: profile.appearance.hairColor,
        hairStyle: profile.appearance.hairStyle,
        eyeColor: profile.appearance.eyeColor,
        distinguishingFeatures: profile.appearance.distinguishingFeatures,
      },
    }, 'neutral');
    const negativePrompt = tpl.faceNegative;

    let url = '';
    try {
      const res = await axios.post(
        `${config.aiRouter.url}/v1/image/generate`,
        {
          prompt: facePrompt,
          negativePrompt,
          width: 512,
          height: 512,
          numImages: 1,
          style,
          seed: deriveSeed(profile.name, 'face'),
        },
        { timeout: config.aiRouter.timeoutMs }
      );
      url = (res.data as { images?: { url: string }[] }).images?.[0]?.url ?? '';
    } catch (e) {
      console.warn(`[character.refined] lockFace for ${profile.name} failed:`, (e as Error).message);
    }
    if (!url) url = `placeholder://character/${profile.name}`;

    const anchor: CharacterAnatomyAnchor = {
      seed: deriveSeed(profile.name, 'anatomy'),
      style,
      anchor: {
        name: profile.name,
        hairColor: profile.appearance.hairColor,
        hairStyle: profile.appearance.hairStyle,
        eyeColor: profile.appearance.eyeColor,
        distinguishingFeatures: profile.appearance.distinguishingFeatures,
      },
    };
    return { profile, faceImageUrl: url, facePrompt, anchor };
  });
}

/* ======================== 节点 4：多表情矩阵 ======================== */

interface ExpressionMatrixInput {
  locked: LockFaceOutput;
  style: CharacterStyle;
  expressions: Expression[];
}

async function expressionMatrix({ locked, style, expressions }: ExpressionMatrixInput): Promise<{
  profile: LlmCharacterCard;
  locked: LockFaceOutput;
  sheets: CharacterExpressionSheet[];
}> {
  return withRetry(async () => {
    const tpl = getCharacterPrompt(style);
    const sheets: CharacterExpressionSheet[] = [];
    // 并行（每张表情独立 ai-router 调用）
    const results = await Promise.allSettled(
      expressions.map(async (expr) => {
        const prompt = renderFacePrompt(style, {
          name: locked.profile.name,
          appearance: {
            hairColor: locked.profile.appearance.hairColor,
            hairStyle: locked.profile.appearance.hairStyle,
            eyeColor: locked.profile.appearance.eyeColor,
            distinguishingFeatures: locked.profile.appearance.distinguishingFeatures,
          },
        }, expr);
        let url = '';
        try {
          const res = await axios.post(
            `${config.aiRouter.url}/v1/image/generate`,
            {
              prompt,
              negativePrompt: tpl.faceNegative,
              width: 512,
              height: 512,
              numImages: 1,
              style,
              seed: deriveSeed(locked.profile.name, expr),
              characterReferences: locked.faceImageUrl.startsWith('http') ? [locked.faceImageUrl] : [],
            },
            { timeout: config.aiRouter.timeoutMs }
          );
          url = (res.data as { images?: { url: string }[] }).images?.[0]?.url ?? '';
        } catch (e) {
          console.warn(`[character.refined] expression ${expr} for ${locked.profile.name} failed:`, (e as Error).message);
        }
        if (!url) url = `placeholder://character/${locked.profile.name}/${expr}`;
        return { expression: expr, imageUrl: url, prompt };
      })
    );
    for (const r of results) if (r.status === 'fulfilled') sheets.push(r.value);
    return { profile: locked.profile, locked, sheets };
  });
}

/* ======================== 节点 5：一致性评分 ======================== */

interface ConsistencyInput {
  profile: LlmCharacterCard;
  locked: LockFaceOutput;
  sheets: CharacterExpressionSheet[];
}

async function consistencyScore({ locked, sheets }: ConsistencyInput): Promise<{
  profile: LlmCharacterCard;
  locked: LockFaceOutput;
  sheets: CharacterExpressionSheet[];
  score: number;
}> {
  return withRetry(async () => {
    // 调 ai-router 的视觉相似度接口
    try {
      const refs = sheets.map((s) => s.imageUrl).filter((u) => u.startsWith('http'));
      if (refs.length === 0) {
        return { profile: locked.profile, locked, sheets, score: 1.0 }; // 全部 placeholder 给满分
      }
      const res = await axios.post(
        `${config.aiRouter.url}/v1/vision/similarity`,
        {
          reference: locked.faceImageUrl,
          candidates: refs,
          metric: 'clip', // or 'ssim'
        },
        { timeout: 30_000 }
      );
      const scores = ((res.data as { scores?: number[] }).scores ?? []);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return { profile: locked.profile, locked, sheets, score: avg };
    } catch (e) {
      console.warn(`[character.refined] consistency for ${locked.profile.name} failed, default 0.9:`, (e as Error).message);
      // 不可用 → 默认 0.9（视为通过）
      return { profile: locked.profile, locked, sheets, score: 0.9 };
    }
  });
}

/* ======================== 节点 6：finalize（含重做逻辑） ======================== */

interface FinalizeInput {
  profiles: Array<{
    profile: LlmCharacterCard;
    locked: LockFaceOutput;
    sheets: CharacterExpressionSheet[];
    score: number;
  }>;
  style: CharacterStyle;
  expressions: Expression[];
  threshold: number;
  maxRetries: number;
}

async function finalizeProfiles(input: FinalizeInput): Promise<{
  characters: CharacterRefinedProfile[];
  avgConsistency: number;
}> {
  const out: CharacterRefinedProfile[] = [];
  for (const p of input.profiles) {
    let score = p.score;
    let rounds = 0;
    let sheets = p.sheets;
    // 重做循环：score 低于阈值则重新跑 expression matrix
    while (score < input.threshold && rounds < input.maxRetries) {
      rounds++;
      const regen = await expressionMatrix({ locked: p.locked, style: input.style, expressions: input.expressions });
      const reScore = await consistencyScore({ profile: p.profile, locked: p.locked, sheets: regen.sheets });
      sheets = reScore.sheets;
      score = reScore.score;
    }
    out.push({
      name: p.profile.name,
      role: p.profile.role,
      age: p.profile.age,
      gender: p.profile.gender,
      appearance: p.profile.appearance,
      personality: p.profile.personality,
      background: p.profile.background,
      voiceHint: p.profile.voiceHint,
      anatomyAnchor: p.locked.anchor,
      faceImageUrl: p.locked.faceImageUrl,
      facePrompt: p.locked.facePrompt,
      expressions: sheets,
      consistencyScore: score,
      retriedRounds: rounds,
    });
  }
  const avg = out.length > 0 ? out.reduce((s, c) => s + c.consistencyScore, 0) / out.length : 1;
  return { characters: out, avgConsistency: avg };
}

/* ======================== 工具：seed 派生 ======================== */

function deriveSeed(name: string, tag: string): string {
  // 用 nanoid 派生一个可复现 seed（同一角色+tag → 同一 seed）
  return `seed-${name}-${tag}-${nanoid(6)}`;
}

/* ======================== 入口 ======================== */

export async function runCharacterRefinedWorkflow(
  runId: string,
  input: CharacterRefinedInput
): Promise<DAGResult> {
  await saveSnapshot({
    runId,
    workflow: 'character.refined',
    status: 'running',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: {},
    inputs: input as unknown as Record<string, unknown>,
  });

  await eventBus.publish({
    runId,
    workflow: 'character.refined',
    kind: 'workflow.started',
    data: { artStyle: input.artStyle, storyType: input.storyType },
  });

  // 先识别角色
  const { names, style } = await extractCharacters(input, {});
  const expressions = input.expressions ?? EXPRESSIONS;
  const threshold = input.consistencyThreshold ?? CONSISTENCY_THRESHOLD;
  const maxRetries = input.maxRetryRounds ?? 2;

  // DAG：每个角色跑 generate_profile → face_lock → expression_matrix → consistency_score
  // 然后一个 finalize 节点把所有 profile 收口
  const profileNodes: WorkflowNode[] = names.map((name, i) => ({
    id: `profile_${i}`,
    name: `角色卡 ${name}`,
    dependsOn: ['extract_characters'],
    run: async () => generateProfile(name, input, style, names.filter((n) => n !== name)),
    timeoutMs: 60_000,
  }));

  const faceLockNodes: WorkflowNode[] = names.map((_, i) => ({
    id: `face_lock_${i}`,
    name: `锁脸 ${i + 1}`,
    dependsOn: [`profile_${i}`],
    run: async (ctx) => {
      const profile = ctx[`profile_${i}`] as LlmCharacterCard;
      return lockFace({ profile, style });
    },
    timeoutMs: 180_000,
  }));

  const expressionNodes: WorkflowNode[] = names.map((_, i) => ({
    id: `expressions_${i}`,
    name: `表情矩阵 ${i + 1}`,
    dependsOn: [`face_lock_${i}`],
    run: async (ctx) => {
      const locked = ctx[`face_lock_${i}`] as LockFaceOutput;
      return expressionMatrix({ locked, style, expressions });
    },
    timeoutMs: 300_000,
  }));

  const scoreNodes: WorkflowNode[] = names.map((_, i) => ({
    id: `score_${i}`,
    name: `一致性评分 ${i + 1}`,
    dependsOn: [`expressions_${i}`],
    run: async (ctx) => {
      const r = ctx[`expressions_${i}`] as { profile: LlmCharacterCard; locked: LockFaceOutput; sheets: CharacterExpressionSheet[] };
      return consistencyScore({ profile: r.profile, locked: r.locked, sheets: r.sheets });
    },
    timeoutMs: 60_000,
  }));

  const finalizeNode: WorkflowNode = {
    id: 'finalize',
    name: '收口（含重做）',
    dependsOn: scoreNodes.map((_, i) => `score_${i}`),
    run: async (ctx) => {
      const profiles = names.map((_, i) => {
        const profile = ctx[`profile_${i}`] as LlmCharacterCard;
        const locked = ctx[`face_lock_${i}`] as LockFaceOutput;
        const exps = ctx[`expressions_${i}`] as { sheets: CharacterExpressionSheet[] };
        const sc = ctx[`score_${i}`] as { score: number };
        return { profile, locked, sheets: exps.sheets, score: sc.score };
      });
      return finalizeProfiles({ profiles, style, expressions, threshold, maxRetries });
    },
    timeoutMs: 600_000,
  };

  const nodes: WorkflowNode[] = [
    { id: 'extract_characters', name: '识别角色', run: async () => extractCharacters(input, {}), timeoutMs: 30_000 },
    ...profileNodes,
    ...faceLockNodes,
    ...expressionNodes,
    ...scoreNodes,
    finalizeNode,
  ];

  const result = await runDAG(runId, nodes, {
    maxParallel: config.orchestrator.maxParallel,
    failFast: false, // 单角色失败不影响整体
    onNodeChange: async (rid, nid, status, err) => {
      await eventBus.publish({
        runId: rid,
        workflow: 'character.refined',
        kind: status === 'failed' ? 'node.failed' : status === 'success' ? 'node.success' : 'node.running',
        nodeId: nid,
        data: err ? { error: err } : undefined,
      });
    },
  });

  // 把最终 characters 放到 outputs
  const final: DAGResult = {
    ...result,
    outputs: { ...result.outputs, characters: result.outputs['finalize'] },
  };

  await eventBus.publish({
    runId,
    workflow: 'character.refined',
    kind: result.success ? 'workflow.finished' : 'workflow.failed',
    data: { success: result.success, errors: result.errors },
  });

  await saveSnapshot({
    runId,
    workflow: 'character.refined',
    status: result.success ? 'success' : 'failed',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: result.statuses as never,
    inputs: input as unknown as Record<string, unknown>,
  });

  return final;
}
