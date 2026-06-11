const { Client } = require('D:\\ManhuaWorks\\services\\user-service\\node_modules\\pg');
(async () => {
  const c = new Client({host:'127.0.0.1',port:5432,user:'mhw',password:'mhw_dev_password_2026',database:'manhuaworks'});
  await c.connect();
  const subs = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='subscriptions' ORDER BY ordinal_position");
  console.log('=== subscriptions columns ===');
  for (const r of subs.rows) console.log(`  ${r.column_name}: ${r.data_type}`);
  const bal = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='user_balances' ORDER BY ordinal_position");
  console.log('=== user_balances columns ===');
  for (const r of bal.rows) console.log(`  ${r.column_name}: ${r.data_type}`);
  const users = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
  console.log('=== users columns ===');
  for (const r of users.rows) console.log(`  ${r.column_name}: ${r.data_type}`);
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
