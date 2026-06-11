import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService';
import { getValidated } from '../middleware/validate';
import { AuthedRequest, getUser } from '../middleware/auth';
import { BadRequestError } from '@manhuaworks/shared';

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
