/**
 * api-client composable — 统一 API 客户端 (派单 47)
 *
 * 替代各 app 中直接 import axios 的模式。
 * 集中管理：JWT 注入 / 401 刷新 / 重试 / 超时 / 错误格式。
 *
 * 用法:
 *   import { useApi } from '@manhuaworks/api-client'
 *   const { client } = useApi()
 *   const data = await client.http.get('/api/v1/projects')
 *   const user = await client.users.getProfile()
 */
import { createApiClient, tokenStore } from '@manhuaworks/api-client'
import { computed } from 'vue'
import type { ApiBundle, CreateApiClientOptions } from '@manhuaworks/api-client'

let _singleton: ApiBundle | null = null

export interface UseApiOptions extends CreateApiClientOptions {
  /** 单例模式 (默认 true, 全局共享一个 client 实例) */
  singleton?: boolean
}

export function useApi(opts: UseApiOptions = {}): {
  client: ApiBundle
  isReady: ReturnType<typeof computed<boolean>>
} {
  const { singleton = true, ...rest } = opts

  if (singleton && _singleton) {
    return {
      client: _singleton,
      isReady: computed(() => !!tokenStore.get()),
    }
  }

  const client = createApiClient({
    baseURL: '/api',
    timeoutMs: 30_000,
    maxRetries: 3,
    ...rest,
    onAuthLost: () => {
      tokenStore.clearAll()
      // 重定向到登录页 (仅浏览器环境)
      if (typeof window !== 'undefined') {
        const host = window.location.hostname
        window.location.href = `http://${host}:3000/login?return=${encodeURIComponent(window.location.href)}`
      }
    },
  })

  if (singleton) {
    _singleton = client
  }

  return {
    client,
    isReady: computed(() => !!tokenStore.get()),
  }
}

/** 单例 client (直接调用, 不依赖 Vue setup) */
export function getClient(): ApiBundle {
  if (!_singleton) {
    _singleton = createApiClient({
      baseURL: '/api',
      timeoutMs: 30_000,
      maxRetries: 3,
      onAuthLost: () => {
        tokenStore.clearAll()
        if (typeof window !== 'undefined') {
          const host = window.location.hostname
          window.location.href = `http://${host}:3000/login?return=${encodeURIComponent(window.location.href)}`
        }
      },
    })
  }
  return _singleton
}
