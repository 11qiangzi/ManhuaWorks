/**
 * ai-orchestrator 流水线注册表
 *
 * L5-C 任务：把 5 个 L3.H 已建好的 pipeline 按业务类型聚合到 4 个 type。
 * 不重写实现，只做路由表。
 *
 * 4 个公开 type（与任务约定）：
 *   image      → 图像风格 / 套新艺术风格
 *   character  → 角色一致性 / 跨剧集复用
 *   scene      → 场景生成 / 章节→分镜
 *   workflow   → 多步编排 / 批量剧集
 *
 * 5 个底层 pipeline（已在 src/pipelines/*.ts 里跑通 9 个测试文件 181 tests）：
 *   novel-to-drama     (chapter → 1 episode)         ←  scene 主，workflow 兜底
 *   episode-batch      (chapter → N episodes)        ←  workflow 主
 *   style-transfer     (apply new art style)         ←  image
 *   character-replace  (cross-show character reuse)  ←  character
 *   auto-translate     (translate + burn subtitle)   ←  workflow 兜底（保留旧路由）
 *
 * 暴露 `getPipeline(type)` / `listTypes()` 给 orchestrator-server 用。
 */

import type { PipelineDefinition } from "../pipeline-runner.js";

import { novelToDramaPipeline } from "./novel-to-drama.js";
import { episodeBatchPipeline } from "./episode-batch.js";
import { styleTransferPipeline } from "./style-transfer.js";
import { characterReplacePipeline } from "./character-replace.js";
import { autoTranslatePipeline } from "./auto-translate.js";

/** 4 个公开业务 type */
export type JobType = "image" | "character" | "scene" | "workflow";

/** 任务 → pipeline 映射项 */
export interface PipelineBinding {
  type: JobType;
  /** pipeline 名（用于 log / runId 标识） */
  pipelineName: string;
  /** pipeline 定义（直接喂给 PipelineRunner） */
  definition: PipelineDefinition;
  /** 简短说明（给 health / docs 用） */
  description: string;
}

/** 内部表：4 个 type → pipeline 绑定 */
const BINDINGS: readonly PipelineBinding[] = [
  {
    type: "image",
    pipelineName: "style-transfer",
    definition: styleTransferPipeline,
    description: "图像风格迁移 / 套新艺术风格",
  },
  {
    type: "character",
    pipelineName: "character-replace",
    definition: characterReplacePipeline,
    description: "角色一致性 / 跨剧集复用",
  },
  {
    type: "scene",
    pipelineName: "novel-to-drama",
    definition: novelToDramaPipeline,
    description: "章节→分镜场景生成（单集）",
  },
  {
    type: "workflow",
    pipelineName: "episode-batch",
    definition: episodeBatchPipeline,
    description: "批量剧集编排（多步）",
  },
] as const;

/** 兜底：auto-translate 走老路由 /v1/orchestrate/auto-translate，保留 */
const LEGACY_PIPELINES: readonly PipelineDefinition[] = [autoTranslatePipeline];

/** 4 个 type 列表（给 health / API 校验用） */
export function listTypes(): readonly JobType[] {
  return BINDINGS.map((b) => b.type);
}

/** type → binding，未知 type 抛错 */
export function getBinding(type: string): PipelineBinding {
  const b = BINDINGS.find((x) => x.type === type);
  if (!b) {
    throw new Error(
      `unknown job type "${type}", valid: ${listTypes().join(", ")}`,
    );
  }
  return b;
}

/** 内部 helper：把 unknown type 安全转 binding（不抛，返回 null） */
export function tryGetBinding(type: string): PipelineBinding | null {
  try {
    return getBinding(type);
  } catch {
    return null;
  }
}

/** 拿所有 5 个 pipeline（含 legacy）—— 给 health 端点展示 */
export function listAllPipelines(): readonly PipelineDefinition[] {
  return [...BINDINGS.map((b) => b.definition), ...LEGACY_PIPELINES];
}

/** 仅 4 个 type 对应的 pipeline（orchestrator-server 用） */
export function listOrchestratorPipelines(): readonly PipelineDefinition[] {
  return BINDINGS.map((b) => b.definition);
}
