/**
 * Quota Service
 * 配额扣减 + 重置（每日/月）
 */

import { quotaRepository } from "../repositories/quotaRepository";
import { HttpError } from "../middleware/error";
import type { Quota, QuotaKind } from "../models/quota";
import { logger } from "../config/logger";

export const quotaService = {
  async getForUser(userId: string): Promise<Quota> {
    return quotaRepository.getOrInit(userId);
  },

  /**
   * 消费配额
   * - 月度配额：超过返回 429
   * - 每日/小时限额目前未单独建模（schema 只有 monthly_*），月度统一管
   */
  async consume(
    userId: string,
    kind: QuotaKind,
    amount: number
  ): Promise<{ ok: true; quota: Quota } | { ok: false; reason: string; quota: Quota | null }> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new HttpError(400, "invalid_amount");
    }
    const res = await quotaRepository.consume(userId, kind, amount);
    if (!res.ok) {
      logger.warn({ userId, kind, amount, reason: res.reason }, "[quota] exceeded");
      return { ok: false, reason: res.reason, quota: res.quota };
    }
    return { ok: true, quota: res.quota };
  },

  /** 手动重置（admin） */
  async reset(userId: string, isAdmin: boolean): Promise<Quota> {
    if (!isAdmin) throw new HttpError(403, "admin_only");
    const q = await quotaRepository.reset(userId);
    if (!q) throw new HttpError(404, "quota_not_found");
    return q;
  },

  /** 设置月度上限（admin / plan 切换） */
  async setMonthly(
    userId: string,
    isAdmin: boolean,
    patch: { monthlyTokens?: number; monthlyImages?: number; monthlyVideos?: number }
  ): Promise<Quota> {
    if (!isAdmin) throw new HttpError(403, "admin_only");
    const q = await quotaRepository.setMonthly(userId, patch);
    if (!q) throw new HttpError(404, "quota_not_found");
    return q;
  },

  /**
   * 定时任务：扫描到期用户，重置其 used_* 和 reset_at
   * 每日/每月一刷（schema 当前只有月度 reset_at）
   */
  startResetCron(intervalSec: number): () => void {
    const tick = async () => {
      try {
        const due = await quotaRepository.listDueForReset();
        if (due.length === 0) return;
        logger.info({ count: due.length }, "[quota-cron] due for reset");
        for (const userId of due) {
          await quotaRepository.reset(userId);
        }
      } catch (err) {
        logger.error({ err }, "[quota-cron] tick error");
      }
    };
    void tick();
    const timer = setInterval(tick, intervalSec * 1000);
    return () => clearInterval(timer);
  },

  /** 内部/管理用 */
  async totalUsage() {
    return quotaRepository.totalUsage();
  },
};
