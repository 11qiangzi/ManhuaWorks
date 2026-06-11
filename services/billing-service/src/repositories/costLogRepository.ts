/**
 * Cost Log Repository（in-memory）
 *
 * 设计说明：
 *  - 任务允许 in-memory（Map + 索引）或 better-sqlite3；这里选 in-memory，
 *    因为：
 *      1) AI 调用日志高频写入，Map 写入 O(1)；
 *      2) 单进程部署足够；如需持久化可换 better-sqlite3，接口不变。
 *  - 用 userId / projectId 两个二级索引加速 listBy* / aggregate* 查询。
 *  - 所有 ID 用 uuid v4（node:crypto.randomUUID，零依赖）。
 */

import { randomUUID } from "node:crypto";
import type {
  AggregatePeriod,
  AiProvider,
  CostAggregate,
  CostLogCreateInput,
  CostLogListOptions,
  CostLogRecord,
} from "../models/costLog";

/** 默认上限，防止 list 拉爆内存 */
const DEFAULT_LIST_LIMIT = 1000;
const MAX_LIST_LIMIT = 10_000;

/** 内存表：id -> record */
const store = new Map<string, CostLogRecord>();
/** userId -> Set<id> */
const indexByUser = new Map<string, Set<string>>();
/** projectId -> Set<id>（projectId 可能为 null，跳过索引） */
const indexByProject = new Map<string, Set<string>>();

/** 给定 Date -> 周期起点（Date） */
function periodStart(d: Date, period: AggregatePeriod): Date {
  const out = new Date(d.getTime());
  out.setUTCMilliseconds(0);
  out.setUTCSeconds(0);
  out.setUTCMinutes(0);
  out.setUTCHours(0);
  switch (period) {
    case "day":
      return out;
    case "week": {
      const day = out.getUTCDay(); // 0=Sun
      out.setUTCDate(out.getUTCDate() - day);
      return out;
    }
    case "month":
      out.setUTCDate(1);
      return out;
    case "year":
      out.setUTCMonth(0, 1);
      return out;
    case "all":
      return new Date(0);
    default:
      return out;
  }
}

/** 检查记录是否在 [from, to) 区间（默认 from=epoch, to=+∞） */
function inRange(r: CostLogRecord, from?: Date, to?: Date): boolean {
  if (from && r.createdAt.getTime() < from.getTime()) return false;
  if (to && r.createdAt.getTime() >= to.getTime()) return false;
  return true;
}

function matchesProvider(r: CostLogRecord, provider?: AiProvider): boolean {
  return !provider || r.provider === provider;
}

function takeLimited<T>(arr: T[], offset: number, limit: number): T[] {
  return arr.slice(offset, offset + limit);
}

function bumpIndex(idx: Map<string, Set<string>>, key: string | null | undefined, id: string): void {
  if (!key) return;
  let s = idx.get(key);
  if (!s) {
    s = new Set();
    idx.set(key, s);
  }
  s.add(id);
}

function dropIndex(idx: Map<string, Set<string>>, key: string | null | undefined, id: string): void {
  if (!key) return;
  const s = idx.get(key);
  if (s) s.delete(id);
}

export const costLogRepository = {
  /** 创建一条成本日志，返回完整记录（含生成的 id/createdAt/totalTokens） */
  create(input: CostLogCreateInput): CostLogRecord {
    const totalTokens = (input.promptTokens | 0) + (input.completionTokens | 0);
    const rec: CostLogRecord = {
      id: randomUUID(),
      userId: input.userId,
      projectId: input.projectId ?? null,
      workflowId: input.workflowId ?? null,
      nodeId: input.nodeId ?? null,
      provider: input.provider,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens,
      costCents: input.costCents,
      currency: input.currency ?? "CNY",
      requestId: input.requestId ?? null,
      createdAt: new Date(),
    };
    store.set(rec.id, rec);
    bumpIndex(indexByUser, rec.userId, rec.id);
    bumpIndex(indexByProject, rec.projectId, rec.id);
    return rec;
  },

  /** 按 id 查 */
  findById(id: string): CostLogRecord | null {
    return store.get(id) ?? null;
  },

  /** 按 user 列表（最新在前） */
  listByUser(userId: string, opts: CostLogListOptions = {}): CostLogRecord[] {
    const ids = indexByUser.get(userId);
    if (!ids || ids.size === 0) return [];
    const arr: CostLogRecord[] = [];
    for (const id of ids) {
      const r = store.get(id);
      if (!r) continue;
      if (!inRange(r, opts.from, opts.to)) continue;
      if (!matchesProvider(r, opts.provider)) continue;
      arr.push(r);
    }
    arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = Math.max(0, opts.offset ?? 0);
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIST_LIMIT));
    return takeLimited(arr, offset, limit);
  },

  /** 按 project 列表（最新在前） */
  listByProject(projectId: string, opts: CostLogListOptions = {}): CostLogRecord[] {
    const ids = indexByProject.get(projectId);
    if (!ids || ids.size === 0) return [];
    const arr: CostLogRecord[] = [];
    for (const id of ids) {
      const r = store.get(id);
      if (!r) continue;
      if (!inRange(r, opts.from, opts.to)) continue;
      if (!matchesProvider(r, opts.provider)) continue;
      arr.push(r);
    }
    arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = Math.max(0, opts.offset ?? 0);
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIST_LIMIT));
    return takeLimited(arr, offset, limit);
  },

  /** 按 user 聚合（按 period 切分，可选） */
  aggregateByUser(userId: string, period: AggregatePeriod = "month"): CostAggregate[] {
    const ids = indexByUser.get(userId);
    if (!ids || ids.size === 0) return [];
    const buckets = new Map<string, CostAggregate>();
    for (const id of ids) {
      const r = store.get(id);
      if (!r) continue;
      const start = periodStart(r.createdAt, period);
      const key = start.toISOString();
      let agg = buckets.get(key);
      if (!agg) {
        agg = {
          key,
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costCents: 0,
          currency: r.currency,
          period,
        };
        buckets.set(key, agg);
      }
      agg.count += 1;
      agg.promptTokens += r.promptTokens;
      agg.completionTokens += r.completionTokens;
      agg.totalTokens += r.totalTokens;
      agg.costCents += r.costCents;
    }
    return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
  },

  /** 按 project 聚合（按 period 切分） */
  aggregateByProject(projectId: string, period: AggregatePeriod = "month"): CostAggregate[] {
    const ids = indexByProject.get(projectId);
    if (!ids || ids.size === 0) return [];
    const buckets = new Map<string, CostAggregate>();
    for (const id of ids) {
      const r = store.get(id);
      if (!r) continue;
      const start = periodStart(r.createdAt, period);
      const key = start.toISOString();
      let agg = buckets.get(key);
      if (!agg) {
        agg = {
          key,
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costCents: 0,
          currency: r.currency,
          period,
        };
        buckets.set(key, agg);
      }
      agg.count += 1;
      agg.promptTokens += r.promptTokens;
      agg.completionTokens += r.completionTokens;
      agg.totalTokens += r.totalTokens;
      agg.costCents += r.costCents;
    }
    return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
  },

  /** 按 provider 聚合（period 切分，跨所有用户） */
  aggregateByProvider(period: AggregatePeriod = "month"): CostAggregate[] {
    const buckets = new Map<string, CostAggregate>();
    for (const r of store.values()) {
      const start = periodStart(r.createdAt, period);
      const key = `${r.provider}|${start.toISOString()}`;
      let agg = buckets.get(key);
      if (!agg) {
        agg = {
          key,
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costCents: 0,
          currency: r.currency,
          period,
        };
        buckets.set(key, agg);
      }
      agg.count += 1;
      agg.promptTokens += r.promptTokens;
      agg.completionTokens += r.completionTokens;
      agg.totalTokens += r.totalTokens;
      agg.costCents += r.costCents;
    }
    return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
  },

  /** 测试用：清空全部 */
  __reset(): void {
    store.clear();
    indexByUser.clear();
    indexByProject.clear();
  },

  /** 测试用：当前内存记录数 */
  __size(): number {
    return store.size;
  },
};

export default costLogRepository;
