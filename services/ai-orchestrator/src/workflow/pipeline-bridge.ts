/**
 * Pipeline Bridge — 把 WorkflowNode 映射到 ai-orchestrator 6 个 pipeline
 * L3.C task
 *
 * 设计：
 *   - 与 engine 解耦：engine 只关心"execute(node) -> output"，
 *     bridge 负责"node.type -> 具体 pipeline"映射。
 *   - 用 PipelineRunner 执行（带成本追踪 + 步骤级重试 + 配额校验）。
 *   - 返回的 output 是 buildXxxOutput 的产物（结构化输出，不暴露内部 step）。
 *
 * 不依赖任何外部 HTTP 客户端（除 ai-orchestrator 内部 client）。
 */

import { nanoid } from "nanoid";
import type { AuthUser } from "../middleware/auth.js";
import type { RunSnapshot } from "../pipeline-runner.js";
import { PipelineRunner } from "../pipeline-runner.js";
import type { NodeExecutor, NodeExecutorContext } from "./engine.js";
import type { NodeType, WorkflowNode } from "@manhuaworks/shared-types";

import {
  autoTranslateRefinedPipeline,
  buildAutoTranslateRefinedOutput,
  type AutoTranslateRefinedInput,
} from "../pipelines/auto-translate.refined.js";
import {
  characterReplaceRefinedPipeline,
  buildCharacterReplaceRefinedOutput,
  type CharacterReplaceRefinedInput,
} from "../pipelines/character-replace.refined.js";
import {
  episodeBatchRefinedPipeline,
  buildEpisodeBatchRefinedOutput,
  type EpisodeBatchRefinedInput,
} from "../pipelines/episode-batch.refined.js";
import {
  styleTransferRefinedPipeline,
  buildStyleTransferRefinedOutput,
  type StyleTransferRefinedInput,
} from "../pipelines/style-transfer.refined.js";
import {
  novelToDramaRefinedPipeline,
  buildNovelToDramaRefinedOutput,
  type NovelToDramaRefinedInput,
} from "../pipelines/novel-to-drama.refined.js";
import {
  multiCharacterReplaceRefinedPipeline,
  buildMultiCharacterReplaceOutput,
  type MultiCharacterReplaceInput,
} from "../pipelines/multi-character-replace.refined.js";

// =============================================================================
// 类型
// =============================================================================

/** 节点执行结果（结构化） */
export interface BridgeNodeResult {
  runId: string;
  pipeline: string;
  status: "success" | "failed" | "cancelled";
  output: Record<string, unknown> | null;
  costUsd: number;
  latencyMs: number;
  error?: string;
}

/** 桥执行时的额外上下文 */
export interface BridgeContext {
  user: AuthUser;
  /** 当前用户当月已用（USD） */
  monthlyUsedUsd?: number;
  /** 当前 in-flight run 数 */
  activeRuns?: number;
  /** abort signal（外部取消） */
  signal?: AbortSignal;
}

// =============================================================================
// Pipeline 映射表
// =============================================================================

type AnyInput =
  | AutoTranslateRefinedInput
  | CharacterReplaceRefinedInput
  | EpisodeBatchRefinedInput
  | StyleTransferRefinedInput
  | NovelToDramaRefinedInput
  | MultiCharacterReplaceInput;

type OutputBuilder<TIn extends AnyInput> = (snap: RunSnapshot) => unknown;

interface PipelineEntry<TIn extends AnyInput> {
  pipelineName: string;
  pipeline: import("../pipeline-runner.js").PipelineDefinition;
  buildOutput: OutputBuilder<TIn>;
}

/** 内部 registry（测试可见）：node.type -> {pipeline, pipelineName, buildOutput} */
export const PIPELINE_REGISTRY: Record<NodeType, PipelineEntry<AnyInput>> = {
  "translate": {
    pipelineName: "auto-translate.refined",
    pipeline: autoTranslateRefinedPipeline,
    buildOutput: (snap) => buildAutoTranslateRefinedOutput(snap) as unknown,
  },
  "character-replace": {
    pipelineName: "character-replace.refined",
    pipeline: characterReplaceRefinedPipeline,
    buildOutput: (snap) => buildCharacterReplaceRefinedOutput(snap) as unknown,
  },
  "episode-batch": {
    pipelineName: "episode-batch.refined",
    pipeline: episodeBatchRefinedPipeline,
    buildOutput: (snap) => buildEpisodeBatchRefinedOutput(snap) as unknown,
  },
  "style-transfer": {
    pipelineName: "style-transfer.refined",
    pipeline: styleTransferRefinedPipeline,
    buildOutput: (snap) => buildStyleTransferRefinedOutput(snap) as unknown,
  },
  "novel-to-drama": {
    pipelineName: "novel-to-drama.refined",
    pipeline: novelToDramaRefinedPipeline,
    buildOutput: (snap) => buildNovelToDramaRefinedOutput(snap) as unknown,
  },
  "multi-character": {
    pipelineName: "multi-character-replace.refined",
    pipeline: multiCharacterReplaceRefinedPipeline,
    buildOutput: (snap) => buildMultiCharacterReplaceOutput(snap) as unknown,
  },
};

/** 检查一个 NodeType 是否在注册表中（带类型保护） */
export function isKnownNodeType(t: string): t is NodeType {
  return t in PIPELINE_REGISTRY;
}

/** 列出支持的 pipeline 名称（用于调试 / API 暴露） */
export function listSupportedPipelines(): string[] {
  return Object.values(PIPELINE_REGISTRY).map((e) => e.pipelineName);
}

// =============================================================================
// 核心函数
// =============================================================================

/**
 * 把 node 映射到对应 pipeline 并执行
 * - 通过 PipelineRunner 执行（带 step-level retry + cost tracking）
 * - 失败抛 Error（让 engine 的 retry 机制处理）
 * - 取消抛 DOMException("Aborted")
 */
export async function executeNode(
  node: WorkflowNode,
  bridgeCtx: BridgeContext,
): Promise<BridgeNodeResult> {
  const entry = PIPELINE_REGISTRY[node.type];
  if (!entry) {
    throw new Error(`pipeline-bridge: unknown node type '${node.type}'`);
  }
  const inputs = node.params as unknown as AnyInput;
  const runner = new PipelineRunner(entry.pipeline);
  const ac = new AbortController();
  const externalSignal = bridgeCtx.signal;
  if (externalSignal) {
    if (externalSignal.aborted) ac.abort();
    else externalSignal.addEventListener("abort", () => ac.abort(), { once: true });
  }

  let snap: RunSnapshot;
  try {
    snap = await runner.start({
      pipeline: entry.pipeline,
      user: bridgeCtx.user,
      inputs: inputs as unknown as Record<string, unknown>,
      monthlyUsedUsd: bridgeCtx.monthlyUsedUsd,
      activeRuns: bridgeCtx.activeRuns,
    });
  } catch (err) {
    throw new Error(`pipeline-bridge: runner start failed: ${(err as Error).message}`);
  }

  if (ac.signal.aborted) {
    runner.cancel();
    throw new DOMException("Aborted", "AbortError");
  }

  if (snap.status === "failed") {
    return {
      runId: snap.runId,
      pipeline: entry.pipelineName,
      status: "failed",
      output: null,
      costUsd: snap.costSummary.totalCostUsd,
      latencyMs: snap.costSummary.totalLatencyMs,
      error: snap.error ?? snap.quotaDenial?.detail ?? "unknown",
    };
  }
  if (snap.status === "cancelled") {
    return {
      runId: snap.runId,
      pipeline: entry.pipelineName,
      status: "cancelled",
      output: null,
      costUsd: snap.costSummary.totalCostUsd,
      latencyMs: snap.costSummary.totalLatencyMs,
      error: "cancelled",
    };
  }

  // success
  const output = entry.buildOutput(snap) as Record<string, unknown>;
  return {
    runId: snap.runId,
    pipeline: entry.pipelineName,
    status: "success",
    output,
    costUsd: snap.costSummary.totalCostUsd,
    latencyMs: snap.costSummary.totalLatencyMs,
  };
}

/**
 * 返回一个 NodeExecutor 闭包，用于 WorkflowEngine.execute
 * - 该闭包会调用 executeNode，并把 BridgeNodeResult 包装成 Record<string, unknown>
 * - 默认 user: anonymous（测试用；生产由上层注入）
 */
export function makeBridgeExecutor(
  getUser: (workflowParams: Record<string, unknown>) => AuthUser,
  baseCtx: Omit<BridgeContext, "user" | "signal"> = {},
): NodeExecutor {
  return async (node: WorkflowNode, ctx: NodeExecutorContext) => {
    const user = getUser(ctx.workflowParams);
    const result = await executeNode(node, {
      user,
      monthlyUsedUsd: baseCtx.monthlyUsedUsd,
      activeRuns: baseCtx.activeRuns,
      signal: ctx.signal,
    });
    if (result.status !== "success") {
      throw new Error(result.error ?? `pipeline ${result.pipeline} ${result.status}`);
    }
    return result.output ?? {};
  };
}

// =============================================================================
// 内部工具（导出供测试用）
// =============================================================================

/**
 * 创建一个匿名测试用户（仅供本地/测试使用）
 */
export function createMockUser(userId?: string, tier: AuthUser["tier"] = "pro"): AuthUser {
  return { userId: userId ?? `u-${nanoid(8)}`, tier };
}
