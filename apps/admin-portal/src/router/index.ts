/**
 * admin-portal路由 — 派单 33C: +projects +logs
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { createAuthGuard } from '@manhuaworks/api-client'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '仪表盘', icon: '📊' } },
      { path: 'users', name: 'users', component: () => import('@/views/UsersView.vue'), meta: { title: '用户管理', icon: '👥' } },
      { path: 'billing', name: 'billing', component: () => import('@/views/BillingView.vue'), meta: { title: '计费管理', icon: '💳' } },
      { path: 'audit', name: 'audit', component: () => import('@/views/AuditView.vue'), meta: { title: '审计日志', icon: '📜' } },
      { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { title: '系统设置', icon: '⚙️' } },
      { path: 'ops', name: 'ops', component: () => import('@/views/OpsView.vue'), meta: { title: '业务运营', icon: '📈' } },
      { path: 'compliance', name: 'compliance', component: () => import('@/views/ComplianceView.vue'), meta: { title: '合规审计', icon: '🛡️' } },
      // 🆕 派单 33C
      { path: 'projects', name: 'admin-projects', component: () => import('@/views/AdminProjectsView.vue'), meta: { title: '项目审核', icon: '📁' } },
      { path: 'logs', name: 'admin-logs', component: () => import('@/views/AdminLogsView.vue'), meta: { title: '系统日志', icon: '📋' } },
      // 🆕 P1-3: 合并 ops-portal 路由
      { path: 'monitoring', name: 'monitoring', component: () => import('../../../ops-portal/src/views/MonitoringView.vue'), meta: { title: '系统监控', icon: '📊', section: 'ops' } },
      { path: 'system', name: 'system', component: () => import('../../../ops-portal/src/views/SystemView.vue'), meta: { title: '系统管理', icon: '⚙️', section: 'ops' } },
      { path: 'ops-logs', name: 'ops-logs', component: () => import('../../../ops-portal/src/views/OpsLogsView.vue'), meta: { title: '系统日志', icon: '📋', section: 'ops' } },
      { path: 'services', name: 'services', component: () => import('@/views/ServiceManagementView.vue'), meta: { title: '服务管理', icon: '🔧', section: 'ops' } },
      // 🆕 P3-3: 配乐管理
      { path: 'music-management', name: 'music-management', component: () => import('@/views/MusicManagementView.vue'), meta: { title: '配乐管理', icon: '🎵' } },
    ],
  },
]

const router = createRouter({ history: createWebHistory(), routes })

// 统一鉴权守卫 — 替代硬编码 localhost:3000 跳转, 动态构建主站 URL
createAuthGuard(router, { mode: 'external' })

export default router
