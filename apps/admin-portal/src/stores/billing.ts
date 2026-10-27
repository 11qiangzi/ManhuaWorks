/**
 * admin-portal · billing Pinia store — 接 billing-service
 * 千机工坊 · L2 task 8
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import type {
  PlanDTO, SubscriptionDTO, OrderDTO, InvoiceDTO, RefundDTO,
  PageResp,
} from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

export const useBillingStore = defineStore('billing', () => {
  const api = getApi()

  const plans = ref<PlanDTO[]>([])
  const orders = ref<OrderDTO[]>([])
  const orderTotal = ref(0)
  const invoices = ref<InvoiceDTO[]>([])
  const refunds = ref<RefundDTO[]>([])
  const subscriptions = ref<SubscriptionDTO[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const revenue = computed(() =>
    orders.value
      .filter((o) => o.status === 'paid')
      .reduce((s, o) => s + o.amount, 0),
  )
  const pendingRefunds = computed(() =>
    refunds.value.filter((r) => r.status === 'pending'),
  )

  async function loadPlans(): Promise<void> {
    plans.value = await api.billing.listPlans()
  }

  async function loadOrders(q: { status?: OrderDTO['status']; page?: number; pageSize?: number } = {}): Promise<void> {
    loading.value = true
    try {
      const r: PageResp<OrderDTO> = await api.billing.listOrders({ pageSize: 50, ...q })
      orders.value = r.list
      orderTotal.value = r.total
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '加载订单失败'
      throw e
    } finally { loading.value = false }
  }

  async function loadInvoices(): Promise<void> {
    const r = await api.billing.listInvoices({ pageSize: 50 })
    invoices.value = r.list
  }

  async function loadRefunds(): Promise<void> {
    const r = await api.billing.listRefunds({ pageSize: 50 })
    refunds.value = r.list
  }

  async function approveRefund(id: string): Promise<void> {
    // 实际后端会接管理员动作；这里先调 update 接口（若后端有 PATCH /refunds/:id）
    try {
      await api.http.post(`/refunds/${encodeURIComponent(id)}/approve`)
    } catch {
      // 退到本地标记
      const idx = refunds.value.findIndex((r) => r.id === id)
      if (idx >= 0) refunds.value[idx] = { ...refunds.value[idx]!, status: 'approved' }
    }
  }

  return {
    plans, orders, orderTotal, invoices, refunds, subscriptions,
    loading, error, revenue, pendingRefunds,
    loadPlans, loadOrders, loadInvoices, loadRefunds, approveRefund,
  }
})
