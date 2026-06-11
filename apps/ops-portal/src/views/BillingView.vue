<script setup lang="ts">
/**
 * BillingView · 计费/充值管理
 * ManhuaWorks · M2 · L5-D · 真实账号 + 充值
 *
 * 5 模块:
 *   1) 余额卡（当前用户余额 + 可用币种）
 *   2) 充值表单（金额 + 币种 + 幂等键 + 提交）
 *   3) 充值历史表（10/页 + 分页 + 状态）
 *   4) 4 角色用户余额柱状图（SVG 手画）
 *   5) 流水时间轴（最近 8 条）
 *
 * 数据源：调 billing-service:8090 (mock 失败兜底)
 */
import { computed, onMounted, ref } from 'vue'

/* ============== 类型 ============== */
interface BalanceResp {
  userId: string
  balanceCents: number
  balance: number
  currency: string
  updatedAt: string
}
interface InvoiceItem {
  id: string
  invoiceNo: string
  title: string
  amountCents: number
  currency: string
  status: 'draft' | 'issued' | 'void' | string
  issuedAt: string
  createdAt: string
}
interface InvoicesResp {
  list: InvoiceItem[]
  total: number
  limit: number
  offset: number
}
interface RechargeResp {
  code: number
  message: string
  data: {
    ok: boolean
    reason?: string | null
    invoice: { id: string; invoiceNo: string; amountCents: number; currency: string }
    payment: { method: string; transactionId: string; status: string }
    balance: { balanceCents: number; currency: string }
    idempotent: boolean
  }
}

interface DemoUser {
  id: string
  role: 'admin' | 'creator' | 'free' | 'business'
  displayName: string
  balanceCents: number
  currency: string
}

/* ============== 配置 ============== */
const API_BASE = 'http://127.0.0.1:8090/api/v1/billing'
const PAGE_SIZE = 10

const DEMO_USERS: DemoUser[] = [
  { id: '11111111-1111-4111-8111-111111111101', role: 'admin', displayName: '演示-管理员', balanceCents: 50000, currency: 'USD' },
  { id: '11111111-1111-4111-8111-111111111102', role: 'creator', displayName: '演示-创作者', balanceCents: 20000, currency: 'USD' },
  { id: '11111111-1111-4111-8111-111111111103', role: 'free', displayName: '演示-免费用户', balanceCents: 1000, currency: 'USD' },
  { id: '11111111-1111-4111-8111-111111111104', role: 'business', displayName: '演示-企业用户', balanceCents: 100000, currency: 'USD' },
]

const ROLE_COLORS: Record<string, string> = {
  admin: '#ef4444',
  creator: '#f59e0b',
  free: '#6b7280',
  business: '#6366f1',
}

/* ============== 状态 ============== */
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const balance = ref<BalanceResp | null>(null)
const invoices = ref<InvoicesResp | null>(null)
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil((invoices.value?.total ?? 0) / PAGE_SIZE)))

const form = ref({
  userId: DEMO_USERS[0]!.id,
  amount: 50,
  currency: 'USD' as 'USD' | 'CNY' | 'EUR' | 'JPY',
  idempotencyKey: '',
})
const submitting = ref(false)
const lastResult = ref<RechargeResp | null>(null)
const formError = ref<string | null>(null)

/* ============== 工具 ============== */
function fmtMoney(cents: number, currency = 'USD'): string {
  return `${(cents / 100).toFixed(2)} ${currency}`
}
function fmtAgo(ts: string | Date): string {
  const t = typeof ts === 'string' ? new Date(ts).getTime() : ts.getTime()
  const diff = Date.now() - t
  if (diff < 60_000) return '刚刚'
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}
function statusBadge(s: string): { text: string; color: string } {
  if (s === 'success' || s === 'paid' || s === 'issued') return { text: '成功', color: '#22c55e' }
  if (s === 'failed' || s === 'void') return { text: '失败', color: '#ef4444' }
  if (s === 'pending' || s === 'draft') return { text: '处理中', color: '#eab308' }
  return { text: s, color: '#6b7280' }
}

/* ============== 模拟兜底（fetch 失败时使用） ============== */
function mockBalance(userId: string): BalanceResp {
  const u = DEMO_USERS.find((x) => x.id === userId) ?? DEMO_USERS[0]!
  return {
    userId,
    balanceCents: u.balanceCents,
    balance: u.balanceCents / 100,
    currency: u.currency,
    updatedAt: new Date().toISOString(),
  }
}
function mockInvoices(): InvoicesResp {
  const now = Date.now()
  const list: InvoiceItem[] = Array.from({ length: 23 }, (_, i) => {
    const ok = i % 5 !== 0
    return {
      id: `mock-inv-${i}`,
      invoiceNo: `INV-MOCK-${String(i).padStart(3, '0')}`,
      title: `recharge:${1000 + i * 500}`,
      amountCents: 1000 + i * 500,
      currency: 'USD',
      status: ok ? 'issued' : 'void',
      issuedAt: new Date(now - i * 3600_000).toISOString(),
      createdAt: new Date(now - i * 3600_000).toISOString(),
    }
  })
  return { list, total: list.length, limit: PAGE_SIZE, offset: 0 }
}

/* ============== 拉数据 ============== */
async function fetchBalance(userId: string): Promise<void> {
  try {
    const token = localStorage.getItem('mhw_token') ?? ''
    const r = await fetch(`${API_BASE}/balance`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = (await r.json()) as { data: BalanceResp }
    balance.value = j.data
    errorMsg.value = null
  } catch (e) {
    // mock 兜底
    balance.value = mockBalance(userId)
    errorMsg.value = `后端不可达，使用 mock 数据 (${(e as Error).message})`
  }
}

async function fetchInvoices(): Promise<void> {
  loading.value = true
  try {
    const token = localStorage.getItem('mhw_token') ?? ''
    const offset = (page.value - 1) * PAGE_SIZE
    const r = await fetch(`${API_BASE}/invoices?limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = (await r.json()) as { data: InvoicesResp }
    invoices.value = j.data
  } catch {
    const m = mockInvoices()
    // 手动分页（mock 兜底时也按 10/页）
    const start = (page.value - 1) * PAGE_SIZE
    invoices.value = { list: m.list.slice(start, start + PAGE_SIZE), total: m.total, limit: PAGE_SIZE, offset: start }
  } finally {
    loading.value = false
  }
}

async function submitRecharge(): Promise<void> {
  formError.value = null
  if (form.value.amount <= 0) {
    formError.value = '金额必须大于 0'
    return
  }
  if (form.value.amount > 100000) {
    formError.value = '单笔金额上限 $1000'
    return
  }
  submitting.value = true
  try {
    const token = localStorage.getItem('mhw_token') ?? ''
    const body: Record<string, unknown> = {
      userId: form.value.userId,
      amount: form.value.amount,
      currency: form.value.currency,
    }
    if (form.value.idempotencyKey.trim()) {
      body.idempotencyKey = form.value.idempotencyKey.trim()
    }
    const r = await fetch(`${API_BASE}/recharge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    const j = (await r.json()) as RechargeResp
    lastResult.value = j
    if (j.code === 0 && j.data?.balance) {
      balance.value = {
        userId: form.value.userId,
        balanceCents: j.data.balance.balanceCents,
        balance: j.data.balance.balanceCents / 100,
        currency: j.data.balance.currency,
        updatedAt: new Date().toISOString(),
      }
    }
    await fetchInvoices()
  } catch (e) {
    formError.value = `提交失败：${(e as Error).message}`
  } finally {
    submitting.value = false
  }
}

function changePage(p: number): void {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  void fetchInvoices()
}

/* ============== 柱状图计算 ============== */
const userBarMax = computed(() => Math.max(...DEMO_USERS.map((u) => u.balanceCents)))
const userBarWidth = 360
const userBarHeight = 24

/* ============== 流水时间轴 ============== */
const recentFlows = computed(() => {
  const list = invoices.value?.list ?? []
  return list
    .filter((inv) => inv.status === 'issued' || inv.status === 'void')
    .slice(0, 8)
    .map((inv) => ({
      id: inv.id,
      title: inv.title,
      amount: fmtMoney(inv.amountCents, inv.currency),
      status: statusBadge(inv.status === 'issued' ? 'paid' : inv.status),
      at: fmtAgo(inv.issuedAt),
    }))
})

/* ============== 初始化 ============== */
onMounted(async () => {
  await Promise.all([fetchBalance(form.value.userId), fetchInvoices()])
})
</script>

<template>
  <div class="bill">
    <h1 class="bill__title">💰 计费 / 充值</h1>
    <p class="bill__sub">dev 演示账号预置数据 · 充值走 mock 支付（5 步流程）</p>

    <p v-if="errorMsg" class="bill__warn" data-testid="bill-warn">⚠️ {{ errorMsg }}</p>

    <!-- 1. 余额卡 -->
    <section class="bill__balance" data-testid="bill-balance-card">
      <div class="bill__balance-label">当前余额</div>
      <div class="bill__balance-value">
        <span v-if="balance">{{ fmtMoney(balance.balanceCents, balance.currency) }}</span>
        <span v-else>加载中…</span>
      </div>
      <div class="bill__balance-meta">
        <span v-if="balance">userId: <code>{{ balance.userId.slice(0, 8) }}…</code></span>
        <span v-if="balance">更新于 {{ fmtAgo(balance.updatedAt) }}</span>
      </div>
    </section>

    <!-- 2. 充值表单 -->
    <section class="bill__panel" data-testid="bill-recharge-form">
      <h2 class="bill__panel-title">⚡ 充值</h2>
      <form class="bill__form" @submit.prevent="submitRecharge">
        <label class="bill__field">
          <span>用户</span>
          <select v-model="form.userId" data-testid="form-user">
            <option v-for="u in DEMO_USERS" :key="u.id" :value="u.id">
              {{ u.displayName }} ({{ u.role }})
            </option>
          </select>
        </label>
        <label class="bill__field">
          <span>金额 (USD)</span>
          <input v-model.number="form.amount" type="number" min="0.01" step="0.01" max="100000" data-testid="form-amount" />
        </label>
        <label class="bill__field">
          <span>币种</span>
          <select v-model="form.currency" data-testid="form-currency">
            <option value="USD">USD</option>
            <option value="CNY">CNY</option>
            <option value="EUR">EUR</option>
            <option value="JPY">JPY</option>
          </select>
        </label>
        <label class="bill__field bill__field--wide">
          <span>幂等键（可选，留空则自动生成）</span>
          <input v-model="form.idempotencyKey" type="text" placeholder="idem-xxx" data-testid="form-idem" />
        </label>
        <button class="bill__btn" type="submit" :disabled="submitting" data-testid="form-submit">
          {{ submitting ? '处理中…' : '立即充值' }}
        </button>
        <p v-if="formError" class="bill__form-err">{{ formError }}</p>
        <p v-if="lastResult" class="bill__form-ok">
          {{ lastResult.message }} · tx=<code>{{ lastResult.data.payment.transactionId }}</code> · 新余额
          <strong>{{ fmtMoney(lastResult.data.balance.balanceCents, lastResult.data.balance.currency) }}</strong>
        </p>
      </form>
    </section>

    <!-- 3. 充值历史表 -->
    <section class="bill__panel" data-testid="bill-invoice-table">
      <h2 class="bill__panel-title">📜 充值历史（共 {{ invoices?.total ?? 0 }} 条）</h2>
      <table class="bill__table">
        <thead>
          <tr><th>发票号</th><th>说明</th><th>金额</th><th>状态</th><th>时间</th></tr>
        </thead>
        <tbody>
          <tr v-for="inv in invoices?.list ?? []" :key="inv.id">
            <td><code>{{ inv.invoiceNo }}</code></td>
            <td>{{ inv.title }}</td>
            <td>{{ fmtMoney(inv.amountCents, inv.currency) }}</td>
            <td>
              <span class="bill__badge" :style="{ background: statusBadge(inv.status === 'issued' ? 'paid' : inv.status).color }">
                {{ statusBadge(inv.status === 'issued' ? 'paid' : inv.status).text }}
              </span>
            </td>
            <td>{{ fmtAgo(inv.issuedAt) }}</td>
          </tr>
        </tbody>
      </table>
      <div class="bill__pager">
        <button :disabled="page <= 1" @click="changePage(page - 1)">‹ 上一页</button>
        <span>第 {{ page }} / {{ totalPages }} 页</span>
        <button :disabled="page >= totalPages" @click="changePage(page + 1)">下一页 ›</button>
      </div>
    </section>

    <!-- 4. 4 角色用户余额柱状图 -->
    <section class="bill__panel" data-testid="bill-roles-chart">
      <h2 class="bill__panel-title">👥 4 角色用户余额</h2>
      <svg class="bill__chart" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid meet" data-testid="bill-roles-svg">
        <g v-for="(u, i) in DEMO_USERS" :key="u.id" :transform="`translate(20, ${i * 40 + 20})`">
          <text x="0" y="14" fill="#a0a6b0" font-size="11">{{ u.displayName }} ({{ u.role }})</text>
          <rect
            :x="160"
            :y="2"
            :width="(u.balanceCents / userBarMax) * userBarWidth"
            :height="userBarHeight"
            :fill="ROLE_COLORS[u.role] ?? '#6b7280'"
            rx="3"
          />
          <text
            :x="160 + (u.balanceCents / userBarMax) * userBarWidth + 6"
            y="18"
            fill="#e6e8eb"
            font-size="11"
            font-weight="700"
          >
            {{ fmtMoney(u.balanceCents, u.currency) }}
          </text>
        </g>
      </svg>
    </section>

    <!-- 5. 流水时间轴 -->
    <section class="bill__panel" data-testid="bill-flow-timeline">
      <h2 class="bill__panel-title">🕐 最近流水（时间轴）</h2>
      <ol class="bill__timeline">
        <li v-for="f in recentFlows" :key="f.id" class="bill__tl-item">
          <span class="bill__tl-dot" :style="{ background: f.status.color }" />
          <div class="bill__tl-body">
            <div class="bill__tl-row">
              <strong>{{ f.title }}</strong>
              <span class="bill__badge" :style="{ background: f.status.color }">{{ f.status.text }}</span>
              <span class="bill__tl-amount">{{ f.amount }}</span>
            </div>
            <div class="bill__tl-time">{{ f.at }}</div>
          </div>
        </li>
        <li v-if="recentFlows.length === 0" class="bill__tl-empty">暂无流水</li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.bill { display: flex; flex-direction: column; gap: 20px; }
.bill__title { font-size: 22px; font-weight: 700; margin: 0; }
.bill__sub { color: #6b7280; margin: 0; font-size: 13px; }
.bill__warn {
  background: #3b2415; border: 1px solid #f59e0b; color: #fbbf24;
  padding: 8px 12px; border-radius: 6px; font-size: 12px; margin: 0;
}
.bill__balance {
  background: linear-gradient(135deg, #1e293b, #312e81);
  border: 1px solid #4338ca; border-radius: 12px;
  padding: 22px 26px; color: white;
}
.bill__balance-label { font-size: 12px; color: #c4b5fd; }
.bill__balance-value { font-size: 38px; font-weight: 800; margin: 6px 0; }
.bill__balance-meta { color: #a5b4fc; font-size: 11px; display: flex; gap: 12px; }
.bill__balance-meta code { background: rgba(255,255,255,0.1); padding: 1px 6px; border-radius: 3px; }

.bill__panel {
  background: #181b22; border: 1px solid #2a2f3a; border-radius: 10px;
  padding: 18px 20px;
}
.bill__panel-title { font-size: 14px; font-weight: 700; margin: 0 0 14px; color: #e6e8eb; }

.bill__form { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; align-items: end; }
.bill__field { display: flex; flex-direction: column; gap: 4px; }
.bill__field--wide { grid-column: 1 / 3; }
.bill__field > span { color: #a0a6b0; font-size: 11px; }
.bill__field input, .bill__field select {
  background: #0f1115; color: #e6e8eb; border: 1px solid #2a2f3a;
  border-radius: 6px; padding: 8px 10px; font-size: 13px;
}
.bill__btn {
  background: #6366f1; color: white; border: none; border-radius: 6px;
  padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer;
}
.bill__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.bill__form-err { color: #fca5a5; font-size: 12px; grid-column: 1 / -1; margin: 0; }
.bill__form-ok {
  color: #86efac; font-size: 12px; grid-column: 1 / -1; margin: 0;
  background: #14532d; padding: 8px 10px; border-radius: 4px;
}
.bill__form-ok code { background: rgba(0,0,0,0.3); padding: 1px 5px; border-radius: 3px; }

.bill__table { width: 100%; border-collapse: collapse; font-size: 12px; }
.bill__table th, .bill__table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #2a2f3a; }
.bill__table th { color: #6b7280; font-weight: 600; }
.bill__table code { background: #2a2f3a; padding: 1px 6px; border-radius: 3px; font-size: 11px; }
.bill__badge {
  display: inline-block; padding: 2px 8px; border-radius: 10px;
  font-size: 10px; color: white; font-weight: 700;
}
.bill__pager {
  display: flex; align-items: center; justify-content: center; gap: 16px;
  margin-top: 14px; font-size: 12px; color: #a0a6b0;
}
.bill__pager button {
  background: #232834; color: #e6e8eb; border: 1px solid #2a2f3a;
  border-radius: 5px; padding: 4px 12px; font-size: 12px; cursor: pointer;
}
.bill__pager button:disabled { opacity: 0.4; cursor: not-allowed; }

.bill__chart { width: 100%; height: 200px; display: block; }

.bill__timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.bill__tl-item { display: flex; gap: 12px; align-items: flex-start; padding-left: 8px; position: relative; }
.bill__tl-item:not(:last-child)::after {
  content: ''; position: absolute; left: 13px; top: 16px; bottom: -10px;
  width: 2px; background: #2a2f3a;
}
.bill__tl-dot {
  width: 10px; height: 10px; border-radius: 50%;
  margin-top: 5px; flex-shrink: 0; z-index: 1;
}
.bill__tl-body { flex: 1; }
.bill__tl-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.bill__tl-amount { color: #86efac; font-weight: 700; margin-left: auto; }
.bill__tl-time { color: #6b7280; font-size: 11px; margin-top: 2px; }
.bill__tl-empty { color: #6b7280; font-size: 12px; text-align: center; padding: 20px; }
</style>
