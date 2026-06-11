/**
 * Key Rotation调度
 *
 *业务规则：
 * - 每条 key如果超过 KEY_AGE_WARN_DAYS（默认30）没更新 →提醒
 * -超过 KEY_AGE_HARD_DAYS（默认90）→标记为 expired，不允许使用
 * -巡检周期：ROTATION_CHECK_INTERVAL_SEC（默认6 小时）
 *
 * 设计取舍：
 * - 不强制轮换 key（用户可能用的是长期 token），只提醒
 * - "轮换"在 UI上 = "更新你的 key"，本质就是 PATCH /v1/keys/:id
 * - 本服务只负责：扫描 + 打标签 + 发审计
 *
 * 与 billing-service未来的对接：
 * - rotation_needed_at字段可被 billing读取，决定是否警告用户付费
 */

import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { userApiKeys } from "../db/schema.js";
import { config } from "../config.js";
import { recordAuditSync } from "./audit.js";

export interface RotationReport {
 scanned: number;
 needsWarn: number; // >30 天
 needsHardExpire: number; // >90 天
 marked: number; // 本轮被标记的
 ts: string;
}

/**
 *执行一次巡检
 */
export async function runRotationCheck(): Promise<RotationReport> {
 const warnThreshold = new Date(
 Date.now() - config.KEY_AGE_WARN_DAYS *24 *3600 *1000
 );
 const hardThreshold = new Date(
 Date.now() - config.KEY_AGE_HARD_DAYS *24 *3600 *1000
 );

 // 所有未过期的 key
 const all = await db
 .select({
 id: userApiKeys.id,
 userId: userApiKeys.userId,
 provider: userApiKeys.provider,
 updatedAt: userApiKeys.updatedAt,
 })
 .from(userApiKeys);

 let needsWarn =0;
 let needsHardExpire =0;
 let marked =0;

 for (const k of all) {
 const ageDays =
 (Date.now() - new Date(k.updatedAt).getTime()) / (24 *3600 *1000);

 if (k.updatedAt < hardThreshold) {
 // 已硬过期
 needsHardExpire++;

 // 更新 last_error，提示用户
 await db
 .update(userApiKeys)
 .set({
 lastError: `key_expired_age_${Math.floor(ageDays)}d_please_rotate`,
 })
 .where(eq(userApiKeys.id, k.id));

 await recordAuditSync({
 userId: k.userId,
 apiKeyId: k.id,
 action: "rotate",
 provider: k.provider,
 detail: { event: "hard_expired", ageDays: Math.floor(ageDays) },
 });
 marked++;
 } else if (k.updatedAt < warnThreshold) {
 // 进入提醒区
 needsWarn++;
 await recordAuditSync({
 userId: k.userId,
 apiKeyId: k.id,
 action: "rotate",
 provider: k.provider,
 detail: {
 event: "needs_rotation",
 ageDays: Math.floor(ageDays),
 thresholdDays: config.KEY_AGE_WARN_DAYS,
 },
 });
 }
 }

 return {
 scanned: all.length,
 needsWarn,
 needsHardExpire,
 marked,
 ts: new Date().toISOString(),
 };
}

/**
 *启动cron巡检
 * 返回 stop函数，用于 graceful shutdown
 */
export function startRotationCron(): () => void {
 const intervalMs = config.ROTATION_CHECK_INTERVAL_SEC *1000;
 // eslint-disable-next-line no-console
 console.log(
 `[ai-keys-service] rotation cron started, interval=${config.ROTATION_CHECK_INTERVAL_SEC}s ` +
 `(warn>${config.KEY_AGE_WARN_DAYS}d, hard>${config.KEY_AGE_HARD_DAYS}d)`
 );

 const handle = setInterval(() => {
 runRotationCheck()
 .then((r) => {
 if (r.scanned >0) {
 // eslint-disable-next-line no-console
 console.log(
 `[ai-keys-service] rotation check: scanned=${r.scanned} warn=${r.needsWarn} ` +
 `hard=${r.needsHardExpire} marked=${r.marked}`
 );
 }
 })
 .catch((err) => {
 // eslint-disable-next-line no-console
 console.error("[ai-keys-service] rotation check failed:", err);
 });
 }, intervalMs);

 return () => clearInterval(handle);
}

/**
 * 计算单个 key的年龄状态（给前端用）
 */
export function getKeyAgeStatus(updatedAt: Date): {
 ageDays: number;
 needsRotation: boolean;
 hardExpired: boolean;
} {
 const ageDays =
 (Date.now() - new Date(updatedAt).getTime()) / (24 *3600 *1000);
 return {
 ageDays: Math.floor(ageDays),
 needsRotation: ageDays >= config.KEY_AGE_WARN_DAYS,
 hardExpired: ageDays >= config.KEY_AGE_HARD_DAYS,
 };
}

// 用 sql引用一次避免 import报错（linter友好）
void sql;
void and;
void lt;
