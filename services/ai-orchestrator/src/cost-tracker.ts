/**
 * 成本追踪
 * - 每步完成后累加 cost / latency
 * - 同步调 byokClient.recordUsage 落 ai-keys-service
 * - run 结束输出明细账单
 *
 * 注意：recordUsage 是 best-effort，失败不阻塞主流程（带 console.error）。
 */

import { byokClient } from "./clients/byok.js";
import type { ProviderId } from "./clients/ai-router.js";

export interface CostEntry {
  /** 步骤名（如 "storyboard"） */
  step: string;
  /** 实际产生成本的供应商（可空：纯编排步骤无成本） */
  provider: ProviderId | null;
  costUsd: number;
  latencyMs: number;
  /** 实际是否走 BYOK */
  usedByok: boolean;
  ts: number;
}

export interface CostSummary {
  totalCostUsd: number;
  totalLatencyMs: number;
  stepCount: number;
  byProvider: Record<string, number>;
  byStep: Record<string, number>;
  byokCostUsd: number;
  platformCostUsd: number;
}

export interface RunContext {
  runId: string;
  userId: string;
}

export class CostTracker {
  private entries: CostEntry[] = [];
  private startTs = Date.now();

  constructor(public readonly ctx: RunContext) {}

  /** 记录一步的成本 */
  record(entry: Omit<CostEntry, "ts">): void {
    const full: CostEntry = { ...entry, ts: Date.now() };
    this.entries.push(full);
    // 异步记账（不阻塞）
    if (entry.provider && entry.costUsd > 0) {
      void byokClient
        .recordUsage(this.ctx.userId, entry.provider, entry.costUsd, this.ctx.runId)
        .catch((err) => {
          process.stderr.write(`[cost-tracker] recordUsage failed: ${(err as Error).message}\n`);
        });
    }
  }

  /** 累加（从外部 response 里抽 cost/latency） */
  recordFromStep(step: string, provider: ProviderId | null, costUsd: number, latencyMs: number, usedByok: boolean): void {
    this.record({ step, provider, costUsd, latencyMs, usedByok });
  }

  /** 汇总 */
  summarize(): CostSummary {
    const byProvider: Record<string, number> = {};
    const byStep: Record<string, number> = {};
    let totalCost = 0;
    let totalLat = 0;
    let byokCost = 0;
    let platformCost = 0;
    for (const e of this.entries) {
      totalCost += e.costUsd;
      totalLat += e.latencyMs;
      byStep[e.step] = (byStep[e.step] ?? 0) + e.costUsd;
      if (e.provider) {
        byProvider[e.provider] = (byProvider[e.provider] ?? 0) + e.costUsd;
        if (e.usedByok) byokCost += e.costUsd;
        else platformCost += e.costUsd;
      }
    }
    return {
      totalCostUsd: totalCost,
      totalLatencyMs: totalLat,
      stepCount: this.entries.length,
      byProvider,
      byStep,
      byokCostUsd: byokCost,
      platformCostUsd: platformCost,
    };
  }

  /** 完整明细（用于返回 / 持久化） */
  entries_view(): readonly CostEntry[] {
    return this.entries;
  }

  /** 总耗时 */
  wallTimeMs(): number {
    return Date.now() - this.startTs;
  }
}
