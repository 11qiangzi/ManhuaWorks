import { describe, it, expect, vi } from 'vitest';
import { feishuChannel } from '../src/alerts/channels/feishu';
import { webhookChannel } from '../src/alerts/channels/webhook';
import { emailChannel } from '../src/alerts/channels/email';
import type { Alert } from '../src/types';

const baseAlert: Alert = {
  id: 'a1',
  rule: 'cpu_high',
  service: 'user-service',
  severity: 'critical',
  message: 'CPU 90% > 80%',
  value: 0.9,
  threshold: 0.8,
  startedAt: Date.now(),
  labels: { service: 'user-service', rule: 'cpu_high' },
};

describe('feishuChannel', () => {
  it('no-op when webhookUrl is empty', async () => {
    const ch = feishuChannel({ webhookUrl: '' });
    await expect(ch.send(baseAlert)).resolves.toBeUndefined();
  });

  it('posts to webhook with card body', async () => {
    const mockFetch = vi.fn(async () => ({ ok: true, text: async () => '' })) as unknown as typeof fetch;
    const ch = feishuChannel({ webhookUrl: 'https://feishu/x', defaultAtMobiles: ['u_1'], fetcher: mockFetch });
    await ch.send(baseAlert);
    expect(mockFetch).toHaveBeenCalled();
    const [url, init] = (mockFetch as any).mock.calls[0];
    expect(url).toContain('feishu');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.msg_type).toBe('interactive');
    expect(body.card.header.title.content).toContain('CRITICAL');
  });

  it('throws on non-2xx response', async () => {
    const mockFetch = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'bad' })) as unknown as typeof fetch;
    const ch = feishuChannel({ webhookUrl: 'https://feishu/x', fetcher: mockFetch });
    await expect(ch.send(baseAlert)).rejects.toThrow(/500/);
  });
});

describe('webhookChannel', () => {
  it('no-op when url is empty', async () => {
    const ch = webhookChannel({ url: '' });
    await expect(ch.send(baseAlert)).resolves.toBeUndefined();
  });

  it('posts JSON body', async () => {
    const mockFetch = vi.fn(async () => ({ ok: true, text: async () => '' })) as unknown as typeof fetch;
    const ch = webhookChannel({ url: 'https://hook/x', secret: 'sig', fetcher: mockFetch });
    await ch.send(baseAlert);
    const [url, init] = (mockFetch as any).mock.calls[0];
    expect(url).toBe('https://hook/x');
    expect((init as RequestInit).headers).toMatchObject({ 'X-ManhuaWorks-Signature': 'sig' });
  });

  it('throws on non-2xx', async () => {
    const mockFetch = vi.fn(async () => ({ ok: false, status: 400, text: async () => 'no' })) as unknown as typeof fetch;
    const ch = webhookChannel({ url: 'https://hook/x', fetcher: mockFetch });
    await expect(ch.send(baseAlert)).rejects.toThrow(/400/);
  });
});

describe('emailChannel', () => {
  it('no-op when host/to is empty', async () => {
    const ch = emailChannel({ host: '', port: 587, from: 'a', to: '' });
    await expect(ch.send(baseAlert)).resolves.toBeUndefined();
  });

  it('sends via the supplied transporter', async () => {
    const sendMail = vi.fn<(opts: { to: string; subject: string }) => Promise<{ messageId: string }>>(async () => ({ messageId: 'x' }));
    const ch = emailChannel({
      host: 'smtp.example.com',
      port: 587,
      from: 'm@example.com',
      to: 'o@example.com',
      createTransporter: () => ({ sendMail } as any),
    });
    await ch.send(baseAlert);
    expect(sendMail).toHaveBeenCalled();
    const arg = sendMail.mock.calls[0]?.[0] as unknown as { to: string; subject: string };
    expect(arg.to).toBe('o@example.com');
    expect(arg.subject).toContain('CRITICAL');
  });
});
