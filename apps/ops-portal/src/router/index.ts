import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { createAuthGuard } from '@manhuaworks/api-client'

/**
 * P1-3: ops-portal 路由已大部整合进 admin-portal (5174)。
 * 保留的独特视图: /monitoring /system /logs (被 admin/router 跨引用)
 * 重复视图已删除(dashboard/users/billing), 重定向到 admin 对应路径。
 */
const adminHost = () => `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:5174`

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/monitoring' },
  // 已迁移到 admin → 重定向
  { path: '/dashboard', redirect: () => { window.location.href = adminHost() + '/dashboard'; return '/monitoring' } },
  { path: '/users', redirect: () => { window.location.href = adminHost() + '/users'; return '/monitoring' } },
  { path: '/billing', redirect: () => { window.location.href = adminHost() + '/billing'; return '/monitoring' } },
  { path: '/api-keys', redirect: '/monitoring' },
  // 保留：admin 跨引用的独特视图
  { path: '/monitoring', name: 'Monitoring', component: () => import('@/views/MonitoringView.vue'), meta: { title: '系统监控', requiresAuth: true } },
  { path: '/system', name: 'System', component: () => import('@/views/SystemView.vue'), meta: { title: '系统管理', requiresAuth: true } },
  { path: '/logs', name: 'OpsLogs', component: () => import('@/views/OpsLogsView.vue'), meta: { title: '运维日志', requiresAuth: true } },
]

export const router = createRouter({ history: createWebHistory(), routes })

// 统一鉴权守卫 — 替换硬编码 localhost:3000 跳转, 动态构建主站 URL
createAuthGuard(router, { mode: 'external' })
