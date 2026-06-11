/**
 * API Key操作审计
 *
 *记录：
 * - 谁（userId）在什么时间（created_at）
 * -做了什么（action: create/read/update/delete/validate/rotate）
 * - 对哪个 key（apiKeyId，可空）
 * - 在哪个 provider
 * - 从哪里来（ip / userAgent）
 * -附加上下文（detail JSON）
 *
 * 不记录明文 key（这是安全铁律）。
 */

import { db } from "../db/client.js";
import { apiKeyAudits, type NewApiKeyAudit } from "../db/schema.js";

export type AuditAction =
 | "create"
 | "read"
 | "update"
 | "delete"
 | "validate"
 | "rotate";

export interface AuditInput {
 userId: string;
 apiKeyId?: string | null;
 action: AuditAction;
 provider?: string | null;
 ip?: string | null;
 userAgent?: string | null;
 detail?: Record<string, unknown> | null;
}

/**
 *写一条审计
 * 用 fire-and-forget模式：不阻塞主业务请求
 *失败也不抛错（审计是辅助性的，不能因为审计挂掉导致 API挂）
 */
export function recordAudit(input: AuditInput): void {
 const row: NewApiKeyAudit = {
 userId: input.userId,
 apiKeyId: input.apiKeyId ?? null,
 action: input.action,
 provider: input.provider ?? null,
 ip: input.ip ?? null,
 userAgent: input.userAgent ?? null,
 detail: input.detail ? JSON.stringify(input.detail) : null,
 };

 // 不 await：异步刷库
 db.insert(apiKeyAudits)
 .values(row)
 .then(() => {
 // ok
 })
 .catch((err) => {
 // eslint-disable-next-line no-console
 console.error("[ai-keys-service] audit insert failed:", err);
 });
}

/**
 *同步写审计（给那些需要保证落库后再返回的场景，如 delete）
 */
export async function recordAuditSync(input: AuditInput): Promise<void> {
 const row: NewApiKeyAudit = {
 userId: input.userId,
 apiKeyId: input.apiKeyId ?? null,
 action: input.action,
 provider: input.provider ?? null,
 ip: input.ip ?? null,
 userAgent: input.userAgent ?? null,
 detail: input.detail ? JSON.stringify(input.detail) : null,
 };
 await db.insert(apiKeyAudits).values(row);
}

/**
 * 从 Hono Context里抽取 ip + userAgent
 */
export function extractRequestMeta(c: {
 req: { header: (name: string) => string | undefined };
}): { ip: string | null; userAgent: string | null } {
 const ip =
 c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
 c.req.header("x-real-ip") ??
 null;
 const userAgent = c.req.header("user-agent") ?? null;
 return { ip, userAgent };
}
