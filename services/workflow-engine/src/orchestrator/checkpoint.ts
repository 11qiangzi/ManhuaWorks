/**
 * 断点续跑
 * - 把工作流执行进度定期落 Redis
 * - 失败 / 重启时可以从最后一个完成的节点继续
 * - 节点级 checkpoint + runId 整体快照双层
 */

import { Redis } from 'ioredis';
import { config } from '../config.js';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  _redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: null, // BullMQ 兼容
    enableReadyCheck: true,
    lazyConnect: false,
  });
  _redis.on('error', (e) => console.error('[workflow-engine][redis]', e.message));
  return _redis;
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit().catch(() => undefined);
    _redis = null;
  }
}

const cpKey = (runId: string): string => `${config.redis.checkpointPrefix}${runId}`;
const nodeKey = (runId: string, nodeId: string): string =>
  `${config.redis.checkpointPrefix}${runId}:node:${nodeId}`;

export interface NodeCheckpoint {
  nodeId: string;
  status: 'pending' | 'ready' | 'running' | 'success' | 'failed' | 'skipped';
  output?: unknown;
  error?: string;
  attempts: number;
  updatedAt: number;
}

export interface RunSnapshot {
  runId: string;
  workflow: string;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  startedAt: number;
  updatedAt: number;
  nodes: Record<string, NodeCheckpoint>;
  inputs: Record<string, unknown>;
}

/** 写入单节点 checkpoint（带 TTL） */
export async function saveNodeCheckpoint(
  runId: string,
  nodeId: string,
  data: NodeCheckpoint
): Promise<void> {
  const r = getRedis();
  await r.set(nodeKey(runId, nodeId), JSON.stringify(data), 'EX', config.checkpoint.ttlSec);
}

/** 读取单节点 checkpoint */
export async function loadNodeCheckpoint(
  runId: string,
  nodeId: string
): Promise<NodeCheckpoint | null> {
  const r = getRedis();
  const raw = await r.get(nodeKey(runId, nodeId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NodeCheckpoint;
  } catch {
    return null;
  }
}

/** 写入整个 run 的快照（断点续跑主入口） */
export async function saveSnapshot(snap: RunSnapshot): Promise<void> {
  const r = getRedis();
  const next: RunSnapshot = { ...snap, updatedAt: Date.now() };
  await r.set(cpKey(snap.runId), JSON.stringify(next), 'EX', config.checkpoint.ttlSec);
}

/** 读取整个 run 的快照 */
export async function loadSnapshot(runId: string): Promise<RunSnapshot | null> {
  const r = getRedis();
  const raw = await r.get(cpKey(runId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RunSnapshot;
  } catch {
    return null;
  }
}

/** 删除 run 及其所有节点 checkpoint（成功完成时清理） */
export async function deleteSnapshot(runId: string): Promise<void> {
  const r = getRedis();
  await r.del(cpKey(runId));
  // 节点 checkpoint 用 SCAN 清理（量小可接受）
  const pattern = `${config.redis.checkpointPrefix}${runId}:node:*`;
  const stream = r.scanStream({ match: pattern, count: 100 });
  const keys: string[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (batch: string[]) => keys.push(...batch));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  if (keys.length > 0) await r.del(...keys);
}

/** 列出所有活跃 runId（用于运维查询） */
export async function listActiveRuns(): Promise<string[]> {
  const r = getRedis();
  const pattern = `${config.redis.checkpointPrefix}*`;
  const stream = r.scanStream({ match: pattern, count: 200 });
  const keys: string[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (batch: string[]) => keys.push(...batch));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  // 过滤掉 node 子键
  return Array.from(new Set(keys.filter((k) => !k.includes(':node:')).map((k) => {
    const prefix = config.redis.checkpointPrefix;
    return k.startsWith(prefix) ? k.slice(prefix.length) : k;
  })));
}
