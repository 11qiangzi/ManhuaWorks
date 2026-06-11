# @manhuaworks/ui

> ManhuaWorks 4 前端共享 UI 基础设施：错误处理 + Loading + Toast + 通知

`packages/ui` 是 ManhuaWorks 4 个前端应用（`web` / `studio` / `admin-portal` / `user-portal`）共享的基础设施包，提供 3 大类通用能力 + 50+ 组件/composable/store。

---

## 能力概览

| 类别 | 数量 | 关键 API |
|------|------|---------|
| 错误处理 | 5 类错误 + 30+ 错误码 | `AppError`, `useErrorHandler`, `useErrorBoundary`, `useFormErrors` |
| Loading | 14 类 + 16 组件 | `useLoading`, `useAsyncState` |
| Toast | 4 类型 + 6 位置 + 队列 | `useToast`, `useToastStore` |
| 通知 | 站内消息流 | `useNotification`, `useNotificationStore` |

---

## 1. 错误处理

### 错误码（30+）

```ts
import { ErrorCodes } from '@manhuaworks/ui'

// 1xxx 客户端
ErrorCodes.BAD_REQUEST         // E1001
ErrorCodes.UNAUTHORIZED        // E1002
ErrorCodes.FORBIDDEN           // E1003
ErrorCodes.NOT_FOUND           // E1004
ErrorCodes.VALIDATION_FAILED   // E1011
// ... 共 11 个

// 2xxx 服务端（8 个）
ErrorCodes.INTERNAL_ERROR      // E2001
// ...

// 3xxx 网络（8 个）
ErrorCodes.NETWORK_OFFLINE     // E3001
ErrorCodes.NETWORK_TIMEOUT     // E3002
// ...

// 4xxx 业务（10+）
ErrorCodes.AUTH_LOGIN_FAILED   // E4001
ErrorCodes.QUOTA_EXCEEDED      // E4009
// ...

// 5xxx 运行时（7 个）
ErrorCodes.UNKNOWN             // E5001
// ...
```

### 错误类层级

```
AppError (基类)
├── NetworkError      — 离线/超时/DNS/WebSocket
├── ValidationError   — 字段错误（多字段 + toMap + errorFor）
├── AuthError         — 401/403/token 过期/账户锁定
└── BusinessError     — 资源/配额/工作流/生成/上传
```

### 全局异常捕获

在 `main.ts` 一行接入：

```ts
import { installGlobalErrorHandler } from '@manhuaworks/ui'

app.use(createPinia())
installGlobalErrorHandler(app, {
  consoleLog: true,   // 输出到控制台
  toast: true,        // 自动 toast 提示
  report: (err) => {  // 自定义上报
    fetch('/api/error-log', { method: 'POST', body: JSON.stringify(err.toJSON()) })
  }
})
```

捕获 3 层：
- `window.onerror` — 同步运行时
- `unhandledrejection` — 未捕获 Promise
- `app.config.errorHandler` — Vue 组件错误

### ErrorBoundary

```vue
<ErrorBoundary v-slot="{ error, reset }">
  <MyComponent />
  <template #fallback>
    <div>出错了: {{ error?.message }} <button @click="reset">重试</button></div>
  </template>
</ErrorBoundary>
```

或者用 composable 拿一个内置组件：

```ts
const { ErrorBoundary, captureError, reset } = useErrorBoundary()
```

### 表单错误

```ts
const { errors, setError, applyValidationError } = useFormErrors()

try {
  await api.submit(form)
} catch (e) {
  if (isValidationError(e)) {
    applyValidationError(e)  // 自动把 fieldErrors 灌进 errors
  }
}
```

模板：

```vue
<input v-model="email" />
<FormFieldError :message="errors.email" :field-id="'email'" />
```

---

## 2. Loading（14 类）

| 类型 | 场景 | API |
|------|------|-----|
| `page` | 路由切换 | `<LoadingPage />` |
| `section` | 区域加载 | `<LoadingSection />` |
| `table` | 表格骨架 | `<LoadingTable :rows="10" :columns="5" />` |
| `button` | 防重复提交 | `<LoadingButton :loading="loading" @click="..." />` |
| `form` | 表单提交 | `<LoadingForm :loading="loading" @submit="..." />` |
| `inline` | 行内提示 | `<LoadingInline message="保存中" />` |
| `modal` | 弹窗加载 | `<LoadingModal :visible="loading" />` |
| `drawer` | 抽屉加载 | `<LoadingDrawer :visible="loading" position="right" />` |
| `skeleton` | 骨架屏（10 变体）| `<Skeleton variant="card" />` |
| `infinite` | 无限滚动 | `<InfiniteScroll :loading="..." :finished="..." @loadMore="..." />` |
| `pull-refresh` | 下拉刷新 | `<PullToRefresh :refreshing="..." @refresh="..." />` |
| `upload` | 上传进度 | `<UploadProgress :filename="..." :loaded="..." :total="..." />` |
| `progress` | 进度条 | `<ProgressBar :value="50" />` |
| `indeterminate` | 不确定进度 | `<IndeterminateProgress />` |

### useLoading — 14 类统一管理

```ts
const loading = useLoading()

loading.start('button', 'submitBtn', { message: '提交中...' })
loading.setProgress('upload-1', 75)
loading.stop('submitBtn')

// 一行包装
const data = await loading.withLoading('page', 'fetchUser', () => api.fetchUser(id))
```

### useAsyncState — 异步状态机

```ts
const { data, error, isLoading, retry, cancel } = useAsyncState(
  () => api.fetchUser(id),
  { retry: 3, retryDelay: 1000 }
)
```

可重试的错误自动重试（网络/5xx/限流），非可重试错误直接抛出。

### Skeleton 10 变体

```vue
<Skeleton variant="card" />
<Skeleton variant="list" :rows="5" />
<Skeleton variant="table" :rows="10" :columns="4" />
<Skeleton variant="avatar" :width="40" :height="40" />
<Skeleton variant="text" />
<Skeleton variant="image" :height="200" />
<Skeleton variant="button" />
<Skeleton variant="chart" :height="200" />
<Skeleton variant="grid" :grid-cols="4" />
<Skeleton variant="calendar" :calendar-cells="42" />
```

---

## 3. Toast

### 4 种类型

| 类型 | 默认时长 | 图标 | 用途 |
|------|---------|------|------|
| `success` | 3000ms | ✓ | 操作成功 |
| `error` | 5000ms | ✕ | 错误提示 |
| `warning` | 4000ms | ! | 警告 |
| `info` | 3000ms | i | 通知 |
| `loading` | 持续 | 旋转 | 加载中 |
| `promise` | 跟随结果 | 流转 | 异步任务 |

### 6 个位置

- `top-right`（默认）
- `top-left`
- `top-center`
- `bottom-right`
- `bottom-left`
- `bottom-center`

### 用法

```ts
const toast = useToast()

toast.success('保存成功')
toast.error('网络异常', { title: '错误' })
toast.warning('空间不足', { position: 'bottom-right' })

// Promise 包装
const user = await toast.promise(api.createUser(data), {
  loading: '创建中...',
  success: '创建成功！',
  error: (e) => `创建失败: ${e.message}`
})

// 自定义 action
toast.error('保存失败', {
  action: { label: '重试', handler: () => retrySave() }
})
```

### 队列管理

- 最大并发 8 个（超过移除最早的普通 toast）
- `loading` 和 `promise` 永不自动移除
- 手动 `dismiss(id)` 或 `clear()` 全清

---

## 4. 通知（站内消息）

与 toast 区别：
- toast：临时轻提示，几秒消失
- notification：站内消息流，持久化，可标记已读

```ts
const { items, unreadCount, add, markAllAsRead } = useNotification()

add({ level: 'mention', title: '@你', body: 'alice 提到了你', source: 'alice' })
add({ level: 'info', title: '项目更新', body: 'xxx', link: '/projects/1' })
```

UI 组件：

```vue
<NotificationCenter />
```

带：
- 🔔 红点未读数
- 今天/昨天/更早 分组
- 点击标记已读
- 全部已读按钮

---

## 4 前端接入

在 4 个 `main.ts` 中：

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  installGlobalErrorHandler,
  ToastContainer,
  NotificationCenter,
  ErrorBoundary,
  LoadingOverlay
} from '@manhuaworks/ui'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
installGlobalErrorHandler(app, { toast: true })

app.component('ToastContainer', ToastContainer)
app.component('NotificationCenter', NotificationCenter)
app.component('ErrorBoundary', ErrorBoundary)
app.component('LoadingOverlay', LoadingOverlay)

app.mount('#app')
```

---

## 测试

```bash
pnpm test           # 一次性
pnpm test:watch     # 监听
```

测试覆盖：
- `error.test.ts` — 30+ 用例：错误码、5 类错误、类型守卫、fromUnknown、fromHttpResponse
- `loading.test.ts` — 14 类 + useAsyncState
- `toast.test.ts` — 4 类型 + 6 位置 + 队列 + promise
- `notification.test.ts` — CRUD + 已读未读 + 面板 + 分组

---

## 目录

```
packages/ui/
├── src/
│   ├── errors/         # 5 类错误 + 30+ 错误码
│   │   ├── AppError.ts
│   │   ├── NetworkError.ts
│   │   ├── ValidationError.ts
│   │   ├── AuthError.ts
│   │   ├── BusinessError.ts
│   │   └── index.ts
│   ├── composables/    # 9 个 composable
│   │   ├── useErrorHandler.ts
│   │   ├── useFormErrors.ts
│   │   ├── useErrorBoundary.ts
│   │   ├── useLoading.ts
│   │   ├── useAsyncState.ts
│   │   ├── useToast.ts
│   │   ├── useNotification.ts
│   │   └── index.ts
│   ├── components/     # 24+ Vue 组件
│   │   ├── ErrorBoundary.vue
│   │   ├── GlobalErrorModal.vue
│   │   ├── InlineError.vue
│   │   ├── FormFieldError.vue
│   │   ├── Loading*.vue (16 个)
│   │   ├── Skeleton.vue
│   │   ├── Toast*.vue (7 个)
│   │   ├── NotificationCenter.vue
│   │   ├── NotificationItem.vue
│   │   └── index.ts
│   ├── stores/         # 2 个 Pinia store
│   │   ├── toast.ts
│   │   ├── notification.ts
│   │   └── index.ts
│   └── index.ts
├── tests/              # 4 个测试文件
│   ├── error.test.ts
│   ├── loading.test.ts
│   ├── toast.test.ts
│   └── notification.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## License

MIT — ManhuaWorks
