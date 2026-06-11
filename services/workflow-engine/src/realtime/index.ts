/**
 * realtime 模块入口
 * 一次性初始化并启动 event-bus + progress center + （可选）ws-server
 */

import { eventBus } from './event-bus.js';
import { progressCenter } from './progress.js';
import { realtimeWS } from './ws-server.js';
import { clearCancel } from './cancel.js';
import { config } from '../config.js';
import { getRedis } from '../orchestrator/checkpoint.js';

export interface RealtimeInitOptions {
  /** 是否启动 ws-server（生产环境用 attach() 手动挂；demo/单进程用 true） */
  startWS?: boolean;
  /** 启动时是否同时 clear 旧的 cancel flag */
  clearStaleCancels?: boolean;
}

/** 一键启动 realtime 子系统 */
export async function initRealtime(opts: RealtimeInitOptions = {}): Promise<void> {
  await eventBus.start();
  progressCenter.start();
  // 进度变化时主动广播
  progressCenter.onProgress((snap) => realtimeWS.broadcastProgress(snap));

  if (opts.startWS) {
    realtimeWS.start(config.port, '/ws');
  }

  if (opts.clearStaleCancels) {
    // 清理超过 1h 的 cancel 标志（避免误伤恢复中的 run）
    const r = getRedis();
    const pattern = `${config.redis.checkpointPrefix}cancel:*`;
    const stream = r.scanStream({ match: pattern, count: 100 });
    const keys: string[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (b: string[]) => keys.push(...b));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
    for (const k of keys) {
      const ttl = await r.ttl(k);
      if (ttl < 3600) await clearCancel(k.replace(`${config.redis.checkpointPrefix}cancel:`, ''));
    }
  }

  console.log('[realtime] initialized (event-bus + progress + ws ready)');
}

export async function shutdownRealtime(): Promise<void> {
  await realtimeWS.close();
  await eventBus.close();
}

export { eventBus } from './event-bus.js';
export { progressCenter, type ProgressSnapshot, type ProgressHandler } from './progress.js';
export { realtimeWS } from './ws-server.js';
export { requestCancel, isCancelled, clearCancel, withCancelCheck } from './cancel.js';
export { resumeRun, resumeFromCheckpoint, listEvents, getNodeStates, clearRing } from './resume.js';
