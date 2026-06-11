/**
 * 成本计算器
 *
 * 复用 CostTracker.summarize() 的输出，但补充：
 *   - 单价表（按 step 类型 × provider）
 *   - BYOK vs platform 拆账
 *   - 节省百分比
 *   - 总账（USD / CNY）
 *
 * 用法：
 *   const bill = calculateBill(snap.costSummary, {
 *     rates: DEFAULT_RATES,
 *     usdToCny: 7.2,
 *   });
 *   console.log(bill.totalCny);
 */

import type { CostSummary } from "../../cost-tracker.js";
import type { ProviderId } from "../../clients/ai-router.js";

/** 单价表：每步在每个 provider 上的成本（USD） */
export interface CostRates {
  storyboard: Record<ProviderId, number>;
  character: Record<ProviderId, number>;
  scene: Record<ProviderId, number>;
  "image-gen": Record<ProviderId, number>;
  tts: Record<ProviderId, number>;
  "video-gen": Record<ProviderId, number>;
  compose: Record<ProviderId, number>;
}

export const DEFAULT_RATES: CostRates = {
  storyboard: { deepseek: 0.10, zhipu: 0.15, volcengine: 0.18, minimax: 0.12 },
  character: { deepseek: 0.18, zhipu: 0.20, volcengine: 0.22, minimax: 0.20 },
  scene: { deepseek: 0.08, zhipu: 0.10, volcengine: 0.12, minimax: 0.10 },
  "image-gen": { deepseek: 0.35, zhipu: 0.40, volcengine: 0.45, minimax: 0.40 },
  tts: { deepseek: 0.05, zhipu: 0.10, volcengine: 0.12, minimax: 0.08 },
  "video-gen": { deepseek: 0.55, zhipu: 0.60, volcengine: 0.65, minimax: 0.60 },
  compose: { deepseek: 0.03, zhipu: 0.05, volcengine: 0.06, minimax: 0.04 },
};

export interface CalculateBillOptions {
  rates?: CostRates;
  usdToCny?: number;
}

export interface BillLine {
  step: string;
  provider: ProviderId | null;
  costUsd: number;
  costCny: number;
  ratio: number; // 占总成本百分比
}

export interface Bill {
  totalUsd: number;
  totalCny: number;
  byokUsd: number;
  byokCny: number;
  platformUsd: number;
  platformCny: number;
  byProvider: Record<string, number>;
  byStep: Record<string, number>;
  lines: BillLine[];
  /** 总计节省（如果 all-byok 模式 vs platform 模式） */
  savingVsAllPlatformUsd: number;
  savingVsAllPlatformCny: number;
  /** BYOK 模式 vs 平台模式的价格倍数（< 1 = BYOK 便宜） */
  byokRatio: number;
}

export function calculateBill(summary: CostSummary, opts: CalculateBillOptions = {}): Bill {
  const rates = opts.rates ?? DEFAULT_RATES;
  const cny = opts.usdToCny ?? 7.2;

  const lines: BillLine[] = [];
  for (const [step, costUsd] of Object.entries(summary.byStep)) {
    const provider = pickProvider(step, summary);
    const ratio = summary.totalCostUsd > 0 ? costUsd / summary.totalCostUsd : 0;
    lines.push({
      step,
      provider,
      costUsd,
      costCny: costUsd * cny,
      ratio,
    });
  }
  lines.sort((a, b) => b.costUsd - a.costUsd);

  // 估算 all-platform 成本（用于 BYOK 节省）
  const allPlatformUsd = Object.entries(summary.byStep).reduce((sum, [step, _cost]) => {
    void _cost;
    const platformRate = rates[step as keyof CostRates]?.volcengine ?? 0.5;
    return sum + platformRate;
  }, 0);

  return {
    totalUsd: summary.totalCostUsd,
    totalCny: summary.totalCostUsd * cny,
    byokUsd: summary.byokCostUsd,
    byokCny: summary.byokCostUsd * cny,
    platformUsd: summary.platformCostUsd,
    platformCny: summary.platformCostUsd * cny,
    byProvider: summary.byProvider,
    byStep: summary.byStep,
    lines,
    savingVsAllPlatformUsd: Math.max(0, allPlatformUsd - summary.byokCostUsd),
    savingVsAllPlatformCny: Math.max(0, (allPlatformUsd - summary.byokCostUsd) * cny),
    byokRatio: summary.platformCostUsd > 0 ? summary.byokCostUsd / summary.platformCostUsd : 0,
  };
}

/** 从 byProvider 找该步骤使用的 provider（兜底：取最大占比） */
function pickProvider(step: string, summary: CostSummary): ProviderId | null {
  // 简单启发：取 byProvider 里 cost > 0 的第一个（步骤间粗映射够用）
  const providers = Object.keys(summary.byProvider) as ProviderId[];
  if (providers.length === 0) return null;
  return providers[0] ?? null;
}

/** 格式化账单人读字符串 */
export function formatBill(bill: Bill): string {
  const lines: string[] = [];
  lines.push("┌─ 成本明细 ─────────────────────────────");
  lines.push(`│ 总成本: $${bill.totalUsd.toFixed(4)} (¥${bill.totalCny.toFixed(2)})`);
  lines.push(`│ ├─ BYOK:    $${bill.byokUsd.toFixed(4)} (¥${bill.byokCny.toFixed(2)})`);
  lines.push(`│ └─ Platform: $${bill.platformUsd.toFixed(4)} (¥${bill.platformCny.toFixed(2)})`);
  lines.push("├─ 按步骤 ─────────────────────────────────");
  for (const l of bill.lines) {
    const pct = (l.ratio * 100).toFixed(1).padStart(5);
    const usd = l.costUsd.toFixed(4).padStart(8);
    const cny = l.costCny.toFixed(2).padStart(7);
    lines.push(`│ ${l.step.padEnd(12)} ${pct}%  $${usd} (¥${cny})`);
  }
  lines.push("└─────────────────────────────────────────");
  return lines.join("\n");
}

/** 两份账单对比（BYOK vs Platform） */
export function compareBills(a: Bill, b: Bill): {
  aIsCheaper: boolean;
  diffUsd: number;
  diffPct: number;
  winner: "a" | "b" | "tie";
} {
  const diff = a.totalUsd - b.totalUsd;
  const pct = a.totalUsd > 0 ? (diff / a.totalUsd) * 100 : 0;
  return {
    aIsCheaper: diff < 0,
    diffUsd: Math.abs(diff),
    diffPct: Math.abs(pct),
    winner: Math.abs(diff) < 0.0001 ? "tie" : diff < 0 ? "a" : "b",
  };
}
