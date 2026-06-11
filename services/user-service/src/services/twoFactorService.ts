/**
 * 2FA service — 启用 / 校验 / 关闭
 * secret 用 users.display_name 旁边的 _2fa_secret 字段存？——没有就用
 * audit_logs 关联？——也不合适。
 * 干净方案：把 2fa 字段挂在 users 上一组：two_factor_enabled (boolean), two_factor_secret (text), backup_codes (jsonb)
 * 注意：001_init.sql 没有这俩字段。我们这里用最轻的「在 audit_logs 之外」做法：
 *   - secret 加密后存 users.password_hash 同列位置？我们不污染 users 表
 *   - 改成用一个独立小表 2fa_secrets？不，schema 要严格
 * 妥协：把 2FA 信息存到 users 表的 avatar_url 是不行的。
 * 解决：迁移文件 003 已经在 audit_logs 旁边建表，我们直接用 audit_logs.detail 存 secret 也不安全。
 * 实际最终方案：复用 password_hash 列？不行，1 个用户只能 1 个 hash。
 * 结论：必须建表。已建 003，新增 minimal 004：
 */
import { pool } from '../config/db';
import { generateSecret, buildOtpAuthUrl, buildQrDataUrl, verifyTotp, generateBackupCodes } from '../utils/otp';
import { NotFoundError, BadRequestError } from '@manhuaworks/shared';
import { findById } from '../repositories/userRepository';

export interface TwoFactorStatus {
  enabled: boolean;
  has_secret: boolean;
  backup_codes_remaining: number;
}

export async function getStatus(userId: string): Promise<TwoFactorStatus> {
  const r = await pool.query<{ secret: string | null; backup_codes: string[] | null; enabled: boolean }>(
    'SELECT two_factor_secret AS secret, two_factor_backup_codes AS backup_codes, two_factor_enabled AS enabled FROM users WHERE id = $1',
    [userId]
  );
  const row = r.rows[0];
  if (!row) throw new NotFoundError('user not found');
  return {
    enabled: row.enabled,
    has_secret: !!row.secret,
    backup_codes_remaining: row.backup_codes?.length ?? 0,
  };
}

export interface EnableInit {
  secret: string;
  otpauth_url: string;
  qr_data_url: string;
}

export async function startEnable(userId: string): Promise<EnableInit> {
  const u = await findById(userId);
  if (!u) throw new NotFoundError('user not found');
  if (!u.email) throw new BadRequestError('user has no email; cannot enable 2FA');

  const secret = generateSecret();
  const otpauth_url = buildOtpAuthUrl(u.email, secret);
  const qr_data_url = await buildQrDataUrl(otpauth_url);

  // 暂存 secret，等用户验证通过再正式启用
  await pool.query(
    'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
    [secret, userId]
  );

  return { secret, otpauth_url, qr_data_url };
}

export async function confirmEnable(userId: string, token: string): Promise<{ backup_codes: string[] }> {
  const r = await pool.query<{ secret: string | null; enabled: boolean }>(
    'SELECT two_factor_secret AS secret, two_factor_enabled AS enabled FROM users WHERE id = $1',
    [userId]
  );
  const row = r.rows[0];
  if (!row) throw new NotFoundError('user not found');
  if (row.enabled) throw new BadRequestError('2FA already enabled');
  if (!row.secret) throw new BadRequestError('2FA not initialized');

  if (!verifyTotp(token, row.secret)) {
    throw new BadRequestError('invalid_totp');
  }

  const backupCodes = generateBackupCodes(10);
  await pool.query(
    'UPDATE users SET two_factor_enabled = TRUE, two_factor_backup_codes = $1 WHERE id = $2',
    [JSON.stringify(backupCodes), userId]
  );
  return { backup_codes: backupCodes };
}

export async function verify(userId: string, token: string): Promise<{ ok: boolean; via: 'totp' | 'backup' }> {
  const r = await pool.query<{ secret: string | null; enabled: boolean; backup_codes: string[] | null }>(
    'SELECT two_factor_secret AS secret, two_factor_enabled AS enabled, two_factor_backup_codes AS backup_codes FROM users WHERE id = $1',
    [userId]
  );
  const row = r.rows[0];
  if (!row || !row.enabled || !row.secret) {
    throw new BadRequestError('2FA not enabled');
  }

  // 1) 优先尝 TOTP
  if (verifyTotp(token, row.secret)) {
    return { ok: true, via: 'totp' };
  }

  // 2) 备用码（去横线比对）
  const normalized = token.replace(/-/g, '').toUpperCase();
  const codes = row.backup_codes ?? [];
  const idx = codes.findIndex((c) => c.replace(/-/g, '').toUpperCase() === normalized);
  if (idx >= 0) {
    const next = [...codes];
    next.splice(idx, 1);
    await pool.query(
      'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
      [JSON.stringify(next), userId]
    );
    return { ok: true, via: 'backup' };
  }

  return { ok: false, via: 'totp' };
}

export async function disable(userId: string, token: string): Promise<void> {
  const r = await pool.query<{ secret: string | null; enabled: boolean }>(
    'SELECT two_factor_secret AS secret, two_factor_enabled AS enabled FROM users WHERE id = $1',
    [userId]
  );
  const row = r.rows[0];
  if (!row) throw new NotFoundError('user not found');
  if (!row.enabled) throw new BadRequestError('2FA not enabled');
  if (!row.secret || !verifyTotp(token, row.secret)) {
    throw new BadRequestError('invalid_totp');
  }
  await pool.query(
    'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL, two_factor_backup_codes = NULL WHERE id = $1',
    [userId]
  );
}
