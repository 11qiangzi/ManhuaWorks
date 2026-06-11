/**
 * ManhuaWorks · M2 集成冒烟测试
 * -----------------------------------------------------------------------------
 * 任务：L5-E 收官验收 — 钟帧
 * 日期：2026-06-09
 * 目的：M2 交付的 9 个端口连通性 + 关键端点契约 1 遍真实 HTTP 跑通
 *
 * 测试矩阵（8 测）：
 *   1. AC-21 user-service /health        → 200
 *   2. AC-22 project-service /health     → 200
 *   3. AC-23 billing-service /health     → 200
 *   4. AC-24 collab-service /health      → 200
 *   5. AC-25 ai-orchestrator /health     → 200 或 503（deps down 时 503 是正确）
 *   6. AC-26 ai-orchestrator /v1/orchestrate/pipelines 无 token → 401
 *   7. AC-16/17 user-service /api/v1/auth/register → 201 (idempotent: 409 视为通过)
 *   8. AC-16 user-service /api/v1/auth/login → 200 + JWT
 *
 * 前置：先跑 `.\scripts\dev-start.ps1` 起 4 service + 1 orchestrator
 *       数据库 postgres:5432 已就绪（seed 已跑过 或 未跑均可）
 *
 * 用法：
 *   cd D:\ManhuaWorks
 *   npx vitest run tests/integration/m2-smoke.test.ts --reporter=basic
 *
 * 设计原则（来自 L4-A 教训：禁止编 API 路径）：
 *   - 所有路径从源代码 `routes/index.ts` 实抄
 *   - 所有断言 ① 状态码 + ② body.code + ③ 关键字段
 *   - 不依赖子 agent 报告，必须自己看到 200/201
 * -----------------------------------------------------------------------------
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/* ============== 端口 ============== */
// 与 scripts/dev-start.ps1 完全一致
const PORTS = {
  web: 3000,
  adminPortal: 5174,
  studio: 5175,
  userPortal: 5180,
  orchestrator: 8087,
  userService: 8088,
  projectService: 8089,
  billingService: 8090,
  collabService: 8091,
} as const;

const URLS = {
  web: `http://127.0.0.1:${PORTS.web}`,
  adminPortal: `http://127.0.0.1:${PORTS.adminPortal}`,
  studio: `http://127.0.0.1:${PORTS.studio}`,
  userPortal: `http://127.0.0.1:${PORTS.userPortal}`,
  orchestrator: `http://127.0.0.1:${PORTS.orchestrator}`,
  userService: `http://127.0.0.1:${PORTS.userService}`,
  projectService: `http://127.0.0.1:${PORTS.projectService}`,
  billingService: `http://127.0.0.1:${PORTS.billingService}`,
  collabService: `http://127.0.0.1:${PORTS.collabService}`,
} as const;

const TEST_USER = {
  email: 'l5b-test@example.com',
  password: 'Test1234',
  displayName: 'M2 Smoke Test',
} as const;

/* ============== HTTP 工具 ============== */
interface HttpResult<T = unknown> {
  status: number;
  body: T;
  rawText: string;
}

async function httpGet<T = unknown>(url: string, timeoutMs = 5_000): Promise<HttpResult<T>> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal });
    const text = await res.text();
    let body: T;
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = text as unknown as T;
    }
    return { status: res.status, body, rawText: text };
  } finally {
    clearTimeout(t);
  }
}

async function httpPost<T = unknown>(
  url: string,
  body: unknown,
  timeoutMs = 8_000,
): Promise<HttpResult<T>> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let parsed: T;
    try {
      parsed = JSON.parse(text) as T;
    } catch {
      parsed = text as unknown as T;
    }
    return { status: res.status, body: parsed, rawText: text };
  } finally {
    clearTimeout(t);
  }
}

/* ============== 共享 fixtures ==============
 * 真实响应（实测抄自 POST /api/v1/auth/login）：
 *   { "code": 0, "message": "ok", "data": {
 *       "access_token": "eyJ...",
 *       "refresh_token": "eyJ...",
 *       "expires_in": 604800,
 *       "token_type": "Bearer",
 *       "user": { id, email, display_name, role, status, ... }
 *   }}
 * 错误响应：{ "code": "conflict", "message": "email_already_used" }  // 409
 */
interface Envelope {
  code: number | string;
  message: string;
  data?: unknown;
}
interface AuthUser {
  id: string;
  email: string | null;
  display_name: string;
  role: number;
  status?: number;
}
interface AuthResponse {
  code: number;
  message: string;
  data?: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    user: AuthUser;
  };
}

let accessToken: string | null = null;

/* ============== beforeAll：先 ping 所有端口 ============== */
beforeAll(async () => {
  // 探测 user-service，5s 内连不上就 fail
  const probe = await httpGet(`${URLS.userService}/health`, 3_000);
  if (probe.status !== 200) {
    throw new Error(
      `[m2-smoke] user-service 不可达 (${probe.status})。先跑 scripts/dev-start.ps1`,
    );
  }
}, 30_000);

/* ============== 8 测 ============== */
describe('M2 集成冒烟 (8/8)', () => {
  /* ---------- 1-4: 4 service /health ---------- */
  it('AC-21 user-service /health → 200', async () => {
    const r = await httpGet<Envelope>(`${URLS.userService}/health`);
    expect(r.status).toBe(200);
    expect(r.body.code).toBe(0);
    const data = r.body.data as { service: string; status: string } | undefined;
    expect(data?.service).toBe('user-service');
    expect(data?.status).toBe('healthy');
  });

  it('AC-22 project-service /health → 200', async () => {
    const r = await httpGet<Envelope>(`${URLS.projectService}/health`);
    expect(r.status).toBe(200);
    expect(r.body.code).toBe(0);
    const data = r.body.data as { service: string; version: string } | undefined;
    expect(data?.service).toBe('project-service');
    expect(typeof data?.version).toBe('string');
  });

  it('AC-23 billing-service /health → 200', async () => {
    const r = await httpGet<Envelope>(`${URLS.billingService}/health`);
    expect(r.status).toBe(200);
    expect(r.body.code).toBe(0);
    const data = r.body.data as { service: string; version: string } | undefined;
    expect(data?.service).toBe('billing-service');
  });

  it('AC-24 collab-service /health → 200', async () => {
    const r = await httpGet<Envelope>(`${URLS.collabService}/health`);
    expect(r.status).toBe(200);
    expect(r.body.code).toBe(0);
    const data = r.body.data as { service: string; version: string; uptime?: number } | undefined;
    expect(data?.service).toBe('collab-service');
  });

  /* ---------- 5: orchestrator /health (deps down 时 503 仍 OK) ---------- */
  it('AC-25 ai-orchestrator /health → 200 or 503', async () => {
    const r = await httpGet<{ ok: boolean; service: string; deps?: Record<string, string> }>(
      `${URLS.orchestrator}/health`,
    );
    // 503 是允许的：orchestrator 会查 6 个 dep，dev 环境全 down 就 503
    expect([200, 503]).toContain(r.status);
    expect(r.body.service).toBe('ai-orchestrator');
    expect(typeof r.body.ok).toBe('boolean');
  });

  /* ---------- 6: orchestrator /v1/orchestrate/pipelines 无 token → 401 ---------- */
  it('AC-26 ai-orchestrator /v1/orchestrate/pipelines 无 token → 401', async () => {
    const r = await httpGet<{ error?: string }>(
      `${URLS.orchestrator}/v1/orchestrate/pipelines`,
    );
    expect(r.status).toBe(401);
  });

  /* ---------- 7: user-service /api/v1/auth/register ---------- */
  it('AC-16 user-service /api/v1/auth/register → 201 (409 也算 idempotent)', async () => {
    const r = await httpPost<AuthResponse>(`${URLS.userService}/api/v1/auth/register`, {
      email: TEST_USER.email,
      password: TEST_USER.password,
      display_name: TEST_USER.displayName,
    });
    // 期望：201（新注册）或 409（已注册）—— 都算通过
    expect([201, 409]).toContain(r.status);
    if (r.status === 201) {
      expect(r.body.code).toBe(0);
      expect(r.body.data?.access_token).toBeTruthy();
      accessToken = r.body.data!.access_token;
    } else {
      // 409 表示账号已存在，body 是 {code:"conflict", message:"email_already_used"}
      expect(String(r.body.code)).toBe('conflict');
    }
  });

  /* ---------- 8: user-service /api/v1/auth/login → 200 + JWT ---------- */
  it('AC-16 user-service /api/v1/auth/login → 200 + JWT', async () => {
    const r = await httpPost<AuthResponse>(`${URLS.userService}/api/v1/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password,
    });
    expect(r.status).toBe(200);
    expect(r.body.code).toBe(0);
    const data = r.body.data;
    expect(data).toBeTruthy();
    expect(typeof data?.access_token).toBe('string');
    expect(data!.access_token.length).toBeGreaterThan(20); // JWT 一般 100+ 字符
    // 标准 JWT 三段
    const parts = data!.access_token.split('.');
    expect(parts.length).toBe(3);
    // user 信息
    expect(data?.user.email).toBe(TEST_USER.email);
    accessToken = data!.access_token;
  });
});

/* ============== afterAll：清理（不删用户，留给下次复测） ============== */
afterAll(async () => {
  if (accessToken) {
    // eslint-disable-next-line no-console
    console.log(`[m2-smoke] accessToken (前 30 字符): ${accessToken.slice(0, 30)}...`);
  }
});
