/**
 * emailService — mock 邮件服务
 * 生产换 SMTP/SES，只需要把 queue 里 send 替换成真实实现
 * 这里只 console.log + 入队（数组兜底）
 */
import { logger } from '../config/logger';

export interface EmailJob {
  id: string;
  to: string;
  subject: string;
  body: string;
  attempts: number;
  enqueuedAt: number;
}

const queue: EmailJob[] = [];
const MOCK_LOG = process.env.EMAIL_MOCK_LOG === 'true';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `email-${Date.now()}-${counter}`;
}

export function enqueueEmail(input: { to: string; subject: string; body: string }): EmailJob {
  const job: EmailJob = {
    id: nextId(),
    to: input.to,
    subject: input.subject,
    body: input.body,
    attempts: 0,
    enqueuedAt: Date.now(),
  };
  queue.push(job);
  if (MOCK_LOG) {
    logger.info(
      { jobId: job.id, to: job.to, subject: job.subject },
      `[mock-email] → ${job.to} :: ${job.subject}\n${job.body}\n---`
    );
  }
  return job;
}

export function getQueueSnapshot(): EmailJob[] {
  return [...queue];
}

export function clearQueue(): void {
  queue.length = 0;
}

/* -------- 业务模板 -------- */

export function sendEmailVerification(email: string, verifyUrl: string): EmailJob {
  return enqueueEmail({
    to: email,
    subject: '[ManhuaWorks] 请验证你的邮箱',
    body: `你好，

请点击以下链接完成邮箱验证（24 小时内有效）:
${verifyUrl}

如非本人操作，请忽略本邮件。
— ManhuaWorks`,
  });
}

export function sendPasswordReset(email: string, resetUrl: string): EmailJob {
  return enqueueEmail({
    to: email,
    subject: '[ManhuaWorks] 密码重置',
    body: `你好，

请点击以下链接重置密码（1 小时内有效）:
${resetUrl}

如非本人操作，请忽略并尽快修改密码。
— ManhuaWorks`,
  });
}

export function sendTwoFactorEnabled(email: string): EmailJob {
  return enqueueEmail({
    to: email,
    subject: '[ManhuaWorks] 2FA 已启用',
    body: `你的账户已启用两步验证 (TOTP)。如非本人操作，请立即修改密码并联系我们。`,
  });
}
