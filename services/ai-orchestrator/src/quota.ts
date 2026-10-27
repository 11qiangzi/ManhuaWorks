/**
 * 配额管理
 * 5 级 RBAC（guest/free/pro/business/enterprise）对应不同月度配额
 * + 单次任务并发上限
 * + 同一资源类型月调用次数上限
 *
 * 这是 orchestrator 本地的"软配额"——决定"是否允许发起这个任务"。
 * 真正扣费由 byokClient.recordUsage() 异步落 ai-keys-service。
 */

import type { UserTier } from "./middleware/auth.js";

export interface QuotaPolicy {
  /** 月度预算（USD），-1 = 无限 */
  monthlyBudgetUsd: number;
  /** 单次 run 最大成本（USD） */
  perRunMaxUsd: number;
  /** 同 Pipeline 同月最多调用次数，-1 = 无限 */
  monthlyRunLimit: number;
  /** 同时在飞的 run 数 */
  maxConcurrent: number;
  /** 允许的 pipeline 白名单（空数组 = 全部） */
  pipelineAllowList: readonly string[];
}

export const QUOTA_POLICIES: Record<UserTier, QuotaPolicy> = {
  guest: {
    monthlyBudgetUsd: 0,
    perRunMaxUsd: 0,
    monthlyRunLimit: 0,
    maxConcurrent: 0,
    pipelineAllowList: [],
  },
  free: {
    monthlyBudgetUsd: 5,
    perRunMaxUsd: 1,
    monthlyRunLimit: 10,
    maxConcurrent: 1,
    pipelineAllowList: ["novel-to-drama", "style-transfer"],
  },
  pro: {
    monthlyBudgetUsd: 50,
    perRunMaxUsd: 10,
    monthlyRunLimit: 200,
    maxConcurrent: 3,
    pipelineAllowList: ["novel-to-drama", "episode-batch", "style-transfer", "character-replace", "auto-translate", "one-click-manga", "auto-music"],
  },
  business: {
    monthlyBudgetUsd: 500,
    perRunMaxUsd: 80,
    monthlyRunLimit: 5000,
    maxConcurrent: 10,
    pipelineAllowList: ["novel-to-drama", "episode-batch", "style-transfer", "character-replace", "auto-translate", "one-click-manga", "auto-music"],
  },
  enterprise: {
    monthlyBudgetUsd: -1,
    perRunMaxUsd: -1,
    monthlyRunLimit: -1,
    maxConcurrent: 50,
    pipelineAllowList: ["novel-to-drama", "episode-batch", "style-transfer", "character-replace", "auto-translate", "one-click-manga", "auto-music"],
  },
} as const;

export interface QuotaCheckInput {
  tier: UserTier;
  pipeline: string;
  estimatedCostUsd: number;
  activeRuns: number;
  monthlyUsed: number;
}

export type QuotaCheckResult =
  | { ok: true; policy: QuotaPolicy; remainingUsd: number; remainingRuns: number }
  | { ok: false; reason: QuotaDenialReason; detail: string; policy: QuotaPolicy };

export type QuotaDenialReason =
  | "tier_blocked"
  | "pipeline_not_allowed"
  | "monthly_budget_exceeded"
  | "per_run_limit_exceeded"
  | "concurrent_limit_exceeded"
  | "monthly_run_limit_exceeded";

export function checkQuota(input: QuotaCheckInput): QuotaCheckResult {
  const policy = QUOTA_POLICIES[input.tier];
  const remainingUsd = policy.monthlyBudgetUsd === -1 ? Number.POSITIVE_INFINITY : policy.monthlyBudgetUsd - input.monthlyUsed;

  if (input.tier === "guest") {
    return { ok: false, reason: "tier_blocked", detail: "guest users cannot run pipelines", policy };
  }
  if (policy.pipelineAllowList.length > 0 && !policy.pipelineAllowList.includes(input.pipeline)) {
    return {
      ok: false,
      reason: "pipeline_not_allowed",
      detail: `pipeline '${input.pipeline}' not allowed for tier '${input.tier}'`,
      policy,
    };
  }
  if (policy.perRunMaxUsd !== -1 && input.estimatedCostUsd > policy.perRunMaxUsd) {
    return {
      ok: false,
      reason: "per_run_limit_exceeded",
      detail: `estimated cost $${input.estimatedCostUsd.toFixed(4)} > per-run cap $${policy.perRunMaxUsd}`,
      policy,
    };
  }
  if (policy.maxConcurrent !== -1 && input.activeRuns >= policy.maxConcurrent) {
    return {
      ok: false,
      reason: "concurrent_limit_exceeded",
      detail: `active runs ${input.activeRuns} >= max concurrent ${policy.maxConcurrent}`,
      policy,
    };
  }
  if (policy.monthlyRunLimit !== -1 && input.monthlyUsed >= policy.monthlyRunLimit) {
    return {
      ok: false,
      reason: "monthly_run_limit_exceeded",
      detail: `monthly used ${input.monthlyUsed} >= limit ${policy.monthlyRunLimit}`,
      policy,
    };
  }
  if (policy.monthlyBudgetUsd !== -1 && remainingUsd <= 0) {
    return {
      ok: false,
      reason: "monthly_budget_exceeded",
      detail: `monthly budget $${policy.monthlyBudgetUsd} exhausted (used $${input.monthlyUsed.toFixed(4)})`,
      policy,
    };
  }

  const remainingRuns =
    policy.monthlyRunLimit === -1 ? Number.POSITIVE_INFINITY : policy.monthlyRunLimit - input.monthlyUsed;
  return { ok: true, policy, remainingUsd, remainingRuns };
}

/** 估算各 Pipeline 的成本（用于前置 quota 校验） */
export const COST_ESTIMATES = {
  "novel-to-drama": 0.85, // 1 集 60s 漫剧
  "episode-batch": 8.5, // 10 集
  "style-transfer": 0.4, // 1 段视频换皮
  "character-replace": 0.6, // 跨集角色替换
  "auto-translate": 0.25, // 单语种翻译 + 烧字幕
  "one-click-manga": 5.0, // P2: 一键创作 7 步全流程
  "auto-music": 0.3, // P2: 配乐生成
} as const;

export function estimateCost(pipeline: keyof typeof COST_ESTIMATES): number {
  return COST_ESTIMATES[pipeline];
}
