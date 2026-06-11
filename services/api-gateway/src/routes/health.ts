/**
 * /health —— liveness
 * /ready  —— readiness（5 个后台探针）
 *
 * 区别：
 *   - liveness：进程是否活着 → 失败 K8s 杀 Pod
 *   - readiness：能不能接活   → 失败 K8s 摘流量
 *
 * 探针策略：
 *   - 所有目标并发检查（Promise.all），总耗时 ≈ 最慢那个
 *   - 任何一项失败 → HTTP 503，但 body 详细列出每项
 *   - 超时硬限（每个 target 自己的 timeoutMs）
 */

import { Hono } from 'hono';
import { loadConfig, type ReadinessTarget } from '../config.js';
import { getRedis } from '../redis.js';
import pg from 'pg';

const { Pool } = pg;

// ──────────────────────────────────────────────────────────
// 探针实现
// ──────────────────────────────────────────────────────────

async function probeHttp(target: ReadinessTarget): Promise<{ ok: boolean; latencyMs: number; detail?: string }> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), target.timeoutMs);
  try {
    const res = await fetch(target.url, { method: 'GET', signal: ctrl.signal });
    return {
      ok: res.ok,
      latencyMs: Date.now() - t0,
      detail: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    const msg = (err as Error).message || String(err) || 'unknown error';
    return { ok: false, latencyMs: Date.now() - t0, detail: msg };
  } finally {
    clearTimeout(timer);
  }
}

async function probeRedis(target: ReadinessTarget): Promise<{ ok: boolean; latencyMs: number; detail?: string }> {
  const t0 = Date.now();
  try {
    const r = await getRedis();
    const pong = await Promise.race([
      r.ping(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('ping timeout')), target.timeoutMs)),
    ]);
    return { ok: pong === 'PONG', latencyMs: Date.now() - t0 };
  } catch (err) {
    const msg = (err as Error).message || String(err) || 'unknown error';
    return { ok: false, latencyMs: Date.now() - t0, detail: msg };
  }
}

async function probePostgres(target: ReadinessTarget): Promise<{ ok: boolean; latencyMs: number; detail?: string }> {
  const t0 = Date.now();
  const pool = new Pool({ connectionString: target.url, connectionTimeoutMillis: target.timeoutMs });
  try {
    const r = await pool.query('SELECT 1 AS ok');
    return { ok: r.rows[0]?.ok === 1, latencyMs: Date.now() - t0 };
  } catch (err) {
    const msg = (err as Error).message || String(err) || 'unknown error';
    return { ok: false, latencyMs: Date.now() - t0, detail: msg };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function probeOne(target: ReadinessTarget) {
  let result: { ok: boolean; latencyMs: number; detail?: string };
  switch (target.kind) {
    case 'http':
      result = await probeHttp(target);
      break;
    case 'redis':
      result = await probeRedis(target);
      break;
    case 'postgres':
      result = await probePostgres(target);
      break;
  }
  return { name: target.name, kind: target.kind, url: target.url, ...result };
}

// ──────────────────────────────────────────────────────────
// 路由
// ──────────────────────────────────────────────────────────

const health = new Hono();

/** 进程是否还活着 —— 永远 200，只要进程在就 OK */
health.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'api-gateway',
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/** 能不能接活 —— 5 个探针全过才算 ready */
health.get('/ready', async (c) => {
  const cfg = loadConfig();
  const probes = await Promise.all(cfg.readiness.map(probeOne));
  const allOk = probes.every((p) => p.ok);

  return c.json(
    {
      status: allOk ? 'ready' : 'not_ready',
      service: 'api-gateway',
      checkedAt: new Date().toISOString(),
      totalLatencyMs: Math.max(...probes.map((p) => p.latencyMs)),
      checks: probes,
    },
    allOk ? 200 : 503,
  );
});

export default health;
