/**
 * DAG 调度器
 * - 节点：每个工作流由若干"节点"组成
 * - 边：节点之间的依赖（出边集合）
 * - 状态机：pending → ready → running → (success | failed | skipped)
 * - 并行：所有"上游均成功"的节点进入 ready，并行触发
 * - 串行：依赖链自然串行
 * - 条件分支：节点带 when 谓词，上游完成后判断是否执行
 */

export type NodeStatus = 'pending' | 'ready' | 'running' | 'success' | 'failed' | 'skipped';

export interface NodeContext {
  /** 来自上游节点的输出，key = nodeId */
  [key: string]: unknown;
}

export interface WorkflowNode {
  id: string;
  /** 显示名 */
  name: string;
  /** 真正干活的执行器（接收 ctx，返回该节点的输出） */
  run: (ctx: NodeContext) => Promise<unknown>;
  /** 上游节点 id 集合（必须全部 success 才进入 ready） */
  dependsOn?: string[];
  /** 条件谓词：返回 false 时节点被跳过（视为 success，不阻塞下游） */
  when?: (ctx: NodeContext) => boolean | Promise<boolean>;
  /** 单节点最大重试次数（默认走 orchestrator 全局） */
  maxRetries?: number;
  /** 节点级超时 ms */
  timeoutMs?: number;
}

export interface DAGOptions {
  /** 单批最多并行触发的节点数 */
  maxParallel?: number;
  /** 整个 DAG 的兜底超时 */
  totalTimeoutMs?: number;
  /** 任意节点失败立即终止（默认 true） */
  failFast?: boolean;
  /** 节点状态变化回调（用于打日志 / 更新 checkpoint） */
  onNodeChange?: (runId: string, nodeId: string, status: NodeStatus, error?: string) => void | Promise<void>;
}

export interface DAGResult {
  success: boolean;
  /** 节点最终输出 */
  outputs: Record<string, unknown>;
  /** 节点状态快照 */
  statuses: Record<string, NodeStatus>;
  /** 错误信息（仅 success=false） */
  errors: Record<string, string>;
  /** 总耗时 ms */
  durationMs: number;
}

interface NodeRuntime {
  node: WorkflowNode;
  status: NodeStatus;
  output?: unknown;
  error?: string;
  attempts: number;
}

/** 用 Kahn 算法一次性校验 DAG，发现环直接抛错 */
export function validateDAG(nodes: WorkflowNode[]): void {
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    for (const dep of n.dependsOn ?? []) {
      if (!ids.has(dep)) {
        throw new Error(`Node "${n.id}" depends on unknown node "${dep}"`);
      }
      if (dep === n.id) {
        throw new Error(`Node "${n.id}" depends on itself`);
      }
    }
  }
  // 拓扑排序
  const indeg = new Map<string, number>();
  for (const n of nodes) indeg.set(n.id, 0);
  for (const n of nodes) for (const dep of n.dependsOn ?? []) {
    indeg.set(n.id, (indeg.get(n.id) ?? 0) + 1);
  }
  const queue: string[] = [];
  for (const [id, d] of indeg) if (d === 0) queue.push(id);
  let visited = 0;
  while (queue.length > 0) {
    const cur = queue.shift()!;
    visited++;
    for (const n of nodes) {
      if ((n.dependsOn ?? []).includes(cur)) {
        const newDeg = (indeg.get(n.id) ?? 0) - 1;
        indeg.set(n.id, newDeg);
        if (newDeg === 0) queue.push(n.id);
      }
    }
  }
  if (visited !== nodes.length) {
    throw new Error('DAG has a cycle');
  }
}

export async function runDAG(
  runId: string,
  nodes: WorkflowNode[],
  opts: DAGOptions = {}
): Promise<DAGResult> {
  validateDAG(nodes);
  const maxParallel = Math.max(1, opts.maxParallel ?? 4);
  const failFast = opts.failFast ?? true;

  const runtime = new Map<string, NodeRuntime>();
  for (const n of nodes) runtime.set(n.id, { node: n, status: 'pending', attempts: 0 });

  const ctx: NodeContext = {};
  const errors: Record<string, string> = {};
  const start = Date.now();

  /** 判定一个节点是否可以进入 ready */
  const canReady = (n: NodeRuntime): boolean => {
    if (n.status !== 'pending') return false;
    for (const dep of n.node.dependsOn ?? []) {
      const depRt = runtime.get(dep);
      if (!depRt) return false;
      if (depRt.status === 'failed') return false;
      if (depRt.status !== 'success' && depRt.status !== 'skipped') return false;
    }
    return true;
  };

  /** 触发条件谓词检查；若不满足则标 skipped */
  const evaluateWhen = async (n: NodeRuntime): Promise<boolean> => {
    if (!n.node.when) return true;
    try {
      return await n.node.when(ctx);
    } catch (e) {
      n.error = e instanceof Error ? e.message : String(e);
      n.status = 'failed';
      errors[n.node.id] = n.error;
      return false;
    }
  };

  const setStatus = async (n: NodeRuntime, status: NodeStatus, error?: string) => {
    n.status = status;
    if (error) n.error = error;
    if (opts.onNodeChange) await opts.onNodeChange(runId, n.node.id, status, error);
  };

  /** 主循环：分批并行触发 ready 节点 */
  const totalDeadline = opts.totalTimeoutMs ? start + opts.totalTimeoutMs : Infinity;

  while (true) {
    if (Date.now() > totalDeadline) {
      return {
        success: false,
        outputs: Object.fromEntries(
          Array.from(runtime.entries()).map(([k, v]) => [k, v.output])
        ),
        statuses: Object.fromEntries(Array.from(runtime.entries()).map(([k, v]) => [k, v.status])),
        errors: { ...errors, __dag__: 'total timeout exceeded' },
        durationMs: Date.now() - start,
      };
    }

    // 收集本轮可触发的节点
    const ready: NodeRuntime[] = [];
    for (const n of runtime.values()) {
      if (canReady(n)) ready.push(n);
    }

    if (ready.length === 0) {
      // 没有可触发节点 → 看是否所有节点都收敛（success / failed / skipped）
      const allDone = Array.from(runtime.values()).every(
        (n) => n.status === 'success' || n.status === 'failed' || n.status === 'skipped'
      );
      if (allDone) break;
      // 否则说明有节点被死锁（理论上不会发生，因为 validateDAG 已保证无环）
      // 兜底：把剩余 pending 标 failed
      for (const n of runtime.values()) {
        if (n.status === 'pending') {
          await setStatus(n, 'failed', 'deadlock: unreachable node');
          errors[n.node.id] = 'deadlock';
        }
      }
      break;
    }

    // 限制本批并行数
    const batch = ready.slice(0, maxParallel);
    for (const n of batch) await setStatus(n, 'ready');

    // 并行执行本批
    const results = await Promise.allSettled(
      batch.map(async (n) => {
        // 条件谓词
        const pass = await evaluateWhen(n);
        if (!pass) {
          if (n.status !== 'failed') await setStatus(n, 'skipped', n.error);
          return;
        }
        await setStatus(n, 'running');
        n.attempts++;
        try {
          // 节点级超时
          const timeoutMs = n.node.timeoutMs ?? Infinity;
          const output = await Promise.race([
            n.node.run(ctx),
            new Promise<never>((_, rej) =>
              setTimeout(() => rej(new Error(`node timeout after ${timeoutMs}ms`)), timeoutMs)
            ),
          ]);
          n.output = output;
          ctx[n.node.id] = output;
          await setStatus(n, 'success');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          n.error = msg;
          errors[n.node.id] = msg;
          await setStatus(n, 'failed', msg);
          if (failFast) throw e;
        }
      })
    );

    // fail-fast：任何一个抛错就立即终止
    if (failFast && results.some((r) => r.status === 'rejected')) break;
  }

  const statuses: Record<string, NodeStatus> = {};
  const outputs: Record<string, unknown> = {};
  for (const [id, rt] of runtime) {
    statuses[id] = rt.status;
    if (rt.output !== undefined) outputs[id] = rt.output;
  }
  const success = Object.values(statuses).every((s) => s === 'success' || s === 'skipped');

  return {
    success,
    outputs,
    statuses,
    errors,
    durationMs: Date.now() - start,
  };
}
