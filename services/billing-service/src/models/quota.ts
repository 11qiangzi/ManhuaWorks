/**
 * Quota 模型
 * 直接读数据库 quotas 表（schema：users.id, monthly_*, used_*, reset_at）
 */

export type QuotaKind = "tokens" | "images" | "videos";

export interface QuotaRow {
  id: string;
  user_id: string;
  monthly_tokens: number;
  used_tokens: number;
  monthly_images: number;
  used_images: number;
  monthly_videos: number;
  used_videos: number;
  reset_at: Date;
}

export interface Quota {
  id: string;
  userId: string;
  monthlyTokens: number;
  usedTokens: number;
  monthlyImages: number;
  usedImages: number;
  monthlyVideos: number;
  usedVideos: number;
  resetAt: Date;
  /** 派生：剩余 */
  remainingTokens: number;
  remainingImages: number;
  remainingVideos: number;
}

export function rowToQuota(row: QuotaRow): Quota {
  return {
    id: row.id,
    userId: row.user_id,
    monthlyTokens: row.monthly_tokens,
    usedTokens: row.used_tokens,
    monthlyImages: row.monthly_images,
    usedImages: row.used_images,
    monthlyVideos: row.monthly_videos,
    usedVideos: row.used_videos,
    resetAt: row.reset_at,
    remainingTokens: Math.max(0, row.monthly_tokens - row.used_tokens),
    remainingImages: Math.max(0, row.monthly_images - row.used_images),
    remainingVideos: Math.max(0, row.monthly_videos - row.used_videos),
  };
}

export function quotaFieldOf(kind: QuotaKind): {
  monthly: "monthly_tokens" | "monthly_images" | "monthly_videos";
  used: "used_tokens" | "used_images" | "used_videos";
} {
  switch (kind) {
    case "tokens":
      return { monthly: "monthly_tokens", used: "used_tokens" };
    case "images":
      return { monthly: "monthly_images", used: "used_images" };
    case "videos":
      return { monthly: "monthly_videos", used: "used_videos" };
  }
}
