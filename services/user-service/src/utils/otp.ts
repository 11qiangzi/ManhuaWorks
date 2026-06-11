import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const ISSUER = process.env.TOTP_ISSUER ?? 'ManhuaWorks';

authenticator.options = {
  window: 1,    // 允许前后 1 个 30s 窗口
  step: 30,
};

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpAuthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function buildQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { width: 256, margin: 1 });
}

export function verifyTotp(token: string, secret: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  return authenticator.verify({ token, secret });
}

export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}
