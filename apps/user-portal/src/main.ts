/**
 * 千机工坊 · 用户后台入口
 * W4 + L2 task 8 接通真后端
 * L2 task 9: 主题 + 响应式
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/responsive.css'
import {
  installGlobalErrorHandler,
  ToastContainer,
  NotificationCenter,
  ErrorBoundary
} from '@manhuaworks/ui'
import { useTheme } from '../../../packages/ui/src/composables/useTheme'
import { themes } from '../../../packages/ui/src/themes'

import { getApi, installGlobalErrorHook } from './api-bridge'
import { ApiError } from '@manhuaworks/api-client'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// L2 基础措施
installGlobalErrorHandler(app, {
  consoleLog: true,
  toast: true
})



// L2 task 9: 主题
useTheme().init()
app.provide('mw-themes', themes)

app.component('ToastContainer', ToastContainer)
app.component('NotificationCenter', NotificationCenter)
app.component('ErrorBoundary', ErrorBoundary)

/* ------------------------------------------------------------------ */
/*                       全局错误 -> Toast                              */
/* ------------------------------------------------------------------ */

function showToast(kind: 'info' | 'error' | 'warning', text: string): void {
  try {
    window.dispatchEvent(new CustomEvent('mhw:toast', { detail: { kind, text } }))
  } catch {
    // toast dispatch failed silently
  }
}

const api = getApi()


installGlobalErrorHook((err: ApiError) => {
  showToast('error', err.userMessage)
})

window.addEventListener('mhw:auth-lost', () => {
  showToast('warning', '登录已过期')
  try { router.push({ name: 'login' }) } catch { /* noop */ }
})

/* ------------------------------------------------------------------ */
/*                          启动时拉一次 me                            */
/* ------------------------------------------------------------------ */

;(async () => {
  try {
    const { useAuthStore } = await import('./stores/auth')
    const a = useAuthStore()
    await a.fetchMe()
  } catch {
    /* 未登录或后端不可达 */
  }
})()

app.mount('#app')
