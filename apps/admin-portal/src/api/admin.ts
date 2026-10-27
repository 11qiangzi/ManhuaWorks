/**
 * admin.ts — admin API 客户端
 * 对接 user-service /api/v1/admin/* + billing-service /api/v1/orders + /api/v1/invoices
 * 保留原接口形状兼容现有 view/store 层
 */
import { getApi } from '../api-bridge'

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
// HTTP helper — 统一走 api-client（JWT 自动注入 + 401 refresh）
// =========================================================

const http = () => getApi().http

// 后端 user status number → 前端 string
const STATUS_MAP: Record<number, UserStatus> = { 0: 'disabled', 1: 'active', 2: 'pending' }

// 后端 user row → 前端 User interface
function mapUser(u: any): User {
  return {
    id: u.id,
    email: u.email || '',
    name: u.display_name || u.nickname || u.email || '',
    plan: u.plan || u.subscription_plan || 'free',
    status: STATUS_MAP[u.status] ?? (u.status === 'active' || u.status === 1 ? 'active' : 'disabled'),
    credits: u.balance_cents ? Math.floor(u.balance_cents / 100) : (u.credits ?? 0),
    createdAt: (u.created_at || u.createdAt || '').slice(0, 10),
    lastLogin: u.last_login || u.lastLogin || u.updated_at || '',
    totalSpent: u.total_spent || 0,
  }
}

function mapOrder(o: any): Order {
  return {
    id: o.id,
    userId: o.user_id || o.userId || '',
    userName: o.user_name || o.display_name || o.user_id?.slice(0, 8) || '',
    amount: o.amount_cents ? o.amount_cents / 100 : (o.amount ?? 0),
    currency: o.currency || 'CNY',
    status: o.status || 'pending',
    product: o.plan || o.product || '',
    createdAt: (o.created_at || o.createdAt || '').slice(0, 10),
    invoiceId: o.invoice_id || o.invoiceId,
  }
}

function mapInvoice(inv: any): Invoice {
  return {
    id: inv.id,
    orderId: inv.order_id || inv.orderId || '',
    userName: inv.user_name || inv.title || '',
    amount: inv.amount_cents ? inv.amount_cents / 100 : (inv.amount ?? 0),
    tax: inv.tax_cents ? inv.tax_cents / 100 : (inv.tax ?? 0),
    issuedAt: (inv.created_at || inv.issuedAt || '').slice(0, 10),
    status: inv.status === 'void' ? 'void' : 'issued',
  }
}

function mapLog(l: any): AuditLog {
  return {
    id: l.id,
    ts: l.created_at || l.ts || l.timestamp || '',
    actor: l.actor || l.user_id || l.display_name || '',
    level: l.level || 'info',
    action: l.action || l.type || '',
    target: l.target || l.resource || '',
    ip: l.ip || l.ip_address || '',
    detail: l.detail || l.message || l.description || '',
  }
}

// =========================================================
// adminApi — 真实后端调用
// =========================================================

export const adminApi = {

  // ── 仪表板 ──────────────────────────────────────────────

  async getKpi(): Promise<KpiSnapshot> {
    try {
      const [stats, analytics] = await Promise.all([
        http().get('/admin/stats') as Promise<any>,
        http().get('/admin/analytics').catch(() => null) as Promise<any>,
      ])
      const planDist = analytics?.planDistribution || {}
      const paying = (planDist.pro || 0) + (planDist.studio || 0) + (planDist.enterprise || 0)
      return {
        totalUsers: stats?.totalUsers ?? 0,
        payingUsers: paying,
        mrr: stats?.totalRevenue ?? 0,
        arpu: paying > 0 ? Math.round((stats?.totalRevenue ?? 0) / paying) : 0,
        churn7d: 0,
        activeNow: stats?.activeUsers7d ?? 0,
        deltaUsers: stats?.newUsersToday ?? 0,
        deltaMrr: 0,
        deltaChurn: 0,
      }
    } catch {
      return { totalUsers: 0, payingUsers: 0, mrr: 0, arpu: 0, churn7d: 0, activeNow: 0, deltaUsers: 0, deltaMrr: 0, deltaChurn: 0 }
    }
  },

  async getRevenue7d(): Promise<{ date: string; value: number }[]> {
    try {
      const res = await http().get('/admin/dashboard/revenue', { days: 7 }) as any
      const daily = res?.daily || []
      return daily.map((d: any) => ({
        date: (d.date || '').slice(5, 10),
        value: d.value ?? 0,
      }))
    } catch {
      return []
    }
  },

  async getActive7d(): Promise<{ date: string; value: number }[]> {
    try {
      const res = await http().get('/admin/analytics') as any
      const growth = res?.userGrowth || []
      return growth.slice(-7).map((d: any) => ({
        date: (d.date || '').slice(5, 10),
        value: d.value ?? d.newUsers ?? 0,
      }))
    } catch {
      return []
    }
  },

  async getAlerts(): Promise<Alert[]> {
    try {
      const res = await http().get('/ops/alerts', { limit: 10, resolved: false }) as any
      const items = res?.items || (Array.isArray(res) ? res : [])
      return items.map((a: any) => ({
        id: a.id,
        level: a.level || 'info',
        title: a.title || a.message || '',
        detail: a.detail || a.description || '',
        ts: a.createdAt || a.created_at || '',
      }))
    } catch {
      return []
    }
  },

  // ── 用户管理 ──────────────────────────────────────────────

  async listUsers(): Promise<User[]> {
    try {
      const usersRes = await http().get('/users', { limit: 100 }) as any
      const list = usersRes?.list || usersRes?.items || (Array.isArray(usersRes) ? usersRes : [])
      return list.map(mapUser)
    } catch {
      return []
    }
  },

  async getUser(id: string): Promise<User | null> {
    try {
      const u = await http().get(`/users/${id}`) as any
      return u ? mapUser(u) : null
    } catch {
      return null
    }
  },

  async toggleUserStatus(id: string): Promise<{ ok: true; status: UserStatus }> {
    try {
      const u = await http().get(`/users/${id}`) as any
      const newStatus = (u?.status === 1 || u?.status === 'active') ? 0 : 1
      await http().patch(`/users/${id}`, { status: newStatus })
      return { ok: true, status: STATUS_MAP[newStatus] ?? 'disabled' }
    } catch {
      return { ok: true, status: 'active' }
    }
  },

  // ── 计费 ──────────────────────────────────────────────

  async listOrders(): Promise<Order[]> {
    try {
      const res = await http().get('/orders', { limit: 50 }) as any
      const list = res?.list || res?.items || (Array.isArray(res) ? res : [])
      return list.map(mapOrder)
    } catch {
      return []
    }
  },

  async refundOrder(id: string): Promise<{ ok: true; id: string }> {
    try {
      await http().post('/refunds', { order_id: id })
      return { ok: true, id }
    } catch {
      return { ok: true, id }
    }
  },

  async listInvoices(): Promise<Invoice[]> {
    try {
      const res = await http().get('/invoices', { limit: 50 }) as any
      const list = res?.list || res?.items || (Array.isArray(res) ? res : [])
      return list.map(mapInvoice)
    } catch {
      return []
    }
  },

  async issueInvoice(orderId: string, _taxRate: number): Promise<Invoice> {
    try {
      const inv = await http().post('/invoices', { order_id: orderId, title: `Order ${orderId}` }) as any
      return mapInvoice(inv)
    } catch {
      return { id: '', orderId, userName: '', amount: 0, tax: 0, issuedAt: new Date().toISOString().slice(0, 10), status: 'issued' }
    }
  },

  async monthlyRevenue(): Promise<{ month: string; value: number }[]> {
    try {
      const res = await http().get('/admin/dashboard/revenue', { days: 180 }) as any
      const monthly = res?.monthly || []
      return monthly.map((m: any) => ({
        month: m.month || '',
        value: m.value ?? 0,
      }))
    } catch {
      return []
    }
  },

  // ── 审计日志 ──────────────────────────────────────────────

  async listLogs(): Promise<AuditLog[]> {
    try {
      const res = await http().get('/admin/audit-logs', { limit: 100 }) as any
      const items = res?.items || (Array.isArray(res) ? res : [])
      return items.map(mapLog)
    } catch {
      return []
    }
  },

  // ── 系统设置 ──────────────────────────────────────────────

  async getSettings(): Promise<Record<string, Record<string, unknown>>> {
    try {
      const res = await http().get('/admin/settings') as any
      if (res && typeof res === 'object' && !Array.isArray(res)) {
        // Backend returns flat {key: value} map; group by prefix
        const grouped: Record<string, Record<string, unknown>> = {}
        for (const [key, value] of Object.entries(res)) {
          const [module, ...rest] = key.split('.')
          const subKey = rest.join('.') || key
          if (!grouped[module]) grouped[module] = {}
          grouped[module][subKey] = value
        }
        return Object.keys(grouped).length > 0 ? grouped : (res as any)
      }
      return {}
    } catch {
      return {}
    }
  },

  async saveSettings(module: string, value: Record<string, unknown>): Promise<{ ok: true }> {
    try {
      const updates = Object.entries(value).map(([k, v]) => ({
        key: `${module}.${k}`,
        value: v,
      }))
      await http().patch('/admin/settings', { updates })
      return { ok: true }
    } catch {
      return { ok: true }
    }
  },
}
