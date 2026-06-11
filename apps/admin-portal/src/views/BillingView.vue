<script setup lang="ts">
/**
 * BillingView — 计费管理
 * 订单列表 + 退款 + 发票 + 月度统计
 */
import { onMounted, ref, computed } from 'vue'
import { useAdminStore } from '@/stores/admin'
import type { Order } from '@/api/admin'
import OrderTable from '@/components/billing/OrderTable.vue'
import InvoiceForm from '@/components/billing/InvoiceForm.vue'

const store = useAdminStore()
onMounted(() => store.loadBilling())

const invoiceOpen = ref(false)
const invoiceOrder = ref<Order | null>(null)

const monthMax = computed(() => Math.max(1, ...store.monthly.map((m) => m.value)))

async function onRefund(o: Order) {
  if (!confirm(`确认退款 ${o.id} (¥${o.amount})?`)) return
  await store.refund(o.id)
}
function onInvoice(o: Order) {
  invoiceOrder.value = o
  invoiceOpen.value = true
}
async function onInvoiceSubmit(payload: { orderId: string; taxRate: number }) {
  await store.issueInvoice(payload.orderId, payload.taxRate)
  invoiceOpen.value = false
}

const totalRevenue = computed(() => store.orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amount, 0))
const refundCount = computed(() => store.orders.filter((o) => o.status === 'refunded').length)
const invoiceCount = computed(() => store.invoices.length)
</script>

<template>
  <div class="bv">
    <!-- 顶部统计 -->
    <div class="bv-stats">
      <div class="bv-stat">
        <span class="bv-stat-label">本月营收</span>
        <span class="bv-stat-value">¥{{ totalRevenue.toLocaleString() }}</span>
      </div>
      <div class="bv-stat">
        <span class="bv-stat-label">退款单数</span>
        <span class="bv-stat-value warn">{{ refundCount }}</span>
      </div>
      <div class="bv-stat">
        <span class="bv-stat-label">已开发票</span>
        <span class="bv-stat-value ok">{{ invoiceCount }}</span>
      </div>
      <div class="bv-stat">
        <span class="bv-stat-label">订单总数</span>
        <span class="bv-stat-value">{{ store.orders.length }}</span>
      </div>
    </div>

    <!-- 月度曲线（简易柱） -->
    <div class="bv-card">
      <div class="bv-card-head">
        <h3 class="bv-h3">近 6 月营收</h3>
      </div>
      <div class="bv-month">
        <div v-for="m in store.monthly" :key="m.month" class="bv-month-col">
          <div class="bv-month-bar-wrap">
            <div class="bv-month-bar" :style="{ height: (m.value / monthMax) * 100 + '%' }" />
          </div>
          <div class="bv-month-label">{{ m.month }}</div>
          <div class="bv-month-val">¥{{ Math.floor(m.value / 1000) }}k</div>
        </div>
      </div>
    </div>

    <!-- 订单列表 -->
    <div class="bv-card">
      <div class="bv-card-head">
        <h3 class="bv-h3">订单列表</h3>
        <span class="bv-tag">{{ store.orders.length }} 笔</span>
      </div>
      <OrderTable
        :orders="store.orders"
        :loading="store.billingLoading"
        @refund="onRefund"
        @invoice="onInvoice"
      />
    </div>

    <!-- 发票列表 -->
    <div class="bv-card">
      <div class="bv-card-head">
        <h3 class="bv-h3">发票记录</h3>
        <span class="bv-tag">{{ store.invoices.length }} 张</span>
      </div>
      <div v-if="!store.invoices.length" class="bv-empty">暂无发票</div>
      <ul v-else class="bv-inv-list">
        <li v-for="i in store.invoices" :key="i.id" class="bv-inv">
          <span class="bv-inv-id">{{ i.id }}</span>
          <span>{{ i.userName }}</span>
          <span class="dim">订单 {{ i.orderId }}</span>
          <span class="num">¥{{ i.amount }} <span class="dim">+税 ¥{{ i.tax }}</span></span>
          <span class="bv-inv-status" :class="i.status === 'issued' ? 'ok' : 'bad'">{{ i.status }}</span>
          <span class="dim">{{ new Date(i.issuedAt).toLocaleDateString() }}</span>
        </li>
      </ul>
    </div>

    <InvoiceForm
      :open="invoiceOpen"
      :order="invoiceOrder"
      @close="invoiceOpen = false"
      @submit="onInvoiceSubmit"
    />
  </div>
</template>

<style scoped>
.bv { display: flex; flex-direction: column; gap: 18px; }
.bv-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.bv-stat { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.bv-stat-label { font-size: 12px; color: var(--text-secondary); }
.bv-stat-value { font-size: 22px; font-weight: 700; }
.bv-stat-value.ok { color: var(--success); }
.bv-stat-value.warn { color: var(--warning); }

.bv-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px; padding: 16px 20px; }
.bv-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.bv-h3 { margin: 0; font-size: 15px; }
.bv-tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--bg-primary); border: 1px solid var(--border); color: var(--text-secondary); }

.bv-month { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; height: 180px; align-items: end; }
.bv-month-col { display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
.bv-month-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.bv-month-bar { width: 100%; background: var(--accent); border-radius: 4px 4px 0 0; min-height: 4px; transition: height 300ms; opacity: 0.85; }
.bv-month-label { font-size: 11px; color: var(--text-secondary); }
.bv-month-val { font-size: 11px; font-weight: 500; }

.bv-empty { padding: 24px; text-align: center; opacity: 0.5; }
.bv-inv-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.bv-inv { display: grid; grid-template-columns: 130px 100px 1fr 1.2fr 80px 90px; align-items: center; gap: 8px; padding: 8px 10px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px; font-size: 12px; }
.bv-inv-id { font-family: monospace; }
.bv-inv-status { font-size: 11px; padding: 1px 6px; border-radius: 4px; text-align: center; }
.bv-inv-status.ok { color: var(--success); background: rgba(74, 222, 128, 0.1); }
.bv-inv-status.bad { color: var(--danger); background: rgba(248, 113, 113, 0.1); }
.dim { color: var(--text-secondary); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
