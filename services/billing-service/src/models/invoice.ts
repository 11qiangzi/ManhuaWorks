/**
 * Invoice 模型
 */

export type InvoiceStatus = "draft" | "issued" | "void";

export interface InvoiceRow {
  id: string;
  user_id: string;
  order_id: string | null;
  invoice_no: string;
  title: string;
  tax_id: string | null;
  amount_cents: string | number;
  currency: string;
  status: InvoiceStatus;
  pdf_path: string | null;
  issued_at: Date;
  created_at: Date;
}

export interface Invoice {
  id: string;
  userId: string;
  orderId: string | null;
  invoiceNo: string;
  title: string;
  taxId: string | null;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  pdfPath: string | null;
  issuedAt: Date;
  createdAt: Date;
}

export function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    userId: row.user_id,
    orderId: row.order_id,
    invoiceNo: row.invoice_no,
    title: row.title,
    taxId: row.tax_id,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    status: row.status,
    pdfPath: row.pdf_path,
    issuedAt: row.issued_at,
    createdAt: row.created_at,
  };
}

export function genInvoiceNo(now: Date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const stamp =
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate());
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .padStart(6, "0")
    .toUpperCase();
  return `INV-${stamp}-${rand}`;
}
