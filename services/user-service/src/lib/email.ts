/**
 * 邮箱验证码 - 阿里云 DirectMail SMTP
 *
 * 选型: 阿里云邮件推送 DirectMail
 *   SMTP_HOST: smtpdm.aliyun.com
 *   SMTP_PORT: 465 (SSL)
 *   SMTP_USER: noreply@qianjigongfang.com (派单 13 改的 FROM)
 *
 * 接口对齐 sms.ts (派单 14 要求)：
 *   sendEmailCode(email)   — 发 6 位数字码
 *   verifyEmailCode(email, code) — 校验
 *
 * 内存数据结构 (跟 sms.ts 完全一致):
 *   codeStore: email -> { code, expiresAt, attempts }
 *   rateStore: email -> [timestamps in last 1h]
 *
 * 进程重启会清空（开发可接受）。生产应换 Redis。
 *
 * ⚠️ 派单 14 风险: 阿里云 DirectMail 要求域名备案才能发到国内邮箱 (QQ/163);
 *    未备案 = 收件人进垃圾箱。梁总拍 Q1A: 未备案先测, 进垃圾箱不 care。
 */

import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "./env.js";

interface CodeRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}

const codeStore = new Map<string, CodeRecord>();
const rateStore = new Map<string, number[]>();

/* ---------------- 工具函数 ---------------- */

function randomCode(len = 6): string {
  // 6 位数字验证码
  return Math.floor(Math.random() * 10 ** len)
    .toString()
    .padStart(len, "0");
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [email, rec] of Array.from(codeStore.entries())) {
    if (rec.expiresAt <= now) codeStore.delete(email);
  }
  for (const [email, list] of Array.from(rateStore.entries())) {
    const fresh = list.filter((t) => now - t < 60 * 60 * 1000);
    if (fresh.length === 0) rateStore.delete(email);
    else rateStore.set(email, fresh);
  }
}

/* ---------------- SMTP 客户端 (懒加载) ---------------- */

let transporter: Transporter | null = null;

/**
 * 懒加载 SMTP transporter — 避免启动时无密码就崩
 * 第一次 sendEmailCode 时初始化
 */
function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new Error(
      "[email] SMTP not configured: SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing"
    );
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // 465 = SSL, 其他端口用 STARTTLS
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });

  return transporter;
}

/* ---------------- 邮件模板 ---------------- */

const SUBJECT = "【千机工坊】邮箱验证码";

function renderHtml(code: string, ttlMinutes: number): string {
  // 极简内联样式，兼容主流邮箱客户端
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px 32px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
          <tr><td style="font-size:20px;font-weight:600;color:#222;text-align:center;padding-bottom:24px;">千机工坊</td></tr>
          <tr><td style="font-size:14px;color:#555;line-height:1.6;padding-bottom:16px;">你好，</td></tr>
          <tr><td style="font-size:14px;color:#555;line-height:1.6;padding-bottom:24px;">你的邮箱验证码如下，${ttlMinutes} 分钟内有效：</td></tr>
          <tr><td style="background:#fafafa;border-radius:6px;padding:24px;text-align:center;">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a73e8;font-family:'Courier New',monospace;">${code}</span>
          </td></tr>
          <tr><td style="font-size:12px;color:#999;line-height:1.6;padding-top:24px;">如非本人操作，请忽略本邮件。</td></tr>
          <tr><td style="font-size:12px;color:#ccc;text-align:center;padding-top:32px;">— 千机工坊团队</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderText(code: string, ttlMinutes: number): string {
  return `【千机工坊】邮箱验证码

你的验证码是：${code}

${ttlMinutes} 分钟内有效。如非本人操作，请忽略本邮件。

— 千机工坊团队`;
}

/* ---------------- 对外接口 ---------------- */

/**
 * 发送邮箱验证码
 * - 1 小时内同邮箱最多 EMAIL_RATE_LIMIT_PER_HOUR 条
 * - EMAIL_MOCK=true 时不发邮件，只返回 mockCode（dev 用）
 * - 返回 mock 模式下的 code（仅 dev 可见），生产模式下 null
 */
export async function sendEmailCode(
  email: string
): Promise<{ ok: true; mockCode?: string } | { ok: false; reason: string }> {
  cleanupExpired();

  // 频率限制
  const now = Date.now();
  const recent = (rateStore.get(email) ?? []).filter(
    (t) => now - t < 60 * 60 * 1000
  );
  if (recent.length >= env.EMAIL_RATE_LIMIT_PER_HOUR) {
    return {
      ok: false,
      reason: `rate_limited: max ${env.EMAIL_RATE_LIMIT_PER_HOUR}/hour`,
    };
  }
  recent.push(now);
  rateStore.set(email, recent);

  const code = randomCode();
  const expiresAt = now + env.EMAIL_CODE_TTL_SEC * 1000;
  codeStore.set(email, { code, expiresAt, attempts: 0 });

  if (env.EMAIL_MOCK === "true") {
    // mock 模式：打到日志 + 返回 code（仅 dev 可见）
    // eslint-disable-next-line no-console
    console.log(`[email-mock] email=${email} code=${code}`);
    return { ok: true, mockCode: code };
  }

  // 真发：阿里云 DirectMail SMTP
  try {
    const tx = getTransporter();
    const ttlMinutes = Math.floor(env.EMAIL_CODE_TTL_SEC / 60);
    await tx.sendMail({
      from: `"千机工坊" <${env.EMAIL_FROM}>`,
      to: email,
      subject: SUBJECT,
      text: renderText(code, ttlMinutes),
      html: renderHtml(code, ttlMinutes),
      replyTo: "support@qianjigongfang.com",
    });
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[email] send failed email=${email} reason=${reason}`);
    // code 已存, 但发送失败 — 删掉避免遗留死码
    codeStore.delete(email);
    return { ok: false, reason: `send_failed: ${reason}` };
  }
}

/**
 * 校验邮箱验证码
 * - 通过：返回 { ok: true }，并删除该 code
 * - 失败：累计 attempts，达到 5 次强制失效
 */
export function verifyEmailCode(
  email: string,
  code: string
): { ok: true } | { ok: false; reason: string } {
  const rec = codeStore.get(email);
  if (!rec) return { ok: false, reason: "no_code_or_expired" };
  if (rec.expiresAt <= Date.now()) {
    codeStore.delete(email);
    return { ok: false, reason: "expired" };
  }
  rec.attempts += 1;
  if (rec.attempts > 5) {
    codeStore.delete(email);
    return { ok: false, reason: "too_many_attempts" };
  }
  if (rec.code !== code) {
    return { ok: false, reason: "wrong_code" };
  }
  codeStore.delete(email);
  return { ok: true };
}

/* ---------------- 测试辅助 (供单元测试用) ---------------- */

export function _resetStores(): void {
  codeStore.clear();
  rateStore.clear();
}