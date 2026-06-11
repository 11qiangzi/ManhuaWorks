/**
 * ManhuaWorks user-service 数据库 Schema
 *
 * 对应 PostgreSQL 7 表（参考 docs/database/ER.md + migrations/001_init.sql）：
 *  1. users          - 用户
 *  2. projects       - 作品/项目
 *  3. subscriptions  - 订阅
 *  4. quotas         - 配额
 *  5. api_keys       - BYOK 加密存储
 *  6. api_call_logs  - API 调用日志 + 成本
 *  7. role_vectors   - 角色一致性向量
 *
 * Drizzle ORM 0.36.x + postgres-js 驱动
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  integer,
  boolean,
  timestamp,
  bigserial,
  customType,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/*                          自定义类型：vector(384)                    */
/* ------------------------------------------------------------------ */
// pgvector 扩展类型，Drizzle 默认不内置；用 customType 适配输出/绑定为字符串
const vector384 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(384)";
  },
  toDriver(value: number[]) {
    // pgvector 接受 '[1,2,3]' 格式
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string) {
    // postgres-js 会以字符串返回 vector，转回 number[]
    if (typeof value !== "string") return value as unknown as number[];
    return value
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")
      .map((v) => Number(v));
  },
});

/* ------------------------------------------------------------------ */
/*                              Enums                                 */
/* ------------------------------------------------------------------ */
export const userRoleEnum = pgEnum("user_role", [
  "1", "2", "3", "4", "5", // 1=普通 2=会员 3=客服 4=运营 5=管理员
]);
export const userStatusEnum = pgEnum("user_status", ["0", "1"]); // 0=禁用 1=正常
export const projectStatusEnum = pgEnum("project_status", [
  "0", "1", "2", "3", // 0=草稿 1=生成中 2=完成 3=失败
]);
export const callTypeEnum = pgEnum("call_type", ["text", "image", "video", "embed"]);
export const callStatusEnum = pgEnum("call_status", ["0", "1"]); // 0=成功 1=失败
export const planEnum = pgEnum("plan", ["free", "pro", "team"]);

/* ------------------------------------------------------------------ */
/*  1. users                                                           */
/* ------------------------------------------------------------------ */
export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    phone: varchar("phone", { length: 20 }).unique(),
    email: varchar("email", { length: 255 }).unique(),
    passwordHash: varchar("password_hash", { length: 255 }),
    displayName: varchar("display_name", { length: 50 }),
    avatarUrl: text("avatar_url"),
    role: smallint("role").notNull().default(1),
    status: smallint("status").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    phoneIdx: index("idx_users_phone").on(t.phone),
    emailIdx: index("idx_users_email").on(t.email),
    roleIdx: index("idx_users_role").on(t.role),
  })
);

/* ------------------------------------------------------------------ */
/*  2. subscriptions                                                   */
/* ------------------------------------------------------------------ */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_generate_v4()`),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: varchar("plan", { length: 20 }).notNull().default("free"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  autoRenew: boolean("auto_renew").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ */
/*  3. quotas                                                          */
/* ------------------------------------------------------------------ */
export const quotas = pgTable("quotas", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_generate_v4()`),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  monthlyTokens: integer("monthly_tokens").notNull().default(100000),
  usedTokens: integer("used_tokens").notNull().default(0),
  monthlyImages: integer("monthly_images").notNull().default(50),
  usedImages: integer("used_images").notNull().default(0),
  monthlyVideos: integer("monthly_videos").notNull().default(10),
  usedVideos: integer("used_videos").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true })
    .notNull()
    .default(sql`NOW() + INTERVAL '1 month'`),
});

/* ------------------------------------------------------------------ */
/*  4. projects                                                        */
/* ------------------------------------------------------------------ */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    artStyle: varchar("art_style", { length: 50 }),
    storyType: varchar("story_type", { length: 50 }),
    coverUrl: text("cover_url"),
    status: smallint("status").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("idx_projects_user_id").on(t.userId),
    statusIdx: index("idx_projects_status").on(t.status),
    createdIdx: index("idx_projects_created_at").on(t.createdAt),
  })
);

/* ------------------------------------------------------------------ */
/*  5. api_keys  (BYOK)                                                */
/* ------------------------------------------------------------------ */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(),
    keyAlias: varchar("key_alias", { length: 50 }).notNull(),
    keyEncrypted: customType<{ data: Buffer; driverData: Buffer }>({
      dataType: () => "bytea",
      fromDriver: (v) => v as Buffer,
      toDriver: (v) => v,
    })("key_encrypted").notNull(),
    keyIv: customType<{ data: Buffer; driverData: Buffer }>({
      dataType: () => "bytea",
      fromDriver: (v) => v as Buffer,
      toDriver: (v) => v,
    })("key_iv").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userProviderAliasIdx: uniqueIndex("idx_api_keys_user_provider_alias").on(
      t.userId,
      t.provider,
      t.keyAlias
    ),
  })
);

/* ------------------------------------------------------------------ */
/*  6. api_call_logs                                                   */
/* ------------------------------------------------------------------ */
export const apiCallLogs = pgTable(
  "api_call_logs",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    provider: varchar("provider", { length: 50 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    callType: varchar("call_type", { length: 20 }).notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: customType<{ data: number; driverData: string }>({
      dataType: () => "decimal(10, 6)",
      fromDriver: (v) => Number(v),
      toDriver: (v) => String(v),
    })("cost_usd").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    status: smallint("status").notNull().default(0),
    errorMsg: text("error_msg"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("idx_api_logs_user_created").on(t.userId, t.createdAt),
    projectIdx: index("idx_api_logs_project").on(t.projectId),
    statusIdx: index("idx_api_logs_status").on(t.status),
  })
);

/* ------------------------------------------------------------------ */
/*  7. role_vectors                                                    */
/* ------------------------------------------------------------------ */
export const roleVectors = pgTable(
  "role_vectors",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    roleName: varchar("role_name", { length: 100 }).notNull(),
    embedding: vector384("embedding").notNull(),
    referenceImageUrl: text("reference_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    projectIdx: index("idx_role_vectors_project").on(t.projectId),
  })
);

/* ------------------------------------------------------------------ */
/*  类型导出（用于 service 层类型推断）                                */
/* ------------------------------------------------------------------ */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Quota = typeof quotas.$inferSelect;
export type NewQuota = typeof quotas.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiCallLog = typeof apiCallLogs.$inferSelect;
export type NewApiCallLog = typeof apiCallLogs.$inferInsert;
export type RoleVector = typeof roleVectors.$inferSelect;
export type NewRoleVector = typeof roleVectors.$inferInsert;
