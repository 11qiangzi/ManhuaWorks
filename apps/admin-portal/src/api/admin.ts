/**
 * admin.ts — admin API mock 客户端
 * 全部走本地 mock 数据；接口形状按生产约定
 */

export type UserStatus = 'active' | 'disabled' | 'pending'
export type OrderStatus = 'paid' | 'refunded' | 'pending' | 'failed'
export type LogLevel = 'info' | 'warn' | 'error'

export interface User {
  id: string
  email: string
  name: string
  plan: 'free' | 'pro' | 'studio'
  status: UserStatus
  credits: number
  createdAt: string
  lastLogin: string
  totalSpent: number
}

export interface Order {
  id: string
  userId: string
  userName: string
  amount: number
  currency: 'CNY' | 'USD'
  status: OrderStatus
  product: string
  createdAt: string
  invoiceId?: string
}

export interface Invoice {
  id: string
  orderId: string
  userName: string
  amount: number
  tax: number
  issuedAt: string
  status: 'issued' | 'void'
}

export interface AuditLog {
  id: string
  ts: string
  actor: string
  level: LogLevel
  action: string
  target: string
  ip: string
  detail: string
}

export interface KpiSnapshot {
  totalUsers: number
  payingUsers: number
  mrr: number
  arpu: number
  churn7d: number
  activeNow: number
  deltaUsers: number
  deltaMrr: number
  deltaChurn: number
}

export interface Alert {
  id: string
  level: 'error' | 'warn' | 'info'
  title: string
  detail: string
  ts: string
}

// =========================================================
// Mock 数据
// =========================================================

const NAMES = ['林染', '梁总', '阿白', '小鱼', '老王', '阿熊', '小七', '墨轩', '苏白', '李子', '阿柒', '小满', '半夏', '清辉', '听雪', '听风']
const DOMAINS = ['example.com', 'manhuaworks.io', 'qq.com', 'gmail.com', '163.com']
const PRODUCTS = ['Pro 月卡', 'Studio 年卡', 'Credits 500', 'Credits 2000', 'API 额度包', '专业订阅季卡']
const ACTIONS = ['user.login', 'user.create', 'order.pay', 'order.refund', 'config.update', 'auth.role', 'ai.generate', 'ai.failover', 'billing.invoice', 'system.alert']

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function rid(prefix: string): string { return prefix + Math.random().toString(36).slice(2, 10) }
function nowMinus(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

const MOCK_USERS: User[] = Array.from({ length: 24 }, (_, i) => ({
  id: `u_${(1000 + i).toString()}`,
  email: `${rand(NAMES).toLowerCase().replace(/\s/g, '')}${i}@${rand(DOMAINS)}`,
  name: rand(NAMES),
  plan: rand(['free', 'pro', 'studio'] as const),
  status: rand(['active', 'active', 'active', 'disabled', 'pending'] as const),
  credits: Math.floor(Math.random() * 5000),
  createdAt: nowMinus(Math.floor(Math.random() * 180)),
  lastLogin: nowMinus(Math.random() * 30),
  totalSpent: Math.floor(Math.random() * 2000),
}))

const MOCK_ORDERS: Order[] = Array.from({ length: 32 }, (_, i) => ({
  id: `o_${(50000 + i).toString()}`,
  userId: MOCK_USERS[i % MOCK_USERS.length].id,
  userName: MOCK_USERS[i % MOCK_USERS.length].name,
  amount: Math.floor(20 + Math.random() * 800),
  currency: rand(['CNY', 'CNY', 'CNY', 'USD'] as const),
  status: rand(['paid', 'paid', 'paid', 'pending', 'refunded', 'failed'] as const),
  product: rand(PRODUCTS),
  createdAt: nowMinus(Math.floor(Math.random() * 60)),
  invoiceId: Math.random() > 0.5 ? rid('inv_') : undefined,
}))

const MOCK_INVOICES: Invoice[] = MOCK_ORDERS
  .filter((o) => o.invoiceId)
  .map((o) => ({
    id: o.invoiceId!,
    orderId: o.id,
    userName: o.userName,
    amount: o.amount,
    tax: Math.floor(o.amount * 0.06),
    issuedAt: o.createdAt,
    status: rand(['issued', 'issued', 'void'] as const),
  }))

const MOCK_LOGS: AuditLog[] = Array.from({ length: 80 }, (_, i) => ({
  id: `log_${i}`,
  ts: nowMinus(Math.random() * 7),
  actor: rand(NAMES),
  level: rand(['info', 'info', 'info', 'warn', 'error'] as const),
  action: rand(ACTIONS),
  target: rid('tgt_'),
  ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  detail: `${rand(ACTIONS)} succeeded with code ${200 + Math.floor(Math.random() * 50)}`,
}))

const MOCK_KPI: KpiSnapshot = {
  totalUsers: 1284,
  payingUsers: 312,
  mrr: 184_320,
  arpu: 142.7,
  churn7d: 3.2,
  activeNow: 87,
  deltaUsers: 8.4,
  deltaMrr: 12.1,
  deltaChurn: -0.6,
}

const MOCK_ALERTS: Alert[] = [
  { id: 'a1', level: 'error', title: 'ai-orchestrator 5xx 突增', detail: '近 10 分钟错误率 12.4%，已超阈值', ts: nowMinus(0.05) },
  { id: 'a2', level: 'warn', title: '支付回调延迟', detail: '微信支付回调平均延迟 6.2s', ts: nowMinus(0.5) },
  { id: 'a3', level: 'info', title: '新功能上线', detail: 'Studio V2 模型选择器已发布', ts: nowMinus(2) },
]

// =========================================================
// 假延迟 + 简易 mock
// =========================================================

function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((res) => setTimeout(() => res(value), ms))
}

export const adminApi = {
  // 仪表板
  getKpi(): Promise<KpiSnapshot> { return delay(MOCK_KPI) },
  getRevenue7d(): Promise<{ date: string; value: number }[]> {
    const series = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(5, 10),
      value: Math.floor(8000 + Math.random() * 18000),
    }))
    return delay(series)
  },
  getActive7d(): Promise<{ date: string; value: number }[]> {
    const series = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(5, 10),
      value: Math.floor(120 + Math.random() * 90),
    }))
    return delay(series)
  },
  getAlerts(): Promise<Alert[]> { return delay(MOCK_ALERTS) },

  // 用户
  listUsers(): Promise<User[]> { return delay(MOCK_USERS) },
  getUser(id: string): Promise<User | null> {
    return delay(MOCK_USERS.find((u) => u.id === id) ?? null)
  },
  toggleUserStatus(id: string): Promise<{ ok: true; status: UserStatus }> {
    const u = MOCK_USERS.find((x) => x.id === id)
    const status: UserStatus = u?.status === 'active' ? 'disabled' : 'active'
    if (u) u.status = status
    return delay({ ok: true, status })
  },

  // 计费
  listOrders(): Promise<Order[]> { return delay(MOCK_ORDERS) },
  refundOrder(id: string): Promise<{ ok: true; id: string }> {
    const o = MOCK_ORDERS.find((x) => x.id === id)
    if (o) o.status = 'refunded'
    return delay({ ok: true, id })
  },
  listInvoices(): Promise<Invoice[]> { return delay(MOCK_INVOICES) },
  issueInvoice(orderId: string, taxRate: number): Promise<Invoice> {
    const o = MOCK_ORDERS.find((x) => x.id === orderId)
    const inv: Invoice = {
      id: rid('inv_'),
      orderId,
      userName: o?.userName ?? 'unknown',
      amount: o?.amount ?? 0,
      tax: Math.floor((o?.amount ?? 0) * taxRate),
      issuedAt: new Date().toISOString(),
      status: 'issued',
    }
    if (o) o.invoiceId = inv.id
    MOCK_INVOICES.unshift(inv)
    return delay(inv)
  },
  monthlyRevenue(): Promise<{ month: string; value: number }[]> {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    return delay(months.map((m) => ({ month: m, value: Math.floor(80_000 + Math.random() * 220_000) })))
  },

  // 审计
  listLogs(): Promise<AuditLog[]> { return delay(MOCK_LOGS) },

  // 设置
  getSettings(): Promise<Record<string, Record<string, unknown>>> {
    return delay({
      ai: { provider: 'openai', fallback: 'deepseek', dailyQuota: 50000, timeoutMs: 30000 },
      payment: { provider: 'wechat', sandbox: true, taxRate: 0.06, currency: 'CNY' },
      email: { smtp: 'smtp.example.com', port: 465, from: 'no-reply@manhuaworks.io', ssl: true },
      storage: { driver: 's3', bucket: 'mhw-prod', cdn: 'cdn.example.com', maxUploadMB: 50 },
      ratelimit: { rps: 100, burst: 200, perUser: 10, windowSec: 60 },
    })
  },
  saveSettings(module: string, value: Record<string, unknown>): Promise<{ ok: true }> {
    return delay({ ok: true })
  },
}
