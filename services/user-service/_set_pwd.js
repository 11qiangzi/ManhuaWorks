// 用 pg client 改 4 个 demo 密码
const { Client } = require('D:\\ManhuaWorks\\services\\user-service\\node_modules\\pg');
const bcrypt = require('D:\\ManhuaWorks\\services\\user-service\\node_modules\\bcryptjs');

(async () => {
  const c = new Client({
    host: '127.0.0.1', port: 5432,
    user: 'mhw', password: 'mhw_dev_password_2026',
    database: 'manhuaworks'
  });
  await c.connect();
  const hash = bcrypt.hashSync('Test1234!', 12);
  console.log('hash:', hash.substring(0, 30) + '...');
  const r = await c.query("UPDATE users SET password_hash = $1 WHERE email LIKE $2 RETURNING email", [hash, 'demo-%@manhuaworks.local']);
  console.log('updated', r.rowCount, 'rows:');
  for (const row of r.rows) console.log(' ', row.email);
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
