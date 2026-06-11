/**
 * 精修分镜工作流（storyboard.refined）
 *
 * 相比 W2 的 storyboard.ts，本版：
 *   1. 走 LLM（ai-router）按 prompts/storyboard.ts 模板拆镜，输出严格 JSON 契约
 *   2. 增加分镜颗粒度（granularity）：beat / shot / micro-shot 三档
 *   3. 增加镜头时长分配：按 5 段节奏曲线（铺垫 / 上升 / 高潮 / 收束 / 余韵）动态配比
 *   4. 校验环节做完整性检查：场景闭环、镜头对齐、时长加和 vs 章节目标秒数
 *   5. 集成 event-bus：每节点 publish 事件
 *
 * DAG:
 *   [infer_tone] ─→ [build_prompt] ─→ [call_llm] ─→ [parse_and_validate] ─→ [allocate_durations] ─→ [emit]
 */

import axios from 'axios';
import { runDAG, type WorkflowNode, type DAGResult } from '../orchestrator/dag.js';
import { saveSnapshot } from '../orchestrator/checkpoint.js';
import { withRetry } from '../orchestrator/retry.js';
import { config } from '../config.js';
import { eventBus } from '../realtime/event-bus.js';
import {
  renderStoryboardPrompt,
  inferTone,
  getStoryboardPrompt,
  type StoryboardTone,
  type StoryboardPromptTemplate,
} from '../prompts/storyboard.js';
import type { Scene, Shot } from './storyboard.js';

export type Granularity = 'beat' | 'shot' | 'micro_shot';

/** beat ≈ 3-5 个 micro-shot 组成；shot ≈ 1 个 beat；micro-shot ≈ 1-3s 最小单元 */
const GRANULARITY_FACTOR: Record<Granularity, number> = {
  beat: 0.5, // 镜头数 ≈ 章节段数
  shot: 1.0, // 默认
  micro_shot: 2.0, // 每个 beat 拆 2 个 micro-shot
};

export interface StoryboardRefinedInput {
  text: string;
  storyType: string;
  chapterTitle?: string;
  chapterNo?: number;
  /** 目标时长（秒）；默认 60（一集短漫剧） */
  targetDurationSec?: number;
  /** 分镜颗粒度 */
  granularity?: Granularity;
  /** 强制 tone（不传则从 storyType 推断） */
  tone?: StoryboardTone;
  /** 视觉风格 id，会写进 prompt */
  artStyle?: string;
  /** 是否回退到启发式（LLM 失败兜底） */
  allowHeuristicFallback?: boolean;
}

export interface StoryboardRefinedOutput {
  chapterTitle: string;
  storyType: string;
  tone: StoryboardTone;
  granularity: Granularity;
  targetDurationSec: number;
  scenes: Scene[];
  shots: Shot[];
  totalShots: number;
  /** 5 段节奏曲线：每段累计秒数（铺垫 / 上升 / 高潮 / 收束 / 余韵） */
  pacingCurve: { setup: number; rise: number; climax: number; resolve: number; linger: number };
  /** 校验报告 */
  validation: {
    totalDurationSec: number;
    targetHit: boolean;
    driftSec: number;
    warnings: string[];
  };
  /** 是否走了 LLM */
  usedLlm: boolean;
}

/* ======================== 节点 1：推断 tone ======================== */

async function inferToneNode(
  input: StoryboardRefinedInput,
  _ctx: unknown
): Promise<{ tone: StoryboardTone; tpl: StoryboardPromptTemplate }> {
  return withRetry(async () => {
    const tone = input.tone ?? inferTone(input.storyType);
    return { tone, tpl: getStoryboardPrompt(tone) };
  });
}

/* ======================== 节点 2：组装 prompt ======================== */

async function buildPromptNode(
  input: StoryboardRefinedInput,
  ctx: Record<string, unknown>
): Promise<{ prompt: string; expectedScenes: number; expectedShots: number }> {
  return withRetry(async () => {
    const { tpl, tone } = ctx['infer_tone'] as { tone: StoryboardTone; tpl: StoryboardPromptTemplate };
    const granularity = input.granularity ?? 'shot';
    const factor = GRANULARITY_FACTOR[granularity];
    const targetSec = input.targetDurationSec ?? 60;
    const expectedShots = Math.max(6, Math.round((targetSec / tpl.defaultShotSec) * factor));
    const expectedScenes = Math.max(2, Math.round(expectedShots / tpl.defaultShotsPerScene));

    const prompt = renderStoryboardPrompt(tone, {
      text: input.text,
      chapter: input.chapterNo ?? input.chapterTitle ?? '?',
      sceneCount: expectedScenes,
      shotCount: expectedShots,
      style: input.artStyle,
    });
    return { prompt, expectedScenes, expectedShots };
  });
}

/* ======================== 节点 3：调 LLM ======================== */

interface LlmStoryboard {
  scenes: Array<{
    id: string;
    location: string;
    characters: string[];
    summary: string;
    moodTag?: string;
    tensionLevel?: number;
  }>;
  shots: Array<{
    id: string;
    sceneId: string;
    shotType: string;
    cameraMove: string;
    description: string;
    durationSec: number;
    characters: string[];
    dialogue?: string;
    sfx?: string;
    ambient?: string;
    clue?: string;
  }>;
}

async function callLlmNode(
  input: StoryboardRefinedInput,
  ctx: Record<string, unknown>
): Promise<{ raw: string; parsed: LlmStoryboard | null; llmError?: string }> {
  const { prompt } = ctx['build_prompt'] as { prompt: string };
  return withRetry(async () => {
    try {
      const res = await axios.post(
        `${config.aiRouter.url}/v1/llm/chat`,
        {
          prompt,
          temperature: 0.4,
          maxTokens: 4000,
          responseFormat: 'json',
        },
        { timeout: config.aiRouter.timeoutMs }
      );
      const raw = ((res.data as { content?: string }).content ?? '').trim();
      const parsed = safeParse(raw);
      if (!parsed) {
        return { raw, parsed: null, llmError: 'JSON parse failed' };
      }
      return { raw, parsed };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (input.allowHeuristicFallback === false) throw e;
      return { raw: '', parsed: null, llmError: msg };
    }
  }, { maxAttempts: 2 });
}

/* ======================== 节点 4：解析+校验 ======================== */

async function parseAndValidateNode(
  input: StoryboardRefinedInput,
  ctx: Record<string, unknown>
): Promise<{ scenes: Scene[]; shots: Shot[]; warnings: string[] }> {
  return withRetry(async () => {
    const { parsed } = ctx['call_llm'] as { parsed: LlmStoryboard | null };
    const { expectedScenes, expectedShots } = ctx['build_prompt'] as { expectedScenes: number; expectedShots: number };
    const warnings: string[] = [];

    if (!parsed) {
      // 兜底：用 base storyboard 的启发式
      const { scenes, shots } = heuristicStoryboard(input, expectedScenes, expectedShots);
      warnings.push('LLM unavailable; fell back to heuristic storyboard');
      return { scenes, shots, warnings };
    }

    const scenes: Scene[] = (parsed.scenes ?? []).map((s, i) => ({
      sceneId: s.id || `s${i + 1}`,
      location: s.location ?? '未命名场景',
      characters: s.characters ?? [],
      startIdx: 0,
      endIdx: 0,
      summary: s.summary ?? '',
    }));

    const validShotTypes = new Set(['ECU', 'CU', 'MCU', 'MS', 'MLS', 'LS', 'OTS']);
    const validMoves = new Set([
      'push', 'pull', 'pan', 'tilt', 'track', 'static',
      'handoff', 'handheld', 'whiplash', 'dolly', 'creep', 'crash-zoom',
    ]);

    const shots: Shot[] = (parsed.shots ?? []).map((sh, i) => {
      const shotType = (validShotTypes.has(sh.shotType) ? sh.shotType : 'MS') as Shot['shotType'];
      const cameraMove = (validMoves.has(sh.cameraMove) ? sh.cameraMove : 'static') as Shot['cameraMove'];
      return {
        shotId: sh.id || `s1_sh${i + 1}`,
        sceneId: sh.sceneId || scenes[0]?.sceneId || 's1',
        shotType,
        cameraMove,
        description: sh.description ?? '',
        textSnippet: sh.description ?? '',
        durationSec: clampDuration(sh.durationSec),
        characters: sh.characters ?? [],
        dialogue: sh.dialogue,
      };
    });

    // 完整性检查
    if (scenes.length === 0) warnings.push('LLM returned 0 scenes');
    if (shots.length < expectedShots * 0.5) {
      warnings.push(`shot count ${shots.length} < 50% of expected ${expectedShots}`);
    }
    // 镜头必须能映射到 scene
    const sceneIds = new Set(scenes.map((s) => s.sceneId));
    const orphan = shots.filter((s) => !sceneIds.has(s.sceneId));
    if (orphan.length > 0) {
      warnings.push(`${orphan.length} shots reference unknown sceneId`);
      // 自动归到 s1
      for (const o of orphan) o.sceneId = scenes[0]?.sceneId ?? 's1';
    }
    return { scenes, shots, warnings };
  });
}

/* ======================== 节点 5：时长分配 ======================== */

/** 5 段节奏曲线（每段占章节总时长的比例） */
const PACING_RATIO: Record<StoryboardTone, [number, number, number, number, number]> = {
  hot_blooded: [0.05, 0.40, 0.30, 0.20, 0.05],
  healing:     [0.20, 0.50, 0.20, 0.05, 0.05],
  mystery:     [0.10, 0.50, 0.25, 0.10, 0.05],
};

async function allocateDurationsNode(
  input: StoryboardRefinedInput,
  ctx: Record<string, unknown>
): Promise<{
  shots: Shot[];
  pacingCurve: { setup: number; rise: number; climax: number; resolve: number; linger: number };
}> {
  return withRetry(async () => {
    const { shots } = ctx['parse_and_validate'] as { shots: Shot[] };
    const { tone } = ctx['infer_tone'] as { tone: StoryboardTone };
    const targetSec = input.targetDurationSec ?? 60;
    const [r0, r1, r2, r3, r4] = PACING_RATIO[tone];

    // 计算每段累计秒数
    const pacingCurve = {
      setup:   Math.round(targetSec * r0),
      rise:    Math.round(targetSec * r1),
      climax:  Math.round(targetSec * r2),
      resolve: Math.round(targetSec * r3),
      linger:  Math.round(targetSec * r4),
    };
    const stageBounds = [pacingCurve.setup, pacingCurve.rise, pacingCurve.climax, pacingCurve.resolve];
    const totalStages = pacingCurve.setup + pacingCurve.rise + pacingCurve.climax + pacingCurve.resolve + pacingCurve.linger;

    // 把镜头按顺序等分到 5 段；每段内的镜头按总秒数等分
    const n = shots.length;
    if (n === 0) return { shots, pacingCurve };

    const stages: Shot[][] = [[], [], [], [], []];
    const stageWeights = PACING_RATIO[tone];
    // 按权重分配镜头到段
    const counts = stageWeights.map((w) => Math.max(1, Math.round(n * w)));
    // 调整总数到 n
    let sum = counts.reduce((a, b) => a + b, 0);
    while (sum > n) {
      const idx = counts.indexOf(Math.max(...counts));
      counts[idx]! -= 1;
      sum--;
    }
    while (sum < n) {
      const idx = counts.findIndex((c) => c > 0);
      counts[idx]! += 1;
      sum++;
    }
    let cursor = 0;
    for (let s = 0; s < 5; s++) {
      for (let k = 0; k < counts[s]!; k++) {
        if (cursor < n) stages[s]!.push(shots[cursor]!);
        cursor++;
      }
    }

    // 每段内部按比例重新分配秒数
    const reallocated = stages.flatMap((stageShots, stageIdx) => {
      const stageSec = stageIdx === 0 ? pacingCurve.setup
        : stageIdx === 1 ? pacingCurve.rise
        : stageIdx === 2 ? pacingCurve.climax
        : stageIdx === 3 ? pacingCurve.resolve
        : pacingCurve.linger;
      if (stageShots.length === 0) return [];
      const per = stageSec / stageShots.length;
      return stageShots.map((sh) => ({ ...sh, durationSec: Math.max(0.5, Math.round(per * 10) / 10) }));
    });

    // 调整余数（最后一镜吃掉漂移）
    const actualTotal = reallocated.reduce((s, sh) => s + sh.durationSec, 0);
    const drift = totalStages - actualTotal;
    if (reallocated.length > 0 && Math.abs(drift) > 0.05) {
      reallocated[reallocated.length - 1]!.durationSec = Math.max(
        0.5,
        Math.round((reallocated[reallocated.length - 1]!.durationSec + drift) * 10) / 10
      );
    }
    void stageBounds; // 暂未直接使用，预留做可视化

    return { shots: reallocated, pacingCurve };
  });
}

/* ======================== 节点 6：emit + 校验 ======================== */

async function emitNode(
  input: StoryboardRefinedInput,
  ctx: Record<string, unknown>
): Promise<StoryboardRefinedOutput> {
  const { scenes, shots, warnings: preWarnings } = ctx['parse_and_validate'] as { scenes: Scene[]; shots: Shot[]; warnings: string[] };
  const { pacingCurve } = ctx['allocate_durations'] as { pacingCurve: { setup: number; rise: number; climax: number; resolve: number; linger: number } };
  const { tone } = ctx['infer_tone'] as { tone: StoryboardTone };
  const { parsed } = ctx['call_llm'] as { parsed: LlmStoryboard | null };

  const totalDurationSec = shots.reduce((s, sh) => s + sh.durationSec, 0);
  const targetSec = input.targetDurationSec ?? 60;
  const driftSec = totalDurationSec - targetSec;
  const targetHit = Math.abs(driftSec) <= Math.max(2, targetSec * 0.05);
  const warnings = [...preWarnings];
  if (!targetHit) warnings.push(`duration drift ${driftSec.toFixed(1)}s vs target ${targetSec}s`);

  return {
    chapterTitle: input.chapterTitle ?? `Chapter ${input.chapterNo ?? '?'}`,
    storyType: input.storyType,
    tone,
    granularity: input.granularity ?? 'shot',
    targetDurationSec: targetSec,
    scenes,
    shots,
    totalShots: shots.length,
    pacingCurve,
    validation: { totalDurationSec, targetHit, driftSec, warnings },
    usedLlm: parsed !== null,
  };
}

/* ======================== 工具函数 ======================== */

function safeParse(raw: string): LlmStoryboard | null {
  if (!raw) return null;
  // 去掉可能包裹的 ```json ... ```
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  try {
    const obj = JSON.parse(s) as unknown;
    if (typeof obj !== 'object' || obj === null) return null;
    const o = obj as Record<string, unknown>;
    if (!Array.isArray(o['scenes']) || !Array.isArray(o['shots'])) return null;
    return o as unknown as LlmStoryboard;
  } catch {
    return null;
  }
}

function clampDuration(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return 3;
  return Math.min(15, Math.max(0.5, Math.round(sec * 10) / 10));
}

/** 启发式兜底（LLM 不可用时） */
function heuristicStoryboard(
  input: StoryboardRefinedInput,
  expectedScenes: number,
  expectedShots: number
): { scenes: Scene[]; shots: Shot[] } {
  const paragraphs = input.text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const perScene = Math.max(2, Math.ceil(expectedShots / Math.max(1, expectedScenes)));
  const scenes: Scene[] = [];
  let cur: Scene | null = null;
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]!;
    if (!cur) {
      cur = {
        sceneId: `s${scenes.length + 1}`,
        location: '未命名场景',
        characters: [],
        startIdx: 0,
        endIdx: p.length,
        summary: p.slice(0, 30) + '…',
      };
    } else {
      cur.endIdx += p.length + 1;
      cur.summary += p.slice(0, 20) + '…';
    }
    if ((scenes.length + 1) % 3 === 0 || scenes.length >= expectedScenes - 1) {
      scenes.push(cur);
      cur = null;
    }
    if (scenes.length >= expectedScenes) break;
  }
  if (cur) scenes.push(cur);

  const cameraMoves: Shot['cameraMove'][] = ['push', 'pull', 'pan', 'static', 'track'];
  const shotTypes: Shot['shotType'][] = ['CU', 'MCU', 'MS', 'MLS', 'LS'];
  const shots: Shot[] = [];
  for (const sc of scenes) {
    for (let k = 0; k < perScene; k++) {
      shots.push({
        shotId: `${sc.sceneId}_sh${k + 1}`,
        sceneId: sc.sceneId,
        shotType: shotTypes[k % shotTypes.length]!,
        cameraMove: cameraMoves[k % cameraMoves.length]!,
        description: `${sc.location} - 镜 ${k + 1}`,
        textSnippet: sc.summary,
        durationSec: 3,
        characters: sc.characters,
      });
    }
  }
  return { scenes, shots };
}

/* ======================== 入口 ======================== */

export async function runStoryboardRefinedWorkflow(
  runId: string,
  input: StoryboardRefinedInput
): Promise<DAGResult> {
  await saveSnapshot({
    runId,
    workflow: 'storyboard.refined',
    status: 'running',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: {},
    inputs: input as unknown as Record<string, unknown>,
  });

  await eventBus.publish({
    runId,
    workflow: 'storyboard.refined',
    kind: 'workflow.started',
    data: { targetDurationSec: input.targetDurationSec ?? 60, storyType: input.storyType },
  });

  const nodes: WorkflowNode[] = [
    { id: 'infer_tone', name: '推断 tone', run: async () => inferToneNode(input, {}), timeoutMs: 10_000 },
    { id: 'build_prompt', name: '组装 prompt', dependsOn: ['infer_tone'], run: async (ctx) => buildPromptNode(input, ctx as Record<string, unknown>), timeoutMs: 10_000 },
    { id: 'call_llm', name: '调 LLM 拆镜', dependsOn: ['build_prompt'], run: async (ctx) => callLlmNode(input, ctx as Record<string, unknown>), timeoutMs: 180_000 },
    { id: 'parse_and_validate', name: '解析+校验', dependsOn: ['call_llm'], run: async (ctx) => parseAndValidateNode(input, ctx as Record<string, unknown>), timeoutMs: 30_000 },
    { id: 'allocate_durations', name: '时长分配', dependsOn: ['parse_and_validate'], run: async (ctx) => allocateDurationsNode(input, ctx as Record<string, unknown>), timeoutMs: 30_000 },
    { id: 'emit', name: '产出结果', dependsOn: ['parse_and_validate', 'allocate_durations', 'infer_tone'], run: async (ctx) => emitNode(input, ctx as Record<string, unknown>), timeoutMs: 10_000 },
  ];

  const result = await runDAG(runId, nodes, {
    maxParallel: 1,
    failFast: false, // 节点内部已有兜底，不让 LLM 失败炸整个工作流
    onNodeChange: async (rid, nid, status, err) => {
      await eventBus.publish({
        runId: rid,
        workflow: 'storyboard.refined',
        kind: status === 'failed' ? 'node.failed' : status === 'success' ? 'node.success' : status === 'running' ? 'node.running' : 'node.ready',
        nodeId: nid,
        data: err ? { error: err } : undefined,
      });
    },
  });

  await eventBus.publish({
    runId,
    workflow: 'storyboard.refined',
    kind: result.success ? 'workflow.finished' : 'workflow.failed',
    data: { success: result.success, errors: result.errors },
  });

  await saveSnapshot({
    runId,
    workflow: 'storyboard.refined',
    status: result.success ? 'success' : 'failed',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: result.statuses as never,
    inputs: input as unknown as Record<string, unknown>,
  });

  return result;
}
