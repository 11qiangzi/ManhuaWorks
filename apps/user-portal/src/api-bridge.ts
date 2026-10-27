/**
 * user-portal · api bridge — 4 客户端单例
 * 千机工坊 · L2 task 8
 */
import { createApiClient, ApiError, tokenStore } from '@manhuaworks/api-client'
import type { ApiBundle } from '@manhuaworks/api-client'

let _api: ApiBundle | null = null

export function getApi(): ApiBundle {
  if (_api) return _api
  _api = createApiClient({
    baseURL: '/api/v1',
    onAuthLost: () => {
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

export function installGlobalErrorHook(onError: (e: ApiError) => void): void {
  window.addEventListener('unhandledrejection', (ev) => {
    const r = (ev as PromiseRejectionEvent).reason
    if (r instanceof ApiError) onError(r)
  })
}

export { ApiError }
