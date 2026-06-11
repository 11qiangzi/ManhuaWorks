/**
 * Payment 模型（mock 支付）
 */

export type PaymentMethod = "alipay" | "wechat" | "paypal" | "mock";
export type PaymentChannel = "h5" | "pc" | "app" | "sdk";
export type PaymentStatus = "pending" | "success" | "failed" | "refunded";

export interface PaymentRow {
  id: string;
  order_id: string;
  method: PaymentMethod;
  channel: PaymentChannel;
  amount_cents: string | number;
  currency: string;
  status: PaymentStatus;
  transaction_id: string | null;
  sandbox: boolean;
  raw_payload: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  channel: PaymentChannel;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  transactionId: string | null;
  sandbox: boolean;
  rawPayload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export function rowToPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    orderId: row.order_id,
    method: row.method,
    channel: row.channel,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    status: row.status,
    transactionId: row.transaction_id,
    sandbox: row.sandbox,
    rawPayload: row.raw_payload ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const PAYMENT_METHODS: {
  id: PaymentMethod;
  name: string;
  channels: PaymentChannel[];
  currencies: string[];
  sandbox: boolean;
}[] = [
  { id: "alipay", name: "支付宝", channels: ["h5", "pc", "app"], currencies: ["CNY"], sandbox: true },
  { id: "wechat", name: "微信支付", channels: ["h5", "app"], currencies: ["CNY"], sandbox: true },
  { id: "paypal", name: "PayPal", channels: ["h5", "pc"], currencies: ["USD", "EUR"], sandbox: true },
  { id: "mock", name: "沙盒（mock）", channels: ["pc", "app"], currencies: ["CNY", "USD"], sandbox: true },
];

export function findMethod(id: string): typeof PAYMENT_METHODS[number] | null {
  return PAYMENT_METHODS.find((m) => m.id === id) ?? null;
}
