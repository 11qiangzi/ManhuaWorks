/**
 * Quota Service
 * 配额扣减 + 重置（每月）
 * 计量单位统一为"次"（episodes）
 */

import { quotaRepository } from "../repositories/quotaRepository";
import { HttpError } from "../middleware/error";
import type { Quota } from "../models/quota";
import { logger } from "../config/logger";

export const quotaService = {
  async getForUser(userId: string): Promise<Quota> {
    return quotaRepository.getOrInit(userId);
  },

  /**
   * 消费配额（1 次 = 1 episode）
   * - 月度配额：超过返回 429
   * - monthlyEpisodes = -1 表示无限制，始终放行
   */
  async consume(
    userId: string,
    amount: number
  ): Promise<{ ok: true; quota: Quota } | { ok: false; reason: string; quota: Quota | null }> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new HttpError(400, "invalid_amount");
    }
    const res = await quotaRepository.consume(userId, amount);
    if (!res.ok) {
      logger.warn({ userId, amount, reason: res.reason }, "[quota] exceeded");
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
    patch: { monthlyEpisodes?: number }
  ): Promise<Quota> {
    if (!isAdmin) throw new HttpError(403, "admin_only");
    const q = await quotaRepository.setMonthly(userId, patch);
    if (!q) throw new HttpError(404, "quota_not_found");
    return q;
  },

  /**
   * 定时任务：扫描到期用户，重置其 used_episodes 和 reset_at
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
