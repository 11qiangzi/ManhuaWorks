import { ref, reactive } from 'vue'

/** 通用 API 请求状态 */
export interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
  status: number | null
  loading: boolean
  duration: number | null
}

/** 模拟 API Key 列表 */
export interface ApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsed: string
  status: 'active' | 'revoked' | 'expired'
  usageCount: number
}

/** 模拟 API 调用日志 */
export interface ApiCallLog {
  id: string
  method: string
  path: string
  status: number
  duration: number
  timestamp: string
  keyPrefix: string
}

/** Mock API Keys */
export function useMockApiKeys() {
  const keys = ref<ApiKey[]>([
    {
      id: 'key_001',
      name: '生产环境 Key',
      prefix: 'sk-prod-a8f3...k2m1',
      createdAt: '2026-01-15',
      lastUsed: '2026-04-10 14:32',
      status: 'active',
      usageCount: 12847,
    },
    {
      id: 'key_002',
      name: '测试环境 Key',
      prefix: 'sk-test-b2c7...p9x4',
      createdAt: '2026-02-20',
      lastUsed: '2026-04-10 16:05',
      status: 'active',
      usageCount: 3562,
    },
    {
      id: 'key_003',
      name: 'CI/CD 流水线',
      prefix: 'sk-cicd-d4e9...w7n2',
      createdAt: '2026-03-01',
      lastUsed: '2026-04-09 08:17',
      status: 'active',
      usageCount: 891,
    },
    {
      id: 'key_004',
      name: '旧版集成（已废弃）',
      prefix: 'sk-old-f1g6...r3t8',
      createdAt: '2025-11-10',
      lastUsed: '2026-02-28 11:43',
      status: 'revoked',
      usageCount: 45230,
    },
  ])

  const createKey = (name: string) => {
    const newKey: ApiKey = {
      id: `key_${Date.now()}`,
      name,
      prefix: `sk-new-${Math.random().toString(36).slice(2, 6)}...${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString().slice(0, 10),
      lastUsed: '从未使用',
      status: 'active',
      usageCount: 0,
    }
    keys.value.unshift(newKey)
    return newKey
  }

  const deleteKey = (id: string) => {
    keys.value = keys.value.filter((k) => k.id !== id)
  }

  return { keys, createKey, deleteKey }
}

/** Mock API 调用日志 */
export function useMockCallLogs() {
  const logs = ref<ApiCallLog[]>([
    { id: 'log_1', method: 'POST', path: '/v1/audio/generate', status: 200, duration: 2340, timestamp: '2026-04-10 16:05:12', keyPrefix: 'sk-test' },
    { id: 'log_2', method: 'POST', path: '/v1/images/generate', status: 200, duration: 5120, timestamp: '2026-04-10 16:03:44', keyPrefix: 'sk-prod' },
    { id: 'log_3', method: 'GET', path: '/v1/comics/mh_8xk21', status: 200, duration: 89, timestamp: '2026-04-10 15:58:30', keyPrefix: 'sk-prod' },
    { id: 'log_4', method: 'POST', path: '/v1/audio/match', status: 200, duration: 1560, timestamp: '2026-04-10 15:52:17', keyPrefix: 'sk-test' },
    { id: 'log_5', method: 'PATCH', path: '/v1/comics/mh_8xk21', status: 200, duration: 134, timestamp: '2026-04-10 15:45:03', keyPrefix: 'sk-prod' },
    { id: 'log_6', method: 'POST', path: '/v1/video/generate', status: 429, duration: 12, timestamp: '2026-04-10 15:40:55', keyPrefix: 'sk-cicd' },
    { id: 'log_7', method: 'DELETE', path: '/v1/comics/mh_old99', status: 404, duration: 45, timestamp: '2026-04-10 15:30:22', keyPrefix: 'sk-test' },
    { id: 'log_8', method: 'POST', path: '/v1/audio/sfx', status: 200, duration: 3210, timestamp: '2026-04-10 15:25:10', keyPrefix: 'sk-prod' },
    { id: 'log_9', method: 'GET', path: '/v1/tts/voices', status: 200, duration: 67, timestamp: '2026-04-10 15:20:48', keyPrefix: 'sk-prod' },
    { id: 'log_10', method: 'POST', path: '/v1/audio/process', status: 200, duration: 4500, timestamp: '2026-04-10 15:15:33', keyPrefix: 'sk-test' },
  ])
  return { logs }
}

/** 通用 fetch 封装（用于 Playground） */
export function useDevFetch() {
  const response = reactive<ApiResponse>({
    data: null,
    error: null,
    status: null,
    loading: false,
    duration: null,
  })

  async function send(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: string
  ) {
    response.loading = true
    response.error = null
    response.data = null
    response.status = null
    response.duration = null

    const start = performance.now()

    try {
      const opts: RequestInit = {
        method,
        headers: { ...headers },
      }
      if (body && method !== 'GET') {
        opts.body = body
      }

      const res = await fetch(url, opts)
      const elapsed = Math.round(performance.now() - start)

      response.status = res.status
      response.duration = elapsed

      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        response.data = await res.json()
      } else {
        response.data = await res.text()
      }
    } catch (err: any) {
      response.error = err.message || '请求失败'
      response.duration = Math.round(performance.now() - start)
    } finally {
      response.loading = false
    }
  }

  return { response, send }
}
