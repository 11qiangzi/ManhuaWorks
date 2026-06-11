/**
 * 事件总线（Redis Pub/Sub 跨实例广播）
 *
 * 用途：
 *   - workflow-engine 任意实例上执行的工作流节点状态变化
 *   - 都会被 publish 到 Redis channel
 *   - 所有实例（包括本实例）subscribe 后能收到事件
 *   - ws-server 拿到事件后下发给对应的 WebSocket 客户端
 *
 * 频道命名：
 *   mw:wf:events               — 节点级事件（每个 step 开始/结束/失败/重试）
 *   mw:wf:events:run:<runId>   — 单 run 频道（精细订阅）
 *
 * 不依赖 BullMQ 自己的 events（QueueEvents），避免与队列解耦。
 */

import type { Redis } from 'ioredis';
import { config } from '../config.js';
import { getRedis } from '../orchestrator/checkpoint.js';

/* ======================== 事件类型 ======================== */

export type EventKind =
  | 'workflow.queued'
  | 'workflow.started'
  | 'workflow.finished'
  | 'workflow.failed'
  | 'workflow.cancelled'
  | 'workflow.resumed'
  | 'node.ready'
  | 'node.running'
  | 'node.success'
  | 'node.failed'
  | 'node.retry'
  | 'node.skipped'
  | 'progress.tick'; // 周期性进度（带 percent / etaMs）

export interface WorkflowEvent {
  /** 事件 id（uuid v4 like） */
  id: string;
  /** 事件类型 */
  kind: EventKind;
  /** 哪个 run */
  runId: string;
  /** 哪个 workflow kind */
  workflow: string;
  /** 哪个 node（如果是节点事件） */
  nodeId?: string;
  /** 节点显示名 */
  nodeName?: string;
  /** 时间戳 ms */
  ts: number;
  /** 自由 payload */
  data?: Record<string, unknown>;
}

/* ======================== 频道常量 ======================== */

const CHANNEL_ALL = `${config.redis.checkpointPrefix}events`;
const channelForRun = (runId: string): string => `${CHANNEL_ALL}:run:${runId}`;

/* ======================== 简易 id 生成 ======================== */

let _idCounter = 0;
function newId(): string {
  _idCounter = (Date.now() % 1_000_000) * 1000 + (_idCounter++ & 0xfff);
  // 形如 ev-1f8b2c3a-7e
  return `ev-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
}

/* ======================== 事件总线 ======================== */

export type EventHandler = (ev: WorkflowEvent) => void | Promise<void>;

class WorkflowEventBus {
  private subscriber: Redis | null = null;
  private handlers = new Set<EventHandler>();
  private runHandlers = new Map<string, Set<EventHandler>>();
  private connected = false;
  private pendingPublishes: Promise<unknown> = Promise.resolve();

  /** 启动总线（懒连接） */
  async start(): Promise<void> {
    if (this.connected) return;
    const r = getRedis();
    // 单独的连接做 subscribe（ioredis 要求 subscribe 连接不能发普通命令）
    const { default: IORedis } = await import('ioredis');
    this.subscriber = new IORedis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    this.subscriber.on('error', (e) => console.error('[event-bus][sub]', e.message));

    await this.subscriber.subscribe(CHANNEL_ALL);
    this.subscriber.on('message', (channel, raw) => {
      this.dispatchRaw(channel, raw).catch((e) =>
        console.error('[event-bus] dispatch error', e)
      );
    });
    this.connected = true;
    console.log(`[event-bus] subscribed to ${CHANNEL_ALL}`);
  }

  /** 发布事件 */
  async publish(ev: Omit<WorkflowEvent, 'id' | 'ts'>): Promise<void> {
    const full: WorkflowEvent = {
      id: newId(),
      ts: Date.now(),
      ...ev,
    };
    const payload = JSON.stringify(full);
    const r = getRedis();
    // 串行化发布，避免极端并发
    this.pendingPublishes = this.pendingPublishes
      .catch(() => undefined)
      .then(async () => {
        await r.publish(CHANNEL_ALL, payload);
        await r.publish(channelForRun(full.runId), payload);
      });
    return this.pendingPublishes as Promise<void>;
  }

  /** 订阅所有事件 */
  onAll(h: EventHandler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  /** 订阅单个 run 的事件（精细化） */
  onRun(runId: string, h: EventHandler): () => void {
    let set = this.runHandlers.get(runId);
    if (!set) {
      set = new Set();
      this.runHandlers.set(runId, set);
      // 第一次订阅该 runId 时，开专属频道
      if (this.subscriber) {
        this.subscriber.subscribe(channelForRun(runId)).catch((e) =>
          console.error(`[event-bus] subscribe ${runId} failed`, e)
        );
      }
    }
    set.add(h);
    return () => {
      const s = this.runHandlers.get(runId);
      if (!s) return;
      s.delete(h);
      if (s.size === 0) {
        this.runHandlers.delete(runId);
        if (this.subscriber) {
          this.subscriber.unsubscribe(channelForRun(runId)).catch(() => undefined);
        }
      }
    };
  }

  private async dispatchRaw(channel: string, raw: string): Promise<void> {
    let ev: WorkflowEvent;
    try {
      ev = JSON.parse(raw) as WorkflowEvent;
    } catch {
      return;
    }
    // 全局订阅
    const all = Array.from(this.handlers);
    await Promise.allSettled(all.map((h) => Promise.resolve(h(ev))));

    // 单 run 订阅
    const runSet = this.runHandlers.get(ev.runId);
    if (runSet) {
      const rs = Array.from(runSet);
      await Promise.allSettled(rs.map((h) => Promise.resolve(h(ev))));
    }
  }

  async close(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit().catch(() => undefined);
      this.subscriber = null;
    }
    this.connected = false;
    this.handlers.clear();
    this.runHandlers.clear();
  }
}

export const eventBus = new WorkflowEventBus();
