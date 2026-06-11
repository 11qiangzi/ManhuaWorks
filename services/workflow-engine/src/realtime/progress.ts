/**
 * 进度推送
 *
 * 监听 event-bus 的节点事件 → 计算整体进度 → 推送给 ws-server
 *
 * 整体进度算法：
 *   - 收集到所有静态节点（DAG 已知）
 *   - 每个节点权重相等 → done_weight / total_weight
 *   - running 状态计 0.5（半步）
 *   - 实时估算 ETA（基于已完成的平均耗时）
 */

import { eventBus, type WorkflowEvent, type EventKind } from './event-bus.js';

export interface ProgressSnapshot {
  runId: string;
  workflow: string;
  /** 0-100 */
  percent: number;
  /** 当前在跑的节点 id */
  currentNode?: string;
  currentNodeName?: string;
  /** 已经完成的节点数 */
  doneCount: number;
  /** 全部节点数 */
  totalCount: number;
  /** 预计剩余 ms */
  etaMs?: number;
  /** 当前状态描述（人类可读） */
  message: string;
  /** 时间戳 */
  ts: number;
}

export type ProgressHandler = (snap: ProgressSnapshot) => void | Promise<void>;

interface NodeProgress {
  nodeId: string;
  name: string;
  weight: number; // 默认 1；可扩展为节点耗时预估
  status: 'pending' | 'ready' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  attempt: number;
}

/** 跟踪一个 run 的进度 */
class ProgressTracker {
  runId: string;
  workflow: string;
  nodes = new Map<string, NodeProgress>();
  /** 记录节点首次出现的顺序 → 当作 topological 顺序 */
  private order: string[] = [];
  /** 估计的总节点数（由 workflow 注册） */
  private expectedTotal: number = 0;
  /** 已开始时间 */
  readonly startedAt: number;
  /** 节点显示名（来源 DAG 配置） */
  private static: Array<{ id: string; name: string }> = [];

  constructor(runId: string, workflow: string) {
    this.runId = runId;
    this.workflow = workflow;
    this.startedAt = Date.now();
  }

  /** 注册工作流的全部节点（用于预填节点进度） */
  registerNodes(nodes: Array<{ id: string; name: string }>): void {
    this.static = nodes.slice();
    this.expectedTotal = nodes.length;
    for (const n of nodes) {
      this.nodes.set(n.id, {
        nodeId: n.id,
        name: n.name,
        weight: 1,
        status: 'pending',
        attempt: 0,
      });
      this.order.push(n.id);
    }
  }

  /** 应用一个事件（更新内部状态） */
  apply(ev: WorkflowEvent): void {
    if (ev.runId !== this.runId) return;
    let np = ev.nodeId ? this.nodes.get(ev.nodeId) : undefined;
    if (ev.nodeId && !np) {
      np = {
        nodeId: ev.nodeId,
        name: ev.nodeName ?? ev.nodeId,
        weight: 1,
        status: 'pending',
        attempt: 0,
      };
      this.nodes.set(ev.nodeId, np);
      this.order.push(ev.nodeId);
    }
    if (!np) return;
    switch (ev.kind as EventKind) {
      case 'node.ready':
        np.status = 'ready';
        break;
      case 'node.running':
        np.status = 'running';
        if (!np.startedAt) np.startedAt = ev.ts;
        np.attempt++;
        break;
      case 'node.success':
        np.status = 'success';
        np.finishedAt = ev.ts;
        break;
      case 'node.failed':
        np.status = 'failed';
        np.finishedAt = ev.ts;
        np.error = (ev.data?.['error'] as string) ?? 'unknown error';
        break;
      case 'node.retry':
        np.attempt++;
        break;
      case 'node.skipped':
        np.status = 'skipped';
        np.finishedAt = ev.ts;
        break;
    }
  }

  /** 计算当前进度快照 */
  snapshot(): ProgressSnapshot {
    let totalWeight = 0;
    let doneWeight = 0;
    let runningNodes = 0;
    let doneCount = 0;
    let cur: NodeProgress | undefined;
    let message = '准备中…';
    for (const n of this.nodes.values()) {
      totalWeight += n.weight;
      switch (n.status) {
        case 'success':
        case 'skipped':
          doneWeight += n.weight;
          doneCount++;
          break;
        case 'running':
          doneWeight += n.weight * 0.5; // 半步
          runningNodes++;
          cur = n;
          break;
        case 'failed':
          // failed 算全重（含回滚余地）
          break;
        case 'ready':
        case 'pending':
          // 不计入
          break;
      }
    }
    const percent = totalWeight > 0 ? Math.min(100, Math.round((doneWeight / totalWeight) * 100)) : 0;
    const etaMs = this.etaEstimate();
    if (cur) message = `执行中：${cur.name}`;
    else if (doneCount === this.nodes.size && this.nodes.size > 0) message = '已完成';
    else if (runningNodes > 0) message = `执行中`;
    else message = '准备中…';

    return {
      runId: this.runId,
      workflow: this.workflow,
      percent,
      currentNode: cur?.nodeId,
      currentNodeName: cur?.name,
      doneCount,
      totalCount: this.nodes.size,
      etaMs,
      message,
      ts: Date.now(),
    };
  }

  /** 基于已完成节点平均耗时估算剩余时间 */
  private etaEstimate(): number | undefined {
    const completed: number[] = [];
    for (const n of this.nodes.values()) {
      if ((n.status === 'success' || n.status === 'skipped') && n.startedAt && n.finishedAt) {
        completed.push(n.finishedAt - n.startedAt);
      }
    }
    if (completed.length === 0) {
      // 没有已完成节点 → 看当前正在跑的节点耗时
      let rDur = 0;
      for (const n of this.nodes.values()) {
        if (n.status === 'running' && n.startedAt) rDur = Math.max(rDur, Date.now() - n.startedAt);
      }
      return rDur > 0 ? rDur * Math.max(1, this.nodes.size) : undefined;
    }
    const avg = completed.reduce((a, b) => a + b, 0) / completed.length;
    const remaining = Array.from(this.nodes.values()).filter(
      (n) => n.status === 'pending' || n.status === 'ready' || n.status === 'running'
    ).length;
    return Math.max(0, Math.round(avg * remaining));
  }

  isTerminal(): boolean {
    if (this.nodes.size === 0) return false;
    return Array.from(this.nodes.values()).every(
      (n) => n.status === 'success' || n.status === 'skipped' || n.status === 'failed'
    );
  }
}

/* ======================== 进度中心（注册表） ======================== */

class ProgressCenter {
  private trackers = new Map<string, ProgressTracker>();
  private handlers = new Set<ProgressHandler>();
  private globalHandler: ((ev: WorkflowEvent) => void | Promise<void>) | null = null;

  /** 启动（订阅 event-bus） */
  start(): void {
    if (this.globalHandler) return;
    this.globalHandler = (ev) => {
      // 找到或创建 tracker
      let tr = this.trackers.get(ev.runId);
      if (!tr) {
        tr = new ProgressTracker(ev.runId, ev.workflow);
        this.trackers.set(ev.runId, tr);
      }
      tr.apply(ev);
      // 广播
      const snap = tr.snapshot();
      const all = Array.from(this.handlers);
      Promise.allSettled(all.map((h) => Promise.resolve(h(snap)))).catch(() => undefined);
      // 终态清理
      if (tr.isTerminal()) {
        setTimeout(() => this.trackers.delete(ev.runId), 5_000);
      }
    };
    eventBus.onAll(this.globalHandler);
  }

  /** 注册一个 run 的全部节点（必须在 run 之前调用一次，便于预填） */
  registerRunNodes(runId: string, workflow: string, nodes: Array<{ id: string; name: string }>): void {
    let tr = this.trackers.get(runId);
    if (!tr) {
      tr = new ProgressTracker(runId, workflow);
      this.trackers.set(runId, tr);
    }
    tr.registerNodes(nodes);
  }

  /** 客户端订阅 */
  onProgress(h: ProgressHandler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  /** 主动查询 */
  getSnapshot(runId: string): ProgressSnapshot | undefined {
    return this.trackers.get(runId)?.snapshot();
  }

  /** 列出所有正在跟踪的 run */
  listActive(): string[] {
    return Array.from(this.trackers.keys());
  }
}

export const progressCenter = new ProgressCenter();
