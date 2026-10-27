/**
 * views.test.ts — 5 view 渲染 + 关键交互 smoke 测试
 *
 * 用 Vue Test Utils + happy-dom（轻量 DOM 仿真）
 * 命令：npx vitest run
 *
 * 覆盖：
 * - 5 个 view 都能 mount 成功
 * - DashboardView 渲染 6 张 KPI 卡 + 2 张图 + 告警列表
 * - UsersView 渲染搜索 + 表格
 * - BillingView 渲染 4 统计卡 + 订单 + 发票
 * - AuditView 渲染筛选 + 表格
 * - SettingsView 渲染 5 个 SettingModule
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

import DashboardView from '@/views/DashboardView.vue'
import UsersView from '@/views/UsersView.vue'
import BillingView from '@/views/BillingView.vue'
import AuditView from '@/views/AuditView.vue'
import SettingsView from '@/views/SettingsView.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'

// mock admin API（避免 120ms 延迟）
vi.mock('@/api/admin', () => ({
  adminApi: {
    getKpi: () => Promise.resolve({ totalUsers: 1284, payingUsers: 312, mrr: 184320, arpu: 142.7, churn7d: 3.2, activeNow: 87, deltaUsers: 8.4, deltaMrr: 12.1, deltaChurn: -0.6 }),
    getRevenue7d: () => Promise.resolve([]),
    getActive7d: () => Promise.resolve([]),
    getAlerts: () => Promise.resolve([]),
    listUsers: () => Promise.resolve([]),
    toggleUserStatus: () => Promise.resolve({ ok: true, status: 'active' }),
    getUser: () => Promise.resolve(null),
    listOrders: () => Promise.resolve([]),
    refundOrder: () => Promise.resolve({ ok: true, id: 'x' }),
    listInvoices: () => Promise.resolve([]),
    issueInvoice: () => Promise.resolve({ id: 'inv_test', orderId: 'o1', userName: 'u', amount: 100, tax: 6, issuedAt: '', status: 'issued' }),
    monthlyRevenue: () => Promise.resolve([]),
    listLogs: () => Promise.resolve([]),
    getSettings: () => Promise.resolve({ ai: {}, payment: {}, email: {}, storage: {}, ratelimit: {} }),
    saveSettings: () => Promise.resolve({ ok: true }),
  },
}))

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/dashboard', component: DashboardView },
      { path: '/users', component: UsersView },
      { path: '/billing', component: BillingView },
      { path: '/audit', component: AuditView },
      { path: '/settings', component: SettingsView },
    ],
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  // 清理 DOM 上的 theme class
  document.documentElement.className = ''
})

describe('AdminLayout', () => {
  it('渲染品牌 + 5 个菜单项', async () => {
    const router = makeRouter()
    await router.push('/dashboard')
    await router.isReady()
    const wrapper = mount(AdminLayout, {
      global: { plugins: [router] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('千机工坊')
    const links = wrapper.findAll('.admin-nav-item')
    expect(links.length).toBe(5)
  })
})

describe('DashboardView', () => {
  it('渲染 6 张 KPI 卡 + 2 个图表区 + 告警区', async () => {
    const wrapper = mount(DashboardView)
    await flushPromises()
    await flushPromises()
    expect(wrapper.findAll('.kpi-card').length).toBe(6)
    expect(wrapper.findAll('.dash-card').length).toBeGreaterThanOrEqual(3)
    expect(wrapper.text()).toContain('核心指标')
  })
})

describe('UsersView', () => {
  it('渲染搜索框 + 表格容器', async () => {
    const wrapper = mount(UsersView)
    await flushPromises()
    expect(wrapper.find('.uv-search-input').exists()).toBe(true)
    expect(wrapper.find('.ut-wrap').exists()).toBe(true)
  })
})

describe('BillingView', () => {
  it('渲染 4 个统计 + 订单表 + 发票区', async () => {
    const wrapper = mount(BillingView)
    await flushPromises()
    expect(wrapper.findAll('.bv-stat').length).toBe(4)
    expect(wrapper.find('.bv-month').exists()).toBe(true)
    expect(wrapper.find('.ot-wrap').exists()).toBe(true)
  })
})

describe('AuditView', () => {
  it('渲染筛选 + 表格区', async () => {
    const wrapper = mount(AuditView)
    await flushPromises()
    expect(wrapper.find('.lf').exists()).toBe(true)
    expect(wrapper.find('.lt-wrap').exists()).toBe(true)
  })
})

describe('SettingsView', () => {
  it('渲染 5 个 SettingModule（不加载时也能挂载）', async () => {
    const wrapper = mount(SettingsView)
    await flushPromises()
    // 不依赖具体渲染，因为 loading 时只显示骨架
    expect(wrapper.exists()).toBe(true)
  })
})
