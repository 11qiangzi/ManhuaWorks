/**
 * admin Pinia store
 * - 缓存 + 加载状态
 * - 主题切换（与 W2 themes 一致）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { adminApi, type User, type Order, type Invoice, type AuditLog, type KpiSnapshot, type Alert } from '@/api/admin'

export type ThemeName = 'dark-workshop' | 'minimal-light' | 'creator-orange' | 'national-ink' | 'neon-cyber'

export interface ThemeMeta {
  name: ThemeName
  label: string
  desc: string
  preview: { bg: string; accent: string; text: string }
}

export const THEME_LIST: ThemeMeta[] = [
  { name: 'dark-workshop', label: '暗夜工坊', desc: '深夜创作 · 沉浸低光', preview: { bg: '#0e0f12', accent: '#ff7a45', text: '#e8eaed' } },
  { name: 'minimal-light', label: '极简白', desc: '白天办公 · 长时间阅读', preview: { bg: '#ffffff', accent: '#2563eb', text: '#1a1d23' } },
  { name: 'creator-orange', label: '创作橙', desc: '暖感激发 · 爽感创作', preview: { bg: '#fffaf5', accent: '#ff6b1a', text: '#2d1810' } },
  { name: 'national-ink', label: '国风墨', desc: '水风骨改 · 东方气质', preview: { bg: '#f5efe1', accent: '#a8302b', text: '#1a1612' } },
  { name: 'neon-cyber', label: '霓虹赛博', desc: '赛博朋克 · AI 视觉冲击', preview: { bg: '#0a0014', accent: '#ff00aa', text: '#f0e6ff' } },
]

const STORAGE_KEY = 'manhuaworks:theme'

export const useAdminStore = defineStore('admin', () => {
  // 主题
  const theme = ref<ThemeName>('dark-workshop')

  function setTheme(name: ThemeName) {
    theme.value = name
    const html = document.documentElement
    THEME_LIST.forEach((t) => html.classList.remove(`theme-${t.name}`))
    html.classList.add(`theme-${name}`)
    html.setAttribute('data-theme', name)
    try { localStorage.setItem(STORAGE_KEY, name) } catch {}
  }

  function initTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeName | null
      if (saved && THEME_LIST.some((t) => t.name === saved)) {
        setTheme(saved)
        return
      }
    } catch {}
    setTheme(theme.value)
  }

  // 仪表板
  const kpi = ref<KpiSnapshot | null>(null)
  const revenue = ref<{ date: string; value: number }[]>([])
  const active = ref<{ date: string; value: number }[]>([])
  const alerts = ref<Alert[]>([])
  const kpiLoading = ref(false)

  async function loadDashboard() {
    kpiLoading.value = true
    try {
      const [k, r, a, al] = await Promise.all([
        adminApi.getKpi(),
        adminApi.getRevenue7d(),
        adminApi.getActive7d(),
        adminApi.getAlerts(),
      ])
      kpi.value = k; revenue.value = r; active.value = a; alerts.value = al
    } finally {
      kpiLoading.value = false
    }
  }

  // 用户
  const users = ref<User[]>([])
  const usersLoading = ref(false)
  const userQuery = ref('')

  const filteredUsers = computed(() => {
    const q = userQuery.value.trim().toLowerCase()
    if (!q) return users.value
    return users.value.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  })

  async function loadUsers() {
    usersLoading.value = true
    try { users.value = await adminApi.listUsers() } finally { usersLoading.value = false }
  }

  async function toggleUser(id: string) {
    const res = await adminApi.toggleUserStatus(id)
    const u = users.value.find((x) => x.id === id)
    if (u) u.status = res.status
  }

  // 计费
  const orders = ref<Order[]>([])
  const invoices = ref<Invoice[]>([])
  const billingLoading = ref(false)
  const monthly = ref<{ month: string; value: number }[]>([])

  async function loadBilling() {
    billingLoading.value = true
    try {
      const [o, i, m] = await Promise.all([adminApi.listOrders(), adminApi.listInvoices(), adminApi.monthlyRevenue()])
      orders.value = o; invoices.value = i; monthly.value = m
    } finally { billingLoading.value = false }
  }

  async function refund(id: string) {
    await adminApi.refundOrder(id)
    const o = orders.value.find((x) => x.id === id)
    if (o) o.status = 'refunded'
  }

  async function issueInvoice(orderId: string, taxRate: number) {
    const inv = await adminApi.issueInvoice(orderId, taxRate)
    invoices.value.unshift(inv)
    return inv
  }

  // 审计
  const logs = ref<AuditLog[]>([])
  const logsLoading = ref(false)
  const logFilter = ref<{ level: string; action: string; actor: string }>({ level: '', action: '', actor: '' })

  const filteredLogs = computed(() => {
    return logs.value.filter((l) =>
      (!logFilter.value.level || l.level === logFilter.value.level) &&
      (!logFilter.value.action || l.action.includes(logFilter.value.action)) &&
      (!logFilter.value.actor || l.actor.includes(logFilter.value.actor))
    )
  })

  async function loadLogs() {
    logsLoading.value = true
    try { logs.value = await adminApi.listLogs() } finally { logsLoading.value = false }
  }

  // 设置
  const settings = ref<Record<string, Record<string, unknown>>>({})
  const settingsLoading = ref(false)

  async function loadSettings() {
    settingsLoading.value = true
    try { settings.value = await adminApi.getSettings() } finally { settingsLoading.value = false }
  }

  async function saveSetting(module: string, value: Record<string, unknown>) {
    await adminApi.saveSettings(module, value)
    settings.value[module] = { ...value }
  }

  return {
    theme, setTheme, initTheme,
    kpi, revenue, active, alerts, kpiLoading, loadDashboard,
    users, usersLoading, userQuery, filteredUsers, loadUsers, toggleUser,
    orders, invoices, billingLoading, monthly, loadBilling, refund, issueInvoice,
    logs, logsLoading, logFilter, filteredLogs, loadLogs,
    settings, settingsLoading, loadSettings, saveSetting,
  }
})
