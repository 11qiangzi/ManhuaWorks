import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService';
import { getValidated } from '../middleware/validate';
import { AuthedRequest, getUser } from '../middleware/auth';
import { BadRequestError, ConflictError } from '@manhuaworks/shared';
import * as userRepo from '../repositories/userRepository';
import { sendEmailCode, verifyEmailCode } from '../lib/email';
import { sendCode, verifyCode } from '../lib/sms';
import { hashPassword } from '../utils/password';
import { signAccessToken, signRefreshToken } from '../config/jwt';
import { randomBytes } from 'crypto';
import { toPublicUser } from '../models/user';

const RegisterBody = z.object({
  email: z.string().email().max(255).optional(),
  phone: z.string().regex(/^\+?\d{6,20}$/).optional(),
  password: z.string().min(8).max(128),
  display_name: z.string().min(1).max(50).optional(),
}).refine((d) => d.email || d.phone, { message: 'email_or_phone_required' });

const LoginBody = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(1),
  totp: z.string().optional(),
});

const RefreshBody = z.object({ refresh_token: z.string().min(16) });
const LogoutBody = z.object({ refresh_token: z.string().min(16) });

const ForgotBody = z.object({ email: z.string().email() });
const ResetBody = z.object({
  token: z.string().min(16),
  new_password: z.string().min(8).max(128),
});

const VerifyTokenBody = z.object({ token: z.string().min(16) });
const Verify2faBody = z.object({ user_id: z.string().uuid(), totp: z.string().min(6).max(10) });

function ctxOf(req: Request): { userAgent?: string; ipAddress?: string } {
  return {
    userAgent: (req.headers['user-agent'] as string) ?? undefined,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? undefined,
  };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = getValidated<z.infer<typeof RegisterBody>>(req, 'body');
    const result = await authService.registerAndLogin(data, ctxOf(req));
    res.status(201).json({ code: 0, message: 'created', data: result });
  } catch (e) { next(e); }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = getValidated<z.infer<typeof LoginBody>>(req, 'body');
    const ctx = ctxOf(req);
    // 先按 password 走；如果用户开启 2FA，require 2fa 流程
    const result = await authService.login(data, ctx);
    res.status(200).json({ code: 0, message: 'ok', data: result });
  } catch (e) { next(e); }
}

export async function verify2fa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = getValidated<z.infer<typeof Verify2faBody>>(req, 'body');
    const result = await authService.loginWithTotp(data.user_id, data.totp, ctxOf(req));
    res.status(200).json({ code: 0, message: 'ok', data: result });
  } catch (e) { next(e); }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = getValidated<z.infer<typeof RefreshBody>>(req, 'body');
    const result = await authService.refresh(data.refresh_token, ctxOf(req));
    res.status(200).json({ code: 0, message: 'ok', data: result });
  } catch (e) { next(e); }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = getValidated<z.infer<typeof LogoutBody>>(req, 'body');
    const userId = (req as AuthedRequest).user?.id;
    await authService.logout(data.refresh_token, userId, ctxOf(req));
    res.status(200).json({ code: 0, message: 'ok' });
  } catch (e) { next(e); }
}

export async function logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const u = getUser(req as AuthedRequest);
    const n = await authService.logoutAll(u.id, ctxOf(req));
    res.status(200).json({ code: 0, message: 'ok', data: { revoked: n } });
  } catch (e) { next(e); }
}

export async function forgot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = getValidated<z.infer<typeof ForgotBody>>(req, 'body');
    await authService.requestPasswordReset(data.email, ctxOf(req));
    // 防枚举：统一 200
    res.status(200).json({ code: 0, message: 'ok' });
  } catch (e) { next(e); }
}

export async function reset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = getValidated<z.infer<typeof ResetBody>>(req, 'body');
    await authService.resetPassword(data.token, data.new_password, ctxOf(req));
    res.status(200).json({ code: 0, message: 'ok' });
  } catch (e) { next(e); }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = getValidated<z.infer<typeof VerifyTokenBody>>(req, 'body');
    if (!data.token) throw new BadRequestError('missing_token');
    await authService.confirmEmailVerification(data.token);
    res.status(200).json({ code: 0, message: 'ok' });
  } catch (e) { next(e); }
}

export const Validators = {
  RegisterBody,
  LoginBody,
  RefreshBody,
  LogoutBody,
  ForgotBody,
  ResetBody,
  VerifyTokenBody,
  Verify2faBody,
};

/* ---------------- 邮箱验证码 (派单 14: 阿里云 DirectMail) ---------------- */

const SendEmailCodeBody = z.object({
  email: z.string().email().max(255),
});

const RegisterByEmailBody = z.object({
  email: z.string().email().max(255),
  code: z.string().length(6),
  password: z.string().min(8).max(128),
  display_name: z.string().min(1).max(50).optional(),
});

// 重新导出给 routes 用
export { SendEmailCodeBody, RegisterByEmailBody };

/**
 * POST /api/v1/auth/send-email-code
 * body: { email: string }
 * 调用阿里云 DirectMail 发 6 位数字验证码
 */
export async function sendEmailCodeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = getValidated<z.infer<typeof SendEmailCodeBody>>(req, 'body');
    const result = await sendEmailCode(data.email);
    if (!result.ok) {
      const status = result.reason.startsWith('rate_limited') ? 429 : 500;
      res.status(status).json({ code: status, message: result.reason });
      return;
    }
    res.status(200).json({
      code: 0,
      message: 'ok',
      data: {
        email: data.email,
        ttl: 600,
        // mock 模式才返回 code（仅 dev/staging 可见）
        ...(result.mockCode ? { mock_code: result.mockCode } : {}),
      },
    });
  } catch (e) { next(e); }
}

/**
 * POST /api/v1/auth/register-by-email
 * body: { email, code, password, display_name? }
 * 验证邮箱码 + 创建用户 + 返回 JWT
 */
export async function registerByEmailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = getValidated<z.infer<typeof RegisterByEmailBody>>(req, 'body');
    const { email, code, password, display_name } = data;

    // 1. 校验验证码
    const verify = verifyEmailCode(email, code);
    if (!verify.ok) {
      res.status(401).json({ code: 401, message: verify.reason });
      return;
    }

    // 2. 防重复注册
    const exist = await userRepo.findByEmail(email);
    if (exist) {
      throw new ConflictError('email_already_used');
    }

    // 3. 创建用户 + 默认订阅 + 默认配额
    const passwordHash = await hashPassword(password);
    const created = await userRepo.createUser({
      email,
      password_hash: passwordHash,
      display_name: display_name ?? email.split('@')[0]!,
      role: 1,
    });

    // 默认 free 订阅 + 默认配额 (跟 sms login / register 行为一致)
    const { pool } = await import('../config/db');
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan) VALUES ($1, 'free') ON CONFLICT (user_id) DO NOTHING`,
      [created.id]
    );
    await pool.query(
      `INSERT INTO quotas (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [created.id]
    );

    // 4. 发 JWT — 跟 login 路径一致 (不调 registerAndLogin, 避免重复创建 user)
    const access = signAccessToken({
      sub: created.id,
      email: created.email,
      role: created.role,
    });
    const refresh = signRefreshToken({
      sub: created.id,
      jti: randomBytes(16).toString('hex'),
    });

    res.status(201).json({
      code: 0,
      message: 'registered',
      data: {
        access_token: access,
        refresh_token: refresh,
        token_type: 'Bearer',
        expires_in: 7 * 24 * 60 * 60,
        user: toPublicUser(created),
      },
    });
  } catch (e) { next(e); }
}

/* ---------------- 手机验证码 (SMS) ---------------- */

const SendSmsCodeBody = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/),
});

const LoginWithCodeBody = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/),
  code: z.string().length(6),
});

export { SendSmsCodeBody, LoginWithCodeBody };

/**
 * POST /api/v1/auth/send-code
 * body: { phone: string }
 * 发送 6 位短信验证码 (SMS_MOCK=true 时仅打日志)
 */
export async function sendSmsCodeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = getValidated<z.infer<typeof SendSmsCodeBody>>(req, 'body');
    const result = await sendCode(data.phone);
    if (!result.ok) {
      const status = result.reason.startsWith('rate_limited') ? 429 : 500;
      res.status(status).json({ code: status, message: result.reason });
      return;
    }
    res.status(200).json({
      code: 0,
      message: 'ok',
      data: {
        phone: data.phone,
        ttl: 300,
        ...(result.mockCode ? { mock_code: result.mockCode } : {}),
      },
    });
  } catch (e) { next(e); }
}

/**
 * POST /api/v1/auth/login-with-code
 * body: { phone: string, code: string }
 * 验证短信码 → 找到/自动创建用户 → 返回 JWT
 */
export async function loginWithCodeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = getValidated<z.infer<typeof LoginWithCodeBody>>(req, 'body');

    // 1. 校验验证码
    const verify = verifyCode(data.phone, data.code);
    if (!verify.ok) {
      res.status(401).json({ code: 401, message: verify.reason });
      return;
    }

    // 2. 查找用户，不存在则自动注册
    let user = await userRepo.findByPhone(data.phone);
    if (!user) {
      user = await userRepo.createUser({
        phone: data.phone,
        display_name: `用户${data.phone.slice(-4)}`,
        role: 1,
      });
      // 默认 free 订阅 + 默认配额
      const { pool } = await import('../config/db');
      await pool.query(
        `INSERT INTO subscriptions (user_id, plan) VALUES ($1, 'free') ON CONFLICT (user_id) DO NOTHING`,
        [user.id]
      );
      await pool.query(
        `INSERT INTO quotas (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [user.id]
      );
    }

    // 3. 签发 JWT
    const access = signAccessToken({ sub: user.id, email: user.email ?? '', role: user.role });
    const refresh = signRefreshToken({ sub: user.id, jti: randomBytes(16).toString('hex') });

    res.status(200).json({
      code: 0,
      message: 'ok',
      data: {
        access_token: access,
        refresh_token: refresh,
        token_type: 'Bearer',
        expires_in: 7 * 24 * 60 * 60,
        user: toPublicUser(user),
      },
    });
  } catch (e) { next(e); }
}
