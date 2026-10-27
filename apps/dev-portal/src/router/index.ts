import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { createAuthGuard } from '@manhuaworks/api-client'
import DevLayout from '@/components/DevLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: DevLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: '首页', requiresAuth: true },
      },
      {
        path: 'docs',
        name: 'docs',
        component: () => import('@/views/DocsView.vue'),
        meta: { title: 'API 文档', requiresAuth: true },
      },
      {
        path: 'api-keys',
        name: 'api-keys',
        component: () => import('@/views/ApiKeysView.vue'),
        meta: { title: 'API Key 管理', requiresAuth: true },
      },
      {
        path: 'playground',
        name: 'playground',
        component: () => import('@/views/PlaygroundView.vue'),
        meta: { title: 'Playground', requiresAuth: true },
      },
      {
        path: 'sdk',
        name: 'sdk',
        component: () => import('@/views/SdkView.vue'),
        meta: { title: 'SDK 下载', requiresAuth: true },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const title = (to.meta.title as string) || '开发者平台'
  document.title = `千机工坊 - ${title}`
})

// 统一鉴权守卫 — dev-portal 此前无任何鉴权, 现接入统一守卫
createAuthGuard(router, { mode: 'external' })

export default router
