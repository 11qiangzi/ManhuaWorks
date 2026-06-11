/**
 * Subscription 模型
 * 数据库表：subscriptions（按 docs/database/migrations/001_init.sql）
 */

import type { PlanIdDb } from "../config/plans";

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: PlanIdDb;
  started_at: Date;
  expires_at: Date | null;
  auto_renew: boolean;
  created_at: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: PlanIdDb;
  startedAt: Date;
  expiresAt: Date | null;
  autoRenew: boolean;
  createdAt: Date;
}

export function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    autoRenew: row.auto_renew,
    createdAt: row.created_at,
  };
}

/** 距离过期的秒数；null = 永久（free） */
export function secondsToExpiry(sub: Subscription, now: Date = new Date()): number | null {
  if (!sub.expiresAt) return null;
  return Math.floor((sub.expiresAt.getTime() - now.getTime()) / 1000);
}

export function isActive(sub: Subscription, now: Date = new Date()): boolean {
  if (sub.plan === "free") return true; // free 永久
  if (!sub.expiresAt) return false;
  return sub.expiresAt.getTime() > now.getTime();
}
