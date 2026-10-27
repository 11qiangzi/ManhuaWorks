/**
 * composables/ops.ts —业务运营 + 合规 composable
 * 千机工坊 · M1-W3 L3.K
 *
 * useOps()
 * -4 大模块12 数据点
 * -2.5s 超时 +失败回退 mock
 * -10s 自动刷新（可关闭）
 *
 * useCompliance()
 * -3 大模块汇总 + 总览数字
 * -2.5s 超时 +失败回退 mock
 */

import { ref, computed, onUnmounted } from 'vue'
import {
 opsApi,
 type TimeRange,
 type OpsSnapshot,
 type ComplianceSnapshot,
} from '@/api/ops'

const TIMEOUT_MS =2500

/** 超时 +失败回退 */
async function withTimeout<T>(p: Promise<T>, fallback: T, ms = TIMEOUT_MS): Promise<T> {
 let timer: ReturnType<typeof setTimeout> | null = null
 try {
 const out = await Promise.race<T>([
 p,
 new Promise<T>((_, reject) => {
 timer = setTimeout(() => reject(new Error('timeout')), ms)
 }),
 ])
 return out
 } catch {
 return fallback
 } finally {
 if (timer) clearTimeout(timer)
 }
}

/* ============================================================== *
 * useOps —4 大模块12 数据点
 * ============================================================== */

export interface UseOpsReturn {
 snapshot: ReturnType<typeof ref<OpsSnapshot | null>>
 loading: ReturnType<typeof ref<boolean>>
 error: ReturnType<typeof ref<string | null>>
 range: ReturnType<typeof ref<TimeRange>>
 load: (r?: TimeRange) => Promise<void>
 refresh: () => Promise<void>
 startAutoRefresh: (intervalMs?: number) => void
 stopAutoRefresh: () => void

 //12 个数据点 (computed暴露)
 dau: ReturnType<typeof computed<OpsSnapshot['users']['dau']>>
 mau: ReturnType<typeof computed<OpsSnapshot['users']['mau']>>
 newUsers: ReturnType<typeof computed<OpsSnapshot['users']['newUsers']>>
 churn: ReturnType<typeof computed<OpsSnapshot['users']['churn']>>
 activeUsers: ReturnType<typeof computed<OpsSnapshot['users']['active']>>
 projectsTotal: ReturnType<typeof computed<number>>
 projectsActive: ReturnType<typeof computed<number>>
 conversionRate: ReturnType<typeof computed<number>>
 topProjects: ReturnType<typeof computed<OpsSnapshot['projects']['topProjects']>>
 gmv: ReturnType<typeof computed<OpsSnapshot['revenue']['gmv']>>
 subscriptions: ReturnType<typeof computed<OpsSnapshot['revenue']['subscriptions']>>
 arpu: ReturnType<typeof computed<number>>
 refundRate: ReturnType<typeof computed<number>>
 ticketsPending: ReturnType<typeof computed<number>>
 avgResponseMin: ReturnType<typeof computed<number>>
 satisfaction: ReturnType<typeof computed<number>>
 urgentTickets: ReturnType<typeof computed<OpsSnapshot['tickets']['urgent']>>
}

export function useOps(): UseOpsReturn {
 const snapshot = ref<OpsSnapshot | null>(null)
 const loading = ref(false)
 const error = ref<string | null>(null)
 const range = ref<TimeRange>('30d')

 let autoTimer: ReturnType<typeof setInterval> | null = null

 async function load(r?: TimeRange): Promise<void> {
 if (r) range.value = r
 loading.value = true
 error.value = null
 const fallback: OpsSnapshot = {
 users: { dau: [], mau: [], newUsers: [], churn: [], active: [] },
 projects: { total:0, active:0, conversionRate:0, topProjects: [] },
 revenue: { gmv: [], subscriptions: [], arpu:0, refundRate:0 },
 tickets: { pending:0, avgResponseMin:0, satisfaction:0, urgent: [] },
 range: range.value,
 generatedAt: new Date().toISOString(),
 }
 try {
 snapshot.value = await withTimeout(opsApi.getSnapshot(range.value), fallback)
 } catch (e) {
 error.value = e instanceof Error ? e.message : 'load failed'
 snapshot.value = fallback
 } finally {
 loading.value = false
 }
 }

 async function refresh(): Promise<void> {
 const fallback: OpsSnapshot = {
 users: { dau: [], mau: [], newUsers: [], churn: [], active: [] },
 projects: { total:0, active:0, conversionRate:0, topProjects: [] },
 revenue: { gmv: [], subscriptions: [], arpu:0, refundRate:0 },
 tickets: { pending:0, avgResponseMin:0, satisfaction:0, urgent: [] },
 range: range.value,
 generatedAt: new Date().toISOString(),
 }
 snapshot.value = await withTimeout(opsApi.getSnapshot(range.value), fallback)
 }

 function startAutoRefresh(intervalMs =10000): void {
 stopAutoRefresh()
 autoTimer = setInterval(() => { void refresh() }, intervalMs)
 }

 function stopAutoRefresh(): void {
 if (autoTimer) {
 clearInterval(autoTimer)
 autoTimer = null
 }
 }

 onUnmounted(stopAutoRefresh)

 const dau = computed(() => snapshot.value?.users.dau ?? [])
 const mau = computed(() => snapshot.value?.users.mau ?? [])
 const newUsers = computed(() => snapshot.value?.users.newUsers ?? [])
 const churn = computed(() => snapshot.value?.users.churn ?? [])
 const activeUsers = computed(() => snapshot.value?.users.active ?? [])
 const projectsTotal = computed(() => snapshot.value?.projects.total ??0)
 const projectsActive = computed(() => snapshot.value?.projects.active ??0)
 const conversionRate = computed(() => snapshot.value?.projects.conversionRate ??0)
 const topProjects = computed(() => snapshot.value?.projects.topProjects ?? [])
 const gmv = computed(() => snapshot.value?.revenue.gmv ?? [])
 const subscriptions = computed(() => snapshot.value?.revenue.subscriptions ?? [])
 const arpu = computed(() => snapshot.value?.revenue.arpu ??0)
 const refundRate = computed(() => snapshot.value?.revenue.refundRate ??0)
 const ticketsPending = computed(() => snapshot.value?.tickets.pending ??0)
 const avgResponseMin = computed(() => snapshot.value?.tickets.avgResponseMin ??0)
 const satisfaction = computed(() => snapshot.value?.tickets.satisfaction ??0)
 const urgentTickets = computed(() => snapshot.value?.tickets.urgent ?? [])

 return {
 snapshot, loading, error, range, load, refresh, startAutoRefresh, stopAutoRefresh,
 dau, mau, newUsers, churn, activeUsers,
 projectsTotal, projectsActive, conversionRate, topProjects,
 gmv, subscriptions, arpu, refundRate,
 ticketsPending, avgResponseMin, satisfaction, urgentTickets,
 }
}

/* ============================================================== *
 * useCompliance —3 大模块
 * ============================================================== */

export interface UseComplianceReturn {
 snapshot: ReturnType<typeof ref<ComplianceSnapshot | null>>
 loading: ReturnType<typeof ref<boolean>>
 error: ReturnType<typeof ref<string | null>>
 load: () => Promise<void>

 apiKeys: ReturnType<typeof computed<ComplianceSnapshot['apiKeys']>>
 dataRequests: ReturnType<typeof computed<ComplianceSnapshot['dataRequests']>>
 systemAudits: ReturnType<typeof computed<ComplianceSnapshot['systemAudits']>>
 totals: ReturnType<typeof computed<ComplianceSnapshot['totals']>>
}

export function useCompliance(): UseComplianceReturn {
 const snapshot = ref<ComplianceSnapshot | null>(null)
 const loading = ref(false)
 const error = ref<string | null>(null)

 async function load(): Promise<void> {
 loading.value = true
 error.value = null
 const fallback: ComplianceSnapshot = {
 apiKeys: [], dataRequests: [], systemAudits: [],
 totals: {
 byokCount:0, exportRequests:0, deleteRequests:0,
 gdprPending:0, ccpaPending:0, loginFailures24h:0, permissionChanges:0,
 },
 generatedAt: new Date().toISOString(),
 }
 try {
 snapshot.value = await withTimeout(opsApi.getCompliance(), fallback)
 } catch (e) {
 error.value = e instanceof Error ? e.message : 'load failed'
 snapshot.value = fallback
 } finally {
 loading.value = false
 }
 }

 const apiKeys = computed(() => snapshot.value?.apiKeys ?? [])
 const dataRequests = computed(() => snapshot.value?.dataRequests ?? [])
 const systemAudits = computed(() => snapshot.value?.systemAudits ?? [])
 const totals = computed(() => snapshot.value?.totals ?? {
 byokCount:0, exportRequests:0, deleteRequests:0,
 gdprPending:0, ccpaPending:0, loginFailures24h:0, permissionChanges:0,
 })

 return { snapshot, loading, error, load, apiKeys, dataRequests, systemAudits, totals }
}
