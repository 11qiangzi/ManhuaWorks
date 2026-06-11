/* 临时 e2e 脚本：建用户 + 签 token + 跑 billing-service 主要流程 */
import { Pool } from "pg";
import jwt from "jsonwebtoken";

const DB = "postgresql://mhw:mhw_dev_password_2026@127.0.0.1:5432/manhuaworks";
const SECRET = "change_me_in_production_billing";
const ISS = "manhuaworks";
const AUD = "manhuaworks-api";
const BASE = "http://127.0.0.1:8090";

async function main() {
  const pool = new Pool({ connectionString: DB });
  // 1) 插一个测试用户
  const u = await pool.query<{ id: string }>(
    `INSERT INTO users (display_name, role) VALUES ($1, 1) RETURNING id`,
    [`e2e_${Date.now()}`]
  );
  const userId = u.rows[0]!.id;
  console.log("[e2e] userId:", userId);

  // 2) 签 token
  const token = jwt.sign(
    { sub: userId, role: 1, email: "e2e@manhuaworks.example" },
    SECRET,
    { algorithm: "HS256", issuer: ISS, audience: AUD, expiresIn: "1h" }
  );
  console.log("[e2e] token:", token.slice(0, 40) + "...");

  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: auth,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text; }
    console.log(`[${method} ${path}] ${res.status}`, JSON.stringify(json).slice(0, 200));
    return { status: res.status, body: json };
  }

  // 3) 取订阅（自动 free 初始化）
  await call("GET", "/api/v1/subscriptions/me");

  // 4) 升级到 pro
  await call("PUT", "/api/v1/subscriptions/me", { plan: "pro", auto_renew: true });

  // 5) 取配额
  await call("GET", "/api/v1/quota");

  // 6) 创建订单
  const orderRes = await call("POST", "/api/v1/orders", { plan: "pro" });
  const order = (orderRes.body as { data?: { id: string } }).data;
  if (!order) throw new Error("no order id");
  console.log("[e2e] orderId:", order.id);

  // 7) 调 mock 支付
  const payRes = await call("POST", `/api/v1/orders/${order.id}/pay`, { method: "mock" });
  console.log("[e2e] pay result:", JSON.stringify(payRes.body).slice(0, 200));

  // 8) 看订单
  await call("GET", `/api/v1/orders/${order.id}`);

  // 9) 开票
  const invRes = await call("POST", "/api/v1/invoices", {
    order_id: order.id,
    title: "ManhuaWorks 个人订阅",
    tax_id: "91110000XXXXXXXXXX",
  });
  const inv = (invRes.body as { data?: { id: string; invoice_no: string } }).data;
  if (!inv) throw new Error("no invoice id");
  console.log("[e2e] invoiceId:", inv.id, "no:", inv.invoice_no);

  // 10) 拿 PDF
  const pdfRes = await fetch(`${BASE}/api/v1/invoices/${inv.id}/pdf`, { headers: auth });
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  console.log("[e2e] pdf status:", pdfRes.status, "bytes:", pdfBuf.length, "magic:", pdfBuf.slice(0, 4).toString());

  // 11) 申请退款
  const refRes = await call("POST", "/api/v1/refunds", { order_id: order.id, reason: "e2e test" });
  const ref = (refRes.body as { data?: { id: string; status: string } }).data;
  console.log("[e2e] refund:", ref?.id, ref?.status);

  // 12) 消费配额
  await call("POST", "/api/v1/quota/consume", { type: "tokens", amount: 1000 });
  await call("POST", "/api/v1/quota/consume", { type: "images", amount: 5 });

  // 13) 配额超额测试
  await call("POST", "/api/v1/quota/consume", { type: "tokens", amount: 99_999_999 });

  // 14) admin 操作
  const adminToken = jwt.sign(
    { sub: userId, role: 5 },
    SECRET,
    { algorithm: "HS256", issuer: ISS, audience: AUD, expiresIn: "1h" }
  );
  const adminAuth = { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" };
  const adminRes = await fetch(`${BASE}/api/v1/refunds/${ref!.id}/approve`, {
    method: "POST",
    headers: adminAuth,
  });
  console.log("[e2e] admin approve refund:", adminRes.status, await adminRes.text());

  // 15) webhook 测试
  const o2Res = await call("POST", "/api/v1/orders", { plan: "team" });
  const o2 = (o2Res.body as { data?: { id: string } }).data;
  if (o2) {
    const wh = await fetch(`${BASE}/api/v1/orders/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: o2.id,
        method: "alipay",
        transaction_id: "TXN-ALIPAY-1",
        amount_cents: 49900,
      }),
    });
    console.log("[e2e] webhook:", wh.status, (await wh.text()).slice(0, 200));
  }

  // 16) 退订
  await call("POST", "/api/v1/subscriptions/cancel");

  // 清理
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  console.log("[e2e] done");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
