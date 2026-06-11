// 临时 db init 脚本 (用 pg 直接连)
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, "init_collab.sql"), "utf8");

const adminUrl = "postgres://mhw:mhw_dev_password_2026@127.0.0.1:5432/postgres";
const targetDb = "collab";

const client = new pg.Client({ connectionString: adminUrl });
await client.connect();

// 确保 collab 库存在
const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [targetDb]);
if (exists.rowCount === 0) {
  console.log("creating database:", targetDb);
  await client.query(`CREATE DATABASE ${targetDb}`);
} else {
  console.log("database already exists:", targetDb);
}
await client.end();

const c2 = new pg.Client({ connectionString: adminUrl.replace("/postgres", `/${targetDb}`) });
await c2.connect();
await c2.query(sql);
console.log("✅ schema applied to", targetDb);
await c2.end();
