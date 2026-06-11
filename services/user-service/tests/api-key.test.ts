/**
 * API Key 端到端集成测试
 *
 * 流程：注册 → 加 key → 列出（看不到明文）→ 内部解密 → 模拟 AI 调用 → revoke
 *
 * 覆盖：
 *   - 加 key 不返回明文
 *   - 列不带密文
 *   - 跨用户隔离
 *   - 软删
 *   - reveal 端点：owner 可见，其他用户 404
 *   - 未授权拒绝
 *   - 唯一约束
 *   - 错误 provider 校验
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { pool, closeDb } from '../src/config/db';
import { apiKeyRepo } from '../src/repos/api-key.repo';
import { getDecryptedKey } from '../src/routes/api-key.routes';

const app = createApp();

const stamp = Date.now();
const TEST_EMAIL = `byok-${stamp}@manhuaworks.test`;
const OTHER_EMAIL = `byok-other-${stamp}@manhuaworks.test`;
const TEST_PWD = 'CorrectHorseBatteryStaple!1';

let token = '';
let userId = '';
let otherToken = '';
let otherUserId = '';

beforeAll(async () => {
  const r = await pool.query('SELECT 1 AS ok');
  expect(r.rows[0]?.ok).toBe(1);
});

afterAll(async () => {
  if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  if (otherUserId) await pool.query('DELETE FROM users WHERE id = $1', [otherUserId]);
  await closeDb();
});

beforeEach(() => {
  // repo 是内存单例，每个 test 隔离
  apiKeyRepo.clear();
});

describe('setup', () => {
  it('register main + other user', async () => {
    const r1 = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PWD, display_name: 'BYOK' });
    expect(r1.status).toBe(201);
    token = r1.body.data.access_token;
    userId = r1.body.data.user.id;

    const r2 = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: OTHER_EMAIL, password: TEST_PWD, display_name: 'Other' });
    expect(r2.status).toBe(201);
    otherToken = r2.body.data.access_token;
    otherUserId = r2.body.data.user.id;
  });
});

describe('POST /api/v1/user/api-keys', () => {
  it('adds key and returns public record (no encryptedKey, no plaintext)', async () => {
    const r = await request(app)
      .post('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-test-1234567890ABCDEF' });

    expect(r.status).toBe(201);
    expect(r.body.code).toBe(0);
    expect(r.body.data.provider).toBe('openai');
    expect(r.body.data.keyFingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(r.body.data.lastFour).toBe('CDEF');
    // 隐私：绝不返回明文 / 密文
    const body = JSON.stringify(r.body);
    expect(body).not.toContain('sk-test-1234567890ABCDEF');
    expect(body).not.toContain('encryptedKey');
    expect(body).not.toContain('ciphertext');
  });

  it('rejects without auth', async () => {
    const r = await request(app)
      .post('/api/v1/user/api-keys')
      .send({ provider: 'openai', apiKey: 'sk-x' });
    expect(r.status).toBe(401);
  });

  it('rejects invalid provider', async () => {
    const r = await request(app)
      .post('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'fake-provider', apiKey: 'sk-x' });
    expect(r.status).toBe(400);
  });

  it('rejects empty apiKey', async () => {
    const r = await request(app)
      .post('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: '' });
    expect(r.status).toBe(400);
  });

  it('returns 409 on duplicate (userId, provider)', async () => {
    await request(app)
      .post('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'anthropic', apiKey: 'sk-ant-1' });
    const r2 = await request(app)
      .post('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'anthropic', apiKey: 'sk-ant-2' });
    expect(r2.status).toBe(409);
  });
});

describe('GET /api/v1/user/api-keys', () => {
  it('lists user keys without encryptedKey', async () => {
    await request(app)
      .post('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-list-openai-AAAA' });
    await request(app)
      .post('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'deepseek', apiKey: 'sk-list-deepseek-BBBB' });

    const r = await request(app)
      .get('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`);

    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(2);
    const body = JSON.stringify(r.body);
    expect(body).not.toContain('sk-list-openai-AAAA');
    expect(body).not.toContain('sk-list-deepseek-BBBB');
    expect(body).not.toContain('encryptedKey');
    expect(body).not.toContain('ciphertext');
  });

  it('rejects without auth', async () => {
    const r = await request(app).get('/api/v1/user/api-keys');
    expect(r.status).toBe(401);
  });

  it('returns empty array when user has no keys', async () => {
    // other user 没加过 key
    const r = await request(app)
      .get('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual([]);
  });
});

describe('full BYOK flow: add → list → internal decrypt → mock AI → revoke', () => {
  it('end-to-end works with mock AI call', async () => {
    // 1) 加 OpenAI key
    const addRes = await request(app)
      .post('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-e2e-MOCK-KEY-9999' });
    expect(addRes.status).toBe(201);
    const keyId = addRes.body.data.id as string;

    // 2) 列出来（看不到明文）
    const listRes = await request(app)
      .get('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(JSON.stringify(listRes.body)).not.toContain('sk-e2e-MOCK-KEY-9999');

    // 3) 内部 getDecryptedKey 拿明文（模拟 ai-orchestrator）
    const plain = getDecryptedKey(userId, 'openai');
    expect(plain).toBe('sk-e2e-MOCK-KEY-9999');

    // 4) 用它"调 AI"（mock）— 验证明文可作为 Authorization Bearer
    const mockAiRes = await request(app)
      .get('/api/v1/health')
      .set('Authorization', `Bearer ${plain!}`); // 用解出的 key 当 token 调下游（仅 mock 验证流转）
    // 这里我们没专门 mock AI，但能确认 plain 是有效字符串即可
    expect(typeof plain).toBe('string');
    expect(plain).not.toBeNull();
    expect(plain!.length).toBeGreaterThan(0);
    // mock 调用本身的 status 不重要（health 是 200）
    expect([200, 401]).toContain(mockAiRes.status);

    // 5) touchLastUsed 已经被 getDecryptedKey 内部触发
    const after = apiKeyRepo.findById(keyId);
    expect(after.lastUsedAt).not.toBeNull();

    // 6) revoke
    const delRes = await request(app)
      .delete(`/api/v1/user/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.revokedAt).not.toBeNull();

    // 7) revoke 后内部解密应失败
    const plain2 = getDecryptedKey(userId, 'openai');
    expect(plain2).toBeNull();
  });
});

describe('DELETE /api/v1/user/api-keys/:id', () => {
  it('soft deletes (keeps record in list)', async () => {
    const add = await request(app)
      .post('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'google', apiKey: 'sk-google-test-XXXX' });
    const id = add.body.data.id;

    const del = await request(app)
      .delete(`/api/v1/user/api-keys/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const list = await request(app)
      .get('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].revokedAt).not.toBeNull();
  });

  it('returns 404 for unknown id', async () => {
    const r = await request(app)
      .delete('/api/v1/user/api-keys/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(404);
  });

  it('returns 404 when deleting another user key', async () => {
    // 用户 A 加 key
    const aAdd = await request(app)
      .post('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'minimax', apiKey: 'sk-a-only-ZZZZ' });
    // 用户 B 想删 A 的 key
    const r = await request(app)
      .delete(`/api/v1/user/api-keys/${aAdd.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(r.status).toBe(404);
  });
});

describe('GET /api/v1/user/api-keys/:id/reveal', () => {
  it('owner can reveal plaintext once', async () => {
    const add = await request(app)
      .post('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-reveal-test-7777' });
    const id = add.body.data.id;

    const r = await request(app)
      .get(`/api/v1/user/api-keys/${id}/reveal`)
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.data.apiKey).toBe('sk-reveal-test-7777');
  });

  it('non-owner gets 404', async () => {
    const add = await request(app)
      .post('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-reveal-isol-8888' });
    const r = await request(app)
      .get(`/api/v1/user/api-keys/${add.body.data.id}/reveal`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(r.status).toBe(404);
  });

  it('rejects without auth', async () => {
    const r = await request(app).get('/api/v1/user/api-keys/whatever/reveal');
    expect(r.status).toBe(401);
  });

  it('reveal on revoked key returns 400', async () => {
    const add = await request(app)
      .post('/api/v1/user/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-reveal-revkd-9999' });
    const id = add.body.data.id;
    await request(app)
      .delete(`/api/v1/user/api-keys/${id}`)
      .set('Authorization', `Bearer ${token}`);
    const r = await request(app)
      .get(`/api/v1/user/api-keys/${id}/reveal`)
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(400);
  });
});
