const { Pool } = require('pg');
const p = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'mhw',
  password: 'mhw_dev_password_2026',
  database: 'collab'
});

async function main() {
  const { rows } = await p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('Collab tables:', rows.map(r => r.table_name).join(', '));

  // Check manhuaworks db too
  const p2 = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'mhw',
    password: 'mhw_dev_password_2026',
    database: 'manhuaworks'
  });
  const { rows: rows2 } = await p2.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('Manhuaworks tables:', rows2.map(r => r.table_name).join(', '));
  
  await p.end();
  await p2.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
