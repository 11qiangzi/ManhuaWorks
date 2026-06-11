/**
 * 断点续传（resume）
 *
 * 场景：客户端 WebSocket 断线后重连，需要拿到缺失的进度事件。
 * 实现：
 *   - 每个 run 的事件在 Redis 上按 id 保留（ring buffer）
 *   - 客户端重连时带上 lastEventId，服务端从该 id 之后的事件开始 replay
 *   - 同时基于 checkpoint.ts 的节点级缓存重算当前快照
 *
 * 事件保留窗口：默认 10 分钟（足够一次完整短流程）
 */

import { getRedis, loadNodeCheckpoint, loadSnapshot } from '../orchestrator/checkpoint.js';
import { config } from '../config.js';
import { eventBus, type WorkflowEvent } from './event-bus.js';
import { progressCenter, type ProgressSnapshot } from './progress.js';

const RESERVED_TTL = 600; // 10 分钟
const MAX_EVENTS_PER_RUN = 5000;

const ringKey = (runId: string): string => `${config.redis.checkpointPrefix}ring:${runId}`;
const cursorKey = (runId: string, clientId: string): string =>
  `${config.redis.checkpointPrefix}ring:cursor:${runId}:${clientId}`;

interface StoredEvent extends WorkflowEvent {
  /** ring buffer 自增序号 */
  seq: number;
}

export interface ResumeResult {
  /** 是否需要从断点重放 */
  replayed: number;
  /** 最新的事件序号（供客户端下次重连定位） */
  latestSeq: number;
  /** 现状快照（replay 后的真实进度） */
  snapshot: ProgressSnapshot | null;
  /** 该 run 是否已结束 */
  finished: boolean;
}

/** 监听 event-bus，把事件落到 ring buffer */
let ringListenerInstalled = false;
async function ensureRingListener(): Promise<void> {
  if (ringListenerInstalled) return;
  ringListenerInstalled = true;
  eventBus.onAll(async (ev) => {
    const r = getRedis();
    // 用 LIST 维护 ring
    const key = ringKey(ev.runId);
    // RPUSH 后 LTRIM 保持最新 N 条
    const seq = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const stored: StoredEvent = { ...ev, seq };
    await r.rpush(key, JSON.stringify(stored));
    await r.ltrim(key, -MAX_EVENTS_PER_RUN, -1);
    await r.expire(key, RESERVED_TTL);
  });
}

/**
 * 客户端重连时调用：拿到从 lastEventId 之后的所有事件
 * @param runId 工作流 id
 * @param lastSeq 客户端最后收到的事件序号（0 表示从头开始）
 * @param clientId 客户端标识（用于服务端做游标）
 */
export async function resumeRun(
  runId: string,
  lastSeq: number = 0,
  clientId?: string
): Promise<ResumeResult> {
  await ensureRingListener();

  const r = getRedis();
  const raw = await r.lrange(ringKey(runId), 0, -1);
  const events: StoredEvent[] = [];
  for (const s of raw) {
    try {
      events.push(JSON.parse(s) as StoredEvent);
    } catch {
      // 跳过损坏事件
    }
  }
  // 按序号升序
  events.sort((a, b) => a.seq - b.seq);

  // 过滤出 > lastSeq
  const tail = events.filter((e) => e.seq > lastSeq);
  const latestSeq = events.length > 0 ? events[events.length - 1]!.seq : lastSeq;

  // 把 tail 重放到 progressCenter（让状态机跟实际一致）
  if (tail.length > 0) {
    for (const ev of tail) {
      // progressCenter 监听 event-bus，所以直接发布即可触发它
      await eventBus.publish({
        kind: ev.kind,
        runId: ev.runId,
        workflow: ev.workflow,
        nodeId: ev.nodeId,
        nodeName: ev.nodeName,
        data: ev.data,
      });
    }
  }

  // 写客户端游标（便于排查）
  if (clientId) {
    await r.set(cursorKey(runId, clientId), String(latestSeq), 'EX', RESERVED_TTL);
  }

  // 读 snapshot
  const snapshot = progressCenter.getSnapshot(runId) ?? null;
  // 看是否终态
  const cp = await loadSnapshot(runId);
  const finished = cp ? cp.status === 'success' || cp.status === 'failed' || cp.status === 'cancelled' : false;

  return {
    replayed: tail.length,
    latestSeq,
    snapshot,
    finished,
  };
}

/**
 * 列出 run 全部已存事件（用于前端补齐 UI，不触发重放）
 */
export async function listEvents(runId: string, sinceSeq: number = 0): Promise<StoredEvent[]> {
  const r = getRedis();
  const raw = await r.lrange(ringKey(runId), 0, -1);
  const out: StoredEvent[] = [];
  for (const s of raw) {
    try {
      const e = JSON.parse(s) as StoredEvent;
      if (e.seq > sinceSeq) out.push(e);
    } catch {
      // 跳过
    }
  }
  out.sort((a, b) => a.seq - b.seq);
  return out;
}

/**
 * 计算 from-checkpoint 的快速恢复（不依赖 ring）
 * 当 ring 过期但 checkpoint 还在时，回退到 checkpoint 模式
 */
export async function resumeFromCheckpoint(runId: string): Promise<ProgressSnapshot | null> {
  const snap = await loadSnapshot(runId);
  if (!snap) return null;
  // 同步节点状态到 progressCenter
  for (const [nid, np] of Object.entries(snap.nodes)) {
    await eventBus.publish({
      kind: `node.${np.status}` as WorkflowEvent['kind'],
      runId,
      workflow: snap.workflow,
      nodeId: nid,
      data: { error: np.error, attempts: np.attempts },
    });
  }
  return progressCenter.getSnapshot(runId) ?? null;
}

/** 列出 run 下每个节点的最新 checkpoint（用于客户端重连后立即拉一次全量） */
export async function getNodeStates(runId: string): Promise<Record<string, unknown>> {
  const snap = await loadSnapshot(runId);
  if (!snap) return {};
  const out: Record<string, unknown> = {};
  for (const [nid, np] of Object.entries(snap.nodes)) {
    out[nid] = np;
  }
  return out;
}

/** 显式清理 ring（用于 run 完成后） */
export async function clearRing(runId: string): Promise<void> {
  const r = getRedis();
  await r.del(ringKey(runId));
  // 删所有该 run 的客户端游标
  const pattern = `${config.redis.checkpointPrefix}ring:cursor:${runId}:*`;
  const stream = r.scanStream({ match: pattern, count: 100 });
  const keys: string[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (b: string[]) => keys.push(...b));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  if (keys.length > 0) await r.del(...keys);
}
