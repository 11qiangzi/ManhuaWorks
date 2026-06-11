import nodemailer, { type Transporter } from 'nodemailer';
import type { Alert, AlertChannel } from '../../types';

export interface EmailChannelOptions {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
  to: string;
  /**
   * Override transporter creation (for tests).
   */
  createTransporter?: () => Transporter;
}

let sharedTransporter: Transporter | null = null;
let sharedOptions: EmailChannelOptions | null = null;

function transporterFor(opts: EmailChannelOptions): Transporter {
  if (opts.createTransporter) return opts.createTransporter();
  if (sharedTransporter && sharedOptions && shallowEq(sharedOptions, opts)) {
    return sharedTransporter;
  }
  sharedTransporter = nodemailer.createTransport({
    host: opts.host,
    port: opts.port,
    secure: opts.port === 465,
    auth: opts.user ? { user: opts.user, pass: opts.password ?? '' } : undefined,
  });
  sharedOptions = opts;
  return sharedTransporter;
}

function shallowEq(a: EmailChannelOptions, b: EmailChannelOptions): boolean {
  return a.host === b.host && a.port === b.port && a.user === b.user && a.password === b.password;
}

export function emailChannel(opts: EmailChannelOptions): AlertChannel {
  if (!opts.host || !opts.to) {
    return {
      name: 'email',
      async send() {
        // disabled: no SMTP config
      },
    };
  }

  return {
    name: 'email',
    async send(alert: Alert) {
      const t = transporterFor(opts);
      const subject = `[${alert.severity.toUpperCase()}] ${alert.service} - ${alert.rule}`;
      const text = [
        `Service: ${alert.service}`,
        `Rule: ${alert.rule}`,
        `Severity: ${alert.severity}`,
        `Value: ${alert.value.toFixed(3)}`,
        `Threshold: ${alert.threshold}`,
        `Message: ${alert.message}`,
        `Started: ${new Date(alert.startedAt).toISOString()}`,
        `Alert ID: ${alert.id}`,
      ].join('\n');
      await t.sendMail({ from: opts.from, to: opts.to, subject, text });
    },
  };
}
