/**
 * 派单 17 migration runner — 应用 db/migrations/0003_byok.sql
 * 验证 user_api_keys 和 rate_limit_counters 表已建
 */
const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'manhuaworks',
  user: 'mhw',
  password: 'mhw_dev_password_2026',
});

const fs = require('fs');
const path = require('path');

async function run() {
  // 1. Run 0003_byok.sql
  const migrationFile = path.join(__dirname, '..', 'db', 'migrations', '0003_byok.sql');
  const sql = fs.readFileSync(migrationFile, 'utf-8');
  console.log('Running migration 0003 (派单 17 BYOK)...');
  await pool.query(sql);
  console.log('Migration 0003 applied.');

  // 2. Verify tables
  const tables = ['user_api_keys', 'rate_limit_counters'];
  for (const t of tables) {
    const r = await pool.query(`SELECT to_regclass($1) AS exists`, [t]);
    console.log(`  ${t}: ${r.rows[0].exists ? '✅ exists' : '❌ MISSING'}`);
  }

  // 3. Show columns
  const cols = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_name IN ('user_api_keys', 'rate_limit_counters')
    ORDER BY table_name, ordinal_position
  `);
  console.log('\nColumns:');
  for (const row of cols.rows) {
    console.log(`  ${row.table_name}.${row.column_name} (${row.data_type})`);
  }

  await pool.end();
  console.log('\nDone.');
}

run().catch(e => { console.error(e); process.exit(1); });
