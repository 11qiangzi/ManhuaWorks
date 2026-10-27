/**
 * billing-service 启动时 seed
 * ManhuaWorks · L5-D · 真实账号 + 充值
 *
 * 幂等：检查后存在则跳过，每次启动 1-2 秒完成
 * 用 `mhw` 用户连 manhuaworks DB
 *
 * Seed 内容：
 *   1) 4 个 demo 用户（admin / creator / free / business）—— upsert 到 users
 *   2) 3 个订阅档（free $0 / pro $29 / business $99 月费）—— upsert 到 subscriptions
 *   3) 2 根测试 api-key（admin + creator）—— upsert 到 api_keys
 *   4) 给 4 个用户开 user_balances 账户（按订阅档预置余额）
 *
 * 注意：billing 自身使用 JWT（HS256 共享密钥），不依赖 api-key 模式；
 * 这里的 api-key 是给 user-service 演示的，与 L5-C 区分开。
 */

import { Pool, PoolClient } from "pg";
import { env } from "./config/env";
import { logger } from "./config/logger";

/* ------------------------------------------------------------------ */
/*  演示数据定义                                                       */
/* ------------------------------------------------------------------ */

/** demo 用户固定 UUID（4 角色一一对应） */
export const DEMO_USER_IDS = {
  admin: "11111111-1111-4111-8111-111111111101",
  creator: "11111111-1111-4111-8111-111111111102",
  free: "11111111-1111-4111-8111-111111111103",
  business: "11111111-1111-4111-8111-111111111104",
} as const;

export interface DemoUser {
  id: string;
  email: string;
  phone: string | null;
  display_name: string;
  role: number;
  status: number;
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: DEMO_USER_IDS.admin,
    email: "demo-admin@manhuaworks.local",
    phone: "+8615900000001",
    display_name: "演示账号-管理员",
    role: 5, // admin
    status: 1,
  },
  {
    id: DEMO_USER_IDS.creator,
    email: "demo-creator@manhuaworks.local",
    phone: "+8615900000002",
    display_name: "演示账号-创作者",
    role: 2, // creator/pro member
    status: 1,
  },
  {
    id: DEMO_USER_IDS.free,
    email: "demo-free@manhuaworks.local",
    phone: "+8619900000003",
    display_name: "演示账号-免费用户",
    role: 1, // regular
    status: 1,
  },
  {
    id: DEMO_USER_IDS.business,
    email: "demo-business@manhuaworks.local",
    phone: "+8619900000004",
    display_name: "演示账号-企业用户",
    role: 4, // business/ops
    status: 1,
  },
];

/** 4 个订阅档（按 plan 维度 upsert；每用户 1 条订阅） */
export interface DemoPlan {
  plan: "free" | "basic" | "pro" | "enterprise";
  userId: string;
  monthlyPriceCents: number; // 月费（分）
  currency: string;
}

export const DEMO_PLANS: DemoPlan[] = [
  { plan: "free", userId: DEMO_USER_IDS.free, monthlyPriceCents: 0, currency: "CNY" },
  { plan: "basic", userId: DEMO_USER_IDS.creator, monthlyPriceCents: 3900, currency: "CNY" },
  { plan: "pro", userId: DEMO_USER_IDS.business, monthlyPriceCents: 14900, currency: "CNY" },
];

/** admin 的订阅也写一份（enterprise，但角色是 admin） */
export const DEMO_PLANS_ADMIN: DemoPlan[] = [
  { plan: "enterprise", userId: DEMO_USER_IDS.admin, monthlyPriceCents: 0, currency: "CNY" },
];

/** 2 根测试 api-key（admin + creator） */
export interface DemoApiKey {
  userId: string;
  provider: string;
  keyAlias: string;
}

export const DEMO_API_KEYS: DemoApiKey[] = [
  { userId: DEMO_USER_IDS.admin, provider: "deepseek", keyAlias: "demo-admin-deepseek-key" },
  { userId: DEMO_USER_IDS.creator, provider: "zhipu", keyAlias: "demo-creator-zhipu-key" },
];

/* ------------------------------------------------------------------ */
/*  余额表（独立新表，不动 users 现有列）                                */
/* ------------------------------------------------------------------ */

export const USER_BALANCES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS user_balances (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_balance_nonneg CHECK (balance_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_user_balances_updated ON user_balances(updated_at DESC);

-- 触发器：自动维护 updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_balances_updated_at') THEN
        CREATE TRIGGER trg_user_balances_updated_at BEFORE UPDATE ON user_balances
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;
`;

/** 按订阅档预置余额（cents，USD） */
export const DEMO_INITIAL_BALANCES: Record<string, number> = {
  [DEMO_USER_IDS.admin]: 50000, // $500
  [DEMO_USER_IDS.creator]: 20000, // $200
  [DEMO_USER_IDS.free]: 1000, // $10
  [DEMO_USER_IDS.business]: 100000, // $1000
};

/* ------------------------------------------------------------------ */
/*  单独建一个连接池（不干扰服务主 pool）                                */
/* ------------------------------------------------------------------ */

function getSeedPool(): Pool {
  return new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    max: 2,
    connectionTimeoutMillis: env.DB_CONNECT_TIMEOUT_MS,
  });
}

/* ------------------------------------------------------------------ */
/*  工具：upsert 用户                                                   */
/* ------------------------------------------------------------------ */

async function upsertUser(client: PoolClient, u: DemoUser): Promise<"inserted" | "kept"> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO users (id, email, phone, display_name, role, status, two_factor_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE)
     ON CONFLICT (id) DO UPDATE
       SET email = COALESCE(EXCLUDED.email, users.email),
           phone = COALESCE(EXCLUDED.phone, users.phone),
           display_name = COALESCE(EXCLUDED.display_name, users.display_name),
           updated_at = NOW()
     RETURNING id, (xmax = 0) AS inserted`,
    [u.id, u.email, u.phone, u.display_name, u.role, u.status]
  );
  // 简化判断：只要存在就 ok
  return r.rows[0]?.id ? "kept" : "inserted";
}

/** 用 email 反查 id，避免不同步 */
async function upsertUserByEmail(client: PoolClient, u: DemoUser): Promise<void> {
  // 1) 先按 id 查
  const byId = await client.query<{ id: string }>(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [u.id]);
  if (byId.rows[0]) {
    // 已存在 → 更新名字/角色/状态（不动 phone/email 以免破坏外键）
    await client.query(
      `UPDATE users
          SET display_name = $2,
              role = $3,
              status = $4,
              updated_at = NOW()
        WHERE id = $1`,
      [u.id, u.display_name, u.role, u.status]
    );
    return;
  }
  // 2) 按 email 查（可能是历史创建）
  const byEmail = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [u.email]
  );
  if (byEmail.rows[0]) {
    // 把这条 email 用户的角色/名字同步过来；id 不强改
    await client.query(
      `UPDATE users
          SET display_name = $2,
              role = $3,
              status = $4,
              updated_at = NOW()
        WHERE id = $5`,
      [u.display_name, u.role, u.status, byEmail.rows[0].id]
    );
    return;
  }
  // 3) phone 反查 (id/email 都没, 但 phone 已存在 - 留 id 同步)
  if (u.phone) {
    const byPhone = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE phone = $1 LIMIT 1`,
      [u.phone]
    );
    if (byPhone.rows[0]) {
      const pid = byPhone.rows[0].id;
      await client.query(
        `UPDATE users
            SET email = $1, display_name = $2, role = $3, status = $4, updated_at = NOW()
          WHERE id = $5`,
        [u.email, u.display_name, u.role, u.status, pid]
      );
      return;
    }
  }
  // 4) 真的不存在 → 插入 (id/email/phone 都不冲突)
  await client.query(
    `INSERT INTO users (id, email, phone, display_name, role, status, two_factor_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       display_name = EXCLUDED.display_name,
       role = EXCLUDED.role,
       status = EXCLUDED.status,
       updated_at = NOW()`,
    [u.id, u.email, u.phone, u.display_name, u.role, u.status]
  );
}

async function upsertSubscription(client: PoolClient, p: DemoPlan): Promise<void> {
  // 简单：每用户保证一条订阅；已存在则刷新 plan 与 auto_renew
  const exists = await client.query<{ id: string }>(
    `SELECT id FROM subscriptions WHERE user_id = $1 LIMIT 1`,
    [p.userId]
  );
  if (exists.rows[0]) {
    await client.query(
      `UPDATE subscriptions
          SET plan = $2, started_at = NOW(), auto_renew = TRUE, expires_at = NULL
        WHERE id = $1`,
      [exists.rows[0].id, p.plan]
    );
    return;
  }
  await client.query(
    `INSERT INTO subscriptions (user_id, plan, started_at, auto_renew)
     VALUES ($1, $2, NOW(), TRUE)
     ON CONFLICT (user_id) DO UPDATE SET
       plan = EXCLUDED.plan,
       started_at = NOW(),
       auto_renew = TRUE,
       expires_at = NULL`,
    [p.userId, p.plan]
  );
}

async function upsertApiKey(client: PoolClient, k: DemoApiKey): Promise<void> {
  // 1) 看是否已有同名 alias
  const exists = await client.query<{ id: string }>(
    `SELECT id FROM api_keys WHERE user_id = $1 AND key_alias = $2 LIMIT 1`,
    [k.userId, k.keyAlias]
  );
  if (exists.rows[0]) return; // 已 seed 过
  // 2) 插入（key_encrypted / key_iv 放占位 bytea；真实场景下由 user-service 加密）
  await client.query(
    `INSERT INTO api_keys (user_id, provider, key_alias, key_encrypted, key_iv)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      k.userId,
      k.provider,
      k.keyAlias,
      Buffer.from(`demo-encrypted-${k.keyAlias}`),
      Buffer.from("0123456789ab"),
    ]
  );
}

async function upsertUserBalance(client: PoolClient, userId: string, cents: number): Promise<void> {
  // 已存在不覆盖（保留充值后余额）；不存在则预置
  const exists = await client.query<{ user_id: string }>(
    `SELECT user_id FROM user_balances WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  if (exists.rows[0]) return;
  await client.query(
    `INSERT INTO user_balances (user_id, balance_cents, currency)
     VALUES ($1, $2, 'USD')`,
    [userId, cents]
  );
}

/* ------------------------------------------------------------------ */
/*  主流程                                                              */
/* ------------------------------------------------------------------ */

export interface SeedResult {
  usersInserted: number;
  usersUpdated: number;
  subscriptionsSet: number;
  apiKeysInserted: number;
  balancesSet: number;
  durationMs: number;
}

export async function runSeed(pool?: Pool): Promise<SeedResult> {
  const t0 = Date.now();
  const ownPool = !pool;
  const p = pool ?? getSeedPool();
  const result: SeedResult = {
    usersInserted: 0,
    usersUpdated: 0,
    subscriptionsSet: 0,
    apiKeysInserted: 0,
    balancesSet: 0,
    durationMs: 0,
  };

  const client = await p.connect();
  try {
    await client.query("BEGIN");

    // 1) 余额表 schema（幂等 CREATE）
    await client.query(USER_BALANCES_SCHEMA_SQL);

    // 2) 4 用户
    for (const u of DEMO_USERS) {
      // 简化版：直接 upsertId；如果发现 rowCount=1 + xmax=0 算 inserted
      const before = await client.query<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [u.id]);
      await upsertUserByEmail(client, u);
      if (before.rows[0]) result.usersUpdated += 1;
      else result.usersInserted += 1;
    }

    // 3) 订阅档（4 个 user 都有）
    const allPlans = [...DEMO_PLANS, ...DEMO_PLANS_ADMIN];
    for (const plan of allPlans) {
      await upsertSubscription(client, plan);
      result.subscriptionsSet += 1;
    }

    // 4) 2 个 api-key
    for (const k of DEMO_API_KEYS) {
      const before = await client.query<{ id: string }>(
        `SELECT id FROM api_keys WHERE user_id = $1 AND key_alias = $2`,
        [k.userId, k.keyAlias]
      );
      await upsertApiKey(client, k);
      if (!before.rows[0]) result.apiKeysInserted += 1;
    }

    // 5) 余额预置
    for (const [uid, cents] of Object.entries(DEMO_INITIAL_BALANCES)) {
      const before = await client.query<{ user_id: string }>(
        `SELECT user_id FROM user_balances WHERE user_id = $1`,
        [uid]
      );
      await upsertUserBalance(client, uid, cents);
      if (!before.rows[0]) result.balancesSet += 1;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    logger.error({ err }, "[seed] failed");
    throw err;
  } finally {
    client.release();
    if (ownPool) await p.end();
  }

  result.durationMs = Date.now() - t0;
  logger.info({ ...result }, "[seed] done");
  return result;
}

/** 让 index.ts 一行调用 */
export async function seedOnBoot(): Promise<void> {
  try {
    const out = await runSeed();
    if (out.usersInserted > 0 || out.apiKeysInserted > 0 || out.balancesSet > 0) {
      logger.info(
        { inserted: out.usersInserted, apiKeys: out.apiKeysInserted, balances: out.balancesSet },
        "[seed] fresh data inserted"
      );
    } else {
      logger.info("[seed] all demo data already present, skipped");
    }
  } catch (err) {
    logger.error({ err }, "[seed] on boot failed (non-fatal)");
  }
}
