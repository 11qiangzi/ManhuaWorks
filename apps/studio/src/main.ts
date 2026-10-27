import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/tailwind.css'
import './styles/responsive.css'
import './styles/shared-components.css'
import {
  installGlobalErrorHandler,
  ToastContainer,
  LoadingOverlay,
  ErrorBoundary
} from '@manhuaworks/ui'
import { useTheme } from '../../../packages/ui/src/composables/useTheme'
import { themes } from '../../../packages/ui/src/themes'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Auth hydration: fetch user data if token exists, listen for auth-lost events
useAuthStore().initAuth()

// L2 基础设施：工坊涉及大量生成/上传/工作流，错误+loading 都要齐全
installGlobalErrorHandler(app, {
  consoleLog: true,
  toast: true
})

// L2 task 9: 主题系统
useTheme().init()
app.provide('mw-themes', themes)

app.component('ToastContainer', ToastContainer)
app.component('LoadingOverlay', LoadingOverlay)
app.component('ErrorBoundary', ErrorBoundary)

app.mount('#app')
