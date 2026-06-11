/**
 * 订阅档位配置
 *
 * ⚠️ 数据库 schema 限制（subscriptions.plan CHECK）：
 *    plan IN ('free', 'pro', 'team')
 *
 * 任务描述里的 "enterprise" 实际对应数据库的 "team"（企业版/团队版）。
 * 本服务在 API 层做别名映射：UI 可传 "enterprise" → 内部存 "team"。
 */

export type PlanIdDb = "free" | "pro" | "team";
export type PlanIdAlias = "free" | "pro" | "enterprise" | "team";

export interface PlanConfig {
  id: PlanIdDb;
  alias: PlanIdAlias[];
  name: string;
  description: string;
  /** 单位：分（CNY cents） */
  priceCentsMonthly: number;
  /** 项目上限；null = 不限 */
  projectLimit: number | null;
  /** 每月 token 配额 */
  monthlyTokens: number;
  /** 每月图片配额 */
  monthlyImages: number;
  /** 每月视频配额 */
  monthlyVideos: number;
}

export const PLANS: Record<PlanIdDb, PlanConfig> = {
  free: {
    id: "free",
    alias: ["free"],
    name: "免费版",
    description: "上手即用，5 个项目 / 月度基础配额",
    priceCentsMonthly: 0,
    projectLimit: 5,
    monthlyTokens: 100_000,
    monthlyImages: 50,
    monthlyVideos: 10,
  },
  pro: {
    id: "pro",
    alias: ["pro"],
    name: "专业版",
    description: "无限项目 / 大幅提升月度配额",
    priceCentsMonthly: 9900, // ¥99
    projectLimit: null,
    monthlyTokens: 10_000_000,
    monthlyImages: 5_000,
    monthlyVideos: 500,
  },
  team: {
    id: "team",
    alias: ["team", "enterprise"],
    name: "企业版（Team）",
    description: "定制配额 + 团队协作 + 优先支持",
    priceCentsMonthly: 49900, // ¥499 起
    projectLimit: null,
    monthlyTokens: 50_000_000,
    monthlyImages: 20_000,
    monthlyVideos: 2_000,
  },
};

export const PLAN_LIST: PlanConfig[] = Object.values(PLANS);

/** 把外部 alias 解析为数据库 plan id，找不到返回 null */
export function resolvePlanId(input: string | null | undefined): PlanIdDb | null {
  if (!input) return null;
  const lower = input.toLowerCase();
  for (const p of PLAN_LIST) {
    if (p.alias.includes(lower as PlanIdAlias)) return p.id;
  }
  return null;
}

export function getPlan(id: PlanIdDb): PlanConfig {
  return PLANS[id];
}

export function isPaidPlan(id: PlanIdDb): boolean {
  return id !== "free";
}

/** 给订阅同步配额（plan → quotas 行） */
export function quotasForPlan(id: PlanIdDb): {
  monthlyTokens: number;
  monthlyImages: number;
  monthlyVideos: number;
} {
  const p = getPlan(id);
  return {
    monthlyTokens: p.monthlyTokens,
    monthlyImages: p.monthlyImages,
    monthlyVideos: p.monthlyVideos,
  };
}
