import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as userService from '../services/userService';
import * as twoFactor from '../services/twoFactorService';
import { getValidated } from '../middleware/validate';
import { AuthedRequest, getUser } from '../middleware/auth';
import { Role } from '../models/user';

const UpdateMeBody = z.object({
  display_name: z.string().min(1).max(50).optional(),
  avatar_url: z.string().url().max(2048).optional(),
});
const ChangePasswordBody = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(8).max(128),
});
const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
const AdminUpdateBody = z.object({
  role: z.number().int().min(1).max(5).optional(),
  status: z.number().int().min(0).max(1).optional(),
});
const TotpTokenBody = z.object({ totp: z.string().min(6).max(10) });

function ctxOf(req: Request): { userAgent?: string; ipAddress?: string } {
  return {
    userAgent: (req.headers['user-agent'] as string) ?? undefined,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? undefined,
  };
}

/* /me */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const u = getUser(req as AuthedRequest);
    const me = await userService.getMe(u.id);
    res.status(200).json({ code: 0, message: 'ok', data: me });
  } catch (e) { next(e); }
}

export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const u = getUser(req as AuthedRequest);
    const data = getValidated<z.infer<typeof UpdateMeBody>>(req, 'body');
    const me = await userService.updateMe(u.id, data);
    res.status(200).json({ code: 0, message: 'ok', data: me });
  } catch (e) { next(e); }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const u = getUser(req as AuthedRequest);
    const data = getValidated<z.infer<typeof ChangePasswordBody>>(req, 'body');
    await userService.changePassword(u.id, data.old_password, data.new_password);
    res.status(200).json({ code: 0, message: 'ok' });
  } catch (e) { next(e); }
}

/* admin: list users */
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = getValidated<z.infer<typeof ListQuery>>(req, 'query');
    const r = await userService.listUsers({ limit: q.limit, offset: q.offset });
    res.status(200).json({ code: 0, message: 'ok', data: r });
  } catch (e) { next(e); }
}

export async function getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params['id'];
    if (!id) return void res.status(400).json({ code: 'bad_request', message: 'missing_id' });
    const u = await userService.getUserById(id);
    res.status(200).json({ code: 0, message: 'ok', data: u });
  } catch (e) { next(e); }
}

export async function adminUpdateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params['id'];
    if (!id) return void res.status(400).json({ code: 'bad_request', message: 'missing_id' });
    const data = getValidated<z.infer<typeof AdminUpdateBody>>(req, 'body');
    const u = await userService.adminUpdateUser(id, data);
    res.status(200).json({ code: 0, message: 'ok', data: u });
  } catch (e) { next(e); }
}

export async function adminDeleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params['id'];
    if (!id) return void res.status(400).json({ code: 'bad_request', message: 'missing_id' });
    await userService.adminDeleteUser(id);
    res.status(204).end();
  } catch (e) { next(e); }
}

/* /me/2fa */
export async function get2faStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const u = getUser(req as AuthedRequest);
    const s = await twoFactor.getStatus(u.id);
    res.status(200).json({ code: 0, message: 'ok', data: s });
  } catch (e) { next(e); }
}

export async function start2fa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const u = getUser(req as AuthedRequest);
    const r = await twoFactor.startEnable(u.id);
    res.status(200).json({ code: 0, message: 'ok', data: r });
  } catch (e) { next(e); }
}

export async function confirm2fa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const u = getUser(req as AuthedRequest);
    const data = getValidated<z.infer<typeof TotpTokenBody>>(req, 'body');
    const r = await twoFactor.confirmEnable(u.id, data.totp);
    res.status(200).json({ code: 0, message: 'ok', data: r });
  } catch (e) { next(e); }
}

export async function disable2fa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const u = getUser(req as AuthedRequest);
    const data = getValidated<z.infer<typeof TotpTokenBody>>(req, 'body');
    await twoFactor.disable(u.id, data.totp);
    res.status(200).json({ code: 0, message: 'ok' });
  } catch (e) { next(e); }
}

export const Validators = {
  UpdateMeBody,
  ChangePasswordBody,
  ListQuery,
  AdminUpdateBody,
  TotpTokenBody,
  RoleAdmin: Role.Admin,
};
