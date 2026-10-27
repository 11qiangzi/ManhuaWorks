/**
 * 订阅档位配置
 *
 * 数据库 schema（subscriptions.plan CHECK）：
 *    plan IN ('free', 'basic', 'pro', 'enterprise')
 *
 * 配额统一使用"次"（episodes）作为计量单位，
 * 每次调用（拆稿/出图/配音/合成视频）消耗 1 次。
 *
 * 免费版 v3.0 P3: 从 monthlyEpisodes=9 改为 dailyEpisodes=3（月总量=90，每日限3次）
 */

export type PlanId = "free" | "basic" | "pro" | "enterprise";

export interface PlanConfig {
  id: PlanId;
  name: string;
  description: string;
  /** 单位：分（CNY cents）；null = 定制报价 */
  priceCentsMonthly: number | null;
  /** 项目上限；null = 不限 */
  projectLimit: number | null;
  /** 每月"次"配额（-1 = 无限制） */
  monthlyEpisodes: number;
  /** 每日"次"配额（null = 不限日配额，>0 = 每日限制） */
  dailyEpisodes: number | null;
  /** 是否为加油包（非订阅，一次性额外配额） */
  isBoostPack: boolean;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "免费版",
    description: "体验 AI 漫剧创作，3 次/天",
    priceCentsMonthly: 0,
    projectLimit: 5,
    monthlyEpisodes: 90, // v3.0 P3: 3次/天 × 30天 = 90次/月
    dailyEpisodes: 3,     // v3.0 P3: 每日限制 3 次
    isBoostPack: false,
  },
  basic: {
    id: "basic",
    name: "基础版",
    description: "个人创作者首选，50 次/月",
    priceCentsMonthly: 3900, // ¥39
    projectLimit: 20,
    monthlyEpisodes: 50,
    dailyEpisodes: null, // 不限日配额
    isBoostPack: false,
  },
  pro: {
    id: "pro",
    name: "专业版",
    description: "团队与企业推荐，280 次/月",
    priceCentsMonthly: 14900, // ¥149
    projectLimit: null,
    monthlyEpisodes: 280,
    dailyEpisodes: null, // 不限日配额
    isBoostPack: false,
  },
  enterprise: {
    id: "enterprise",
    name: "企业版",
    description: "大规模内容生产，无限制",
    priceCentsMonthly: null, // 定制报价
    projectLimit: null,
    monthlyEpisodes: -1, // 无限制
    dailyEpisodes: null, // 不限日配额
    isBoostPack: false,
  },
};

export const PLAN_LIST: PlanConfig[] = Object.values(PLANS);

/** 9.9 元加油包 — 一次性额外配额（非订阅） */
export const BOOST_PACK = {
  id: "boost_9_9" as const,
  name: "9.9 元加油包",
  description: "一次性额外 20 次创作，用完即止",
  priceCents: 990, // ¥9.90
  episodes: 20,
  validDays: 7, // 7 天内有效
} as const;

/** 加油包列表 */
export const BOOST_PACKS = [BOOST_PACK];

/** 把字符串解析为 plan id，找不到返回 null */
export function resolvePlanId(input: string | null | undefined): PlanId | null {
  if (!input) return null;
  const lower = input.toLowerCase();
  if (lower in PLANS) return lower as PlanId;
  return null;
}

export function getPlan(id: PlanId): PlanConfig {
  return PLANS[id];
}

export function isPaidPlan(id: PlanId): boolean {
  return id !== "free";
}

/** 给订阅同步配额（plan → quotas 行） */
export function quotasForPlan(id: PlanId): {
  monthlyEpisodes: number;
  dailyEpisodes: number | null;
} {
  const p = getPlan(id);
  return {
    monthlyEpisodes: p.monthlyEpisodes,
    dailyEpisodes: p.dailyEpisodes,
  };
}
