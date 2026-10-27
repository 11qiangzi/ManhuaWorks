/**
 * 千机工坊 · Admin Portal · main entry
 * L2 task 8 接通真后端
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/tailwind.css'
import './styles/responsive.css'

import { useTheme } from '@manhuaworks/ui'
import { themes } from '@manhuaworks/ui'

import { getApi, installGlobalErrorHook } from './api-bridge'
import { ApiError } from '@manhuaworks/api-client'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.provide('mw-themes', themes)

/* ------------------------------------------------------------------ */
/*                       全局错误 → Toast                              */
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
    if (!a.isAdmin) {
      // 非管理员：直接踢回登录
      try { router.push({ name: 'login' }) } catch { /* noop */ }
    }
  } catch {
    /* 未登录或后端不可达 */
  }
})()

app.mount('#app')

// 主题初始化必须在 mount 之后（useTheme 内部用了 onMounted）
useTheme().init()
