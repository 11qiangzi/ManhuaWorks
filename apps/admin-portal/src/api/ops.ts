/**
 * ops.ts —业务运营 + 合规审计 · 本地 mock 数据
 * ManhuaWorks · M1-W3 L3.K
 *
 * 不连真后端（api-client 没有 ops / compliance 模块）。
 * composables/ops.ts 调用这里，2.5s 超时，失败回退 mock。
 */

export type TimeRange = '7d' | '30d' | '90d' | 'all'

/* ============================================================== *
 * Ops 数据类型 —4 大模块12 数据点
 * ============================================================== */

export interface SeriesPoint { date: string; value: number }

/** 用户运营 (3) */
export interface UsersOps {
 dau: SeriesPoint[]   //1. DAU折线
 mau: SeriesPoint[]   //2. MAU折线
 newUsers: SeriesPoint[] //3. 新增
 churn: SeriesPoint[]    //4.流失
 active: { id: string; name: string; email: string; lastLogin: string }[] //活跃用户列表
}

/** 项目运营 (3) */
export interface ProjectsOps {
 total: number //1. 总数
 active: number //2.活跃
 conversionRate: number //3.付费转化率（%）
 topProjects: { id: string; name: string; revenue: number; shots: number }[] //4.头部 TOP10
}

/**收入运营 (3) */
export interface RevenueOps {
 gmv: SeriesPoint[]   //1. GMV折线
 subscriptions: { plan: string; count: number; revenue: number }[] //2.订阅分饼
 arpu: number //3. ARPU
 refundRate: number //4.退款率（%）
}

/** 工单运营 (3) */
export interface TicketsOps {
 pending: number //1. 未处理
 avgResponseMin: number //2. 平均响应时间（分钟）
 satisfaction: number //3.满意度（%）
 urgent: { id: string; title: string; user: string; createdAt: string; priority: 'P0' | 'P1' | 'P2' }[] //4.紧急列表
}

export interface OpsSnapshot {
 users: UsersOps
 projects: ProjectsOps
 revenue: RevenueOps
 tickets: TicketsOps
 range: TimeRange
 generatedAt: string
}

/* ============================================================== *
 * Compliance 数据类型 —3 大模块
 * ============================================================== */

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

/* ============================================================== *
 * Mock 生成器
 * ============================================================== */

const NAMES = ['林启', '林染', '梁总', '阿白', '小鱼', '老王', '阿熊', '小七', '墨轩', '苏白']
const PROJECTS = ['灰星1500 章', '星海30 章', '山海卷', '云中歌', '破晓', '深渊回响', '浮生若梦', '夜行者', '云顶天宫', '机械黎明']

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function rid(p: string): string { return p + Math.random().toString(36).slice(2,9) }
function isoMinus(days: number): string { return new Date(Date.now() - days *86400000).toISOString() }

function genSeries(days: number, min: number, max: number): SeriesPoint[] {
 return Array.from({ length: days }, (_, i) => ({
 date: new Date(Date.now() - (days -1 - i) *86400000).toISOString().slice(5,10),
 value: Math.floor(min + Math.random() * (max - min)),
 }))
}

function genOpsSnapshot(range: TimeRange): OpsSnapshot {
 const span = range === '7d' ?7 : range === '30d' ?30 : range === '90d' ?90 :180
 return {
 users: {
 dau: genSeries(span,80,240),
 mau: genSeries(Math.min(span,60),480,1280),
 newUsers: genSeries(span,5,60),
 churn: genSeries(span,2,22),
 active: Array.from({ length:12 }, () => ({
 id: rid('u_'),
 name: rand(NAMES),
 email: `${rand(NAMES).toLowerCase().replace(/\s/g, '')}@example.com`,
 lastLogin: isoMinus(Math.random() *5),
 })),
 },
 projects: {
 total:1284 + Math.floor(Math.random() *40),
 active:462 + Math.floor(Math.random() *20),
 conversionRate: +(18 + Math.random() *6).toFixed(1),
 topProjects: Array.from({ length:10 }, (_, i) => ({
 id: rid('p_'),
 name: PROJECTS[i] ?? `项目 ${i +1}`,
 revenue: Math.floor(8000 + Math.random() *60000),
 shots: Math.floor(20 + Math.random() *220),
 })).sort((a, b) => b.revenue - a.revenue),
 },
 revenue: {
 gmv: genSeries(span,12000,48000),
 subscriptions: [
 { plan: 'Free', count:968, revenue:0 },
 { plan: 'Pro', count:312, revenue:62400 },
 { plan: 'Studio', count:58, revenue:92000 },
 { plan: 'Enterprise', count:12, revenue:138000 },
 ],
 arpu: +(140 + Math.random() *30).toFixed(1),
 refundRate: +(1.4 + Math.random() *1.2).toFixed(1),
 },
 tickets: {
 pending:12 + Math.floor(Math.random() *8),
 avgResponseMin: +(8 + Math.random() *12).toFixed(1),
 satisfaction: +(86 + Math.random() *8).toFixed(1),
 urgent: [
 { id: rid('t_'), title: 'AI 出图失败 (P0)', user: rand(NAMES), createdAt: isoMinus(0.02), priority: 'P0' },
 { id: rid('t_'), title: 'Pro订阅无法升级', user: rand(NAMES), createdAt: isoMinus(0.4), priority: 'P1' },
 { id: rid('t_'), title: '导出4K 卡死', user: rand(NAMES), createdAt: isoMinus(1.2), priority: 'P1' },
 { id: rid('t_'), title: 'BYOK Key 无效提示', user: rand(NAMES), createdAt: isoMinus(2.1), priority: 'P2' },
 ],
 },
 range,
 generatedAt: new Date().toISOString(),
 }
}

function genComplianceSnapshot(): ComplianceSnapshot {
 const byokCount =218 + Math.floor(Math.random() *30)
 return {
 apiKeys: Array.from({ length:24 }, () => ({
 id: rid('key_'),
 userId: rid('u_'),
 userName: rand(NAMES),
 provider: rand(['openai', 'anthropic', 'google', 'azure', 'custom'] as const),
 status: rand(['active', 'active', 'active', 'rotated', 'revoked', 'suspicious'] as const),
 lastChangedAt: isoMinus(Math.random() *14),
 ip: `10.0.${Math.floor(Math.random() *255)}.${Math.floor(Math.random() *255)}`,
 suspicious: Math.random() >0.85,
 })),
 dataRequests: Array.from({ length:18 }, () => ({
 id: rid('req_'),
 userId: rid('u_'),
 userName: rand(NAMES),
 type: rand(['export', 'delete', 'access', 'portability'] as const),
 status: rand(['pending', 'in_progress', 'completed', 'failed'] as const),
 framework: rand(['GDPR', 'CCPA', 'PIPL', 'LGPD'] as const),
 requestedAt: isoMinus(Math.random() *30),
 })),
 systemAudits: Array.from({ length:30 }, () => ({
 id: rid('aud_'),
 actor: rand(NAMES),
 action: rand(['admin.login', 'admin.logout', 'admin.permission', 'config.change', 'auth.failed'] as const),
 target: rid('tgt_'),
 level: rand(['info', 'info', 'info', 'warn', 'error'] as const),
 ts: isoMinus(Math.random() *7),
 ip: `192.168.${Math.floor(Math.random() *255)}.${Math.floor(Math.random() *255)}`,
 })),
 totals: {
 byokCount,
 exportRequests:24 + Math.floor(Math.random() *12),
 deleteRequests:8 + Math.floor(Math.random() *6),
 gdprPending:5 + Math.floor(Math.random() *4),
 ccpaPending:3 + Math.floor(Math.random() *3),
 loginFailures24h:6 + Math.floor(Math.random() *8),
 permissionChanges:12 + Math.floor(Math.random() *6),
 },
 generatedAt: new Date().toISOString(),
 }
}

/* ============================================================== *
 *假延迟 + mock
 * ============================================================== */

function delay<T>(value: T, ms =120): Promise<T> {
 return new Promise((res) => setTimeout(() => res(value), ms))
}

export const opsApi = {
 getSnapshot(range: TimeRange = '30d'): Promise<OpsSnapshot> {
 return delay(genOpsSnapshot(range))
 },
 getCompliance(): Promise<ComplianceSnapshot> {
 return delay(genComplianceSnapshot())
 },
}
