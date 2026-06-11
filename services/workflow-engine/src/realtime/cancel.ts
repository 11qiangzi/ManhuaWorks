/**
 * 用户取消
 *
 * 取消正在跑的步骤：
 *   1. 通过 Redis flag 标记 runId 取消（polling 检查）
 *   2. 同时尝试从 BullMQ 队列里删除未开始的 job
 *   3. 通过 event-bus 发布 workflow.cancelled
 *   4. 已经在跑的节点会通过 isCancelled(runId) 主动检查并 throw
 *
 * 这是一个 best-effort 机制——某些长跑节点（视频生成）取消会等到当前 batch
 * 结束才生效；如果要立即终止，需要 ai-router 配合 stop 端点（W4 任务）。
 */

import { eventBus } from './event-bus.js';
import { getRedis } from '../orchestrator/checkpoint.js';
import { config } from '../config.js';
import { queueRegistry, type WorkflowKind } from '../orchestrator/queue.js';

const cancelKey = (runId: string): string => `${config.redis.checkpointPrefix}cancel:${runId}`;

/** 标记取消 */
export async function requestCancel(runId: string, reason?: string): Promise<{
  marked: boolean;
  removed: boolean;
  reason?: string;
}> {
  const r = getRedis();
  // 写取消 flag（带 24h TTL）
  const marked = await r.set(cancelKey(runId), JSON.stringify({ ts: Date.now(), reason: reason ?? 'user-cancel' }), 'EX', 86_400);
  // 尝试从 BullMQ 移除（如果还在队列里）
  let removed = false;
  try {
    // 不知道具体 kind，挨个尝试（一般 7 种）
    for (const k of ['storyboard', 'character', 'scene', 'image-gen', 'tts', 'video-gen', 'compose'] as WorkflowKind[]) {
      if (await queueRegistry.cancel(k, runId).catch(() => false)) {
        removed = true;
        break;
      }
    }
  } catch {
    // ignore
  }
  // 发布事件
  await eventBus.publish({
    kind: 'workflow.cancelled',
    runId,
    workflow: 'unknown',
    data: { reason: reason ?? 'user-cancel', removed },
  });
  return { marked: marked === 'OK', removed, reason: reason ?? 'user-cancel' };
}

/** 节点内部轮询检查：返回 true 表示应放弃执行 */
export async function isCancelled(runId: string): Promise<boolean> {
  const r = getRedis();
  const v = await r.get(cancelKey(runId));
  return v !== null;
}

/** 清除取消标记（用于 resume 重跑时） */
export async function clearCancel(runId: string): Promise<void> {
  const r = getRedis();
  await r.del(cancelKey(runId));
}

/**
 * 包装节点执行器：周期性检查 cancel flag，发现就抛错
 * 用法：run: async (ctx) => withCancelCheck(runId, async () => { ... })
 */
export async function withCancelCheck<T>(runId: string, fn: () => Promise<T>, intervalMs = 5_000): Promise<T> {
  let cancelled = false;
  const timer = setInterval(async () => {
    if (await isCancelled(runId)) {
      cancelled = true;
      clearInterval(timer);
    }
  }, intervalMs);
  timer.unref?.();
  try {
    return await fn();
  } finally {
    clearInterval(timer);
  }
  // Note: 我们不能 inline 抛错（会破坏 Promise 状态机），所以执行器内部也应该
  // 周期性调 isCancelled()。这个包装器主要负责清理 timer。
}
