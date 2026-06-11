export const AuditAction = {
  Register: 'register',
  Login: 'login',
  LoginFailed: 'login_failed',
  Logout: 'logout',
  PasswordChange: 'password_change',
  PasswordResetRequest: 'password_reset_request',
  PasswordResetComplete: 'password_reset_complete',
  EmailVerifyRequest: 'email_verify_request',
  EmailVerifyComplete: 'email_verify_complete',
  TwoFactorEnable: '2fa_enable',
  TwoFactorDisable: '2fa_disable',
  TwoFactorVerify: '2fa_verify',
  TwoFactorFailed: '2fa_failed',
  ProfileUpdate: 'profile_update',
  AvatarUpdate: 'avatar_update',
} as const;
export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditLog {
  id: number;
  user_id: string | null;
  action: string;
  status: number;          // 0=fail, 1=success
  ip_address: string | null;
  user_agent: string | null;
  detail: Record<string, unknown> | null;
  created_at: Date;
}
