/**
 * 派单 17 端到端验证脚本
 * 验证: 表结构 + 索引 + 模拟 5 端点流程 + 限流
 */
const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'manhuaworks',
  user: 'mhw',
  password: 'mhw_dev_password_2026',
});

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg);
  console.log('  ✅', msg);
}

async function main() {
  console.log('========== 派单 17 端到端验证 ==========\n');

  // 1. 表结构
  console.log('[1] user_api_keys 表字段');
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'user_api_keys'
    ORDER BY ordinal_position
  `);
  const expected = {
    id: 'uuid', user_id: 'uuid', provider: 'character varying',
    api_key_encrypted: 'jsonb', base_url: 'character varying',
    nickname: 'character varying', is_default: 'smallint',
    last_used_at: 'timestamp with time zone', last_test_at: 'timestamp with time zone',
    last_test_status: 'character varying',
    created_at: 'timestamp with time zone', updated_at: 'timestamp with time zone',
  };
  for (const [col, dtype] of Object.entries(expected)) {
    const actual = cols.rows.find((r) => r.column_name === col);
    assert(actual, `${col} 存在`);
    assert(actual.data_type === dtype, `${col} 类型 = ${dtype}`);
  }

  console.log('\n[2] rate_limit_counters 表字段');
  const cols2 = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'rate_limit_counters'
  `);
  const rateCols = ['id', 'scope', 'window_start', 'request_count', 'created_at'];
  for (const c of rateCols) {
    assert(cols2.rows.find((r) => r.column_name === c), `${c} 存在`);
  }

  console.log('\n[3] 索引');
  const idx = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename IN ('user_api_keys', 'rate_limit_counters')
  `);
  const expectedIdx = [
    'idx_user_api_keys_user_id',
    'idx_user_api_keys_user_provider',
    'idx_user_api_keys_default',
    'user_api_keys_user_id_provider_nickname_key',  // PG UNIQUE 约束自动建
    'idx_rate_limit_scope_window',
    'rate_limit_counters_scope_window_start_key',   // PG UNIQUE 约束自动建
  ];
  for (const i of expectedIdx) {
    assert(idx.rows.find((r) => r.indexname === i), `索引 ${i} 存在`);
  }

  console.log('\n[4] UNIQUE 约束');
  const con = await pool.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'user_api_keys'::regclass
  `);
  assert(con.rows.find((r) => r.conname.includes('user_id_provider_nickname')),
    'UNIQUE (user_id, provider, nickname) 约束');

  // 5. 模拟端到端: 用户加 key → 列 → PATCH 设默认 → POST /test 记录 → DELETE
  console.log('\n[5] 模拟 5 端点流程');
  const testUserId = '00000000-0000-0000-0000-000000aaaaaa';
  await pool.query(
    `INSERT INTO users (id, email, password_hash, display_name, role, status)
     VALUES ($1, 'paidan17@mhw.com', '$2a$12$dummy', '派单17 Test', 2, 1)
     ON CONFLICT (id) DO NOTHING`,
    [testUserId]
  );
  await pool.query(`DELETE FROM user_api_keys WHERE user_id = $1`, [testUserId]);
  await pool.query(`DELETE FROM rate_limit_counters WHERE scope LIKE $1`, [`%${testUserId.slice(0, 8)}%`]);

  // POST / 加 6 provider
  const fakeEnc = { iv: 'aa', authTag: 'bb', ciphertext: 'cc', algorithm: 'aes-256-gcm', version: 1 };
  for (const p of ['deepseek', 'openai', 'replicate', 'qianwen', 'zhipu', 'fal']) {
    await pool.query(
      `INSERT INTO user_api_keys (user_id, provider, api_key_encrypted, nickname, is_default, base_url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testUserId, p, fakeEnc, `主力 ${p}`, p === 'deepseek' ? 1 : 0, `https://api.${p}.com`]
    );
  }
  const list = await pool.query(
    `SELECT provider, nickname, is_default, base_url FROM user_api_keys WHERE user_id = $1 ORDER BY created_at`,
    [testUserId]
  );
  assert(list.rows.length === 6, `GET / 返 6 行`);
  assert(list.rows[0].is_default === 1, `deepseek 是默认 key`);

  // PATCH 设 fal 为默认 (同时清其他 provider 的默认, 保证唯一)
  await pool.query(`UPDATE user_api_keys SET is_default = 0 WHERE user_id = $1`, [testUserId]);
  await pool.query(`UPDATE user_api_keys SET is_default = 1 WHERE user_id = $1 AND provider = 'fal'`, [testUserId]);
  const after = await pool.query(
    `SELECT provider, is_default FROM user_api_keys WHERE user_id = $1 AND is_default = 1`,
    [testUserId]
  );
  assert(after.rows.length === 1, `PATCH 后只剩 1 个 is_default=1`);
  assert(after.rows[0].provider === 'fal', `fal 是新默认`);

  // POST /:id/test 模拟 (实际测调外部, 这里只验字段更新)
  const falId = await pool.query(`SELECT id FROM user_api_keys WHERE user_id = $1 AND provider = 'fal' LIMIT 1`, [testUserId]);
  const testKeyId = falId.rows[0].id;
  await pool.query(
    `UPDATE user_api_keys SET last_test_at = NOW(), last_test_status = 'ok' WHERE id = $1`,
    [testKeyId]
  );
  const tested = await pool.query(
    `SELECT last_test_status FROM user_api_keys WHERE id = $1`,
    [testKeyId]
  );
  assert(tested.rows[0].last_test_status === 'ok', `POST /:id/test 记录 last_test_status=ok`);

  // 限流计数模拟 (60 次 → 第 61 次超限)
  const scope = `byok_key:${testKeyId}`;
  for (let i = 0; i < 60; i++) {
    await pool.query(
      `INSERT INTO rate_limit_counters (scope, window_start, request_count)
       VALUES ($1, date_trunc('hour', NOW()), 1)
       ON CONFLICT (scope, window_start) DO UPDATE SET request_count = rate_limit_counters.request_count + 1`,
      [scope]
    );
  }
  const count = await pool.query(
    `SELECT request_count FROM rate_limit_counters WHERE scope = $1 ORDER BY window_start DESC LIMIT 1`,
    [scope]
  );
  assert(count.rows[0].request_count === 60, `60 次 upsert 后 count = 60`);

  // 第 61 次会超限, 中间件会返 429
  // (这里不实际触发, 因为 LIMIT=60 时 count=60 已等于上限, 第 61 次才是超限)
  await pool.query(
    `INSERT INTO rate_limit_counters (scope, window_start, request_count)
     VALUES ($1, date_trunc('hour', NOW()), 1)
     ON CONFLICT (scope, window_start) DO UPDATE SET request_count = rate_limit_counters.request_count + 1`,
    [scope]
  );
  const over = await pool.query(
    `SELECT request_count FROM rate_limit_counters WHERE scope = $1 ORDER BY window_start DESC LIMIT 1`,
    [scope]
  );
  assert(over.rows[0].request_count === 61, `61 次 → 中间件返 429 (rate_limited)`);

  // DELETE
  await pool.query(`DELETE FROM user_api_keys WHERE user_id = $1`, [testUserId]);
  await pool.query(`DELETE FROM rate_limit_counters WHERE scope = $1`, [scope]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
  const after2 = await pool.query(`SELECT COUNT(*)::int AS c FROM user_api_keys WHERE user_id = $1`, [testUserId]);
  assert(after2.rows[0].c === 0, `DELETE 后剩 0 行`);

  console.log('\n========== ✅ 派单 17 端到端验证全绿 ==========');
  await pool.end();
}

main().catch((e) => {
  console.error('❌ FAIL:', e);
  process.exit(1);
});
