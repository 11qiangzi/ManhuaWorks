export const VerificationPurpose = {
  EmailVerify: 1,
  PasswordReset: 2,
} as const;
export type VerificationPurposeValue =
  (typeof VerificationPurpose)[keyof typeof VerificationPurpose];

export interface Verification {
  id: string;
  user_id: string;
  token_hash: string;
  purpose: VerificationPurposeValue;
  target: string;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
}
