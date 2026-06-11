import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  { path: '/api-keys', redirect: '/dashboard' },
  { path: '/dashboard', name: 'Dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '数据看板' } },
  { path: '/users', name: 'Users', component: () => import('@/views/UsersView.vue'), meta: { title: '用户管理' } },
  { path: '/billing', name: 'Billing', component: () => import('@/views/BillingView.vue'), meta: { title: '计费充值' } },
  { path: '/monitoring', name: 'Monitoring', component: () => import('@/views/MonitoringView.vue'), meta: { title: '系统监控' } },
  { path: '/system', name: 'System', component: () => import('@/views/SystemView.vue'), meta: { title: '系统管理' } },
  { path: '/logs', name: 'OpsLogs', component: () => import('@/views/OpsLogsView.vue'), meta: { title: '运维日志' } },
]

export const router = createRouter({ history: createWebHistory(), routes })

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
