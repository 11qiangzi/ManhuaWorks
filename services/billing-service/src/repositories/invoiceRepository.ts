/**
 * Invoice Repository
 */

import { query } from "../config/db";
import type { Invoice, InvoiceRow, InvoiceStatus } from "../models/invoice";
import { rowToInvoice } from "../models/invoice";

export interface CreateInvoiceInput {
  userId: string;
  orderId?: string | null;
  invoiceNo: string;
  title: string;
  taxId?: string | null;
  amountCents: number;
  currency?: string;
}

export const invoiceRepository = {
  async create(input: CreateInvoiceInput): Promise<Invoice> {
    const { rows } = await query<InvoiceRow>(
      `INSERT INTO invoices (user_id, order_id, invoice_no, title, tax_id, amount_cents, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.userId,
        input.orderId ?? null,
        input.invoiceNo,
        input.title,
        input.taxId ?? null,
        input.amountCents,
        input.currency ?? "CNY",
      ]
    );
    return rowToInvoice(rows[0]!);
  },

  async findById(id: string): Promise<Invoice | null> {
    const { rows } = await query<InvoiceRow>(`SELECT * FROM invoices WHERE id = $1`, [id]);
    return rows[0] ? rowToInvoice(rows[0]) : null;
  },

  async findByInvoiceNo(invoiceNo: string): Promise<Invoice | null> {
    const { rows } = await query<InvoiceRow>(
      `SELECT * FROM invoices WHERE invoice_no = $1`,
      [invoiceNo]
    );
    return rows[0] ? rowToInvoice(rows[0]) : null;
  },

  async listByUser(userId: string, limit = 50, offset = 0): Promise<Invoice[]> {
    const { rows } = await query<InvoiceRow>(
      `SELECT * FROM invoices WHERE user_id = $1 ORDER BY issued_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows.map(rowToInvoice);
  },

  async countByUser(userId: string): Promise<number> {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*) FROM invoices WHERE user_id = $1`,
      [userId]
    );
    return Number(rows[0]!.count);
  },

  async listAll(limit = 100, offset = 0): Promise<Invoice[]> {
    const { rows } = await query<InvoiceRow>(
      `SELECT * FROM invoices ORDER BY issued_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows.map(rowToInvoice);
  },

  async setStatus(id: string, status: InvoiceStatus): Promise<Invoice | null> {
    const { rows } = await query<InvoiceRow>(
      `UPDATE invoices SET status = $2 WHERE id = $1 RETURNING *`,
      [id, status]
    );
    return rows[0] ? rowToInvoice(rows[0]) : null;
  },

  async setPdfPath(id: string, pdfPath: string): Promise<Invoice | null> {
    const { rows } = await query<InvoiceRow>(
      `UPDATE invoices SET pdf_path = $2 WHERE id = $1 RETURNING *`,
      [id, pdfPath]
    );
    return rows[0] ? rowToInvoice(rows[0]) : null;
  },
};
