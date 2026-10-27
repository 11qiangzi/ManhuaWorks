/**
 * Subscription Service
 * 订阅生命周期：试用→续费→过期→升降级
 * 4 档套餐：free / basic / pro / enterprise
 */

import { subscriptionRepository } from "../repositories/subscriptionRepository";
import { quotaRepository } from "../repositories/quotaRepository";
import { HttpError } from "../middleware/error";
import {
  getPlan,
  isPaidPlan,
  quotasForPlan,
  resolvePlanId,
  type PlanId,
} from "../config/plans";
import type { Subscription } from "../models/subscription";
import { isActive } from "../models/subscription";
import { logger } from "../config/logger";

export interface UpsertSubscriptionInput {
  plan: string; // 接受 free / basic / pro / enterprise
  expiresAt?: Date | null;
  autoRenew?: boolean;
}

export const subscriptionService = {
  /** 取当前订阅（自动初始化 free） */
  async getOrInit(userId: string): Promise<Subscription> {
    return subscriptionRepository.getOrInitFree(userId);
  },

  /** 创建/升级/降级订阅（UPSERT） */
  async upsert(userId: string, input: UpsertSubscriptionInput): Promise<Subscription> {
    const plan = resolvePlanId(input.plan);
    if (!plan) {
      throw new HttpError(400, "invalid_plan", `unknown plan: ${input.plan}`);
    }
    const existing = await subscriptionRepository.findByUserId(userId);
    const now = new Date();
    let expiresAt: Date | null = input.expiresAt ?? null;
    if (plan === "free" || plan === "enterprise") {
      expiresAt = null; // free 永久，enterprise 定制
    } else if (!expiresAt) {
      // 默认 30 天
      expiresAt = new Date(now.getTime() + 30 * 86400_000);
    }

    const sub = await subscriptionRepository.upsert(
      userId,
      plan,
      expiresAt,
      input.autoRenew ?? false
    );

    // 同步配额（episodes 次/月）
    const q = quotasForPlan(plan);
    await quotaRepository.setMonthly(userId, {
      monthlyEpisodes: q.monthlyEpisodes,
      resetAt: new Date(now.getTime() + 30 * 86400_000),
    });
    logger.info(
      { userId, from: existing?.plan, to: plan, expiresAt },
      "[subscription] upserted"
    );
    return sub;
  },

  /** 续费：延长 expires_at */
  async renew(
    userId: string,
    opts: { extendDays?: number; expiresAt?: Date; autoRenew?: boolean }
  ): Promise<Subscription> {
    const sub = await subscriptionRepository.getOrInitFree(userId);
    if (sub.plan === "free") {
      throw new HttpError(400, "cannot_renew_free", "free 套餐无需续费");
    }
    let next: Date;
    if (opts.expiresAt) {
      next = opts.expiresAt;
    } else {
      const base = sub.expiresAt && sub.expiresAt.getTime() > Date.now()
        ? sub.expiresAt
        : new Date();
      const days = opts.extendDays ?? 30;
      next = new Date(base.getTime() + days * 86400_000);
    }
    const updated = await subscriptionRepository.upsert(
      userId,
      sub.plan,
      next,
      opts.autoRenew ?? sub.autoRenew
    );
    logger.info({ userId, plan: sub.plan, expiresAt: next }, "[subscription] renewed");
    return updated;
  },

  /** 退订：plan=free, auto_renew=false */
  async cancel(userId: string): Promise<Subscription> {
    const sub = await subscriptionRepository.cancel(userId);
    if (!sub) throw new HttpError(404, "subscription_not_found");
    // 同步配额到 free
    const q = quotasForPlan("free");
    await quotaRepository.setMonthly(userId, {
      monthlyEpisodes: q.monthlyEpisodes,
    });
    logger.info({ userId }, "[subscription] cancelled");
    return sub;
  },

  /** 切换 auto_renew */
  async setAutoRenew(userId: string, autoRenew: boolean): Promise<Subscription> {
    const sub = await subscriptionRepository.setAutoRenew(userId, autoRenew);
    if (!sub) throw new HttpError(404, "subscription_not_found");
    return sub;
  },

  /** 检查并自动降级到 free（如果过期了） */
  async checkAndDowngradeIfExpired(userId: string): Promise<Subscription> {
    const sub = await subscriptionRepository.findByUserId(userId);
    if (!sub) {
      return subscriptionRepository.getOrInitFree(userId);
    }
    if (sub.plan !== "free" && sub.plan !== "enterprise" && !isActive(sub)) {
      const updated = await subscriptionRepository.upsert(
        userId,
        "free",
        null,
        false
      );
      // 同步配额
      const q = quotasForPlan("free");
      await quotaRepository.setMonthly(userId, {
        monthlyEpisodes: q.monthlyEpisodes,
      });
      logger.info({ userId }, "[subscription] auto-downgraded to free (expired)");
      return updated;
    }
    return sub;
  },

  /** 列出所有档位（公开） */
  listPlans() {
    return [getPlan("free"), getPlan("basic"), getPlan("pro"), getPlan("enterprise")];
  },

  /** 内部用：判断 user 是否能创建新项目 */
  async canCreateProject(userId: string): Promise<{ allowed: boolean; reason?: string; plan: PlanId; limit: number | null; used: number }> {
    const sub = await this.checkAndDowngradeIfExpired(userId);
    const plan = getPlan(sub.plan);
    if (plan.projectLimit === null) {
      return { allowed: true, plan: sub.plan, limit: null, used: 0 };
    }
    // 限流：调用 project-service 拿真实数量
    const { projectClient } = await import("../clients/projectClient");
    const used = await projectClient.countUserProjects(userId).catch(() => 0);
    if (used >= plan.projectLimit) {
      return {
        allowed: false,
        reason: `plan_${sub.plan}_limit_reached`,
        plan: sub.plan,
        limit: plan.projectLimit,
        used,
      };
    }
    return { allowed: true, plan: sub.plan, limit: plan.projectLimit, used };
  },

  isPaidPlan,
};
