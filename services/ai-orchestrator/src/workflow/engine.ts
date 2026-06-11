/**
 * WorkflowEngine — 工作流节点执行引擎
 * L3.C 任务
 *
 * 能力：
 *   - load(wf)        验证节点 id 唯一 + 检测环
 *   - topologicalSort()  Kahn 算法，返回执行层（每层并行）
 *   - execute(wf, ctx)  按层执行：同层并行 + 跨层顺序
 *   - 节点失败：隔离（不阻塞同层其他节点）+ 重试 3 次 → 标记 failed
 *
 * 设计：
 *   - 与 PipelineRunner 解耦：PipelineRunner 是单 pipeline 内部步骤编排；
 *     WorkflowEngine 是多 pipeline 节点编排。
 *   - 默认 isCritical: true 失败即停；可标 optional: true 失败不阻塞后续层。
 *   - 提供 NodeExecutor 回调让外部注入 pipeline 实际逻辑（pipeline-bridge.ts）。
 */

import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  ExecutionResult,
  LayerExecutionResult,
  NodeExecutionResult,
  NodeStatus,
} from "@manhuaworks/shared-types";

// =============================================================================
// 公开类型
// =============================================================================

export interface NodeExecutorContext {
  /** 触发本次执行的 workflow id */
  workflowId: string;
  /** 上游所有节点的 output（key = nodeId，跨层都能拿到） */
  upstreamOutputs: Record<string, Record<string, unknown>>;
  /** abort signal（cancel 时触发） */
  signal: AbortSignal;
  /** 透传工作流参数（如 projectId） */
  workflowParams: Record<string, unknown>;
}

export type NodeExecutor = (
  node: WorkflowNode,
  ctx: NodeExecutorContext,
) => Promise<Record<string, unknown>>;

/** 节点可选项（用于引擎的失败容忍度控制） */
export interface NodeOptions {
  /** 默认 true：失败不阻塞后续层；false：失败立即终止 workflow */
  optional?: boolean;
  /** 默认 3：最大重试次数（不含首次执行） */
  maxRetries?: number;
}

export interface ExecuteOptions {
  /** abort signal */
  signal?: AbortSignal;
  /** 默认 3 */
  defaultMaxRetries?: number;
  /** 节点级可选/重试覆盖（key = nodeId） */
  nodeOptions?: Record<string, NodeOptions>;
  /** 节点执行器（如果未提供则使用 noop） */
  executor?: NodeExecutor;
  /** 进度回调（每层完成后调用） */
  onLayerComplete?: (layer: LayerExecutionResult) => void;
  /** 节点级进度回调 */
  onNodeStart?: (nodeId: string) => void;
  onNodeFinish?: (nodeId: string, result: NodeExecutionResult) => void;
}

// =============================================================================
// WorkflowEngine
// =============================================================================

export class WorkflowEngine {
  private workflow: Workflow | null = null;

  /**
   * 加载并校验工作流
   *   - 节点 id 唯一
   *   - dependsOn 引用的 id 必须存在
   *   - 检测环（DFS）
   */
  load(workflow: Workflow): void {
    validateUniqueIds(workflow);
    validateDependsOn(workflow);
    detectCycle(workflow);
    this.workflow = workflow;
  }

  /**
   * Kahn 算法拓扑排序，返回执行层
   *   - layers[0] 是入口节点（无依赖）
   *   - 同层节点可并行
   *   - 每层节点依赖的所有节点都在更早的层
   */
  topologicalSort(workflow?: Workflow): WorkflowNode[][] {
    const wf = workflow ?? this.workflow;
    if (!wf) throw new Error("WorkflowEngine: no workflow loaded");

    const inDegree = new Map<string, number>();
    const children = new Map<string, string[]>();
    const nodeById = new Map<string, WorkflowNode>();

    for (const n of wf.nodes) nodeById.set(n.id, n);

    for (const n of wf.nodes) {
      inDegree.set(n.id, (n.dependsOn?.length ?? 0));
      if (!children.has(n.id)) children.set(n.id, []);
    }
    for (const n of wf.nodes) {
      for (const dep of n.dependsOn ?? []) {
        const arr = children.get(dep) ?? [];
        arr.push(n.id);
        children.set(dep, arr);
      }
    }

    const layers: WorkflowNode[][] = [];
    let frontier = wf.nodes.filter((n) => (n.dependsOn?.length ?? 0) === 0);

    while (frontier.length > 0) {
      layers.push(frontier);
      const next: WorkflowNode[] = [];
      for (const n of frontier) {
        for (const childId of children.get(n.id) ?? []) {
          const d = (inDegree.get(childId) ?? 0) - 1;
          inDegree.set(childId, d);
          if (d === 0) {
            const child = nodeById.get(childId);
            if (child) next.push(child);
          }
        }
      }
      frontier = next;
    }

    // 校验：所有节点都进入了 layers（环检测兜底）
    const visited = new Set(layers.flat().map((n) => n.id));
    if (visited.size !== wf.nodes.length) {
      const missing = wf.nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
      throw new Error(`WorkflowEngine: cycle detected involving ${missing.join(", ")}`);
    }

    return layers;
  }

  /**
   * 按层执行：
   *   - 同层并行
   *   - 节点失败：默认重试 3 次
   *   - 失败非 optional → 整体 mark failed
   *   - 失败 optional → 标 skipped，workflow 仍可继续
   *   - 依赖未成功的下游节点 → 标 skipped
   */
  async execute(workflow: Workflow, opts: ExecuteOptions = {}): Promise<ExecutionResult> {
    this.load(workflow);

    const startedAt = Date.now();
    const ac = new AbortController();
    const signal = opts.signal ?? ac.signal;
    const defaultMaxRetries = opts.defaultMaxRetries ?? 3;
    const layers = this.topologicalSort(workflow);
    const layerResults: LayerExecutionResult[] = [];
    const failedNodes: string[] = [];
    const upstreamOutputs: Record<string, Record<string, unknown>> = {};

    let overallStatus: "succeeded" | "partial" | "failed" = "succeeded";
    let fatalError: string | undefined;

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]!;
      const layerStart = Date.now();
      const nodeResults: Record<string, NodeExecutionResult> = {};

      // 决定该层节点状态：依赖未完成 → 标 skipped
      const runnable: WorkflowNode[] = [];
      for (const node of layer) {
        const upstream = (node.dependsOn ?? []).map((d) => nodeResults[d] ?? upstreamOutputs[d]);
        const upstreamFailed = (node.dependsOn ?? []).some((d) => {
          const r = nodeResults[d] ?? upstreamOutputs[d];
          return !r || r.status === "failed" || r.status === "skipped";
        });
        if (upstreamFailed) {
          // 简化：本层节点之间也可能互相依赖，但用 upstreamOutputs 兜底
          const depResults = (node.dependsOn ?? []).map((d) => upstreamOutputs[d]);
          if (depResults.some((r) => !r || (r.status as NodeStatus) === "failed" || (r.status as NodeStatus) === "skipped")) {
            nodeResults[node.id] = blankResult(node.id, "skipped", "dependency failed");
            failedNodes.push(node.id);
            continue;
          }
        }
        runnable.push(node);
        // suppress unused warning for upstream array above
        void upstream;
      }

      // 同层并行执行 runnable 节点
      const execPromises = runnable.map(async (node) => {
        const nodeOpts = opts.nodeOptions?.[node.id] ?? {};
        const maxRetries = nodeOpts.maxRetries ?? defaultMaxRetries;
        const optional = nodeOpts.optional ?? false;
        opts.onNodeStart?.(node.id);
        const result = await runWithRetry(node, maxRetries, signal, {
          workflowId: workflow.id,
          upstreamOutputs,
          signal,
          workflowParams: workflow as unknown as Record<string, unknown>,
        }, opts.executor);
        nodeResults[node.id] = result;
        opts.onNodeFinish?.(node.id, result);
        if (result.status === "succeeded") {
          upstreamOutputs[node.id] = result.output ?? {};
        } else if (result.status === "failed") {
          failedNodes.push(node.id);
          if (!optional) {
            // 致命失败：本层后续不需要等了
            throw new WorkflowFatalError(`node ${node.id} failed: ${result.error}`);
          }
        }
      });

      // 收集：fault 隔离 — 即便有非致命失败也不抛
      const settled = await Promise.allSettled(execPromises);
      for (const s of settled) {
        if (s.status === "rejected" && s.reason instanceof WorkflowFatalError) {
          // 致命：终止后续层
          fatalError = s.reason.message;
          overallStatus = "failed";
          break;
        }
      }

      // 计算层状态
      const statuses = Object.values(nodeResults).map((r) => r.status);
      let layerStatus: LayerExecutionResult["status"];
      if (statuses.every((s) => s === "succeeded")) layerStatus = "succeeded";
      else if (statuses.every((s) => s === "succeeded" || s === "skipped")) layerStatus = "succeeded";
      else if (statuses.some((s) => s === "succeeded")) layerStatus = "partial";
      else layerStatus = "failed";

      const layerResult: LayerExecutionResult = {
        layer: i,
        nodes: nodeResults,
        status: layerStatus,
        durationMs: Date.now() - layerStart,
      };
      layerResults.push(layerResult);
      opts.onLayerComplete?.(layerResult);

      // 致命错误：终止
      if (fatalError) break;

      // 计算整体状态
      const anyFailed = Object.values(nodeResults).some((r) => r.status === "failed");
      if (anyFailed && overallStatus === "succeeded") overallStatus = "partial";
    }

    const finishedAt = Date.now();
    return {
      workflowId: workflow.id,
      status: fatalError ? "failed" : overallStatus,
      layers: layerResults,
      durationMs: finishedAt - startedAt,
      failedNodes,
      startedAt,
      finishedAt,
      error: fatalError,
    };
  }
}

// =============================================================================
// 内部工具
// =============================================================================

class WorkflowFatalError extends Error {
  override readonly name = "WorkflowFatalError";
}

function blankResult(nodeId: string, status: NodeStatus, error?: string): NodeExecutionResult {
  return {
    nodeId,
    status,
    error,
    attempts: 0,
    latencyMs: 0,
  };
}

async function runWithRetry(
  node: WorkflowNode,
  maxRetries: number,
  signal: AbortSignal,
  ctx: NodeExecutorContext,
  executor: NodeExecutor | undefined,
): Promise<NodeExecutionResult> {
  const startedAt = Date.now();
  let attempt = 0;
  let lastError: string | undefined;
  let lastOutput: Record<string, unknown> | undefined;

  while (attempt <= maxRetries) {
    if (signal.aborted) {
      return { nodeId: node.id, status: "skipped", error: "cancelled", attempts: attempt, latencyMs: Date.now() - startedAt };
    }
    attempt += 1;
    try {
      const out = executor ? await executor(node, ctx) : { ok: true, params: node.params };
      lastOutput = out;
      return {
        nodeId: node.id,
        status: "succeeded",
        output: out,
        startedAt,
        finishedAt: Date.now(),
        attempts: attempt,
        latencyMs: Date.now() - startedAt,
      };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      // 如果是取消信号导致，停止重试，直接跳过
      if (signal.aborted) {
        return {
          nodeId: node.id,
          status: "skipped",
          error: lastError,
          output: lastOutput,
          startedAt,
          finishedAt: Date.now(),
          attempts: attempt,
          latencyMs: Date.now() - startedAt,
        };
      }
      if (attempt > maxRetries) break;
      // 退避：200ms * 2^(attempt-1)，上限 2s
      const wait = Math.min(2000, 200 * 2 ** (attempt - 1));
      try {
        await sleep(wait, signal);
      } catch {
        // sleep 被取消 → 视作 skipped
        return {
          nodeId: node.id,
          status: "skipped",
          error: "cancelled during backoff",
          output: lastOutput,
          startedAt,
          finishedAt: Date.now(),
          attempts: attempt,
          latencyMs: Date.now() - startedAt,
        };
      }
    }
  }

  return {
    nodeId: node.id,
    status: "failed",
    error: lastError ?? "unknown",
    output: lastOutput,
    startedAt,
    finishedAt: Date.now(),
    attempts: attempt,
    latencyMs: Date.now() - startedAt,
  };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(() => resolve(), ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

function validateUniqueIds(workflow: Workflow): void {
  const seen = new Set<string>();
  for (const n of workflow.nodes) {
    if (seen.has(n.id)) throw new Error(`WorkflowEngine: duplicate node id '${n.id}'`);
    seen.add(n.id);
  }
  const edgeSeen = new Set<string>();
  for (const e of workflow.edges) {
    if (edgeSeen.has(e.id)) throw new Error(`WorkflowEngine: duplicate edge id '${e.id}'`);
    edgeSeen.add(e.id);
  }
}

function validateDependsOn(workflow: Workflow): void {
  const ids = new Set(workflow.nodes.map((n) => n.id));
  for (const n of workflow.nodes) {
    for (const dep of n.dependsOn ?? []) {
      if (!ids.has(dep)) {
        throw new Error(`WorkflowEngine: node '${n.id}' depends on unknown id '${dep}'`);
      }
    }
  }
  // 边端点必须存在
  for (const e of workflow.edges) {
    if (!ids.has(e.from)) throw new Error(`WorkflowEngine: edge '${e.id}' from unknown '${e.from}'`);
    if (!ids.has(e.to)) throw new Error(`WorkflowEngine: edge '${e.id}' to unknown '${e.to}'`);
  }
}

/** DFS 环检测 */
function detectCycle(workflow: Workflow): void {
  const adj = new Map<string, string[]>();
  for (const n of workflow.nodes) {
    adj.set(n.id, [...(n.dependsOn ?? [])]);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of adj.keys()) color.set(id, WHITE);

  function dfs(u: string, stack: string[]): void {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v);
      if (c === GRAY) {
        const idx = stack.indexOf(v);
        throw new Error(`WorkflowEngine: cycle detected: ${stack.slice(idx).concat(v).join(" -> ")}`);
      } else if (c === WHITE) {
        dfs(v, stack);
      }
    }
    stack.pop();
    color.set(u, BLACK);
  }

  for (const id of adj.keys()) {
    if (color.get(id) === WHITE) dfs(id, []);
  }
}

// =============================================================================
// 便利工厂
// =============================================================================

/** 创建一个空的 WorkflowEngine 实例（不绑定 workflow） */
export function createEngine(): WorkflowEngine {
  return new WorkflowEngine();
}

/** 便捷 builder：从 nodes + edges 构造 Workflow */
export function buildWorkflow(parts: {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges?: WorkflowEdge[];
}): Workflow {
  return {
    id: parts.id,
    name: parts.name,
    nodes: parts.nodes,
    edges: parts.edges ?? [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  };
}
