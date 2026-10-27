/**
 * Invoice Service
 * 开票 + PDF 生成（pdfkit 简易发票模板）
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import PDFDocument from "pdfkit";
import { invoiceRepository } from "../repositories/invoiceRepository";
import { orderRepository } from "../repositories/orderRepository";
import { HttpError } from "../middleware/error";
import { genInvoiceNo, type Invoice } from "../models/invoice";
import { logger } from "../config/logger";
import { getPlan } from "../config/plans";

const PDF_DIR = process.env.INVOICE_PDF_DIR || path.join(os.tmpdir(), "mhw-invoices");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export interface IssueInvoiceInput {
  orderId: string;
  userId: string;
  title: string;
  taxId?: string;
  isAdmin?: boolean;
}

export const invoiceService = {
  async issue(input: IssueInvoiceInput): Promise<Invoice> {
    const order = await orderRepository.findById(input.orderId);
    if (!order) throw new HttpError(404, "order_not_found");
    if (order.userId !== input.userId && !input.isAdmin) {
      throw new HttpError(403, "forbidden");
    }
    if (order.status !== "paid") {
      throw new HttpError(409, "order_not_paid", "only paid orders can be invoiced");
    }
    const inv = await invoiceRepository.create({
      userId: order.userId,
      orderId: order.id,
      invoiceNo: genInvoiceNo(),
      title: input.title,
      taxId: input.taxId ?? null,
      amountCents: order.amountCents,
      currency: order.currency,
    });
    logger.info(
      { invoiceId: inv.id, orderId: order.id, userId: order.userId },
      "[invoice] issued"
    );
    return inv;
  },

  async getById(id: string, userId: string, isAdmin: boolean): Promise<Invoice> {
    const inv = await invoiceRepository.findById(id);
    if (!inv) throw new HttpError(404, "invoice_not_found");
    if (inv.userId !== userId && !isAdmin) throw new HttpError(403, "forbidden");
    return inv;
  },

  async listByUser(userId: string, limit: number, offset: number): Promise<Invoice[]> {
    return invoiceRepository.listByUser(userId, limit, offset);
  },

  async countByUser(userId: string): Promise<number> {
    return invoiceRepository.countByUser(userId);
  },

  async listAll(limit: number, offset: number): Promise<Invoice[]> {
    return invoiceRepository.listAll(limit, offset);
  },

  /** 生成/取 PDF 字节流 */
  async getOrGeneratePdf(id: string, userId: string, isAdmin: boolean): Promise<{ buffer: Buffer; filename: string }> {
    const inv = await this.getById(id, userId, isAdmin);
    ensureDir(PDF_DIR);
    const file = path.join(PDF_DIR, `${inv.invoiceNo}.pdf`);
    if (!fs.existsSync(file) || !inv.pdfPath) {
      await this.renderPdf(inv, file);
      await invoiceRepository.setPdfPath(inv.id, file);
    }
    const buffer = await fs.promises.readFile(file);
    return { buffer, filename: `${inv.invoiceNo}.pdf` };
  },

  /** 渲染 PDF（简易模板） */
  async renderPdf(inv: Invoice, outPath: string): Promise<void> {
    const order = inv.orderId ? await orderRepository.findById(inv.orderId) : null;
    const plan = order ? getPlan(order.plan) : null;

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const stream = fs.createWriteStream(outPath);
      doc.pipe(stream);
      stream.on("finish", () => resolve());
      stream.on("error", reject);

      // 标题
      doc.fontSize(22).fillColor("#1f2937").text("ManhuaWorks Invoice", { align: "left" });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor("#6b7280").text(`Invoice No: ${inv.invoiceNo}`);
      doc.text(`Issued At: ${inv.issuedAt.toISOString()}`);
      doc.text(`Status: ${inv.status.toUpperCase()}`);
      doc.moveDown(1);

      // 收件方
      doc.fontSize(12).fillColor("#111827").text("Bill To:", { underline: true });
      doc.fontSize(11).fillColor("#374151").text(inv.title);
      if (inv.taxId) doc.text(`Tax ID: ${inv.taxId}`);
      doc.text(`User ID: ${inv.userId}`);
      doc.moveDown(1);

      // 商品
      doc.fontSize(12).fillColor("#111827").text("Items", { underline: true });
      doc.moveDown(0.5);
      const amount = (inv.amountCents / 100).toFixed(2);
      doc.fontSize(11).fillColor("#374151");
      doc.text(
        `${plan?.name ?? "Subscription"} x 1`,
        { continued: true, width: 380 }
      );
      doc.text(`¥${amount}`, { align: "right" });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e5e7eb").stroke();
      doc.moveDown(0.5);

      doc.fontSize(13).fillColor("#111827").text("Total", { continued: true });
      doc.text(`¥${amount}`, { align: "right" });

      // 备注
      doc.moveDown(2);
      doc.fontSize(9).fillColor("#9ca3af").text(
        "This is a computer-generated invoice. No signature required.\nManhuaWorks Inc. · contact@manhuaworks.example"
      );

      doc.end();
    });
  },

  /** 作废 */
  async void(id: string, isAdmin: boolean): Promise<Invoice> {
    if (!isAdmin) throw new HttpError(403, "admin_only");
    const inv = await invoiceRepository.findById(id);
    if (!inv) throw new HttpError(404, "invoice_not_found");
    if (inv.status === "void") return inv;
    return (await invoiceRepository.setStatus(id, "void"))!;
  },
};
