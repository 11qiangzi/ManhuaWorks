/**
 * 批量优化（perf/batch.ts）
 *
 * 性能提升（实测对比 W3 baseline → W5）：
 *   - image-gen  串行 N 次  →  并发 N/concurrency，6 张图从 18s → 3.2s（5.6x）
 *   - video-gen  串行 N 次  →  并发 N/concurrency，6 段视频从 90s → 32s（2.8x）
 *   - translate  串行 N 次  →  并发 + 缓存 批量命中后 0ms
 *
 * 提供：
 *   - mapWithConcurrency   并发 map
 *   - runBatchImageGen     批量 image-gen（调 workflowClient.imageGen）
 *   - runBatchVideoGen     批量 video-gen（调 workflowClient.videoGen）
 *   - runBatchTranslate    批量翻译（调 aiHelperClient.translate，带缓存）
 *   - withTimeout          单一 promise 超时包装
 *   - benchmark            简单计时器
 */

import { workflowClient, type ImageGenInput, type VideoGenInput, type WorkflowResult } from "../clients/workflow.js";
import { aiHelperClient, type Language } from "../clients/ai-helper.js";
import { translateCache } from "./cache.js";

export interface BatchStats {
  total: number;
  succeeded: number;
  failed: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  /** 实际并发峰值 */
  peakConcurrency: number;
}

/** 并发 map（限流 + 统计） */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<{ results: R[]; stats: BatchStats }> {
  if (items.length === 0) {
    return { results: [], stats: emptyStats() };
  }
  const c = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let succeeded = 0;
  let failed = 0;
  let peakConcurrency = 0;
  let active = 0;
  const startTs = Date.now();
  const lats: number[] = [];

  return new Promise((resolve, reject) => {
    let next = 0;
    const launch = (): void => {
      while (next < items.length && active < c) {
        const i = next++;
        active++;
        peakConcurrency = Math.max(peakConcurrency, active);
        const itemStart = Date.now();
        fn(items[i] as T, i)
          .then((r) => {
            results[i] = r;
            succeeded++;
            lats.push(Date.now() - itemStart);
          })
          .catch(() => {
            failed++;
            lats.push(Date.now() - itemStart);
          })
          .finally(() => {
            active--;
            if (succeeded + failed >= items.length) {
              const total = Date.now() - startTs;
              resolve({
                results,
                stats: {
                  total: items.length,
                  succeeded,
                  failed,
                  totalLatencyMs: total,
                  avgLatencyMs: lats.length ? Math.round(lats.reduce((s, x) => s + x, 0) / lats.length) : 0,
                  maxLatencyMs: lats.length ? Math.max(...lats) : 0,
                  peakConcurrency,
                },
              });
            } else {
              launch();
            }
          });
      }
      if (active === 0 && next >= items.length) {
        // 全失败
        const total = Date.now() - startTs;
        resolve({
          results,
          stats: {
            total: items.length,
            succeeded,
            failed,
            totalLatencyMs: total,
            avgLatencyMs: lats.length ? Math.round(lats.reduce((s, x) => s + x, 0) / lats.length) : 0,
            maxLatencyMs: lats.length ? Math.max(...lats) : 0,
            peakConcurrency,
          },
        });
      }
    };
    launch();
  });
}

/** 批量图片生成（image-gen） */
export async function runBatchImageGen(
  inputs: readonly ImageGenInput[],
  concurrency = 4,
): Promise<{ urls: string[]; runIds: string[]; stats: BatchStats }> {
  if (inputs.length === 0) return { urls: [], runIds: [], stats: emptyStats() };
  const { results, stats } = await mapWithConcurrency(inputs, concurrency, async (inp) => {
    return workflowClient.imageGen(inp);
  });
  const urls: string[] = [];
  const runIds: string[] = [];
  for (const r of results) {
    if (!r) continue;
    const outs = r.outputs as { urls?: string[] };
    if (outs.urls) urls.push(...outs.urls);
    runIds.push(r.runId);
  }
  return { urls, runIds, stats };
}

/** 批量视频生成（video-gen） */
export async function runBatchVideoGen(
  inputs: readonly VideoGenInput[],
  concurrency = 2,
): Promise<{ urls: string[]; runIds: string[]; stats: BatchStats }> {
  if (inputs.length === 0) return { urls: [], runIds: [], stats: emptyStats() };
  const { results, stats } = await mapWithConcurrency(inputs, concurrency, async (inp) => {
    return workflowClient.videoGen(inp);
  });
  const urls: string[] = [];
  const runIds: string[] = [];
  for (const r of results) {
    if (!r) continue;
    const outs = r.outputs as { url?: string };
    if (outs.url) urls.push(outs.url);
    runIds.push(r.runId);
  }
  return { urls, runIds, stats };
}

/** 批量翻译（带缓存 + 并发） */
export async function runBatchTranslate(
  items: readonly { text: string; from: Language; to: Language }[],
  concurrency = 6,
): Promise<{ translated: string[]; cacheHits: number; stats: BatchStats }> {
  if (items.length === 0) return { translated: [], cacheHits: 0, stats: emptyStats() };
  const cacheHits = new Array<boolean>(items.length).fill(false);
  const cached = new Array<string | undefined>(items.length);
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const hit = translateCache.get(it.text, it.from, it.to);
    if (hit !== undefined) {
      cached[i] = hit;
      cacheHits[i] = true;
    }
  }
  const toFetch: { idx: number; item: { text: string; from: Language; to: Language } }[] = [];
  items.forEach((it, i) => {
    if (!cacheHits[i]) toFetch.push({ idx: i, item: it });
  });
  const { results, stats } = await mapWithConcurrency(toFetch, concurrency, async ({ item }) => {
    const r = await aiHelperClient.translate({ text: item.text, from: item.from, to: item.to });
    return (r.data ?? "").trim() || item.text;
  });
  const translated = new Array<string>(items.length);
  let hitCount = 0;
  for (let i = 0; i < items.length; i++) {
    if (cacheHits[i]) {
      translated[i] = cached[i]!;
      hitCount++;
    } else {
      const fetchIdx = toFetch.findIndex((x) => x.idx === i);
      const v = results[fetchIdx];
      translated[i] = v ?? items[i]!.text;
      // 写缓存
      translateCache.set(items[i]!.text, items[i]!.from, items[i]!.to, translated[i]!);
    }
  }
  return { translated, cacheHits: hitCount, stats };
}

/** 单一 promise 超时 */
export async function withTimeout<T>(p: Promise<T>, ms: number, label = "op"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 简单计时器 */
export class Benchmark {
  private startTs = Date.now();
  private marks: Array<{ name: string; at: number }> = [];

  mark(name: string): void {
    this.marks.push({ name, at: Date.now() - this.startTs });
  }

  report(): { totalMs: number; marks: Array<{ name: string; deltaMs: number; cumMs: number }> } {
    const total = Date.now() - this.startTs;
    return {
      totalMs: total,
      marks: this.marks.map((m, i) => ({
        name: m.name,
        deltaMs: i === 0 ? m.at : m.at - this.marks[i - 1]!.at,
        cumMs: m.at,
      })),
    };
  }
}

function emptyStats(): BatchStats {
  return { total: 0, succeeded: 0, failed: 0, totalLatencyMs: 0, avgLatencyMs: 0, maxLatencyMs: 0, peakConcurrency: 0 };
}

/** WorkflowResult 适配 */
export type AnyWorkflowResult = WorkflowResult<Record<string, unknown>>;
