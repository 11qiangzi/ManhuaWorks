// =============================================================================
// router/index.ts — 路由（派单 33C: 10 新视图添加）
// =============================================================================

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  // 🏠 首页
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: '首页', icon: '🏠' },
  },
  // ② 统一素材库
  {
    path: '/materials',
    name: 'materials',
    component: () => import('../views/MaterialLibraryView.vue'),
    meta: { title: '素材库', icon: '🎭' },
  },
  { path: '/characters', redirect: '/materials?tab=characters' },
  { path: '/scenes', redirect: '/materials?tab=scenes' },
  // ③ 工作流
  {
    path: '/workflow',
    name: 'workflow',
    component: () => import('../views/WorkflowDesignerView.vue'),
    meta: { title: '工作流', icon: '🔀' },
  },
  // ① 剧本创作
  {
    path: '/project',
    name: 'project',
    component: () => import('../views/ProjectEditorView.vue'),
    meta: { title: '项目编辑器', icon: '📖' },
  },
  { path: '/project/:id', name: 'project-detail', component: () => import('../views/ProjectEditorView.vue') },
  // ④ 工具箱
  {
    path: '/tools',
    name: 'tools',
    component: () => import('../views/ToolboxView.vue'),
    meta: { title: '工具箱', icon: '🧰' },
  },
  // ⑤ 导出
  {
    path: '/export',
    name: 'export',
    component: () => import('../views/ExportView.vue'),
    meta: { title: '导出', icon: '📤' },
  },
  // ===== 🆕 派单 33C: 10 新视图 (1:1 复刻 41 HTML) =====
  { path: '/project/:id/shots', name: 'storyboard-grid', component: () => import('../views/StoryboardGridView.vue') },
  { path: '/project/:id/shots/:shotId', name: 'shot-editor', component: () => import('../views/ShotEditorView.vue') },
  { path: '/project/:id/settings', name: 'project-settings', component: () => import('../views/ProjectSettingsView.vue') },
  { path: '/project/new', name: 'new-project-wizard', component: () => import('../views/NewProjectWizardView.vue') },
  { path: '/characters/:id/edit', name: 'character-edit', component: () => import('../views/CharacterEditView.vue') },
  { path: '/scenes/:id/edit', name: 'scene-edit', component: () => import('../views/SceneEditView.vue') },
  { path: '/workflow/node/:id', name: 'node-config', component: () => import('../views/NodeConfigView.vue') },
  { path: '/workflow/batch', name: 'batch-generate', component: () => import('../views/BatchGenerateView.vue') },
  { path: '/workflow/branch', name: 'branch-config', component: () => import('../views/BranchConfigView.vue') },
  { path: '/export/settings', name: 'export-settings', component: () => import('../views/ExportSettingsView.vue') },
  // Fallback
  { path: '/:pathMatch(.*)*', name: 'placeholder', component: () => import('../views/PlaceholderView.vue') },
]

export const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  if (!to.meta.requiresAuth && to.name !== 'login') return
  try {
    const token = localStorage.getItem('mhw.access_token')
    if (!token && to.path !== '/') {
      window.location.href = `http://${window.location.hostname}:3000/login?return=` + encodeURIComponent(window.location.origin + to.path)
      return false
    }
  } catch { return }
})

export default router
