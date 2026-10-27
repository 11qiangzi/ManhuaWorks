/**
 * ops.ts — 业务运营 + 合规审计 · API 客户端
 * 对接 user-service /api/v1/ops/* + /api/v1/admin/analytics
 * 保留原接口形状兼容现有 composable/view 层
 */
import { getApi } from '../api-bridge'

export type TimeRange = '7d' | '30d' | '90d' | 'all'

export interface SeriesPoint { date: string; value: number }

export interface UsersOps {
  dau: SeriesPoint[]
  mau: SeriesPoint[]
  newUsers: SeriesPoint[]
  churn: SeriesPoint[]
  active: { id: string; name: string; email: string; lastLogin: string }[]
}

export interface ProjectsOps {
  total: number
  active: number
  conversionRate: number
  topProjects: { id: string; name: string; revenue: number; shots: number }[]
}

export interface RevenueOps {
  gmv: SeriesPoint[]
  subscriptions: { plan: string; count: number; revenue: number }[]
  arpu: number
  refundRate: number
}

export interface TicketsOps {
  pending: number
  avgResponseMin: number
  satisfaction: number
  urgent: { id: string; title: string; user: string; createdAt: string; priority: 'P0' | 'P1' | 'P2' }[]
}

export interface OpsSnapshot {
  users: UsersOps
  projects: ProjectsOps
  revenue: RevenueOps
  tickets: TicketsOps
  range: TimeRange
  generatedAt: string
}

export interface ApiKeyAuditItem {
  id: string
  userId: string
  userName: string
  provider: 'openai' | 'anthropic' | 'google' | 'azure' | 'custom'
  status: 'active' | 'rotated' | 'revoked' | 'suspicious'
  lastChangedAt: string
  ip: string
  suspicious?: boolean
}

export interface DataComplianceItem {
  id: string
  userId: string
  userName: string
  type: 'export' | 'delete' | 'access' | 'portability'
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  framework: 'GDPR' | 'CCPA' | 'PIPL' | 'LGPD'
  requestedAt: string
}

export interface SystemAuditItem {
  id: string
  actor: string
  action: 'admin.login' | 'admin.logout' | 'admin.permission' | 'config.change' | 'auth.failed'
  target: string
  level: 'info' | 'warn' | 'error'
  ts: string
  ip: string
}

export interface ComplianceSnapshot {
  apiKeys: ApiKeyAuditItem[]
  dataRequests: DataComplianceItem[]
  systemAudits: SystemAuditItem[]
  totals: {
    byokCount: number
    exportRequests: number
    deleteRequests: number
    gdprPending: number
    ccpaPending: number
    loginFailures24h: number
    permissionChanges: number
  }
  generatedAt: string
}

// =========================================================
// HTTP helper
// =========================================================

const http = () => getApi().http

// =========================================================
// opsApi — 真实后端调用
// =========================================================

export const opsApi = {

  async getSnapshot(range: TimeRange = '30d'): Promise<OpsSnapshot> {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 180

    // Parallel fetch from multiple backend endpoints
    const [overview, analytics, revenue, incidents, content] = await Promise.allSettled([
      http().get('/ops/overview') as Promise<any>,
      http().get('/admin/analytics') as Promise<any>,
      http().get('/admin/dashboard/revenue', { days }) as Promise<any>,
      http().get('/ops/incidents', { limit: 20, status: 'open' }) as Promise<any>,
      http().get('/admin/content', { limit: 10 }) as Promise<any>,
    ])

    const ov = overview.status === 'fulfilled' ? overview.value : {}
    const an = analytics.status === 'fulfilled' ? analytics.value : {}
    const rv = revenue.status === 'fulfilled' ? revenue.value : {}
    const inc = incidents.status === 'fulfilled' ? incidents.value : {}
    const ct = content.status === 'fulfilled' ? content.value : {}

    // Users: from analytics.userGrowth
    const growth = an?.userGrowth || []
    const usersOps: UsersOps = {
      dau: growth.slice(-days).map((d: any) => ({ date: (d.date || '').slice(5, 10), value: d.activeUsers ?? d.value ?? 0 })),
      mau: [],
      newUsers: growth.slice(-days).map((d: any) => ({ date: (d.date || '').slice(5, 10), value: d.newUsers ?? 0 })),
      churn: [],
      active: [],
    }

    // Projects: from overview
    const projectsOps: ProjectsOps = {
      total: ov?.projects?.total ?? 0,
      active: ov?.projects?.active ?? 0,
      conversionRate: 0,
      topProjects: [],
    }

    // Revenue: from dashboard/revenue
    const daily = rv?.daily || []
    const planDist = an?.planDistribution || {}
    const totalPaying = Object.entries(planDist)
      .filter(([k]) => k !== 'free')
      .reduce((sum, [, v]) => sum + (v as number), 0)
    const revenueOps: RevenueOps = {
      gmv: daily.map((d: any) => ({ date: (d.date || '').slice(5, 10), value: d.value ?? 0 })),
      subscriptions: Object.entries(planDist).map(([plan, count]) => ({
        plan: plan.charAt(0).toUpperCase() + plan.slice(1),
        count: count as number,
        revenue: 0,
      })),
      arpu: totalPaying > 0 ? Math.round((ov?.revenue?.total ?? 0) / totalPaying) : 0,
      refundRate: 0,
    }

    // Tickets: from incidents
    const incidentItems = inc?.items || (Array.isArray(inc) ? inc : [])
    const ticketsOps: TicketsOps = {
      pending: incidentItems.filter((i: any) => i.status === 'open').length,
      avgResponseMin: 0,
      satisfaction: 0,
      urgent: incidentItems
        .filter((i: any) => i.severity === 'critical' || i.severity === 'major')
        .slice(0, 10)
        .map((i: any) => ({
          id: i.id,
          title: i.title || i.description || '',
          user: i.reporter || '',
          createdAt: i.createdAt || i.created_at || '',
          priority: i.severity === 'critical' ? 'P0' as const : i.severity === 'major' ? 'P1' as const : 'P2' as const,
        })),
    }

    return {
      users: usersOps,
      projects: projectsOps,
      revenue: revenueOps,
      tickets: ticketsOps,
      range,
      generatedAt: new Date().toISOString(),
    }
  },

  async getCompliance(): Promise<ComplianceSnapshot> {
    // Compliance data has limited backend support
    // Use audit-logs for system audit entries
    let auditItems: SystemAuditItem[] = []
    try {
      const res = await http().get('/admin/audit-logs', { limit: 50 }) as any
      const items = res?.items || (Array.isArray(res) ? res : [])
      auditItems = items.map((l: any) => ({
        id: l.id,
        actor: l.actor || l.user_id || l.display_name || '',
        action: (l.action || 'config.change') as SystemAuditItem['action'],
        target: l.target || l.resource || '',
        level: l.level || 'info',
        ts: l.created_at || l.ts || '',
        ip: l.ip || l.ip_address || '',
      }))
    } catch { /* no audit logs available */ }

    return {
      apiKeys: [],
      dataRequests: [],
      systemAudits: auditItems,
      totals: {
        byokCount: 0,
        exportRequests: 0,
        deleteRequests: 0,
        gdprPending: 0,
        ccpaPending: 0,
        loginFailures24h: 0,
        permissionChanges: auditItems.filter(a => a.action === 'admin.permission').length,
      },
      generatedAt: new Date().toISOString(),
    }
  },
}
