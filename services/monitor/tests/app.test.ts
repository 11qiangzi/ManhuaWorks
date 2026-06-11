import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';

describe('monitor app', () => {
  it('GET /health returns 200', async () => {
    const built = buildApp({
      services: [],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    });
    const res = await request(built.app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /metrics returns prom text', async () => {
    const built = buildApp({
      services: [],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    });
    const res = await request(built.app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/manhuaworks_monitor/);
  });

  it('GET /alerts returns current active alerts', async () => {
    const built = buildApp({
      services: [],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    });
    const res = await request(built.app).get('/alerts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });

  it('POST /alerts/acknowledge validates input', async () => {
    const built = buildApp({
      services: [],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    });
    const res = await request(built.app).post('/alerts/acknowledge').send({});
    expect(res.status).toBe(400);
  });

  it('GET /alerts/resolved returns resolved list', async () => {
    const built = buildApp({
      services: [],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    });
    const res = await request(built.app).get('/alerts/resolved');
    expect(res.status).toBe(200);
  });

  it('POST /alerts/silence toggles silenced list', async () => {
    const built = buildApp({
      services: [],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    });
    const r1 = await request(built.app).post('/alerts/silence').send({ service: 's', rule: 'r' });
    expect(r1.status).toBe(200);
    const r2 = await request(built.app).get('/alerts/silenced');
    expect(r2.body.silenced).toContain('s::r');
    const r3 = await request(built.app).delete('/alerts/silence').send({ service: 's', rule: 'r' });
    expect(r3.status).toBe(200);
  });

  it('GET /dashboard returns summary', async () => {
    const built = buildApp({
      services: [],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    });
    const res = await request(built.app).get('/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.services).toBeDefined();
  });

  it('GET /health/deep returns db+redis sections', async () => {
    const built = buildApp({
      services: [],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    });
    const res = await request(built.app).get('/health/deep');
    expect(res.status).toBe(200);
    expect(res.body.db).toBeDefined();
    expect(res.body.redis).toBeDefined();
  });
});
