/**
 * Subscription Repository
 * 表：subscriptions
 */

import { query, withTransaction } from "../config/db";
import type { PoolClient } from "pg";
import type { Subscription, SubscriptionRow } from "../models/subscription";
import { rowToSubscription } from "../models/subscription";
import type { PlanIdDb } from "../config/plans";

export interface CreateSubscriptionInput {
  userId: string;
  plan: PlanIdDb;
  expiresAt?: Date | null;
  autoRenew?: boolean;
}

export const subscriptionRepository = {
  async findByUserId(userId: string): Promise<Subscription | null> {
    const { rows } = await query<SubscriptionRow>(
      `SELECT * FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (rows.length === 0) return null;
    return rowToSubscription(rows[0]!);
  },

  /** 取一条；不存在则按 free 初始化 */
  async getOrInitFree(
    userId: string,
    client?: PoolClient
  ): Promise<Subscription> {
    const exec = async (c: PoolClient | undefined) => {
      const q = c ?? ({ query: query } as unknown as PoolClient);
      const { rows } = await q.query<SubscriptionRow>(
        `SELECT * FROM subscriptions WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      if (rows.length > 0) return rowToSubscription(rows[0]!);
      const inserted = await q.query<SubscriptionRow>(
        `INSERT INTO subscriptions (user_id, plan) VALUES ($1, 'free') RETURNING *`,
        [userId]
      );
      return rowToSubscription(inserted.rows[0]!);
    };

    if (client) return exec(client);
    return withTransaction(exec);
  },

  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    const { rows } = await query<SubscriptionRow>(
      `INSERT INTO subscriptions (user_id, plan, expires_at, auto_renew)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET plan = EXCLUDED.plan,
             expires_at = EXCLUDED.expires_at,
             auto_renew = EXCLUDED.auto_renew
       RETURNING *`,
      [input.userId, input.plan, input.expiresAt ?? null, input.autoRenew ?? false]
    );
    return rowToSubscription(rows[0]!);
  },

  async upsert(
    userId: string,
    plan: PlanIdDb,
    expiresAt: Date | null,
    autoRenew: boolean
  ): Promise<Subscription> {
    return this.create({ userId, plan, expiresAt, autoRenew });
  },

  async setAutoRenew(userId: string, autoRenew: boolean): Promise<Subscription | null> {
    const { rows } = await query<SubscriptionRow>(
      `UPDATE subscriptions SET auto_renew = $2 WHERE user_id = $1 RETURNING *`,
      [userId, autoRenew]
    );
    return rows[0] ? rowToSubscription(rows[0]) : null;
  },

  async cancel(userId: string): Promise<Subscription | null> {
    const { rows } = await query<SubscriptionRow>(
      `UPDATE subscriptions
          SET plan = 'free',
              auto_renew = FALSE,
              expires_at = NULL
        WHERE user_id = $1
        RETURNING *`,
      [userId]
    );
    return rows[0] ? rowToSubscription(rows[0]) : null;
  },

  /** 列出所有订阅（admin） */
  async listAll(limit = 100, offset = 0): Promise<Subscription[]> {
    const { rows } = await query<SubscriptionRow>(
      `SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows.map(rowToSubscription);
  },

  async countAll(): Promise<number> {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM subscriptions`
    );
    return Number(rows[0]?.count ?? 0);
  },
};
