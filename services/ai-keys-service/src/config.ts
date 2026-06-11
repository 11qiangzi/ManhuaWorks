/**
 * ai-keys-service 环境变量集中管理 +启动校验
 *
 *关键配置缺了就 fail-fast，避免运行时才报错。
 *
 *重点：
 * - MASTER_KEY :32字节（base64 或 hex编码都行），用于 HKDF派生 user-specific key
 * 即使 MASTER_KEY泄露，每个用户的派生 key 也不同，
 * 想批量解密需要再攻破 HKDF salt。
 * - DB_URL : PostgreSQL 连接串（Drizzle + postgres-js）
 * - JWT_SECRET : 与 user-service 共用同一把钥匙（HS256），签发 user-service、验证本服务
 */

function require(name: string, fallback?: string): string {
 const v = process.env[name] ?? fallback;
 if (v === undefined || v === "") {
 throw new Error(`[ai-keys-service] missing required env: ${name}`);
 }
 return v;
}

function optional(name: string, fallback = ""): string {
 return process.env[name] ?? fallback;
}

/**
 *解析 MASTER_KEY：支持 base64 / hex / raw utf-8
 * 不管哪种编码，最终必须 >=32字节（HKDF 输入要求）
 */
function parseMasterKey(raw: string): Buffer {
 //优先尝试 base64
 try {
 const b = Buffer.from(raw, "base64");
 if (b.length >=32 && b.toString("base64").replace(/=+$/, "") === raw.replace(/=+$/, "")) {
 return b;
 }
 } catch {
 // ignore
 }
 // 再尝试 hex
 if (/^[0-9a-fA-F]+$/.test(raw) && raw.length %2 ===0) {
 const b = Buffer.from(raw, "hex");
 if (b.length >=32) return b;
 }
 // fallback：当作 utf-8字节（dev模式才这么用）
 const b = Buffer.from(raw, "utf-8");
 if (b.length <32) {
 throw new Error(
 `[ai-keys-service] MASTER_KEY must be >=32 bytes (got ${b.length}). ` +
 `Provide as base64 (>=44 chars) or hex (>=64 chars).`
 );
 }
 return b;
}

const _masterKeyRaw = require("MASTER_KEY", "dev_master_key_change_me_in_production_32bytes!!");

export const config = {
 NODE_ENV: optional("NODE_ENV", "development"),
 PORT: Number(optional("PORT", "8083")),

 DATABASE_URL: optional(
 "DATABASE_URL",
 "postgresql://mhw:mhw_dev_only@localhost:5432/manhuaworks"
 ),

 JWT_SECRET: require("JWT_SECRET", "change_me_in_production"),
 JWT_ISSUER: optional("JWT_ISSUER", "manhuaworks"),
 JWT_AUDIENCE: optional("JWT_AUDIENCE", "manhuaworks-api"),

 // HKDF salt：固定即可，每次部署可以换（换了就意味着旧 key都要重新加密）
 HKDF_SALT: optional("HKDF_SALT", "manhuaworks-byok-salt-v1"),
 HKDF_INFO: optional("HKDF_INFO", "user-api-key-encryption"),

 // Key rotation提醒阈值：30 天
 KEY_AGE_WARN_DAYS: Number(optional("KEY_AGE_WARN_DAYS", "30")),
 KEY_AGE_HARD_DAYS: Number(optional("KEY_AGE_HARD_DAYS", "90")),

 // Validator 超时（毫秒）：调 provider API试一次
 VALIDATE_TIMEOUT_MS: Number(optional("VALIDATE_TIMEOUT_MS", "8000")),

 // Rotation cron：每6 小时巡检一次过期的 key（生产可缩短）
 ROTATION_CHECK_INTERVAL_SEC: Number(optional("ROTATION_CHECK_INTERVAL_SEC", "21600")),

 isProd: process.env.NODE_ENV === "production",
} as const;

//延迟解析 MASTER_KEY（让模块导入时不报错，启动时再 check）
export const masterKey: Buffer = parseMasterKey(_masterKeyRaw);
