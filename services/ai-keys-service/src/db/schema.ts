/**
 * ManhuaWorks ai-keys-service 数据库 Schema
 *
 * 本服务只管1 张主表 +1 张审计表：
 *1. user_api_keys - 用户BYOK加密存储
 *2. api_key_audits - 操作审计（谁在什么时间改了什么）
 *
 * Drizzle ORM0.36.x + postgres-js驱动
 *
 * 与 user-service 的关系：
 * - user-service也有 api_keys 表（早期草稿），但字段结构不同
 * - 本服务独立建表 user_api_keys，避免迁移复杂
 * -将来如果合并，需要做数据迁移脚本
 */

import {
 pgTable,
 uuid,
 varchar,
 text,
 timestamp,
 customType,
 index,
 uniqueIndex,
 pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* bytea 自定义类型 */
/* ------------------------------------------------------------------ */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
 dataType() {
 return "bytea";
 },
 toDriver(value: Buffer) {
 return value;
 },
 fromDriver(value) {
 return value as Buffer;
 },
});

/* ------------------------------------------------------------------ */
/* Enums */
/* ------------------------------------------------------------------ */
export const providerEnum = pgEnum("ai_provider", [
 "openai",
 "anthropic",
 "google",
 "azure_openai",
 "stability",
 "midjourney",
 "runway",
 "replicate",
 "siliconflow",
 "deepseek",
 "qwen",
 "other",
]);

export const auditActionEnum = pgEnum("audit_action", [
 "create",
 "read",
 "update",
 "delete",
 "validate",
 "rotate",
]);

/* ------------------------------------------------------------------ */
/*1. user_api_keys */
/* ------------------------------------------------------------------ */
export const userApiKeys = pgTable(
 "user_api_keys",
 {
 id: uuid("id")
 .primaryKey()
 .default(sql`uuid_generate_v4()`),
 userId: uuid("user_id").notNull(),
 provider: varchar("provider", { length:50 }).notNull(),
 //加密后的密文（base64：IV || TAG || CT），不直接存 bytea
 // —— 这里用 text 也行，但 bytea 更节省空间
 apiKeyEncrypted: bytea("api_key_encrypted").notNull(),
 // 用于 UI显示的提示：例 "sk-***xyz"
 apiKeyHint: varchar("api_key_hint", { length:64 }).notNull(),
 lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
 lastError: text("last_error"),
 createdAt: timestamp("created_at", { withTimezone: true })
 .notNull()
 .defaultNow(),
 updatedAt: timestamp("updated_at", { withTimezone: true })
 .notNull()
 .defaultNow(),
 },
 (t) => ({
 userIdx: index("idx_user_api_keys_user_id").on(t.userId),
 providerIdx: index("idx_user_api_keys_provider").on(t.provider),
 userProviderIdx: uniqueIndex("idx_user_api_keys_user_provider").on(
 t.userId,
 t.provider
 ),
 updatedIdx: index("idx_user_api_keys_updated_at").on(t.updatedAt),
 })
);

/* ------------------------------------------------------------------ */
/*2. api_key_audits */
/* ------------------------------------------------------------------ */
export const apiKeyAudits = pgTable(
 "api_key_audits",
 {
 id: uuid("id")
 .primaryKey()
 .default(sql`uuid_generate_v4()`),
 userId: uuid("user_id").notNull(),
 apiKeyId: uuid("api_key_id"), // 可空（删除时 key已没了）
 action: varchar("action", { length:20 }).notNull(), //复用auditActionEnum
 provider: varchar("provider", { length:50 }),
 ip: varchar("ip", { length:64 }),
 userAgent: text("user_agent"),
 detail: text("detail"), // JSON字符串，存上下文
 createdAt: timestamp("created_at", { withTimezone: true })
 .notNull()
 .defaultNow(),
 },
 (t) => ({
 userIdx: index("idx_api_key_audits_user_id").on(t.userId),
 apiKeyIdx: index("idx_api_key_audits_api_key_id").on(t.apiKeyId),
 actionIdx: index("idx_api_key_audits_action").on(t.action),
 createdIdx: index("idx_api_key_audits_created_at").on(t.createdAt),
 })
);

/* ------------------------------------------------------------------ */
/* 类型导出 */
/* ------------------------------------------------------------------ */
export type UserApiKey = typeof userApiKeys.$inferSelect;
export type NewUserApiKey = typeof userApiKeys.$inferInsert;
export type ApiKeyAudit = typeof apiKeyAudits.$inferSelect;
export type NewApiKeyAudit = typeof apiKeyAudits.$inferInsert;
