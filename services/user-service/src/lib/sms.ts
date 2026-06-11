/**
 * 手机验证码 - 内存 Mock
 *
 * 生产替换计划：
 *   - 阿里云短信服务（Dysmsapi 2017-05-25）
 *   - 腾讯云短信（SecretId/SecretKey + AppId + TemplateId）
 *   - 华为云短信 / 火山引擎短信
 *
 * 接口保持 sendCode() / verifyCode() 不变，业务侧无感切换。
 *
 * 内存数据结构：
 *   codeStore: phone -> { code, expiresAt, attempts }
 *   rateStore: phone -> [timestamps in last 1h]
 *
 * 进程重启会清空（开发可接受）。生产应换 Redis。
 */

import { env } from "./env.js";

interface CodeRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}

const codeStore = new Map<string, CodeRecord>();
const rateStore = new Map<string, number[]>();

function randomCode(len = 6): string {
  // 6 位数字验证码
  return Math.floor(Math.random() * 10 ** len)
    .toString()
    .padStart(len, "0");
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [phone, rec] of codeStore.entries()) {
    if (rec.expiresAt <= now) codeStore.delete(phone);
  }
  for (const [phone, list] of rateStore.entries()) {
    const fresh = list.filter((t) => now - t < 60 * 60 * 1000);
    if (fresh.length === 0) rateStore.delete(phone);
    else rateStore.set(phone, fresh);
  }
}

/**
 * 发送验证码
 * - 1 小时内同号最多 SMS_RATE_LIMIT_PER_HOUR 条
 * - 返回 mock 模式下的 code（仅 dev 可见），生产模式下 null
 */
export async function sendCode(
  phone: string
): Promise<{ ok: true; mockCode?: string } | { ok: false; reason: string }> {
  cleanupExpired();

  // 频率限制
  const now = Date.now();
  const recent = (rateStore.get(phone) ?? []).filter(
    (t) => now - t < 60 * 60 * 1000
  );
  if (recent.length >= env.SMS_RATE_LIMIT_PER_HOUR) {
    return {
      ok: false,
      reason: `rate_limited: max ${env.SMS_RATE_LIMIT_PER_HOUR}/hour`,
    };
  }
  recent.push(now);
  rateStore.set(phone, recent);

  const code = randomCode();
  const expiresAt = now + env.SMS_CODE_TTL_SEC * 1000;
  codeStore.set(phone, { code, expiresAt, attempts: 0 });

  if (env.SMS_MOCK === "true") {
    // mock 模式：直接打到日志 + 返回 code（仅 dev）
    // eslint-disable-next-line no-console
    console.log(`[sms-mock] phone=${phone} code=${code}`);
    return { ok: true, mockCode: code };
  }

  // 生产：调用阿里云/腾讯云 SDK
  // TODO: 替换为真实短信服务
  //   const resp = await dysmsapi.sendSms({ PhoneNumbers: phone, TemplateCode: 'SMS_xxx', TemplateParam: JSON.stringify({ code }) })
  return { ok: true };
}

/**
 * 校验验证码
 * - 通过：返回 { ok: true }，并删除该 code
 * - 失败：累计 attempts，达到 5 次强制失效
 */
export function verifyCode(
  phone: string,
  code: string
): { ok: true } | { ok: false; reason: string } {
  const rec = codeStore.get(phone);
  if (!rec) return { ok: false, reason: "no_code_or_expired" };
  if (rec.expiresAt <= Date.now()) {
    codeStore.delete(phone);
    return { ok: false, reason: "expired" };
  }
  rec.attempts += 1;
  if (rec.attempts > 5) {
    codeStore.delete(phone);
    return { ok: false, reason: "too_many_attempts" };
  }
  if (rec.code !== code) {
    return { ok: false, reason: "wrong_code" };
  }
  codeStore.delete(phone);
  return { ok: true };
}
