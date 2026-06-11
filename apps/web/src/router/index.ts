import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue')
  },
  {
    path: '/showcase',
    name: 'showcase',
    component: () => import('@/views/ShowcaseView.vue')
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue')
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  /* ============================================================
   * Studio · W2 创作者工作台
   * 5 路由：home / editor / model-selector / byok / progress
   * ============================================================ */
  {
    path: '/studio',
    name: 'studio',
    component: () => import('@/views/studio/StudioHomeView.vue'),
    meta: { requiresAuth: true, title: '创作者工作台' }
  },
  {
    path: '/studio/project/:id',
    name: 'project-editor',
    component: () => import('@/views/studio/ProjectEditorView.vue'),
    meta: { requiresAuth: true, title: '项目编辑器' }
  },
  {
    path: '/studio/models',
    name: 'model-selector',
    component: () => import('@/views/studio/ModelSelectorView.vue'),
    meta: { requiresAuth: true, title: '模型选择器' }
  },
  {
    path: '/studio/byok',
    name: 'byok-settings',
    component: () => import('@/views/studio/ByokSettingsView.vue'),
    meta: { requiresAuth: true, title: 'BYOK 设置' }
  },
  {
    path: '/studio/progress',
    name: 'generation-progress',
    component: () => import('@/views/studio/GenerationProgressView.vue'),
    meta: { requiresAuth: true, title: '生成进度' }
  },
  /* ============================================================
   * Studio · W3 工坊流程精修
   * 5 路由：storyboard / characters / scenes / assets / export
   * ============================================================ */
  {
    path: '/studio/storyboard/:projectId?',
    name: 'storyboard-editor',
    component: () => import('@/views/studio/StoryboardEditorView.vue'),
    meta: { requiresAuth: true, title: '分镜编辑器' }
  },
  {
    path: '/studio/characters',
    name: 'character-library',
    component: () => import('@/views/studio/CharacterLibraryView.vue'),
    meta: { requiresAuth: true, title: '角色库' }
  },
  {
    path: '/studio/scenes',
    name: 'scene-library',
    component: () => import('@/views/studio/SceneLibraryView.vue'),
    meta: { requiresAuth: true, title: '场景库' }
  },
  {
    path: '/studio/assets',
    name: 'asset-shelf',
    component: () => import('@/views/studio/AssetShelfView.vue'),
    meta: { requiresAuth: true, title: '资产货架' }
  },
  {
    path: '/studio/export',
    name: 'export',
    component: () => import('@/views/studio/ExportView.vue'),
    meta: { requiresAuth: true, title: '导出成片' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  // 设置页面标题
  if (to.meta?.title) {
    document.title = `${to.meta.title} · ManhuaWorks`
  } else {
    document.title = '漫工场 · AI 漫剧创作平台'
  }
  // 鉴权
  if (to.meta.requiresAuth) {
    try {
      const token = localStorage.getItem('mhw.access_token')
      if (!token) return { name: 'login' }
    } catch {
      return { name: 'login' }
    }
  }
})

export default router
