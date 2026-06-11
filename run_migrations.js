const { Pool } = require('pg');
const fs = require('fs');

async function runSql(dbName, sqlPath) {
  const p = new Pool({
    host: '127.0.0.1', port: 5432,
    user: 'mhw', password: 'mhw_dev_password_2026',
    database: dbName
  });
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`Running ${sqlPath} on ${dbName}...`);
  await p.query(sql);
  console.log(`  Done: ${sqlPath}`);
  await p.end();
}

(async () => {
  await runSql('collab', 'D:/ManhuaWorks/docs/database/migrations/002_teams.sql');
  await runSql('manhuaworks', 'D:/ManhuaWorks/docs/database/migrations/003_system_settings.sql');
  console.log('All migrations done.');
})().catch(e => { console.error(e.message); process.exit(1); });
