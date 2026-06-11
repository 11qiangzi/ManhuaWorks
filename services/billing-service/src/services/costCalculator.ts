/**
 * Cost Calculator — AI 调用成本计算 & 聚合 & 报表
 *
 * 价目表（CNY 分/千 token；CNY = 人民币，1 元 = 100 分）：
 *  - OpenAI     gpt-4o              ¥0.018 / 1K input,  ¥0.054 / 1K output
 *  - OpenAI     gpt-4o-mini         ¥0.0014 / 1K input, ¥0.0056 / 1K output
 *  - OpenAI     gpt-4-turbo         ¥0.072 / 1K input,  ¥0.216 / 1K output
 *  - Anthropic  claude-3-5-sonnet   ¥0.024 / 1K input,  ¥0.096 / 1K output
 *  - Anthropic  claude-3-haiku      ¥0.0018 / 1K input, ¥0.009 / 1K output
 *  - Google     gemini-1.5-pro      ¥0.007 / 1K input,  ¥0.021 / 1K output
 *  - Google     gemini-1.5-flash    ¥0.00056 / 1K input,¥0.00168/ 1K output
 *  - DeepSeek   deepseek-chat       ¥0.001 / 1K input,  ¥0.002 / 1K output
 *  - DeepSeek   deepseek-coder      ¥0.001 / 1K input,  ¥0.002 / 1K output
 *  - MiniMax   MiniMax-Text-01     ¥0.001 / 1K input,  ¥0.008 / 1K output
 *  - MiniMax   MiniMax-Text-01-v2  ¥0.0008/ 1K input,  ¥0.0064/ 1K output
 *
 * 说明：
 *  - 价格表为人民币（CNY）口径，按"分"计算避免浮点；
 *  - 千 token 单价 = 人民币分 (1 ¥ = 100 分)；
 *  - 已知 model 走精确查表；未知 model 走 fallback 单价；
 *  - 整数 token 数用 number 计算，floor 后转分（向上取整避免低估成本）。
 */

import type {
  AggregateBy,
  AiProvider,
  CostAggregate,
  CostLogRecord,
  CostReport,
  CostReportRow,
} from "../models/costLog";

/** 单价条目（CNY 分/千 token） */
export interface PriceEntry {
  promptPer1kCents: number;       // 入 token 单价（分/1K）
  completionPer1kCents: number;   // 出 token 单价（分/1K）
  currency: string;
}

/** provider → model → price */
export type PriceTable = Record<AiProvider, Record<string, PriceEntry>>;

/** provider → 默认价（model 未命中时使用） */
export type ProviderDefault = Record<AiProvider, PriceEntry>;

/** 5 个 provider 的价目表 */
export const PRICE_TABLE: PriceTable = {
  openai: {
    "gpt-4o":           { promptPer1kCents: 1.8,    completionPer1kCents: 5.4,    currency: "CNY" },
    "gpt-4o-mini":      { promptPer1kCents: 0.14,   completionPer1kCents: 0.56,   currency: "CNY" },
    "gpt-4-turbo":      { promptPer1kCents: 7.2,    completionPer1kCents: 21.6,   currency: "CNY" },
  },
  anthropic: {
    "claude-3-5-sonnet": { promptPer1kCents: 2.4,   completionPer1kCents: 9.6,    currency: "CNY" },
    "claude-3-haiku":    { promptPer1kCents: 0.18,  completionPer1kCents: 0.9,    currency: "CNY" },
  },
  google: {
    "gemini-1.5-pro":    { promptPer1kCents: 0.7,   completionPer1kCents: 2.1,    currency: "CNY" },
    "gemini-1.5-flash":  { promptPer1kCents: 0.056, completionPer1kCents: 0.168,  currency: "CNY" },
  },
  deepseek: {
    "deepseek-chat":     { promptPer1kCents: 0.1,   completionPer1kCents: 0.2,    currency: "CNY" },
    "deepseek-coder":    { promptPer1kCents: 0.1,   completionPer1kCents: 0.2,    currency: "CNY" },
  },
  minimax: {
    "MiniMax-Text-01":    { promptPer1kCents: 0.1,  completionPer1kCents: 0.8,    currency: "CNY" },
    "MiniMax-Text-01-v2": { promptPer1kCents: 0.08, completionPer1kCents: 0.64,   currency: "CNY" },
  },
};

/** 未命中具体 model 时，按 provider 给一个保守默认价（取该 provider 已知 model 的中位） */
export const PROVIDER_DEFAULT: ProviderDefault = {
  openai:    { promptPer1kCents: 1.8,   completionPer1kCents: 5.4,   currency: "CNY" }, // 走 gpt-4o 价
  anthropic: { promptPer1kCents: 2.4,   completionPer1kCents: 9.6,   currency: "CNY" },
  google:    { promptPer1kCents: 0.7,   completionPer1kCents: 2.1,   currency: "CNY" },
  deepseek:  { promptPer1kCents: 0.1,   completionPer1kCents: 0.2,   currency: "CNY" },
  minimax: { promptPer1kCents: 0.1,   completionPer1kCents: 0.8,   currency: "CNY" },
};

export interface CalculateCostInput {
  provider: AiProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface CalculateCostResult {
  costCents: number;
  currency: string;
  matchedModel: boolean;
  price: PriceEntry;
}

/** 查价：先 model 精确查，再 provider 默认 */
export function getPrice(provider: AiProvider, model: string): { entry: PriceEntry; matched: boolean } {
  const byModel = PRICE_TABLE[provider];
  if (byModel && byModel[model]) {
    return { entry: byModel[model]!, matched: true };
  }
  return { entry: PROVIDER_DEFAULT[provider], matched: false };
}

/**
 * 计算单次 AI 调用的成本（分，向上取整）。
 * 公式：ceil(promptTokens/1000 * promptPer1kCents) + ceil(completionTokens/1000 * completionPer1kCents)
 */
export function calculateCost(input: CalculateCostInput): CalculateCostResult {
  const { provider, model, promptTokens, completionTokens } = input;
  if (!Number.isFinite(promptTokens) || promptTokens < 0) {
    throw new RangeError("promptTokens must be >= 0");
  }
  if (!Number.isFinite(completionTokens) || completionTokens < 0) {
    throw new RangeError("completionTokens must be >= 0");
  }
  const { entry, matched } = getPrice(provider, model);
  // 千 token 价 × token 数 / 1000，向上取整（保证不退成本）
  const promptPart = Math.ceil((promptTokens * entry.promptPer1kCents) / 1000);
  const completionPart = Math.ceil((completionTokens * entry.completionPer1kCents) / 1000);
  return {
    costCents: promptPart + completionPart,
    currency: entry.currency,
    matchedModel: matched,
    price: entry,
  };
}

/** 聚合维度 — 重新导出便于外部直接引 */
export type { AggregateBy };

export interface AggregateCostsInput {
  records: CostLogRecord[];
  by: AggregateBy;
  period?: "day" | "week" | "month" | "year" | "all";
}

/** 给定 records，按 by 字段分组聚合；period 不传则不切分时间 */
export function aggregateCosts(input: AggregateCostsInput): CostAggregate[] {
  const { records, by } = input;
  const period = input.period ?? "all";
  const buckets = new Map<string, CostAggregate>();

  for (const r of records) {
    let groupKey: string;
    if (by === "user") {
      groupKey = r.userId;
    } else if (by === "project") {
      groupKey = r.projectId ?? "_none_";
    } else {
      groupKey = r.provider;
    }

    let periodKey = "";
    if (period !== "all") {
      const start = periodStartOf(r.createdAt, period);
      periodKey = `|${start.toISOString()}`;
    }
    const key = `${groupKey}${periodKey}`;

    let agg = buckets.get(key);
    if (!agg) {
      agg = {
        key: groupKey,
        count: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costCents: 0,
        currency: r.currency,
        ...(period !== "all" ? { period } : {}),
      };
      buckets.set(key, agg);
    }
    agg.count += 1;
    agg.promptTokens += r.promptTokens;
    agg.completionTokens += r.completionTokens;
    agg.totalTokens += r.totalTokens;
    agg.costCents += r.costCents;
  }
  return Array.from(buckets.values()).sort((a, b) => b.costCents - a.costCents);
}

/** 周期起点（拷贝 repo 的逻辑；保持单测可独立） */
function periodStartOf(d: Date, period: "day" | "week" | "month" | "year" | "all"): Date {
  const out = new Date(d.getTime());
  out.setUTCMilliseconds(0);
  out.setUTCSeconds(0);
  out.setUTCMinutes(0);
  out.setUTCHours(0);
  switch (period) {
    case "day":
      return out;
    case "week": {
      const day = out.getUTCDay();
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
  }
}

/** 聚合 → 报表（含百分比、人民币格式化、汇总） */
export interface FormatCostReportInput {
  aggregated: CostAggregate[];
  period: "day" | "week" | "month" | "year" | "all";
  from?: Date;
  to?: Date;
  labels?: Record<string, string>; // 自定义 key → label 映射
}

export function formatCostReport(input: FormatCostReportInput): CostReport {
  const { aggregated, period } = input;
  const totalCostCents = aggregated.reduce((s, a) => s + a.costCents, 0);
  const totalTokens = aggregated.reduce((s, a) => s + a.totalTokens, 0);
  const totalCalls = aggregated.reduce((s, a) => s + a.count, 0);
  const currency = aggregated[0]?.currency ?? "CNY";

  const rows: CostReportRow[] = aggregated.map((a) => {
    const label = input.labels?.[a.key] ?? a.key;
    const share = totalCostCents > 0 ? (a.costCents / totalCostCents) * 100 : 0;
    return {
      key: a.key,
      label,
      count: a.count,
      promptTokens: a.promptTokens,
      completionTokens: a.completionTokens,
      totalTokens: a.totalTokens,
      costCents: a.costCents,
      costYuan: formatCentsToYuan(a.costCents),
      currency: a.currency,
      sharePercent: Math.round(share * 100) / 100,
    };
  });

  return {
    period,
    from: (input.from ?? aggregated[0]?.key ?? new Date(0).toISOString()).toString(),
    to: (input.to ?? new Date()).toString(),
    totalCostCents,
    totalCostYuan: formatCentsToYuan(totalCostCents),
    totalTokens,
    totalCalls,
    currency,
    rows,
  };
}

/** 分 → 元（保留 2 位 + ¥ 前缀） */
export function formatCentsToYuan(cents: number): string {
  const yuan = cents / 100;
  return `¥${yuan.toFixed(2)}`;
}

/** 工具：列出某个 provider 的所有 model */
export function listModels(provider: AiProvider): string[] {
  return Object.keys(PRICE_TABLE[provider] ?? {});
}

/** 工具：列出所有 provider */
export const ALL_PROVIDERS: AiProvider[] = [
  "openai",
  "anthropic",
  "google",
  "deepseek",
  "minimax",
];
