/**
 * ops-api.ts — ops-portal backend API client
 * 千机工坊 ops-portal · real API integration
 *
 * All functions call the user-service ops routes at :8088
 * (proxied via vite dev server config).
 * Auth token is read from localStorage key 'mhw.access_token'.
 */

/* ──────────── Types ──────────── */

export interface OpsOverview {
  totalUsers: number
  active7d: number
  totalProjects: number
  totalWorks: number
  newToday: number
  revenueSeries?: { date: string; value: number }[]
  providerUsage?: { provider: string; used: number; color?: string }[]
  projectStatus?: { status: string; count: number }[]
}

export interface ServiceInfo {
  name: string
  port?: number
  version?: string
  framework?: string
  status?: string
  icon?: string
}

export interface HealthEntry {
  name: string
  status: string
  latencyMs?: number
  port?: number
  depsDown?: boolean
  message?: string
}

export interface SystemMetrics {
  cpu?: { percent: number; used: number; total: number; unit?: string }
  memory?: { percent: number; used: number; total: number; unit?: string }
  disk?: { percent: number; used: number; total: number; unit?: string }
  qps?: number
  p50Latency?: number
  p99Latency?: number
  qpsChange?: number
  p50Change?: number
  p99Change?: number
}

export interface LogEntry {
  time: string
  level: string
  msg: string
  color: string
}

export interface OpsActivity {
  ts: number
  who: string
  action: string
  target: string
  detail: string
}

export interface Incident {
  id?: string
  title?: string
  severity?: string
  status?: string
  createdAt?: string
  message?: string
}

export interface Alert {
  id?: string
  message?: string
  severity?: string
  createdAt?: string
  status?: string
}

export interface OpsUser {
  id: string
  email: string
  username: string
  provider: string
  status: 'active' | 'trial' | 'paused' | 'revoked'
  createdAt: number
  credits: number
}

export interface BillingSummary {
  userId?: string
  balanceCents?: number
  balance?: number
  currency?: string
  updatedAt?: string
  totalRevenue?: number
  totalRecharges?: number
  invoices?: any[]
}

export interface BillingOverview {
  totalRevenue?: number
  totalUsers?: number
  activeSubscriptions?: number
  revenueSeries?: { date: string; value: number }[]
  recentTransactions?: any[]
  balances?: { userId: string; displayName: string; role: string; balanceCents: number; currency: string }[]
}

/* ──────────── Helpers ──────────── */

function getToken(): string {
  return localStorage.getItem('mhw.access_token') ?? ''
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function opsGet<T>(path: string, query?: Record<string, string | number>): Promise<T> {
  let url = `/api/v1/ops${path}`
  if (query) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) params.set(k, String(v))
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }
  const resp = await fetch(url, {
    headers: { Accept: 'application/json', ...authHeaders() },
  })
  if (!resp.ok) throw new Error(`GET ${url} => HTTP ${resp.status}`)
  const json = await resp.json()
  // Unwrap { code, data } envelope if present
  return (json.data !== undefined ? json.data : json) as T
}

async function adminGet<T>(path: string): Promise<T> {
  const url = `/api/v1/admin${path}`
  const resp = await fetch(url, {
    headers: { Accept: 'application/json', ...authHeaders() },
  })
  if (!resp.ok) throw new Error(`GET ${url} => HTTP ${resp.status}`)
  const json = await resp.json()
  return (json.data !== undefined ? json.data : json) as T
}

/* ──────────── Dashboard ──────────── */

export async function fetchOverview(): Promise<OpsOverview> {
  return opsGet<OpsOverview>('/overview')
}

export async function fetchMetrics(): Promise<SystemMetrics> {
  return opsGet<SystemMetrics>('/metrics')
}

export async function fetchRecentLogs(limit = 10): Promise<OpsActivity[]> {
  const data = await opsGet<{ items?: OpsActivity[] } | OpsActivity[]>('/logs', { limit, offset: 0 })
  if (Array.isArray(data)) return data
  return data.items ?? []
}

export async function fetchIncidents(limit = 10): Promise<Incident[]> {
  const data = await opsGet<{ items?: Incident[] } | Incident[]>('/incidents', { limit, offset: 0 })
  if (Array.isArray(data)) return data
  return data.items ?? []
}

/* ──────────── System ──────────── */

export async function fetchServices(): Promise<ServiceInfo[]> {
  const data = await opsGet<ServiceInfo[] | { items: ServiceInfo[] }>('/services')
  if (Array.isArray(data)) return data
  return data.items ?? []
}

export async function fetchHealth(): Promise<HealthEntry[]> {
  const data = await opsGet<HealthEntry[] | { items: HealthEntry[] }>('/health')
  if (Array.isArray(data)) return data
  return data.items ?? []
}

export async function fetchStatus(): Promise<Record<string, unknown>> {
  return opsGet<Record<string, unknown>>('/status')
}

/* ──────────── Monitoring ──────────── */

export async function fetchLiveMetrics(): Promise<SystemMetrics> {
  return opsGet<SystemMetrics>('/metrics/live')
}

export async function fetchMetricsHistory(): Promise<SystemMetrics & { series?: Record<string, any[]> }> {
  return opsGet('/metrics/history')
}

/* ──────────── Logs (full list) ──────────── */

export async function fetchLogs(limit = 200, offset = 0): Promise<{
  items: LogEntry[]
  total?: number
  warnCount?: number
  errorCount?: number
  todayCount?: number
}> {
  const data = await opsGet<{ items: LogEntry[]; total?: number; warnCount?: number; errorCount?: number; todayCount?: number }>('/logs', { limit, offset })
  if (Array.isArray(data)) {
    return { items: data as LogEntry[] }
  }
  return data
}

/* ──────────── Alerts ──────────── */

export async function fetchAlerts(limit = 20, offset = 0): Promise<Alert[]> {
  const data = await opsGet<{ items?: Alert[] } | Alert[]>('/alerts', { limit, offset })
  if (Array.isArray(data)) return data
  return data.items ?? []
}

/* ──────────── Billing ──────────── */

export async function fetchBillingSummary(): Promise<BillingSummary> {
  return adminGet<BillingSummary>('/billing/summary')
}

export async function fetchBillingOverview(): Promise<BillingOverview> {
  return adminGet<BillingOverview>('/billing/overview')
}

/* ──────────── Users ──────────── */

async function usersGet<T>(path: string, query?: Record<string, string | number>): Promise<T> {
  let url = `/api/v1/users${path}`
  if (query) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) params.set(k, String(v))
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }
  const resp = await fetch(url, {
    headers: { Accept: 'application/json', ...authHeaders() },
  })
  if (!resp.ok) throw new Error(`GET ${url} => HTTP ${resp.status}`)
  const json = await resp.json()
  return (json.data !== undefined ? json.data : json) as T
}

export async function fetchUsers(params?: {
  limit?: number
  offset?: number
  search?: string
  provider?: string
  status?: string
}): Promise<{ items: OpsUser[]; total: number }> {
  const query: Record<string, string | number> = {}
  if (params?.limit) query.limit = params.limit
  if (params?.offset) query.offset = params.offset
  if (params?.search) query.search = params.search
  if (params?.provider && params.provider !== 'all') query.provider = params.provider
  if (params?.status && params.status !== 'all') query.status = params.status

  const data = await usersGet<{ items: OpsUser[]; total: number } | OpsUser[]>('', query)
  if (Array.isArray(data)) return { items: data, total: data.length }
  return { items: data.items ?? [], total: (data as any).total ?? (data.items?.length ?? 0) }
}
