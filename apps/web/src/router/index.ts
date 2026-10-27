import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { MODULE_NAMES } from '@/config/naming'

/**
 * 千机工坊 · 路由 v5.1
 * 
 * 结构：
 *   公共路由（无鉴权）
 *     / /showcase /login
 *   
 *   受保护路由（MainLayout 统一布局 + 鉴权守卫）
 *     /dashboard /projects/* /create/*(6模块) /materials /works /tools /settings
 */

const routes: RouteRecordRaw[] = [
  // ============================================================
  // 公共路由（无鉴权）
  // ============================================================
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/showcase',
    name: 'showcase',
    component: () => import('@/views/ShowcaseView.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
  },
  {
    path: '/pricing',
    name: 'pricing',
    component: () => import('@/views/PricingView.vue'),
    meta: { title: '定价' },
  },
  {
    path: '/share/:type/:id',
    name: 'share',
    component: () => import('@/views/ShareView.vue'),
    meta: { title: '作品分享' },
  },
  {
    path: '/help',
    name: 'help',
    component: () => import('@/views/HelpView.vue'),
    meta: { title: '帮助中心' },
  },

  // ============================================================
  // 受保护路由 · MainLayout 统一布局
  // ============================================================
  {
    path: '/',
    component: () => import('@/components/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      // --- 工作台 ---
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '工作台' },
      },

      // --- 创作模块（6大模块统一前缀 /create） ---
      {
        path: 'create/animation',
        name: 'create-animation',
        component: () => import('@/views/create/StoryboardEditorView.vue'),
        meta: { title: MODULE_NAMES.manga.name },
      },
      {
        path: 'create/novel',
        name: 'create-novel',
        component: () => import('@/views/create/NovelEditorView.vue'),
        meta: { title: MODULE_NAMES.novel.name },
      },
      {
        path: 'create/promo',
        name: 'create-promo',
        component: () => import('@/views/create/PromoEditorView.vue'),
        meta: { title: MODULE_NAMES.promo.name },
      },
      {
        path: 'create/ad-video',
        name: 'create-ad-video',
        component: () => import('@/views/create/AdShortEditorView.vue'),
        meta: { title: MODULE_NAMES.adShort.name },
      },
      {
        path: 'create/ad-image',
        name: 'create-ad-image',
        component: () => import('@/views/create/AdImageEditorView.vue'),
        meta: { title: MODULE_NAMES.adImage.name },
      },
      {
        path: 'create/music',
        name: 'create-music',
        component: () => import('@/views/create/MusicEditorView.vue'),
        meta: { title: MODULE_NAMES.music.name },
      },

      // --- 项目管理 ---
      {
        path: 'projects',
        name: 'projects',
        component: () => import('@/views/ProjectsView.vue'),
        meta: { title: '我的项目' },
      },
      {
        path: 'projects/new',
        name: 'new-project-wizard',
        component: () => import('@/views/NewProjectWizardView.vue'),
        meta: { title: '新建项目' },
      },
      {
        path: 'projects/:id',
        name: 'project-editor',
        component: () => import('@/views/ProjectEditorView.vue'),
        meta: { title: '项目编辑' },
      },
      {
        path: 'projects/:id/settings',
        name: 'project-settings',
        component: () => import('@/views/ProjectSettingsView.vue'),
        meta: { title: '项目设置' },
      },

      // --- 参考图管理 ---
      {
        path: 'projects/:id/reference-images',
        name: 'project-reference-images',
        component: () => import('@/views/ReferenceImagesView.vue'),
        meta: { title: '参考图管理' },
      },

      // --- AI 生成任务 ---
      {
        path: 'generation-tasks',
        name: 'generation-tasks',
        component: () => import('@/views/GenerationTasksView.vue'),
        meta: { title: 'AI 生成任务' },
      },

      // --- 素材中心 ---
      {
        path: 'materials',
        name: 'materials',
        component: () => import('@/views/MaterialLibraryView.vue'),
        meta: { title: '素材中心' },
      },

      // --- 作品库 ---
      {
        path: 'works',
        name: 'works',
        component: () => import('@/views/WorksView.vue'),
        meta: { title: '作品库' },
      },

      // --- 工具箱 ---
      {
        path: 'tools',
        name: 'tools',
        component: () => import('@/views/ToolboxView.vue'),
        meta: { title: '工具箱' },
      },

      // --- 设置 ---
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: '设置' },
      },
      {
        path: 'settings/byok',
        name: 'byok-settings',
        component: () => import('@/views/studio/ByokSettingsView.vue'),
        meta: { title: 'API 密钥管理 (BYOK)' },
      },

      // --- 角色管理 ---
      {
        path: 'characters',
        name: 'characters',
        component: () => import('@/views/CharacterView.vue'),
        meta: { title: '角色管理' },
      },
      {
        path: 'characters/:id/edit',
        name: 'character-edit',
        component: () => import('@/views/CharacterEditView.vue'),
        meta: { title: '角色编辑' },
      },

      // --- 场景管理 ---
      {
        path: 'scenes',
        name: 'scenes',
        component: () => import('@/views/SceneView.vue'),
        meta: { title: '场景管理' },
      },
      {
        path: 'scenes/:id/edit',
        name: 'scene-edit',
        component: () => import('@/views/SceneEditView.vue'),
        meta: { title: '场景编辑' },
      },

      // --- 导出中心 ---
      {
        path: 'export',
        name: 'export',
        component: () => import('@/views/create/ExportView.vue'),
        meta: { title: '导出中心' },
      },
      {
        path: 'export/settings',
        name: 'export-settings',
        component: () => import('@/views/create/ExportSettingsView.vue'),
        meta: { title: '导出设置' },
      },

      // --- 工作流 ---
      {
        path: 'workflow',
        name: 'workflow',
        component: () => import('@/views/create/BatchGenerateView.vue'),
        meta: { title: '批量生成工作流' },
      },

    ],
  },

  // ============================================================
  // 旧路径兼容重定向
  // ============================================================
  {
    path: '/assets',
    redirect: '/materials',
  },
  {
    path: '/team',
    redirect: '/settings',
  },
  {
    path: '/project',
    redirect: '/projects',
  },
  {
    path: '/project/new',
    redirect: '/projects/new',
  },
  {
    path: '/project/:id',
    redirect: (to: any) => `/projects/${to.params.id}`,
  },
  {
    path: '/project/:id/settings',
    redirect: (to: any) => `/projects/${to.params.id}/settings`,
  },

  // ============================================================
  // 404 友好页面（替代静默重定向）
  // ============================================================
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面未找到' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} · 千机工坊`
  } else {
    document.title = '千机工坊 · AI 漫剧创作平台'
  }
  if (to.meta.requiresAuth) {
    try {
      const token = localStorage.getItem('mhw.access_token') || localStorage.getItem('token')
      if (!token) return { name: 'login' }
    } catch {
      return { name: 'login' }
    }
  }
})

export default router
