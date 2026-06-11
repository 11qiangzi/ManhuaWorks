/**
 * web · api bridge — 4 客户端单例 + 全局拦截器
 * ManhuaWorks · L2 task 8
 */
import { createApiClient, ApiError, tokenStore } from '@manhuaworks/api-client'
import type { ApiBundle } from '@manhuaworks/api-client'

let _api: ApiBundle | null = null

export function getApi(): ApiBundle {
  if (_api) return _api
  _api = createApiClient({
    onAuthLost: () => {
      // 401 救不回时清 token；具体跳转交给 main.ts 监听
      try {
        window.dispatchEvent(new CustomEvent('mhw:auth-lost'))
      } catch {
        /* noop */
      }
    },
    refreshHandler: async () => {
      const r = tokenStore.getRefresh()
      if (!r) return null
      try {
        const data = await _api!.users.refresh({ refresh_token: r })
        return data.token
      } catch {
        return null
      }
    },
  })
  return _api
}

/** 全局 fetch 错误 hook（在 main.ts 调用） */
export function installGlobalErrorHook(onError: (e: ApiError) => void): void {
  window.addEventListener('unhandledrejection', (ev) => {
    const r = (ev as PromiseRejectionEvent).reason
    if (r instanceof ApiError) onError(r)
  })
}

export { ApiError }
