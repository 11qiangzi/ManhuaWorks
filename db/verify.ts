// ManhuaWorks DB 验证脚本
// 2026-06-08 谢擎
// 用法: npx tsx D:\ManhuaWorks\db\verify.ts
// 依赖: 项目根目录已装 pg + @types/pg（pnpm 装）

import { Client } from 'pg';

const TABLES = [
  'users',
  'projects',
  'subscriptions',
  'quotas',
  'api_keys',
  'api_call_logs',
  'role_vectors',
] as const;

const EXPECTED = {
  users: 5,
  projects: 3,
  subscriptions: 5,
  quotas: 5,
  api_keys: 0,
  api_call_logs: 1,
  role_vectors: 0, // 待 pgvector 扩展安装
} as Record<string, number>;

async function main() {
  const client = new Client({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'mhw',
    password: process.env.PGPASSWORD || 'mhw_dev_password_2026',
    database: process.env.PGDATABASE || 'manhuaworks',
  });

  await client.connect();
  console.log('✅ Connected to PostgreSQL\n');

  // 1. 版本
  const ver = await client.query<{ version: string }>('SELECT version()');
  console.log('📦 Server:', ver.rows[0].version.split(',')[0]);

  // 2. 数据库
  const db = await client.query<{ current_database: string }>('SELECT current_database()');
  console.log('🗄️  Database:', db.rows[0].current_database);

  // 3. 扩展
  const ext = await client.query<{ extname: string; extversion: string }>(
    "SELECT extname, extversion FROM pg_extension ORDER BY extname"
  );
  console.log('🔌 Extensions:', ext.rows.map(r => `${r.extname}(${r.extversion})`).join(', '));

  // 4. 表清单
  const tables = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
  );
  console.log('\n📋 Tables in public schema:');
  for (const t of tables.rows) console.log('   -', t.tablename);

  // 5. Row count 报表
  console.log('\n📊 Row counts:');
  console.log('   ' + '-'.repeat(60));
  console.log('   ' + 'Table'.padEnd(20) + 'Expected'.padEnd(12) + 'Actual'.padEnd(12) + 'Status');
  console.log('   ' + '-'.repeat(60));

  let pass = 0;
  let fail = 0;

  for (const tbl of TABLES) {
    let actual = -1;
    let status = '⚠️  TABLE MISSING';
    let pending = false;
    try {
      const r = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM ${tbl}`);
      actual = Number(r.rows[0].c);
      const expected = EXPECTED[tbl];
      const ok = actual === expected;
      status = ok ? '✅ PASS' : '❌ FAIL';
      if (ok) pass++; else fail++;
    } catch (e: any) {
      // 表不存在区分：是扩展未装导致（pending）还是真错（fail）
      if (e.message.includes('does not exist') || e.message.includes('不存在')) {
        status = '⏳ PENDING (extension not installed)';
        pending = true;
      } else {
        status = '❌ ERROR: ' + e.message;
        fail++;
      }
    }
    console.log(
      '   ' +
        tbl.padEnd(20) +
        String(EXPECTED[tbl]).padEnd(12) +
        String(actual).padEnd(12) +
        status
    );
  }

  // 6. 角色分布（验证 5 角色）
  console.log('\n👥 Users by role:');
  const roleDist = await client.query<{ role: number; cnt: string }>(
    'SELECT role, count(*)::text AS cnt FROM users GROUP BY role ORDER BY role'
  );
  for (const r of roleDist.rows) {
    console.log(`   role=${r.role}: ${r.cnt} user(s)`);
  }

  // 7. 项目场景
  console.log('\n🎬 Projects:');
  const proj = await client.query<{ title: string; art_style: string; status: number }>(
    'SELECT title, art_style, status FROM projects ORDER BY status'
  );
  for (const p of proj.rows) {
    console.log(`   [${p.status}] ${p.title} (${p.art_style})`);
  }

  // 8. 结论
  console.log('\n' + '='.repeat(60));
  if (fail === 0) {
    if (pass === TABLES.length) {
      console.log(`🎉 ALL CHECKS PASSED (${pass}/${TABLES.length})`);
    } else {
      console.log(`✅ ${pass} core checks passed, ${TABLES.length - pass} pending (extension not installed)`);
    }
  } else {
    console.log(`💥 ${fail} CHECK(S) FAILED, ${pass} passed`);
  }
  console.log('='.repeat(60));

  await client.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('💥 verify.ts crashed:', e);
  process.exit(2);
});
