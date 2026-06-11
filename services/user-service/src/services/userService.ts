import { z } from 'zod';
import * as userRepo from '../repositories/userRepository';
import { hashPassword, verifyPassword, checkPasswordStrength } from '../utils/password';
import { ConflictError, NotFoundError, BadRequestError, UnauthorizedError } from '@manhuaworks/shared';
import { PublicUser, toPublicUser, User } from '../models/user';

export const RegisterSchema = z.object({
  email: z.string().email().max(255).optional(),
  phone: z.string().regex(/^\+?\d{6,20}$/).optional(),
  password: z.string().min(8).max(128),
  display_name: z.string().min(1).max(50).optional(),
}).refine((d) => d.email || d.phone, { message: 'email_or_phone_required' });

export type RegisterInput = z.infer<typeof RegisterSchema>;

export async function register(input: RegisterInput): Promise<PublicUser> {
  const strength = checkPasswordStrength(input.password);
  if (!strength.ok) {
    throw new BadRequestError('weak_password', strength);
  }
  if (input.email) {
    const exist = await userRepo.findByEmail(input.email);
    if (exist) throw new ConflictError('email_already_used');
  }
  if (input.phone) {
    const exist = await userRepo.findByPhone(input.phone);
    if (exist) throw new ConflictError('phone_already_used');
  }
  const password_hash = await hashPassword(input.password);
  const u = await userRepo.createUser({
    email: input.email ?? null,
    phone: input.phone ?? null,
    password_hash,
    display_name: input.display_name ?? null,
  });
  return toPublicUser(u);
}

export const UpdateMeSchema = z.object({
  display_name: z.string().min(1).max(50).optional(),
  avatar_url: z.string().url().max(2048).optional(),
});
export type UpdateMeInput = z.infer<typeof UpdateMeSchema>;

export async function getMe(userId: string): Promise<PublicUser> {
  const u = await userRepo.findById(userId);
  if (!u) throw new NotFoundError('user_not_found');
  return toPublicUser(u);
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<PublicUser> {
  const u = await userRepo.updateUser(userId, input);
  if (!u) throw new NotFoundError('user_not_found');
  return toPublicUser(u);
}

export async function changePassword(userId: string, oldPwd: string, newPwd: string): Promise<void> {
  const u = await userRepo.findById(userId);
  if (!u) throw new NotFoundError('user_not_found');
  if (!u.password_hash) throw new BadRequestError('no_password_set');
  const ok = await verifyPassword(oldPwd, u.password_hash);
  if (!ok) throw new UnauthorizedError('wrong_old_password');
  const strength = checkPasswordStrength(newPwd);
  if (!strength.ok) throw new BadRequestError('weak_password', strength);
  const h = await hashPassword(newPwd);
  await userRepo.updateUser(userId, { password_hash: h });
}

export async function getUserById(id: string): Promise<PublicUser> {
  const u = await userRepo.findById(id);
  if (!u) throw new NotFoundError('user_not_found');
  return toPublicUser(u);
}

export async function listUsers(opts: { limit: number; offset: number }): Promise<{ items: PublicUser[]; total: number }> {
  const [items, total] = await Promise.all([
    userRepo.listUsers(opts),
    userRepo.countUsers(),
  ]);
  return { items, total };
}

export async function adminUpdateUser(id: string, input: { role?: number; status?: number }): Promise<PublicUser> {
  const u = await userRepo.updateUser(id, input);
  if (!u) throw new NotFoundError('user_not_found');
  return toPublicUser(u);
}

export async function adminDeleteUser(id: string): Promise<void> {
  const ok = await userRepo.deleteUser(id);
  if (!ok) throw new NotFoundError('user_not_found');
}
