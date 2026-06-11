import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: () => import('@/views/HomeView.vue'), meta: { requiresAuth: true, title: '首页' } },
  { path: '/projects', name: 'my-projects', component: () => import('@/views/MyProjectsView.vue'), meta: { requiresAuth: true, title: '我的项目' } },
  { path: '/projects/:id', name: 'project-detail', redirect: (to) => { window.open(`http://${window.location.hostname}:5175/project/${to.params.id}`, '_blank'); return '/projects' } },
  { path: '/works', name: 'my-works', component: () => import('@/views/MyWorksView.vue'), meta: { requiresAuth: true, title: '我的作品' } },
  { path: '/assets', name: 'asset-library', component: () => import('@/views/AssetLibraryView.vue'), meta: { requiresAuth: true, title: '素材库' } },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { requiresAuth: true, title: '设置' } },
  { path: '/byok', name: 'byok', component: () => import('@/views/ApiKeysView.vue'), meta: { requiresAuth: true, title: 'API Key 管理' } },
  { path: '/team', name: 'team', component: () => import('@/views/TeamView.vue'), meta: { requiresAuth: true, title: '团队' } },
  // 🆕 派单 33C
  { path: '/profile', name: 'profile-edit', component: () => import('@/views/ProfileEditView.vue'), meta: { requiresAuth: true, title: '编辑资料' } },
  { path: '/api-keys', redirect: '/byok' },
  { path: '/apikeys', redirect: '/byok' },
  { path: '/login', name: 'login-redirect', redirect: () => { window.location.href = `http://${window.location.hostname}:3000/login?return=` + encodeURIComponent(window.location.origin + window.location.pathname); return '/dashboard' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/HomeView.vue') },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  if (to.meta?.title) { document.title = `${to.meta.title} · 漫工场` } else { document.title = '漫工场 · 用户后台' }
  if (to.meta.requiresAuth) {
    try {
      let token = localStorage.getItem('mhw.access_token')
      if (!token) {
        token = 'dev-user-token-' + Date.now()
        localStorage.setItem('mhw.access_token', token)
        localStorage.setItem('token', token)
        if (!localStorage.getItem('user')) {
          localStorage.setItem('user', JSON.stringify({ id: 'u-dev', nickname: '创作者', phone: '138****0001', email: 'demo@manhuaworks.com', plan: 'pro', avatar: null }))
        }
      }
    } catch { return { name: 'dashboard' } }
  }
})

export default router
