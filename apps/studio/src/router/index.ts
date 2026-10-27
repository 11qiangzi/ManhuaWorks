// =============================================================================
// router/index.ts — 路由（派单 33C: 10 新视图添加）
// =============================================================================

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { createAuthGuard } from '@manhuaworks/api-client'

const routes: RouteRecordRaw[] = [
  // 🏠 首页
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: '首页', icon: '🏠', requiresAuth: true },
  },
  // ② 统一素材库
  {
    path: '/materials',
    name: 'materials',
    component: () => import('../views/MaterialLibraryView.vue'),
    meta: { title: '素材库', icon: '🎭', requiresAuth: true },
  },
  { path: '/characters', name: 'characters', component: () => import('../views/CharacterView.vue'), meta: { title: '角色管理', icon: '🎭', requiresAuth: true } },
  { path: '/scenes', name: 'scenes', component: () => import('../views/SceneView.vue'), meta: { title: '场景管理', icon: '🎬', requiresAuth: true } },
  // ③ 工作流
  {
    path: '/workflow',
    name: 'workflow',
    component: () => import('../views/WorkflowDesignerView.vue'),
    meta: { title: '工作流', icon: '🔀', requiresAuth: true },
  },
  // ① 剧本创作
  {
    path: '/project',
    name: 'project',
    component: () => import('../views/ProjectEditorView.vue'),
    meta: { title: '项目编辑器', icon: '📖', requiresAuth: true },
  },
  // /project/new MUST be before /project/:id (dynamic route would catch "new" as id)
  { path: '/project/new', name: 'new-project-wizard', component: () => import('../views/NewProjectWizardView.vue'), meta: { requiresAuth: true } },
  { path: '/project/:id', name: 'project-detail', component: () => import('../views/ProjectEditorView.vue'), meta: { requiresAuth: true } },
  // ④ 工具箱
  {
    path: '/tools',
    name: 'tools',
    component: () => import('../views/ToolboxView.vue'),
    meta: { title: '工具箱', icon: '🧰', requiresAuth: true },
  },
  // ⑤ 导出
  {
    path: '/export',
    name: 'export',
    component: () => import('../views/ExportView.vue'),
    meta: { title: '导出', icon: '📤', requiresAuth: true },
  },
  // ===== 🆕 派单 33C: 10 新视图 (1:1 复刻 41 HTML) =====
  { path: '/project/:id/shots', name: 'storyboard-grid', component: () => import('../views/StoryboardGridView.vue'), meta: { requiresAuth: true } },
  { path: '/project/:id/shots/:shotId', name: 'shot-editor', component: () => import('../views/ShotEditorView.vue'), meta: { requiresAuth: true } },
  { path: '/project/:id/settings', name: 'project-settings', component: () => import('../views/ProjectSettingsView.vue'), meta: { requiresAuth: true } },
  { path: '/characters/:id/edit', name: 'character-edit', component: () => import('../views/CharacterEditView.vue'), meta: { requiresAuth: true } },
  { path: '/scenes/:id/edit', name: 'scene-edit', component: () => import('../views/SceneEditView.vue'), meta: { requiresAuth: true } },
  { path: '/workflow/node/:id', name: 'node-config', component: () => import('../views/NodeConfigView.vue'), meta: { requiresAuth: true } },
  { path: '/workflow/batch', name: 'batch-generate', component: () => import('../views/BatchGenerateView.vue'), meta: { requiresAuth: true } },
  { path: '/workflow/branch', name: 'branch-config', component: () => import('../views/BranchConfigView.vue'), meta: { requiresAuth: true } },
  { path: '/export/settings', name: 'export-settings', component: () => import('../views/ExportSettingsView.vue'), meta: { requiresAuth: true } },
  // ⑥ 动画编辑器（7 步向导：上传小说 → 角色 → 场景 → 风格 → 配乐 → 预览 → 导出）
  { path: '/project/:id/storyboard', name: 'storyboard-editor', component: () => import('../views/StoryboardEditorView.vue'), meta: { requiresAuth: true } },
  // ⑦ 宣传片编辑器（6 步向导）
  { path: '/promo', name: 'promo-editor', component: () => import('../views/PromoEditorView.vue'), meta: { title: '宣传片', requiresAuth: true } },
  // Fallback — 不要求鉴权
  { path: '/:pathMatch(.*)*', name: 'placeholder', component: () => import('../views/PlaceholderView.vue') },
]

export const router = createRouter({ history: createWebHistory(), routes })

// 统一鉴权守卫 — 未登录时跳转主站 (port 3000) 登录页, 带 return 参数
createAuthGuard(router, { mode: 'external' })

export default router
