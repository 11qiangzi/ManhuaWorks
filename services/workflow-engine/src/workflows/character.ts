/**
 * 角色设计工作流（character）
 * 流程：小说正文 → 角色识别 → 角色卡生成（设定/外貌/性格）→ 锁脸（首图）
 *
 * DAG:
 *   [extract_characters] ─→ [generate_profile] ─→ [lock_face]
 *                          （并行：对每个角色跑 generate_profile）
 */

import axios from 'axios';
import { runDAG, type WorkflowNode, type DAGResult } from '../orchestrator/dag.js';
import { saveSnapshot } from '../orchestrator/checkpoint.js';
import { withRetry } from '../orchestrator/retry.js';
import { config } from '../config.js';

export interface CharacterInput {
  /** 小说文本（可不传整本，传一章） */
  text: string;
  /** 故事类型 */
  storyType: string;
  /** 艺术风格 id */
  artStyle: string;
  /** 已有的角色名（可选，用于追加） */
  existingCharacters?: string[];
}

export interface CharacterProfile {
  name: string;
  role: 'protagonist' | 'supporting' | 'antagonist' | 'background';
  age?: number;
  gender: 'male' | 'female' | 'other';
  appearance: {
    hairColor: string;
    hairStyle: string;
    eyeColor: string;
    heightCm?: number;
    bodyType?: string;
    distinguishingFeatures: string[];
  };
  personality: string[];
  background: string;
  /** 锁脸图 URL（生成后填入） */
  faceImageUrl?: string;
  /** 锁脸 prompt（喂给图像模型） */
  facePrompt: string;
}

export interface CharacterOutput {
  characters: CharacterProfile[];
}

/** 节点 1：从文本中识别角色名（启发式：1-4 字 + 高频） */
async function extractCharacters(
  input: CharacterInput,
  _ctx: unknown
): Promise<{ names: string[] }> {
  return withRetry(async () => {
    // 简易启发式：找对话标记"xxx 说/道"前面的 2-3 字人名
    const re = /([\u4e00-\u9fa5]{2,3})(?:说|道|笑|叹|问|答|道|想|答|听|道|语|呼|叫)/g;
    const freq = new Map<string, number>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(input.text)) !== null) {
      const name = m[1]!;
      // 过滤常见非人名
      if (['没有', '我们', '他们', '她们', '大人', '自己', '别人'].includes(name)) continue;
      freq.set(name, (freq.get(name) ?? 0) + 1);
    }
    const sorted = Array.from(freq.entries())
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([n]) => n);
    // 合并已有角色
    const merged = Array.from(new Set([...(input.existingCharacters ?? []), ...sorted])).slice(0, 8);
    return { names: merged };
  });
}

/** 节点 2：为单个角色生成 profile（并行执行） */
async function generateProfile(
  name: string,
  input: CharacterInput
): Promise<CharacterProfile> {
  // 调 ai-router 的 LLM 能力生成角色卡（demo 实现用本地启发式）
  return withRetry(async () => {
    const isProtagonist = name === (input.existingCharacters?.[0] ?? '');
    return {
      name,
      role: isProtagonist ? 'protagonist' : 'supporting',
      gender: 'male', // 默认；真实场景让 LLM 推断
      appearance: {
        hairColor: 'black',
        hairStyle: 'short',
        eyeColor: 'brown',
        distinguishingFeatures: [],
      },
      personality: ['determined', 'curious'],
      background: `${name} 是故事中的角色（由 workflow-engine 自动生成占位）`,
      facePrompt: `${name}, character portrait, ${input.artStyle}, front view, neutral expression, head and shoulders, white background`,
    };
  });
}

/** 节点 3：锁脸（调图像生成） */
async function lockFace(profile: CharacterProfile): Promise<CharacterProfile> {
  return withRetry(async () => {
    // 调 ai-router 的图像生成 endpoint
    const res = await axios.post(
      `${config.aiRouter.url}/v1/image/generate`,
      {
        prompt: profile.facePrompt,
        negativePrompt: 'blurry, low quality, deformed, extra limbs',
        width: 512,
        height: 512,
        numImages: 1,
      },
      { timeout: config.aiRouter.timeoutMs }
    );
    const url = (res.data as { images?: { url: string }[] }).images?.[0]?.url;
    return { ...profile, faceImageUrl: url };
  });
}

export async function runCharacterWorkflow(
  runId: string,
  input: CharacterInput
): Promise<DAGResult> {
  await saveSnapshot({
    runId,
    workflow: 'character',
    status: 'running',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: {},
    inputs: input as unknown as Record<string, unknown>,
  });

  // 先识别角色
  const { names } = await extractCharacters(input, {});

  // 为每个角色跑 profile + lock_face（并行）
  const profileNodes: WorkflowNode[] = names.map((name, i) => ({
    id: `profile_${i}`,
    name: `角色卡 ${name}`,
    dependsOn: ['extract_characters'],
    run: async () => generateProfile(name, input),
    timeoutMs: 60_000,
  }));
  const faceLockNodes: WorkflowNode[] = names.map((_, i) => ({
    id: `lock_face_${i}`,
    name: `锁脸 ${i + 1}`,
    dependsOn: [`profile_${i}`],
    run: async (ctx) => {
      const p = ctx[`profile_${i}`] as CharacterProfile;
      return lockFace(p);
    },
    timeoutMs: 180_000,
  }));

  const nodes: WorkflowNode[] = [
    {
      id: 'extract_characters',
      name: '识别角色',
      run: async () => extractCharacters(input, {}),
      timeoutMs: 30_000,
    },
    ...profileNodes,
    ...faceLockNodes,
  ];

  const result = await runDAG(runId, nodes, {
    maxParallel: config.orchestrator.maxParallel,
    failFast: false, // 单个角色失败不影响其他
  });

  const characters: CharacterProfile[] = names.map((_, i) => {
    const profile = result.outputs[`profile_${i}`] as CharacterProfile | undefined;
    const face = result.outputs[`lock_face_${i}`] as CharacterProfile | undefined;
    return face ?? profile ?? { name: '?', role: 'background', gender: 'other', appearance: { hairColor: '', hairStyle: '', eyeColor: '', distinguishingFeatures: [] }, personality: [], background: '', facePrompt: '' };
  });

  const final: DAGResult = {
    ...result,
    outputs: { ...result.outputs, characters },
  };

  await saveSnapshot({
    runId,
    workflow: 'character',
    status: final.success ? 'success' : 'failed',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: final.statuses as never,
    inputs: input as unknown as Record<string, unknown>,
  });

  return final;
}
