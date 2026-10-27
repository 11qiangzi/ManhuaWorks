/**
 * Quota 模型
 * 直接读取数据库 quotas 表（schema：users.id, monthly_episodes, used_episodes, 
 *   daily_episodes, used_today, reset_at）
 *
 * 计量单位统一为"次"（episodes）：
 *   每次完整的漫剧生成流程（拆稿/出图/配音/合成）消耗 1 次。
 *
 * v3.0 P3: 新增 daily_episodes / used_today 字段，支持每日配额限制。
 */

export interface QuotaRow {
  id: string;
  user_id: string;
  monthly_episodes: number;
  used_episodes: number;
  daily_episodes: number;
  used_today: number;
  today_date: string | null;
  reset_at: Date;
}

export interface Quota {
  id: string;
  userId: string;
  monthlyEpisodes: number;
  usedEpisodes: number;
  dailyEpisodes: number;
  usedToday: number;
  todayDate: string | null;
  resetAt: Date;
  /** 派生：剩余次数（-1 表示无限制） */
  remainingEpisodes: number;
  /** 派生：今日剩余次数（-1 表示无限制，0 表示不设日限） */
  remainingToday: number;
}

export function rowToQuota(row: QuotaRow): Quota {
  const monthly = row.monthly_episodes;
  const used = row.used_episodes;
  const daily = row.daily_episodes ?? 0;
  const usedToday = row.used_today ?? 0;
  return {
    id: row.id,
    userId: row.user_id,
    monthlyEpisodes: monthly,
    usedEpisodes: used,
    dailyEpisodes: daily,
    usedToday,
    todayDate: (row as any).today_date ?? null,
    resetAt: row.reset_at,
    // -1 = 无限制，remaining 也用 -1 表示
    remainingEpisodes: monthly < 0 ? -1 : Math.max(0, monthly - used),
    remainingToday: daily <= 0 ? (daily < 0 ? -1 : -1) : Math.max(0, daily - usedToday),
  };
}
