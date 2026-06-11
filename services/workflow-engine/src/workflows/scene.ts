/**
 * 场景设计工作流（scene）
 * 流程：每镜 → 环境设定 + 构图 + 光影
 *
 * DAG:
 *   [design_environment] ─┐
 *   [design_composition] ─┼─→ [design_lighting] ─→ [emit_prompt]
 *   [design_mood] ─────────┘
 */

import { runDAG, type WorkflowNode, type DAGResult } from '../orchestrator/dag.js';
import { saveSnapshot } from '../orchestrator/checkpoint.js';
import { withRetry } from '../orchestrator/retry.js';
import type { Shot } from './storyboard.js';

export interface SceneInput {
  shot: Shot;
  artStyle: string;
  storyType: string;
}

export interface SceneDesign {
  shotId: string;
  environment: {
    location: string;
    timeOfDay: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night';
    weather?: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'foggy';
    props: string[];
  };
  composition: {
    shotType: string;
    cameraAngle: 'eye-level' | 'low' | 'high' | 'dutch' | 'overhead';
    rule: 'thirds' | 'center' | 'symmetric' | 'leading-lines' | 'depth';
    foreground?: string;
    background?: string;
  };
  lighting: {
    keyLight: 'natural' | 'studio' | 'rim' | 'practical' | 'neon';
    direction: 'front' | 'side' | 'back' | 'top' | 'bottom';
    intensity: 'soft' | 'medium' | 'hard';
    colorTemp: 'warm' | 'neutral' | 'cool';
  };
  mood: {
    emotion: string;
    tension: number; // 0-1
    pacing: 'slow' | 'medium' | 'fast';
  };
  /** 组装好的图像 prompt */
  imagePrompt: string;
}

async function designEnvironment(
  input: SceneInput,
  _ctx: unknown
): Promise<{ env: SceneDesign['environment'] }> {
  return withRetry(async () => {
    return {
      env: {
        location: input.shot.description,
        timeOfDay: 'afternoon',
        weather: 'sunny',
        props: [],
      },
    };
  });
}

async function designComposition(
  input: SceneInput,
  _ctx: unknown
): Promise<{ comp: SceneDesign['composition'] }> {
  return withRetry(async () => {
    return {
      comp: {
        shotType: input.shot.shotType,
        cameraAngle: 'eye-level',
        rule: 'thirds',
      },
    };
  });
}

async function designMood(
  input: SceneInput,
  _ctx: unknown
): Promise<{ mood: SceneDesign['mood'] }> {
  return withRetry(async () => {
    return {
      mood: {
        emotion: 'neutral',
        tension: 0.4,
        pacing: 'medium',
      },
    };
  });
}

async function designLighting(
  input: SceneInput,
  ctx: Record<string, unknown>
): Promise<{ lighting: SceneDesign['lighting'] }> {
  return withRetry(async () => {
    const mood = (ctx['design_mood'] as { mood: SceneDesign['mood'] }).mood;
    return {
      lighting: {
        keyLight: 'natural',
        direction: 'side',
        intensity: mood.tension > 0.7 ? 'hard' : 'medium',
        colorTemp: mood.emotion === 'romantic' ? 'warm' : 'neutral',
      },
    };
  });
}

async function emitPrompt(
  input: SceneInput,
  ctx: Record<string, unknown>
): Promise<SceneDesign> {
  const env = (ctx['design_environment'] as { env: SceneDesign['environment'] }).env;
  const comp = (ctx['design_composition'] as { comp: SceneDesign['composition'] }).comp;
  const mood = (ctx['design_mood'] as { mood: SceneDesign['mood'] }).mood;
  const lighting = (ctx['design_lighting'] as { lighting: SceneDesign['lighting'] }).lighting;
  const imagePrompt = `${input.artStyle} style, ${env.location}, ${comp.shotType}, ${comp.cameraAngle} angle, ${lighting.colorTemp} ${lighting.intensity} ${lighting.direction} light, ${mood.emotion} mood, ${env.timeOfDay}`;
  return {
    shotId: input.shot.shotId,
    environment: env,
    composition: comp,
    lighting,
    mood,
    imagePrompt,
  };
}

export async function runSceneWorkflow(
  runId: string,
  input: SceneInput
): Promise<DAGResult> {
  await saveSnapshot({
    runId,
    workflow: 'scene',
    status: 'running',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: {},
    inputs: input as unknown as Record<string, unknown>,
  });

  const nodes: WorkflowNode[] = [
    { id: 'design_environment', name: '环境设定', run: async () => designEnvironment(input, {}), timeoutMs: 30_000 },
    { id: 'design_composition', name: '构图', run: async () => designComposition(input, {}), timeoutMs: 30_000 },
    { id: 'design_mood', name: '情绪', run: async () => designMood(input, {}), timeoutMs: 30_000 },
    { id: 'design_lighting', name: '光影', dependsOn: ['design_mood'], run: async (ctx) => designLighting(input, ctx as Record<string, unknown>), timeoutMs: 30_000 },
    { id: 'emit_prompt', name: '组装 prompt', dependsOn: ['design_environment', 'design_composition', 'design_mood', 'design_lighting'], run: async (ctx) => emitPrompt(input, ctx as Record<string, unknown>), timeoutMs: 30_000 },
  ];

  const result = await runDAG(runId, nodes, { maxParallel: 3 });
  await saveSnapshot({
    runId,
    workflow: 'scene',
    status: result.success ? 'success' : 'failed',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: result.statuses as never,
    inputs: input as unknown as Record<string, unknown>,
  });
  return result;
}
