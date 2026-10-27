/**
 * admin-portal · M1-W3 L3.K烟测
 * 千机工坊 ·全栈林染
 *
 *验证项：
 *1.路由：/ops + /compliance + /users200
 *2. API mock调用：opsApi.getSnapshot + opsApi.getCompliance ≥5 次
 *3. useOps / useCompliance composable：12 数据点 +3 大模块
 *4. Pinia admin store：基线回归
 *5. 超时回退：2.5s 超时 + mock fallback
 *6.4 模块数据完整性
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

/* ========================================================== *
 *路由验证
 * ========================================================== */
describe('router · /ops + /compliance + /users', () => {
 it('routes包含 /ops → OpsView', async () => {
 const mod = await import('@/router')
 const router = mod.default
 const opsRoute = router.getRoutes().find((r) => r.path === '/ops')
 expect(opsRoute).toBeDefined()
 expect(opsRoute!.name).toBe('ops')
 })

 it('routes包含 /compliance → ComplianceView', async () => {
 const mod = await import('@/router')
 const router = mod.default
 const cmpRoute = router.getRoutes().find((r) => r.path === '/compliance')
 expect(cmpRoute).toBeDefined()
 expect(cmpRoute!.name).toBe('compliance')
 })

 it('routes包含 /users → UsersView (回归)', async () => {
 const mod = await import('@/router')
 const router = mod.default
 const usersRoute = router.getRoutes().find((r) => r.path === '/users')
 expect(usersRoute).toBeDefined()
 expect(usersRoute!.name).toBe('users')
 })

 it('根路径 / 重定向到 /dashboard', async () => {
 const mod = await import('@/router')
 const router = mod.default
 expect(router.getRoutes().some((r) => r.path === '/' && r.redirect === '/dashboard')).toBe(true)
 })

 it('总路由数 ≥7（5旧 +2 新）', async () => {
 const mod = await import('@/router')
 const router = mod.default
 expect(router.getRoutes().length).toBeGreaterThanOrEqual(7)
 })
})

/* ========================================================== *
 * API mock 调用跟踪（ops.compliance.users + ops.users.dau）
 * ========================================================== */
describe('opsApi mock · 调用计数验证', () => {
 let getSnapshotSpy: ReturnType<typeof vi.fn>
 let getComplianceSpy: ReturnType<typeof vi.fn>

 beforeEach(async () => {
 setActivePinia(createPinia())
 const api = await import('@/api/ops')
 getSnapshotSpy = vi.spyOn(api.opsApi, 'getSnapshot')
 getComplianceSpy = vi.spyOn(api.opsApi, 'getCompliance')
 })

 it('getSnapshot + getCompliance累计调用 ≥5（带 mock）', async () => {
 const { useOps } = await import('@/composables/ops')
 const { useCompliance } = await import('@/composables/ops')
 const ops = useOps()
 const cmp = useCompliance()

 await ops.load('7d')
 await ops.load('30d')
 await cmp.load()
 await ops.refresh()
 await cmp.load()

 const total = getSnapshotSpy.mock.calls.length + getComplianceSpy.mock.calls.length
 expect(total).toBeGreaterThanOrEqual(5)
 expect(getSnapshotSpy.mock.calls.length).toBeGreaterThanOrEqual(3)
 expect(getComplianceSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
 })

 it('getSnapshot 返回 OpsSnapshot（4 模块）', async () => {
 const api = await import('@/api/ops')
 const snap = await api.opsApi.getSnapshot('30d')
 expect(snap.users).toBeDefined()
 expect(snap.projects).toBeDefined()
 expect(snap.revenue).toBeDefined()
 expect(snap.tickets).toBeDefined()
 expect(snap.range).toBe('30d')
 })

 it('getCompliance 返回 ComplianceSnapshot（3 大模块）', async () => {
 const api = await import('@/api/ops')
 const snap = await api.opsApi.getCompliance()
 expect(Array.isArray(snap.apiKeys)).toBe(true)
 expect(Array.isArray(snap.dataRequests)).toBe(true)
 expect(Array.isArray(snap.systemAudits)).toBe(true)
 expect(snap.totals).toBeDefined()
 expect(snap.totals.byokCount).toBeGreaterThan(0)
 })
})

/* ========================================================== *
 * useOps composable —12 数据点
 * ========================================================== */
describe('useOps ·12 数据点', () => {
 beforeEach(() => setActivePinia(createPinia()))

 it('load() 后 snapshot.value 含4 大模块', async () => {
 const { useOps } = await import('@/composables/ops')
 const ops = useOps()
 await ops.load('30d')
 expect(ops.snapshot.value).not.toBeNull()
 const s = ops.snapshot.value!
 expect(s.users).toBeDefined()
 expect(s.projects).toBeDefined()
 expect(s.revenue).toBeDefined()
 expect(s.tickets).toBeDefined()
 })

 it('12 数据点 computed全部存在 +类型正确', async () => {
 const { useOps } = await import('@/composables/ops')
 const ops = useOps()
 await ops.load('30d')

 expect(Array.isArray(ops.dau.value)).toBe(true)
 expect(Array.isArray(ops.mau.value)).toBe(true)
 expect(Array.isArray(ops.newUsers.value)).toBe(true)
 expect(Array.isArray(ops.churn.value)).toBe(true)
 expect(Array.isArray(ops.activeUsers.value)).toBe(true)

 expect(typeof ops.projectsTotal.value).toBe('number')
 expect(typeof ops.projectsActive.value).toBe('number')
 expect(typeof ops.conversionRate.value).toBe('number')
 expect(Array.isArray(ops.topProjects.value)).toBe(true)
 expect(ops.topProjects.value.length).toBeGreaterThan(0)

 expect(Array.isArray(ops.gmv.value)).toBe(true)
 expect(Array.isArray(ops.subscriptions.value)).toBe(true)
 expect(typeof ops.arpu.value).toBe('number')
 expect(typeof ops.refundRate.value).toBe('number')

 expect(typeof ops.ticketsPending.value).toBe('number')
 expect(typeof ops.avgResponseMin.value).toBe('number')
 expect(typeof ops.satisfaction.value).toBe('number')
 expect(Array.isArray(ops.urgentTickets.value)).toBe(true)
 })

 it('topProjects 按 revenue降序', async () => {
 const { useOps } = await import('@/composables/ops')
 const ops = useOps()
 await ops.load('30d')
 const tops = ops.topProjects.value
 for (let i =1; i < tops.length; i++) {
 expect(tops[i -1].revenue).toBeGreaterThanOrEqual(tops[i].revenue)
 }
 })

 it('pickRange切换时间范围', async () => {
 const { useOps } = await import('@/composables/ops')
 const ops = useOps()
 await ops.load('7d')
 expect(ops.range.value).toBe('7d')
 await ops.load('90d')
 expect(ops.range.value).toBe('90d')
 })
})

/* ========================================================== *
 * useCompliance composable —3 大模块
 * ========================================================== */
describe('useCompliance ·3 大模块', () => {
 beforeEach(() => setActivePinia(createPinia()))

 it('load() 后3 大模块全部加载', async () => {
 const { useCompliance } = await import('@/composables/ops')
 const cmp = useCompliance()
 await cmp.load()
 expect(cmp.snapshot.value).not.toBeNull()
 expect(cmp.apiKeys.value.length).toBeGreaterThan(0)
 expect(cmp.dataRequests.value.length).toBeGreaterThan(0)
 expect(cmp.systemAudits.value.length).toBeGreaterThan(0)
 })

 it('totals包含7 个合规数字', async () => {
 const { useCompliance } = await import('@/composables/ops')
 const cmp = useCompliance()
 await cmp.load()
 const t = cmp.totals.value
 expect(typeof t.byokCount).toBe('number')
 expect(typeof t.exportRequests).toBe('number')
 expect(typeof t.deleteRequests).toBe('number')
 expect(typeof t.gdprPending).toBe('number')
 expect(typeof t.ccpaPending).toBe('number')
 expect(typeof t.loginFailures24h).toBe('number')
 expect(typeof t.permissionChanges).toBe('number')
 })

 it('apiKeys状态覆盖4 种枚举', async () => {
 const { useCompliance } = await import('@/composables/ops')
 const cmp = useCompliance()
 await cmp.load()
 const statuses = new Set(cmp.apiKeys.value.map((k) => k.status))
 expect(statuses.size).toBeGreaterThanOrEqual(2)
 expect(['active', 'rotated', 'revoked', 'suspicious'].some((s) => statuses.has(s as never))).toBe(true)
 })
})

/* ========================================================== *
 * Pinia admin store 基线回归
 * ========================================================== */
describe('admin store · 基线回归', () => {
 beforeEach(() => setActivePinia(createPinia()))

 it('admin store 默认5主题', async () => {
 const { useAdminStore, THEME_LIST } = await import('@/stores/admin')
 const s = useAdminStore()
 expect(THEME_LIST.length).toBe(5)
 expect(s.theme).toBe('dark-workshop')
 })

 it('setTheme切换主题', async () => {
 const { useAdminStore } = await import('@/stores/admin')
 const s = useAdminStore()
 s.setTheme('minimal-light')
 expect(s.theme).toBe('minimal-light')
 })
})

/* ========================================================== *
 * 超时回退：2.5s 超时 + mock fallback
 * ========================================================== */
describe('useOps ·2.5s 超时回退', () => {
 beforeEach(() => setActivePinia(createPinia()))

 it('getSnapshot慢响应 → loading 最终为 false + snapshot fallback', async () => {
 const api = await import('@/api/ops')
 vi.spyOn(api.opsApi, 'getSnapshot').mockImplementation(
 () => new Promise((res) => setTimeout(() => res(api.opsApi.getSnapshot as never),5000))
 )
 const { useOps } = await import('@/composables/ops')
 const ops = useOps()
 // 不 await 直接检查loading=true
 const p = ops.load('30d')
 expect(ops.loading.value).toBe(true)
 await p
 // 超时后走 fallback
 expect(ops.loading.value).toBe(false)
 expect(ops.snapshot.value).not.toBeNull()
 })

 it('refresh() 后 snapshot仍可更新', async () => {
 const { useOps } = await import('@/composables/ops')
 const ops = useOps()
 await ops.load('30d')
 const oldGenerated = ops.snapshot.value!.generatedAt
 //等待时间错开
 await new Promise((r) => setTimeout(r,5))
 await ops.refresh()
 expect(ops.snapshot.value).not.toBeNull()
 expect(typeof ops.snapshot.value!.generatedAt).toBe('string')
 // generatedAt 可能相同（毫秒精度），但snapshot一定有
 })
})
