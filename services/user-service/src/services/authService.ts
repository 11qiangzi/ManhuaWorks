import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import * as userRepo from '../repositories/userRepository';
import * as sessionRepo from '../repositories/sessionRepository';
import * as verificationRepo from '../repositories/verificationRepository';
import * as auditRepo from '../repositories/auditRepository';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken, revokeSession } from '../config/jwt';
import { BadRequestError, UnauthorizedError, NotFoundError, ConflictError } from '@manhuaworks/shared';
import { sendEmailVerification, sendPasswordReset } from './emailService';
import { VerificationPurpose } from '../models/verification';
import { AuditAction } from '../models/audit';
import { PublicUser, toPublicUser } from '../models/user';

const EMAIL_VERIFY_HOURS = Number(process.env.EMAIL_VERIFY_TTL_HOURS ?? 24);
const PWD_RESET_HOURS = Number(process.env.PASSWORD_RESET_TTL_HOURS ?? 1);
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function randomToken(): string {
  return randomBytes(32).toString('hex');
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;     // access token 秒数
  token_type: 'Bearer';
  user: PublicUser;
}

async function issueTokens(u: PublicUser, ctx: { userAgent?: string; ipAddress?: string }): Promise<TokenPair> {
  const session = await sessionRepo.createSession({
    user_id: u.id,
    refresh_token_hash: 'pending',  // 占位
    user_agent: ctx.userAgent,
    ip_address: ctx.ipAddress,
    expires_at: new Date(Date.now() + REFRESH_TTL_MS),
  });

  const refresh = signRefreshToken({ sub: u.id, jti: session.id });
  const refreshHash = hashToken(refresh);

  // 用真实 hash 覆盖
  await sessionRepo.touchSession(session.id);  // 顺便刷 last_used_at
  const { pool } = await import('../config/db');
  await pool.query('UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2', [refreshHash, session.id]);

  const access = signAccessToken({ sub: u.id, email: u.email, role: u.role });
  // expires_in 留作扩展；这里给 7d
  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: 7 * 24 * 60 * 60,
    token_type: 'Bearer',
    user: u,
  };
}

/* -------------------- register / login -------------------- */

export const LoginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export async function registerAndLogin(input: {
  email?: string;
  phone?: string;
  password: string;
  display_name?: string;
}, ctx: { userAgent?: string; ipAddress?: string }): Promise<TokenPair> {
  // 1) 建用户
  let created;
  if (input.email) {
    const exist = await userRepo.findByEmail(input.email);
    if (exist) throw new ConflictError('email_already_used');
  }
  if (input.phone) {
    const exist = await userRepo.findByPhone(input.phone);
    if (exist) throw new ConflictError('phone_already_used');
  }
  const password_hash = await hashPassword(input.password);
  created = await userRepo.createUser({
    email: input.email ?? null,
    phone: input.phone ?? null,
    password_hash,
    display_name: input.display_name ?? null,
  });

  // 2) 触发邮箱验证
  if (created.email) {
    await requestEmailVerification(created.id, created.email, ctx);
  }

  await auditRepo.log({
    user_id: created.id, action: AuditAction.Register,
    ip_address: ctx.ipAddress, user_agent: ctx.userAgent,
    detail: { email: created.email },
  });

  return issueTokens(toPublicUser(created), ctx);
}

export async function login(input: LoginInput, ctx: { userAgent?: string; ipAddress?: string }): Promise<TokenPair> {
  let user = null;
  if (input.email) user = await userRepo.findByEmail(input.email);
  else if (input.phone) user = await userRepo.findByPhone(input.phone);
  if (!user || !user.password_hash) {
    await auditRepo.log({
      action: AuditAction.LoginFailed, status: 0,
      ip_address: ctx.ipAddress, user_agent: ctx.userAgent,
      detail: { email: input.email, phone: input.phone, reason: 'user_not_found' },
    });
    throw new UnauthorizedError('invalid_credentials');
  }
  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) {
    await auditRepo.log({
      user_id: user.id, action: AuditAction.LoginFailed, status: 0,
      ip_address: ctx.ipAddress, user_agent: ctx.userAgent,
      detail: { reason: 'wrong_password' },
    });
    throw new UnauthorizedError('invalid_credentials');
  }
  if (user.status === 0) {
    throw new ForbiddenErrorish('account_disabled');
  }
  await auditRepo.log({
    user_id: user.id, action: AuditAction.Login,
    ip_address: ctx.ipAddress, user_agent: ctx.userAgent,
  });
  return issueTokens(toPublicUser(user), ctx);
}

// 偷个懒用 ForbiddenError 别名
import { ForbiddenError } from '@manhuaworks/shared';
class ForbiddenErrorish extends ForbiddenError {}

export async function loginWithTotp(
  userId: string,
  totp: string,
  ctx: { userAgent?: string; ipAddress?: string }
): Promise<TokenPair> {
  const u = await userRepo.findById(userId);
  if (!u) throw new UnauthorizedError('invalid_credentials');
  const { verify } = await import('./twoFactorService');
  const r = await verify(u.id, totp);
  if (!r.ok) {
    await auditRepo.log({
      user_id: u.id, action: AuditAction.TwoFactorFailed, status: 0,
      ip_address: ctx.ipAddress, user_agent: ctx.userAgent,
    });
    throw new UnauthorizedError('invalid_totp');
  }
  await auditRepo.log({
    user_id: u.id, action: AuditAction.TwoFactorVerify,
    ip_address: ctx.ipAddress, user_agent: ctx.userAgent,
    detail: { via: r.via },
  });
  return issueTokens(toPublicUser(u), ctx);
}

export async function refresh(refreshToken: string, ctx: { userAgent?: string; ipAddress?: string }): Promise<TokenPair> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('invalid_refresh_token');
  }
  const sess = await sessionRepo.findSessionById(payload.jti);
  if (!sess) throw new UnauthorizedError('session_not_found');
  if (sess.revoked_at) throw new UnauthorizedError('session_revoked');
  if (sess.expires_at.getTime() < Date.now()) throw new UnauthorizedError('session_expired');
  if (sess.refresh_token_hash !== hashToken(refreshToken)) {
    throw new UnauthorizedError('refresh_token_mismatch');
  }
  const u = await userRepo.findById(payload.sub);
  if (!u) throw new UnauthorizedError('user_not_found');
  // 旋转 refresh：撤销旧 session，发新对
  await sessionRepo.revokeSession(sess.id);
  return issueTokens(toPublicUser(u), ctx);
}

export async function logout(refreshToken: string, userId?: string, ctx?: { userAgent?: string; ipAddress?: string }): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await revokeSession(payload.jti);
    if (userId) {
      await auditRepo.log({
        user_id: userId, action: AuditAction.Logout,
        ip_address: ctx?.ipAddress, user_agent: ctx?.userAgent,
      });
    }
  } catch {
    // 静默失败
  }
}

export async function logoutAll(userId: string, ctx: { userAgent?: string; ipAddress?: string }): Promise<number> {
  const { pool } = await import('../config/db');
  const r = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM sessions WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  const count = r.rows[0]?.c ?? 0;
  await sessionRepo.revokeAllForUser(userId);
  await auditRepo.log({
    user_id: userId, action: AuditAction.Logout,
    ip_address: ctx.ipAddress, user_agent: ctx.userAgent,
    detail: { scope: 'all', revoked: count },
  });
  return count;
}

/* -------------------- 邮箱验证 -------------------- */

export async function requestEmailVerification(
  userId: string,
  email: string,
  ctx?: { userAgent?: string; ipAddress?: string }
): Promise<{ token: string; expires_at: Date }> {
  const token = randomToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_HOURS * 60 * 60 * 1000);

  await verificationRepo.createVerification({
    user_id: userId,
    token_hash: tokenHash,
    purpose: VerificationPurpose.EmailVerify,
    target: email,
    expires_at: expiresAt,
  });

  const verifyUrl = `https://app.manhuaworks.local/verify-email?token=${token}&uid=${userId}`;
  sendEmailVerification(email, verifyUrl);

  await auditRepo.log({
    user_id: userId, action: AuditAction.EmailVerifyRequest,
    ip_address: ctx?.ipAddress, user_agent: ctx?.userAgent,
  });

  return { token, expires_at: expiresAt };
}

export async function confirmEmailVerification(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const v = await verificationRepo.findValidByHash(tokenHash, VerificationPurpose.EmailVerify);
  if (!v) throw new BadRequestError('invalid_or_expired_token');
  await verificationRepo.consume(v.id);
  await auditRepo.log({ user_id: v.user_id, action: AuditAction.EmailVerifyComplete });
}

/* -------------------- 密码重置 -------------------- */

export const ForgotSchema = z.object({ email: z.string().email() });
export const ResetSchema = z.object({
  token: z.string().min(16),
  new_password: z.string().min(8).max(128),
});

export async function requestPasswordReset(email: string, ctx?: { userAgent?: string; ipAddress?: string }): Promise<void> {
  const u = await userRepo.findByEmail(email);
  // 防止枚举：无论是否存在都返回 ok
  if (!u) {
    await auditRepo.log({
      action: AuditAction.PasswordResetRequest, status: 0,
      ip_address: ctx?.ipAddress, user_agent: ctx?.userAgent,
      detail: { email, reason: 'no_such_user' },
    });
    return;
  }
  const token = randomToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PWD_RESET_HOURS * 60 * 60 * 1000);
  await verificationRepo.createVerification({
    user_id: u.id,
    token_hash: tokenHash,
    purpose: VerificationPurpose.PasswordReset,
    target: email,
    expires_at: expiresAt,
  });
  const resetUrl = `https://app.manhuaworks.local/reset-password?token=${token}&uid=${u.id}`;
  sendPasswordReset(email, resetUrl);
  await auditRepo.log({
    user_id: u.id, action: AuditAction.PasswordResetRequest,
    ip_address: ctx?.ipAddress, user_agent: ctx?.userAgent,
  });
}

export async function resetPassword(token: string, newPassword: string, ctx?: { userAgent?: string; ipAddress?: string }): Promise<void> {
  const tokenHash = hashToken(token);
  const v = await verificationRepo.findValidByHash(tokenHash, VerificationPurpose.PasswordReset);
  if (!v) throw new BadRequestError('invalid_or_expired_token');
  const u = await userRepo.findById(v.user_id);
  if (!u) throw new NotFoundError('user_not_found');
  const password_hash = await hashPassword(newPassword);
  await userRepo.updateUser(u.id, { password_hash });
  await verificationRepo.consume(v.id);
  await sessionRepo.revokeAllForUser(u.id);  // 强制下线所有设备
  await auditRepo.log({
    user_id: u.id, action: AuditAction.PasswordResetComplete,
    ip_address: ctx?.ipAddress, user_agent: ctx?.userAgent,
  });
}
