import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlertManager } from '../src/alerts/alertManager';
import type { Alert, AlertChannel, RuleDefinition } from '../src/types';

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function makeChannel(name: string, calls: Alert[] = []): AlertChannel & { calls: Alert[] } {
  const ch: AlertChannel & { calls: Alert[] } = {
    name,
    calls,
    async send(a) { this.calls.push(a); },
  };
  return ch;
}

const stubRule: RuleDefinition = {
  id: 'test_rule',
  name: 'Test',
  description: 'stub',
  severity: 'warning',
  async evaluate() {
    return { value: 100, threshold: 50, message: 'over', labels: { service: 'svc' } };
  },
};

describe('AlertManager', () => {
  let am: AlertManager;
  let ch: AlertChannel & { calls: Alert[] };

  beforeEach(() => {
    ch = makeChannel('feishu');
    am = new AlertManager({ channels: [ch], logger: makeLogger() });
  });

  it('fires a new alert on first observation', async () => {
    const a = await am.submit(stubRule, { value: 100, threshold: 50, message: 'over', labels: { service: 'svc' } });
    expect(a).not.toBeNull();
    expect(ch.calls.length).toBe(1);
  });

  it('does not re-notify within the cooldown', async () => {
    await am.submit(stubRule, { value: 100, threshold: 50, message: 'over', labels: { service: 'svc' } });
    await am.submit(stubRule, { value: 110, threshold: 50, message: 'over', labels: { service: 'svc' } });
    await am.submit(stubRule, { value: 120, threshold: 50, message: 'over', labels: { service: 'svc' } });
    expect(ch.calls.length).toBe(1);
  });

  it('re-notifies after the cooldown', async () => {
    am = new AlertManager({ channels: [ch], notifyIntervalMs: 5, logger: makeLogger() });
    await am.submit(stubRule, { value: 100, threshold: 50, message: 'over', labels: { service: 'svc' } });
    await new Promise((r) => setTimeout(r, 10));
    await am.submit(stubRule, { value: 110, threshold: 50, message: 'over', labels: { service: 'svc' } });
    expect(ch.calls.length).toBe(2);
  });

  it('resolves an active alert', async () => {
    await am.submit(stubRule, { value: 100, threshold: 50, message: 'over', labels: { service: 'svc' } });
    const ok = await am.resolve('test_rule', 'svc');
    expect(ok).toBe(true);
    expect(am.listActive().length).toBe(0);
    expect(am.listResolved().length).toBe(1);
  });

  it('resolve returns false for unknown alert', async () => {
    const ok = await am.resolve('does_not_exist', 'svc');
    expect(ok).toBe(false);
  });

  it('acknowledges an active alert', async () => {
    await am.submit(stubRule, { value: 100, threshold: 50, message: 'over', labels: { service: 'svc' } });
    const a = am.acknowledge('test_rule', 'svc', 'alice');
    expect(a?.acknowledgedBy).toBe('alice');
    expect(a?.acknowledgedAt).toBeTypeOf('number');
  });

  it('silence suppresses a (service,rule) combination', async () => {
    am.silence('svc', 'test_rule');
    const a = await am.submit(stubRule, { value: 100, threshold: 50, message: 'over', labels: { service: 'svc' } });
    expect(a).toBeNull();
    expect(ch.calls.length).toBe(0);
    am.unsilence('svc', 'test_rule');
    await am.submit(stubRule, { value: 100, threshold: 50, message: 'over', labels: { service: 'svc' } });
    expect(ch.calls.length).toBe(1);
  });

  it('respects minSeverity', async () => {
    am = new AlertManager({ channels: [ch], logger: makeLogger(), minSeverity: 'critical' });
    const infoRule: RuleDefinition = { ...stubRule, severity: 'info' };
    await am.submit(infoRule, { value: 1, threshold: 0, message: 'info', labels: { service: 'svc' } });
    expect(ch.calls.length).toBe(0);
  });

  it('handles channel failures gracefully', async () => {
    const badCh: AlertChannel = {
      name: 'broken',
      async send() { throw new Error('boom'); },
    };
    am = new AlertManager({ channels: [badCh, ch], logger: makeLogger() });
    await am.submit(stubRule, { value: 1, threshold: 0, message: 'x', labels: { service: 'svc' } });
    // good channel still called
    expect(ch.calls.length).toBe(1);
  });
});
