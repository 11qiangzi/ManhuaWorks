/**
 * web · billing Pinia store — 接 billing-service
 * 千机工坊 · L2 task 8
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import type {
  PlanDTO, SubscriptionDTO, OrderDTO, InvoiceDTO, RefundDTO, QuotaDTO, CreateOrderReq,
} from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

export const useBillingStore = defineStore('billing', () => {
  const api = getApi()

  const plans = ref<PlanDTO[]>([])
  const subscription = ref<SubscriptionDTO | null>(null)
  const orders = ref<OrderDTO[]>([])
  const invoices = ref<InvoiceDTO[]>([])
  const refunds = ref<RefundDTO[]>([])
  const quota = ref<QuotaDTO | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isPro = computed(() => subscription.value?.plan === 'pro' || subscription.value?.plan === 'enterprise')
  const creditsRemaining = computed(() => {
    if (!quota.value) return 0
    return Math.max(0, quota.value.credits_total - quota.value.credits_used)
  })

  async function loadPlans(): Promise<void> {
    try { plans.value = await api.billing.listPlans() } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '加载套餐失败'
      throw e
    }
  }

  async function loadSubscription(): Promise<void> {
    try { subscription.value = await api.billing.getMySubscription() } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        subscription.value = null
        return
      }
      throw e
    }
  }

  async function loadQuota(): Promise<void> {
    try { quota.value = await api.billing.getMyQuota() } catch (e) {
      if (e instanceof ApiError && e.status === 404) { quota.value = null; return }
      throw e
    }
  }

  async function subscribe(plan: 'free' | 'pro' | 'enterprise', cycle: 'monthly' | 'yearly' = 'monthly'): Promise<void> {
    loading.value = true
    try {
      subscription.value = await api.billing.subscribe(plan, cycle)
    } finally { loading.value = false }
  }

  async function cancelSubscription(immediate = false): Promise<void> {
    if (!subscription.value) return
    await api.billing.cancelSubscription(subscription.value.id, immediate)
    await loadSubscription()
  }

  async function loadOrders(): Promise<void> {
    const r = await api.billing.listOrders({ pageSize: 50 })
    orders.value = r.list
  }

  async function createOrder(req: CreateOrderReq): Promise<OrderDTO> {
    const o = await api.billing.createOrder(req)
    orders.value.unshift(o)
    return o
  }

  async function payOrder(id: string, method: string = 'stripe'): Promise<OrderDTO> {
    const o = await api.billing.payOrder(id, method)
    const idx = orders.value.findIndex((x) => x.id === id)
    if (idx >= 0) orders.value[idx] = o
    return o
  }

  async function loadInvoices(): Promise<void> {
    const r = await api.billing.listInvoices({ pageSize: 50 })
    invoices.value = r.list
  }

  async function loadRefunds(): Promise<void> {
    const r = await api.billing.listRefunds({ pageSize: 50 })
    refunds.value = r.list
  }

  async function requestRefund(order_id: string, amount: number, reason: string): Promise<void> {
    const r = await api.billing.requestRefund({ order_id, amount, reason })
    refunds.value.unshift(r)
  }

  return {
    plans, subscription, orders, invoices, refunds, quota, loading, error,
    isPro, creditsRemaining,
    loadPlans, loadSubscription, loadQuota, subscribe, cancelSubscription,
    loadOrders, createOrder, payOrder,
    loadInvoices, loadRefunds, requestRefund,
  }
})
