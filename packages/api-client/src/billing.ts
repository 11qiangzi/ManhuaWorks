/**
 * ManhuaWorks · api-client
 * billing module — subscription/order/invoice/payment/quota/refund
 */

import type { HttpModule, BillingModule } from './types.js'
import type {
  Plan, PlanDTO, SubscriptionDTO, SubscriptionCycle, OrderDTO, OrderStatus,
  CreateOrderReq, PayOrderReq, InvoiceDTO, RefundDTO, RefundStatus, RefundReq,
  QuotaDTO, PageResp, ID,
} from './types.js'

export function createBilling(http: HttpModule): BillingModule {
  return {
    /* ---------------- Plan ---------------- */
    async listPlans() {
      return await http.get<PlanDTO[]>('/billing/plans')
    },
    async getPlan(code: Plan) {
      return await http.get<PlanDTO>(`/billing/plans/${encodeURIComponent(code)}`)
    },

    /* ---------------- Subscription ---------------- */
    async getMySubscription() {
      return await http.get<SubscriptionDTO | null>('/billing/subscriptions/me', undefined, { swallow401: false })
    },
    async subscribe(plan: Plan, cycle: SubscriptionCycle, paymentMethod?: string) {
      return await http.post<SubscriptionDTO>('/billing/subscriptions', { plan, cycle, payment_method: paymentMethod })
    },
    async cancelSubscription(id: ID, immediate = false) {
      return await http.post<SubscriptionDTO>(`/billing/subscriptions/${encodeURIComponent(id)}/cancel`, { immediate })
    },

    /* ---------------- Order ---------------- */
    async listOrders(q: { status?: OrderStatus; page?: number; pageSize?: number } = {}) {
      return await http.get<PageResp<OrderDTO>>('/billing/orders', q as Record<string, unknown>)
    },
    async createOrder(req: CreateOrderReq) {
      return await http.post<OrderDTO>('/billing/orders', req)
    },
    async payOrder(id: ID, method: string) {
      const body: PayOrderReq = { method }
      return await http.post<OrderDTO>(`/billing/orders/${encodeURIComponent(id)}/pay`, body)
    },

    /* ---------------- Invoice ---------------- */
    async listInvoices(q: { page?: number; pageSize?: number } = {}) {
      return await http.get<PageResp<InvoiceDTO>>('/billing/invoices', q as Record<string, unknown>)
    },

    /* ---------------- Refund ---------------- */
    async listRefunds(q: { page?: number; pageSize?: number; status?: RefundStatus } = {}) {
      return await http.get<PageResp<RefundDTO>>('/billing/refunds', q as Record<string, unknown>)
    },
    async requestRefund(req: RefundReq) {
      return await http.post<RefundDTO>('/billing/refunds', req)
    },

    /* ---------------- Quota ---------------- */
    async getMyQuota() {
      return await http.get<QuotaDTO>('/billing/quota/me')
    },
  }
}
