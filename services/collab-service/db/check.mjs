// 校验 collab 库表
import pg from "pg";
const client = new pg.Client({ connectionString: "postgres://mhw:mhw_dev_password_2026@127.0.0.1:5432/collab" });
await client.connect();
const r = await client.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
);
console.log("tables in collab:", r.rows.map(x => x.table_name));
const r2 = await client.query(
  "SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname"
);
console.log("indexes:", r2.rows.length);
await client.end();
