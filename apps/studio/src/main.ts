import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/tailwind.css'
import './styles/responsive.css'
import {
  installGlobalErrorHandler,
  ToastContainer,
  LoadingOverlay,
  ErrorBoundary
} from '@manhuaworks/ui'
import { useTheme } from '../../../packages/ui/src/composables/useTheme'
import { themes } from '../../../packages/ui/src/themes'

const app = createApp(App)
app.use(createPinia())
app.use(router)

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
