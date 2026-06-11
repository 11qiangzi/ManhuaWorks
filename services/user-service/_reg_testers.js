// 注册 3 个测试账号
const { Client } = require('D:\\ManhuaWorks\\services\\user-service\\node_modules\\pg');
const bcrypt = require('D:\\ManhuaWorks\\services\\user-service\\node_modules\\bcryptjs');

const TESTERS = [
  { email: 'tester-zheng@manhuaworks.local', display: '测试员-卫峥', role: 2 },  // web+user
  { email: 'tester-jixian@manhuaworks.local', display: '测试员-纪弦', role: 2 }, // admin+ops
  { email: 'tester-luhan@manhuaworks.local', display: '测试员-路寒', role: 2 },  // studio+API
];

(async () => {
  const c = new Client({
    host: '127.0.0.1', port: 5432,
    user: 'mhw', password: 'mhw_dev_password_2026',
    database: 'manhuaworks'
  });
  await c.connect();
  const hash = bcrypt.hashSync('Test1234!', 12);

  for (const t of TESTERS) {
    // 用 ON CONFLICT do update 保证幂等
    const r = await c.query(
      `INSERT INTO users (id, email, password_hash, display_name, role, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 1, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET password_hash = $2, display_name = $3, updated_at = NOW()
       RETURNING id, email, display_name, role`,
      [t.email, hash, t.display, t.role]
    );
    console.log(`✅ ${t.email} (id=${r.rows[0].id.substring(0, 8)}..., role=${r.rows[0].role})`);
  }

  // 给每个测试员开 pro 套餐 (monthlyPriceCents=2900)
  for (const t of TESTERS) {
    const r = await c.query(
      `INSERT INTO subscriptions (id, user_id, plan, started_at, expires_at, auto_renew, created_at)
       SELECT gen_random_uuid(), u.id, 'pro', NOW(), NOW() + INTERVAL '30 days', true, NOW()
       FROM users u WHERE u.email = $1
       ON CONFLICT (user_id) DO UPDATE SET plan='pro', expires_at=NOW() + INTERVAL '30 days', auto_renew=true
       RETURNING user_id, plan, auto_renew`,
      [t.email]
    );
    console.log(`  sub: ${t.email} → plan=${r.rows[0]?.plan} auto_renew=${r.rows[0]?.auto_renew}`);
  }

  // 给每个测试员开余额 $100
  for (const t of TESTERS) {
    await c.query(
      `INSERT INTO user_balances (user_id, balance_cents, currency, created_at, updated_at)
       SELECT id, 10000, 'USD', NOW(), NOW() FROM users WHERE email = $1
       ON CONFLICT (user_id) DO UPDATE SET balance_cents = 10000, updated_at = NOW()`,
      [t.email]
    );
    console.log(`  balance: ${t.email} → $100`);
  }

  // 验证 3 个能登录
  console.log('\n=== 登录验证 ===');
  const https = require('http');
  for (const t of TESTERS) {
    const data = JSON.stringify({ email: t.email, password: 'Test1234!' });
    const options = {
      hostname: '192.168.0.11', port: 8088, path: '/api/v1/auth/login',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    await new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const d = JSON.parse(body);
          if (res.statusCode === 200) {
            console.log(`  ✅ ${t.email} → token=${d.data?.access_token?.substring(0, 30)}...`);
          } else {
            console.log(`  ❌ ${t.email} → ${res.statusCode} ${d.message}`);
          }
          resolve();
        });
      });
      req.on('error', (e) => { console.log(`  ❌ ${t.email} → ERR ${e.message}`); resolve(); });
      req.write(data);
      req.end();
    });
  }

  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
