/**
 * ManhuaWorks · auth-guard
 * ─────────────────────────────────────────────────────────────
 * 统一前端鉴权守卫 — 所有 6 个前端应用共用
 *
 * 设计原则:
 *   - Token key: mhw.access_token (与 token-store.ts 一致)
 *   - 仅检查 token 是否存在, 不做 JWT 校验 (后端职责)
 *   - 登录页: 主站 (port 3000) 的 /login
 *   - 管理/运维后台: 通过 ?return= 参数跳回原页面
 *
 * 用法:
 *   import { createAuthGuard } from '@manhuaworks/api-client'
 *   createAuthGuard(router)                     // 默认: 站内 /login
 *   createAuthGuard(router, { mode: 'external' }) // 跳主站登录页
 */

import type { Router } from 'vue-router'
import { tokenStore } from './token-store.js'

// ─── 基础工具函数 ─────────────────────────────────────────────

/**
 * getToken — 从 localStorage 读取 access_token
 *
 * 优先使用 tokenStore (已有 SSR 安全处理),
 * fallback 直接读 localStorage.
 */
export function getToken(): string | null {
  return tokenStore.get()
}

/**
 * isAuthenticated — 是否存在非空 access_token
 *
 * 注意: 仅检查 token 存在性, 不校验 JWT 有效期.
 * JWT 校验是后端的职责.
 */
export function isAuthenticated(): boolean {
  const token = getToken()
  return token != null && token.length > 0
}

/**
 * getMainSiteUrl — 获取主站地址
 *
 * 统一使用 window.location.hostname 动态构建,
 * 避免硬编码 localhost (部署到线上后会出问题).
 */
function getMainSiteUrl(): string {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  return `http://${hostname}:3000`
}

/**
 * redirectToLogin — 跳转到登录页
 *
 * @param returnUrl 登录成功后要返回的完整 URL, 默认当前页面
 *
 * - 不传 returnUrl: 跳到主站 /login (不带 return 参数)
 * - 传 returnUrl: 跳到主站 /login?return=<encodedUrl>
 */
export function redirectToLogin(returnUrl?: string): void {
  const loginBase = `${getMainSiteUrl()}/login`
  if (returnUrl) {
    window.location.href = `${loginBase}?return=${encodeURIComponent(returnUrl)}`
  } else {
    window.location.href = loginBase
  }
}

// ─── Auth Guard 配置 ──────────────────────────────────────────

export interface AuthGuardOptions {
  /**
   * 鉴权模式:
   * - 'internal'  : 应用内有 /login 路由, 用 router 跳转 (默认, 适用于 web)
   * - 'external'  : 跳主站 (port 3000) 的 /login, 带 ?return= 参数
   *                 (适用于 admin-portal, ops-portal, user-portal, dev-portal, studio)
   */
  mode?: 'internal' | 'external'

  /**
   * 应用内有 /login 路由时的路由名称 (默认 'login')
   * 仅 mode='internal' 时生效
   */
  loginRouteName?: string
}

/**
 * createAuthGuard — 为 Vue Router 创建统一的 beforeEach 鉴权守卫
 *
 * 检查目标路由的 meta.requiresAuth, 若为 true 且无 token,
 * 则重定向到登录页.
 *
 * @param router  Vue Router 实例
 * @param options 配置项
 *
 * @example
 *   // web 主站 — 内有 /login 路由
 *   createAuthGuard(router, { mode: 'internal' })
 *
 * @example
 *   // admin-portal — 跳主站登录
 *   createAuthGuard(router, { mode: 'external' })
 */
export function createAuthGuard(router: Router, options: AuthGuardOptions = {}): void {
  const { mode = 'internal', loginRouteName = 'login' } = options

  router.beforeEach((to) => {
    if (to.meta?.requiresAuth) {
      if (!isAuthenticated()) {
        if (mode === 'external') {
          // 跳主站登录页, 带上 return URL 以便登录后跳回
          const returnPath = window.location.origin + to.fullPath
          redirectToLogin(returnPath)
          // 返回 false 阻止当前导航 (页面即将被 window.location.href 替换)
          return false
        } else {
          // 应用内跳转到 /login
          return { name: loginRouteName, query: { return: to.fullPath } }
        }
      }
    }
  })
}
