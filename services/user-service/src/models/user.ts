/**
 * User model — strict 1:1 with users table from migrations/001_init.sql
 */
export interface User {
  id: string;
  phone: string | null;
  email: string | null;
  password_hash: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: number;            // 1..5
  status: number;          // 0=disabled, 1=active
  created_at: Date;
  updated_at: Date;
}

export type PublicUser = Omit<User, 'password_hash'>;

export function toPublicUser(u: User): PublicUser {
  const { password_hash, ...rest } = u;
  void password_hash;
  return rest;
}

/* role enum (1=reader, 2=creator, 3=editor, 4=admin, 5=superadmin) */
export const Role = {
  Reader: 1,
  Creator: 2,
  Editor: 3,
  Admin: 4,
  SuperAdmin: 5,
} as const;
export type RoleValue = (typeof Role)[keyof typeof Role];

/* status enum */
export const UserStatus = {
  Disabled: 0,
  Active: 1,
} as const;
export type UserStatusValue = (typeof UserStatus)[keyof typeof UserStatus];
