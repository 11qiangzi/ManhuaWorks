import bcrypt from 'bcryptjs';

const COST = Number(process.env.BCRYPT_COST ?? 12);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface PasswordStrength {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  reasons: string[];
}

export function checkPasswordStrength(plain: string): PasswordStrength {
  const reasons: string[] = [];
  let score: 0 | 1 | 2 | 3 | 4 = 0;

  if (plain.length < 8) reasons.push('too_short');
  if (plain.length >= 8) score = (score + 1) as 0 | 1 | 2 | 3 | 4;
  if (plain.length >= 12) score = (score + 1) as 0 | 1 | 2 | 3 | 4;
  if (/[a-z]/.test(plain) && /[A-Z]/.test(plain)) score = (score + 1) as 0 | 1 | 2 | 3 | 4;
  if (/\d/.test(plain)) score = (score + 1) as 0 | 1 | 2 | 3 | 4;
  if (/[^a-zA-Z0-9]/.test(plain)) score = (score + 1) as 0 | 1 | 2 | 3 | 4;
  if (score > 4) score = 4;

  if (/(.)\1{2,}/.test(plain)) reasons.push('repeated_chars');
  if (/^(?:123|password|qwerty|abc)/i.test(plain)) reasons.push('common_pattern');

  return { ok: reasons.length === 0 && score >= 2, score, reasons };
}
