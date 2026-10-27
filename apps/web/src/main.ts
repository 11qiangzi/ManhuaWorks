/**
 * 千机工坊 · W1 主入口
 * 挂载 App.vue + 注册路由 + 注册 Pinia
 *
 * L2 增强：挂载 ErrorBoundary + ToastContainer + 全局异常捕获
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/shared-components.css'
import { installGlobalErrorHandler, ToastContainer, ToastError } from '@manhuaworks/ui'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// L2 基础设施：挂全局异常捕获（默认 toast 提示）
installGlobalErrorHandler(app, {
  consoleLog: true,
  toast: true
})

// 注册全局组件
app.component('ToastContainer', ToastContainer)
app.component('ToastError', ToastError)

app.mount('#app')
