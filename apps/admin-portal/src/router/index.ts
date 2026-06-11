/**
 * admin-portal路由 — 派单 33C: +projects +logs
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  { path: '/monitoring', redirect: '/dashboard' },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
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
    ],
  },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  if (to.name === 'login') return
  try {
    const token = localStorage.getItem('mhw.access_token')
    if (!token) {
      window.location.href = `http://${window.location.hostname}:3000/login?return=` + encodeURIComponent(window.location.origin + to.path)
      return false
    }
  } catch {
    window.location.href = `http://${window.location.hostname}:3000/login`
    return false
  }
})

export default router
