/**
 * 任务队列（BullMQ + Redis）
 * - 6 个内置队列：storyboard / character / scene / image-gen / tts / video-gen / compose
 * - 任务入队即返回 jobId，异步执行
 * - Worker 在同一进程内（可拆出）
 *
 * 注意：每个工作流内含 DAG 节点；队列层面只调度"工作流粒度"。
 *       节点粒度的并行/串行由 dag.ts 负责。
 */

import { Queue, Worker, QueueEvents, type JobsOptions } from 'bullmq';
import { config } from '../config.js';
import { getRedis } from './checkpoint.js';

export type WorkflowKind =
  | 'storyboard'
  | 'character'
  | 'scene'
  | 'image-gen'
  | 'tts'
  | 'video-gen'
  | 'compose';

export interface WorkflowJob {
  runId: string;
  kind: WorkflowKind;
  inputs: Record<string, unknown>;
  /** 提交者（来自 auth 中间件） */
  subject?: string;
  enqueuedAt: number;
}

type Handler = (job: WorkflowJob) => Promise<unknown>;

class QueueRegistry {
  private queues = new Map<WorkflowKind, Queue<WorkflowJob>>();
  private workers = new Map<WorkflowKind, Worker<WorkflowJob>>();
  private events = new Map<WorkflowKind, QueueEvents>();
  private handlers = new Map<WorkflowKind, Handler>();

  getQueue(kind: WorkflowKind): Queue<WorkflowJob> {
    let q = this.queues.get(kind);
    if (q) return q;
    // BullMQ 要求 connection 是 IORedis 实例本身（不接 URL 字符串的兼容性问题）
    q = new Queue<WorkflowJob>(`wf:${kind}`, {
      prefix: config.redis.queuePrefix,
      connection: { host: new URL(config.redis.url).hostname, port: Number(new URL(config.redis.url).port) || 6379 },
      defaultJobOptions: {
        attempts: config.retry.maxAttempts,
        backoff: { type: 'exponential', delay: config.retry.baseMs },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86_400 },
      } satisfies JobsOptions,
    });
    this.queues.set(kind, q);
    return q;
  }

  getEvents(kind: WorkflowKind): QueueEvents {
    let e = this.events.get(kind);
    if (e) return e;
    e = new QueueEvents(`wf:${kind}`, {
      prefix: config.redis.queuePrefix,
      connection: { host: new URL(config.redis.url).hostname, port: Number(new URL(config.redis.url).port) || 6379 },
    });
    this.events.set(kind, e);
    return e;
  }

  /** 注册 worker + handler（同一 kind 只能注册一次） */
  registerWorker(kind: WorkflowKind, handler: Handler): void {
    if (this.handlers.has(kind)) {
      throw new Error(`Worker for "${kind}" already registered`);
    }
    this.handlers.set(kind, handler);
    const w = new Worker<WorkflowJob>(
      `wf:${kind}`,
      async (job) => handler(job.data),
      {
        prefix: config.redis.queuePrefix,
        connection: { host: new URL(config.redis.url).hostname, port: Number(new URL(config.redis.url).port) || 6379 },
        concurrency: config.orchestrator.workerConcurrency,
      }
    );
    w.on('failed', (job, err) => {
      console.error(`[workflow-engine][${kind}] job ${job?.id} failed:`, err.message);
    });
    w.on('completed', (job) => {
      console.log(`[workflow-engine][${kind}] job ${job?.id} completed`);
    });
    this.workers.set(kind, w);
  }

  /** 入队 */
  async enqueue(kind: WorkflowKind, data: WorkflowJob, opts?: JobsOptions): Promise<string> {
    const q = this.getQueue(kind);
    const job = await q.add(`run:${data.runId}`, data, {
      jobId: data.runId, // 同一 runId 不可重复入队
      ...opts,
    });
    return job.id ?? data.runId;
  }

  /** 取消（仅移除等待中的；运行中的会被 abort via Redis flag） */
  async cancel(kind: WorkflowKind, runId: string): Promise<boolean> {
    const q = this.getQueue(kind);
    const job = await q.getJob(runId);
    if (!job) return false;
    await job.remove();
    return true;
  }

  /** 查询 job 状态 */
  async getStatus(kind: WorkflowKind, runId: string): Promise<{
    state: string;
    progress: number | object | string;
    failedReason?: string;
  } | null> {
    const q = this.getQueue(kind);
    const job = await q.getJob(runId);
    if (!job) return null;
    const state = await job.getState();
    return {
      state,
      progress: job.progress as number | object | string,
      failedReason: job.failedReason,
    };
  }

  async close(): Promise<void> {
    await Promise.all([
      ...Array.from(this.workers.values()).map((w) => w.close()),
      ...Array.from(this.events.values()).map((e) => e.close()),
      ...Array.from(this.queues.values()).map((q) => q.close()),
    ]);
  }
}

export const queueRegistry = new QueueRegistry();
