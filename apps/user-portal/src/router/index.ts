import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { createAuthGuard, redirectToLogin } from '@manhuaworks/api-client'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: () => import('@/views/HomeView.vue'), meta: { requiresAuth: true, title: '首页' } },
  { path: '/projects', name: 'my-projects', component: () => import('@/views/MyProjectsView.vue'), meta: { requiresAuth: true, title: '我的项目' } },
  { path: '/projects/:id', name: 'project-detail', redirect: (to) => { window.open(`http://${window.location.hostname}:5175/project/${to.params.id}`, '_blank'); return '/projects' } },
  { path: '/works', name: 'my-works', component: () => import('@/views/MyWorksView.vue'), meta: { requiresAuth: true, title: '我的作品' } },
  { path: '/assets', name: 'asset-library', component: () => import('@/views/AssetLibraryView.vue'), meta: { requiresAuth: true, title: '素材库' } },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { requiresAuth: true, title: '设置' } },
  { path: '/byok', name: 'byok', component: () => import('@/views/ApiKeysView.vue'), meta: { requiresAuth: true, title: 'API Key 管理' } },
  { path: '/settings/api-keys', name: 'settings-api-keys', component: () => import('@/views/SettingsApiKeyView.vue'), meta: { requiresAuth: true, title: 'API Key 设置 (派单17)' } },
  { path: '/team', name: 'team', component: () => import('@/views/TeamView.vue'), meta: { requiresAuth: true, title: '团队' } },
  // 🆕 派单 33C
  { path: '/profile', name: 'profile-edit', component: () => import('@/views/ProfileEditView.vue'), meta: { requiresAuth: true, title: '编辑资料' } },
  // 🆕 通知中心 + 服务状态
  { path: '/notifications', name: 'notifications', component: () => import('@/views/NotificationsView.vue'), meta: { requiresAuth: true, title: '通知中心' } },
  { path: '/service-status', name: 'service-status', component: () => import('@/views/ServiceStatusView.vue'), meta: { requiresAuth: true, title: '服务状态' } },
  { path: '/api-keys', redirect: '/byok' },
  { path: '/apikeys', redirect: '/byok' },
  // ── P1-2: 开发者工具 (merged from dev-portal) ──
  { path: '/dev', redirect: '/dev/docs' },
  { path: '/dev/docs', name: 'dev-docs', component: () => import('@/views/dev/DevDocsView.vue'), meta: { requiresAuth: true, title: 'API文档' } },
  { path: '/dev/keys', name: 'dev-keys', component: () => import('@/views/dev/DevKeysView.vue'), meta: { requiresAuth: true, title: '开发者Key管理' } },
  { path: '/dev/playground', name: 'dev-playground', component: () => import('@/views/dev/DevPlaygroundView.vue'), meta: { requiresAuth: true, title: 'API调试' } },
  { path: '/dev/sdk', name: 'dev-sdk', component: () => import('@/views/dev/DevSdkView.vue'), meta: { requiresAuth: true, title: 'SDK下载' } },
  { path: '/login', name: 'login-redirect', redirect: () => { redirectToLogin(window.location.origin + window.location.pathname); return '/dashboard' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/HomeView.vue') },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  if (to.meta?.title) { document.title = `${to.meta.title} - 千机工坊` } else { document.title = '千机工坊 - 用户中心' }
})

// 统一鉴权守卫 — 移除 fake dev-token 生成, 未登录时跳转主站登录页
createAuthGuard(router, { mode: 'external' })

export default router
