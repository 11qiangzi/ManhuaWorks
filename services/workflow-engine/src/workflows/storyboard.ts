/**
 * 故事板工作流（storyboard）
 * 流程：小说原文 → 场景分割 → 镜头列表
 *
 * DAG:
 *   [parse_text] ─→ [detect_scenes] ─→ [extract_shots] ─→ [validate]
 */

import { runDAG, type WorkflowNode, type DAGResult } from '../orchestrator/dag.js';
import { saveSnapshot, loadSnapshot } from '../orchestrator/checkpoint.js';
import { withRetry } from '../orchestrator/retry.js';
import { getStoryType } from '../assets/story-types.js';

export interface StoryboardInput {
  /** 小说原文（章节） */
  text: string;
  /** 故事类型 id，如 sweet_romance_novel */
  storyType: string;
  /** 章节标题（可选） */
  chapterTitle?: string;
  /** 章节号 */
  chapterNo?: number;
}

export interface Scene {
  sceneId: string;
  location: string;
  characters: string[];
  startIdx: number;
  endIdx: number;
  summary: string;
}

export interface Shot {
  shotId: string;
  sceneId: string;
  /** 镜头类型：特写/中景/远景 */
  shotType: 'ECU' | 'CU' | 'MCU' | 'MS' | 'MLS' | 'LS' | 'ELS';
  /** 镜头动作：推/拉/摇/移/固定 */
  cameraMove: 'push' | 'pull' | 'pan' | 'tilt' | 'track' | 'static';
  /** 描述 */
  description: string;
  /** 原始文本片段 */
  textSnippet: string;
  /** 估算时长（秒） */
  durationSec: number;
  /** 出现的角色 */
  characters: string[];
  /** 对白 */
  dialogue?: string;
}

export interface StoryboardOutput {
  chapterTitle: string;
  storyType: string;
  scenes: Scene[];
  shots: Shot[];
  totalShots: number;
}

/** 节点 1：把纯文本解析为带索引的段落列表 */
async function parseText(input: StoryboardInput, _ctx: unknown): Promise<{ paragraphs: string[] }> {
  return withRetry(async () => {
    const paragraphs = input.text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (paragraphs.length === 0) {
      throw new Error('Input text is empty');
    }
    return { paragraphs };
  });
}

/** 节点 2：检测场景（用换行+地点关键词做简单场景切分） */
async function detectScenes(
  input: StoryboardInput,
  ctx: Record<string, unknown>
): Promise<{ scenes: Scene[] }> {
  return withRetry(async () => {
    const parsed = ctx['parse_text'] as { paragraphs: string[] } | undefined;
    if (!parsed) throw new Error('parse_text not run');
    const story = getStoryType(input.storyType);

    // 启发式：每 2-4 段一个场景；场景命名基于首段出现的"地点"关键词
    const locationHints = /[在|于|来到|进入|回到|走出|进入]?\s*([\u4e00-\u9fa5A-Za-z0-9]{2,10}?(?:楼|室|厅|场|殿|阁|山|城|街|路|房|家|店|馆|园|院|宫|堂))/;
    const scenes: Scene[] = [];
    let cur: Scene | null = null;
    let idx = 0;
    for (let i = 0; i < parsed.paragraphs.length; i++) {
      const p = parsed.paragraphs[i]!;
      const m = p.match(locationHints);
      const loc = m?.[1] ?? '未命名场景';
      if (!cur) {
        cur = { sceneId: `s${scenes.length + 1}`, location: loc, characters: [], startIdx: idx, endIdx: idx, summary: '' };
      }
      cur.endIdx = idx;
      cur.summary += p.slice(0, 30) + '…';
      idx += p.length + 1;
      // 每 3 段切一个新场景
      if ((i + 1) % 3 === 0 && i < parsed.paragraphs.length - 1) {
        scenes.push(cur);
        cur = null;
      }
    }
    if (cur) scenes.push(cur);

    // 套上故事类型默认密度
    if (story) {
      console.log(`[storyboard] detected ${scenes.length} scenes for ${story.nameZh}`);
    }
    return { scenes };
  });
}

/** 节点 3：从每个场景提取镜头列表 */
async function extractShots(
  input: StoryboardInput,
  ctx: Record<string, unknown>
): Promise<{ shots: Shot[] }> {
  return withRetry(async () => {
    const { scenes } = ctx['detect_scenes'] as { scenes: Scene[] };
    const story = getStoryType(input.storyType);
    const typicalSec = story?.typicalShotSec ?? 4;
    const minShots = story?.shotsPerChapter.min ?? 6;

    // 每个场景至少 minShots/scenes.length 个镜头
    const perScene = Math.max(2, Math.ceil(minShots / Math.max(1, scenes.length)));
    const shots: Shot[] = [];
    const cameraMoves: Shot['cameraMove'][] = ['push', 'pull', 'pan', 'static', 'track'];
    const shotTypes: Shot['shotType'][] = ['CU', 'MCU', 'MS', 'MLS', 'LS'];
    for (const sc of scenes) {
      for (let k = 0; k < perScene; k++) {
        shots.push({
          shotId: `${sc.sceneId}_sh${k + 1}`,
          sceneId: sc.sceneId,
          shotType: shotTypes[k % shotTypes.length]!,
          cameraMove: cameraMoves[k % cameraMoves.length]!,
          description: `${sc.location} - 镜 ${k + 1}`,
          textSnippet: sc.summary,
          durationSec: typicalSec,
          characters: sc.characters,
        });
      }
    }
    return { shots };
  });
}

/** 节点 4：校验 */
async function validate(
  input: StoryboardInput,
  ctx: Record<string, unknown>
): Promise<StoryboardOutput> {
  const { scenes } = ctx['detect_scenes'] as { scenes: Scene[] };
  const { shots } = ctx['extract_shots'] as { shots: Shot[] };
  if (shots.length === 0) throw new Error('No shots extracted');
  return {
    chapterTitle: input.chapterTitle ?? `Chapter ${input.chapterNo ?? '?'}`,
    storyType: input.storyType,
    scenes,
    shots,
    totalShots: shots.length,
  };
}

export async function runStoryboardWorkflow(
  runId: string,
  input: StoryboardInput
): Promise<DAGResult> {
  const nodes: WorkflowNode[] = [
    {
      id: 'parse_text',
      name: '解析文本',
      run: async () => parseText(input, {}),
      timeoutMs: 30_000,
    },
    {
      id: 'detect_scenes',
      name: '检测场景',
      dependsOn: ['parse_text'],
      run: async (ctx) => detectScenes(input, ctx as Record<string, unknown>),
      timeoutMs: 60_000,
    },
    {
      id: 'extract_shots',
      name: '提取镜头',
      dependsOn: ['detect_scenes'],
      run: async (ctx) => extractShots(input, ctx as Record<string, unknown>),
      timeoutMs: 60_000,
    },
    {
      id: 'validate',
      name: '校验',
      dependsOn: ['extract_shots'],
      run: async (ctx) => validate(input, ctx as Record<string, unknown>),
      timeoutMs: 10_000,
    },
  ];

  await saveSnapshot({
    runId,
    workflow: 'storyboard',
    status: 'running',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: {},
    inputs: input as unknown as Record<string, unknown>,
  });

  const result = await runDAG(runId, nodes, {
    maxParallel: 2,
    failFast: true,
    onNodeChange: async (rid, nid, status, err) => {
      const snap = await loadSnapshot(rid);
      if (!snap) return;
      snap.nodes[nid] = {
        nodeId: nid,
        status: status as 'pending' | 'ready' | 'running' | 'success' | 'failed' | 'skipped',
        error: err,
        attempts: 1,
        updatedAt: Date.now(),
      };
      await saveSnapshot(snap);
    },
  });

  await saveSnapshot({
    runId,
    workflow: 'storyboard',
    status: result.success ? 'success' : 'failed',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: result.statuses as never,
    inputs: input as unknown as Record<string, unknown>,
  });

  return result;
}
