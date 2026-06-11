/**
 * ManhuaWorks · W1 主入口
 * 挂载 App.vue + 注册路由 + 注册 Pinia
 *
 * L2 增强：挂载 ErrorBoundary + ToastContainer + 全局异常捕获
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { installGlobalErrorHandler, ToastContainer, ToastError } from '@manhuaworks/ui'
import { useTheme } from '../../../packages/ui/src/composables/useTheme'
import { themes } from '../../../packages/ui/src/themes'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// L2 基础设施：挂全局异常捕获（默认 toast 提示）
installGlobalErrorHandler(app, {
  consoleLog: true,
  toast: true
})

// L2 task 9: 初始化主题系统（localStorage 持久化 + 系统偏好检测）
useTheme().init()
app.provide('mw-themes', themes)

// 注册全局组件
app.component('ToastContainer', ToastContainer)
app.component('ToastError', ToastError)

app.mount('#app')
