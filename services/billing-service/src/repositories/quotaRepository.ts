/**
 * Quota Repository
 * 配额表 quotas 现在只用 monthly_episodes / used_episodes 做统一计量。
 * 旧列（monthly_tokens/images/videos）已通过 migration 006 弃用。
 */

import { query } from "../config/db";
import type { Quota, QuotaRow } from "../models/quota";
import { rowToQuota } from "../models/quota";

export const quotaRepository = {
  async findByUserId(userId: string): Promise<Quota | null> {
    const { rows } = await query<QuotaRow>(
      `SELECT id, user_id, monthly_episodes, used_episodes, reset_at
         FROM quotas WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return rows[0] ? rowToQuota(rows[0]) : null;
  },

  async getOrInit(userId: string): Promise<Quota> {
    const found = await this.findByUserId(userId);
    if (found) return found;
    const { rows } = await query<QuotaRow>(
      `INSERT INTO quotas (user_id) VALUES ($1) RETURNING
         id, user_id, monthly_episodes, used_episodes, reset_at`,
      [userId]
    );
    return rowToQuota(rows[0]!);
  },

  /** 调整月度配额（plan 切换时调用） */
  async setMonthly(
    userId: string,
    patch: { monthlyEpisodes?: number; resetAt?: Date }
  ): Promise<Quota | null> {
    const { rows } = await query<QuotaRow>(
      `INSERT INTO quotas (user_id, monthly_episodes, used_episodes, reset_at)
       VALUES ($1, COALESCE($2, 9), 0, COALESCE($3, NOW() + INTERVAL '1 month'))
       ON CONFLICT (user_id) DO UPDATE
         SET monthly_episodes = COALESCE(EXCLUDED.monthly_episodes, quotas.monthly_episodes),
             reset_at = COALESCE(EXCLUDED.reset_at, quotas.reset_at)
       RETURNING id, user_id, monthly_episodes, used_episodes, reset_at`,
      [
        userId,
        patch.monthlyEpisodes ?? null,
        patch.resetAt ?? null,
      ]
    );
    return rows[0] ? rowToQuota(rows[0]) : null;
  },

  /**
   * 消费配额（原子：原值+amount 不超过 monthly_episodes），
   * 超额返回 { ok: false, reason }；monthly_episodes = -1 表示无限制，始终放行。
   */
  async consume(
    userId: string,
    amount: number
  ): Promise<{ ok: true; quota: Quota } | { ok: false; reason: "not_found" | "exceeded"; quota: Quota | null }> {
    const cur = await this.findByUserId(userId);
    if (!cur) return { ok: false, reason: "not_found", quota: null };
    // -1 = 无限制，不扣减
    if (cur.monthlyEpisodes < 0) {
      return { ok: true, quota: cur };
    }
    if (cur.usedEpisodes + amount > cur.monthlyEpisodes) {
      return { ok: false, reason: "exceeded", quota: cur };
    }
    const { rows } = await query<QuotaRow>(
      `UPDATE quotas
          SET used_episodes = used_episodes + $2
        WHERE user_id = $1
          AND used_episodes + $2 <= monthly_episodes
       RETURNING id, user_id, monthly_episodes, used_episodes, reset_at`,
      [userId, amount]
    );
    if (rows.length === 0) {
      const again = await this.findByUserId(userId);
      return { ok: false, reason: "exceeded", quota: again };
    }
    return { ok: true, quota: rowToQuota(rows[0]!) };
  },

  /** 重置：清零 used_episodes，reset_at = now + 1 month */
  async reset(userId: string): Promise<Quota | null> {
    const { rows } = await query<QuotaRow>(
      `UPDATE quotas
          SET used_episodes = 0,
              reset_at = NOW() + INTERVAL '1 month'
        WHERE user_id = $1
       RETURNING id, user_id, monthly_episodes, used_episodes, reset_at`,
      [userId]
    );
    return rows[0] ? rowToQuota(rows[0]) : null;
  },

  /** 扫描所有到期（reset_at <= now）的行，返回 user_ids */
  async listDueForReset(now: Date = new Date()): Promise<string[]> {
    const { rows } = await query<{ user_id: string }>(
      `SELECT user_id FROM quotas WHERE reset_at <= $1`,
      [now]
    );
    return rows.map((r) => r.user_id);
  },

  /** 当前总览（admin） */
  async totalUsage(): Promise<{
    users: number;
    totalEpisodes: number;
  }> {
    const { rows } = await query<{
      users: string;
      total_episodes: string;
    }>(
      `SELECT COUNT(*)::text AS users,
              COALESCE(SUM(used_episodes), 0)::text AS total_episodes
         FROM quotas`
    );
    const r = rows[0];
    return {
      users: Number(r?.users ?? 0),
      totalEpisodes: Number(r?.total_episodes ?? 0),
    };
  },
};
