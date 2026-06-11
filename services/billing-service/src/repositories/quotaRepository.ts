/**
 * Quota Repository
 */

import { query } from "../config/db";
import type { Quota, QuotaRow, QuotaKind } from "../models/quota";
import { quotaFieldOf, rowToQuota } from "../models/quota";

export const quotaRepository = {
  async findByUserId(userId: string): Promise<Quota | null> {
    const { rows } = await query<QuotaRow>(
      `SELECT * FROM quotas WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return rows[0] ? rowToQuota(rows[0]) : null;
  },

  async getOrInit(userId: string): Promise<Quota> {
    const found = await this.findByUserId(userId);
    if (found) return found;
    const { rows } = await query<QuotaRow>(
      `INSERT INTO quotas (user_id) VALUES ($1) RETURNING *`,
      [userId]
    );
    return rowToQuota(rows[0]!);
  },

  /** 调整月度配额（plan 切换时调用） */
  async setMonthly(
    userId: string,
    patch: { monthlyTokens?: number; monthlyImages?: number; monthlyVideos?: number; resetAt?: Date }
  ): Promise<Quota | null> {
    const { rows } = await query<QuotaRow>(
      `INSERT INTO quotas (user_id, monthly_tokens, monthly_images, monthly_videos, reset_at)
       VALUES ($1, COALESCE($2, 100000), COALESCE($3, 50), COALESCE($4, 10), COALESCE($5, NOW() + INTERVAL '1 month'))
       ON CONFLICT (user_id) DO UPDATE
         SET monthly_tokens = COALESCE(EXCLUDED.monthly_tokens, quotas.monthly_tokens),
             monthly_images = COALESCE(EXCLUDED.monthly_images, quotas.monthly_images),
             monthly_videos = COALESCE(EXCLUDED.monthly_videos, quotas.monthly_videos),
             reset_at = COALESCE(EXCLUDED.reset_at, quotas.reset_at)
       RETURNING *`,
      [
        userId,
        patch.monthlyTokens ?? null,
        patch.monthlyImages ?? null,
        patch.monthlyVideos ?? null,
        patch.resetAt ?? null,
      ]
    );
    return rows[0] ? rowToQuota(rows[0]) : null;
  },

  /** 消费配额（原子：原值+amount 不超过 monthly），超额返回 null + 现状 */
  async consume(
    userId: string,
    kind: QuotaKind,
    amount: number
  ): Promise<{ ok: true; quota: Quota } | { ok: false; reason: "not_found" | "exceeded"; quota: Quota | null }> {
    const f = quotaFieldOf(kind);
    // 1) 读取现状
    const cur = await this.findByUserId(userId);
    if (!cur) return { ok: false, reason: "not_found", quota: null };
    // f.used / f.monthly 是数据库列名 (snake_case)，
    // 需要在 TS 对象（camelCase）上手工映射
    const camelUsed =
      f.used === "used_tokens"
        ? "usedTokens"
        : f.used === "used_images"
        ? "usedImages"
        : "usedVideos";
    const camelMonthly =
      f.monthly === "monthly_tokens"
        ? "monthlyTokens"
        : f.monthly === "monthly_images"
        ? "monthlyImages"
        : "monthlyVideos";
    const cur_used = cur[camelUsed] as number;
    const cur_monthly = cur[camelMonthly] as number;
    if (cur_used + amount > cur_monthly) {
      return { ok: false, reason: "exceeded", quota: cur };
    }
    // 2) 原子更新（带条件防并发）
    const { rows } = await query<QuotaRow>(
      `UPDATE quotas
          SET ${f.used} = ${f.used} + $2
        WHERE user_id = $1
          AND ${f.used} + $2 <= ${f.monthly}
        RETURNING *`,
      [userId, amount]
    );
    if (rows.length === 0) {
      const again = await this.findByUserId(userId);
      return { ok: false, reason: "exceeded", quota: again };
    }
    return { ok: true, quota: rowToQuota(rows[0]!) };
  },

  /** 重置：清零 used_*，reset_at = now + 1 month */
  async reset(userId: string): Promise<Quota | null> {
    const { rows } = await query<QuotaRow>(
      `UPDATE quotas
          SET used_tokens = 0,
              used_images = 0,
              used_videos = 0,
              reset_at = NOW() + INTERVAL '1 month'
        WHERE user_id = $1
        RETURNING *`,
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
    totalTokens: number;
    totalImages: number;
    totalVideos: number;
  }> {
    const { rows } = await query<{
      users: string;
      total_tokens: string;
      total_images: string;
      total_videos: string;
    }>(
      `SELECT COUNT(*)::text AS users,
              COALESCE(SUM(used_tokens), 0)::text AS total_tokens,
              COALESCE(SUM(used_images), 0)::text AS total_images,
              COALESCE(SUM(used_videos), 0)::text AS total_videos
         FROM quotas`
    );
    const r = rows[0];
    return {
      users: Number(r?.users ?? 0),
      totalTokens: Number(r?.total_tokens ?? 0),
      totalImages: Number(r?.total_images ?? 0),
      totalVideos: Number(r?.total_videos ?? 0),
    };
  },
};
