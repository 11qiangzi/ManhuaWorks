/**
 * api-keys · BYOK UI 测试
 * ManhuaWorks · M1-W4 · L4-A
 *
 * 真实后端契约 (L3.D 验证):
 *   - base: /api/v1/user/api-keys
 *   - GET  list:  GET  /api/v1/user/api-keys           → ApiKeyRow[]
 *   - POST create: POST /api/v1/user/api-keys          body {provider, apiKey, alias?}
 *   - GET  reveal: GET  /api/v1/user/api-keys/:id/reveal → {apiKey: '明文'}
 *   - DELETE:      DELETE /api/v1/user/api-keys/:id
 *   - envelope:    { code: 0=ok, message, data }
 *   - 字段:        id, userId, provider, keyFingerprint, lastFour, createdAt(ms), lastUsedAt(ms|null), revokedAt(ms|null)
 *
 * 10 测试覆盖:
 *   1. PROVIDER_META · 5 provider 元数据完整性
 *   2. fetchApiKeys · GET 解析 + Bearer 头
 *   3. createApiKey · body 字段 (provider, apiKey, alias?)
 *   4. createApiKey · label 触发 alias
 *   5. deleteApiKey · DELETE + URL encode
 *   6. revealApiKey · GET /:id/reveal 返回 {apiKey: 明文}
 *   7. error handling · HTTP 500 抛 ApiKeyError
 *   8. error handling · envelope code != 0 抛 ApiKeyError
 *   9. useApiKeys composable · 30s 倒计时
 *  10. useApiKeys composable · reveal 成功 + add/remove
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { effectScope, nextTick } from 'vue'

import {
  PROVIDER_META,
  PROVIDER_IDS,
  fetchApiKeys,
  createApiKey,
  deleteApiKey,
  revealApiKey,
  maskedDisplay,
  formatLastUsed,
  countConfigured,
  ApiKeyError,
  type ApiKeyRow,
  type ProviderId
} from '@/api/api-keys'
import { useApiKeys, REVEAL_TTL_MS } from '@/composables/apiKeys'

/* ========================================================== *
 * 工具：构造 Response (envelope 风格)
 * ========================================================== */
function jsonResp<T>(data: T, init: { status?: number; code?: number; message?: string } = {}): Response {
  const status = init.status ?? 200
  const body = { code: init.code ?? 0, message: init.message ?? 'ok', data }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

/** 真实后端 ApiKeyRow 示例 */
function fakeRow(overrides: Partial<ApiKeyRow> = {}): ApiKeyRow {
  return {
    id: 'key-1234',
    userId: 'user-5678',
    provider: 'openai',
    keyFingerprint: 'ab12cd34ef567890',
    lastFour: 'cdef',
    createdAt: Date.now(),
    lastUsedAt: null,
    revokedAt: null,
    ...overrides
  }
}

/* ========================================================== *
 * 1. PROVIDER_META · 5 个 provider 元数据
 * ========================================================== */
describe('PROVIDER_META · 5 provider 元数据', () => {
  it('正好 5 个 provider', () => {
    expect(PROVIDER_IDS).toHaveLength(5)
    expect(Object.keys(PROVIDER_META)).toHaveLength(5)
  })

  it('5 个 provider id 全部已知且不重复', () => {
    const ids: ProviderId[] = ['openai', 'anthropic', 'google', 'deepseek', 'minimax']
    for (const id of ids) {
      expect(PROVIDER_META[id]).toBeDefined()
      const meta = PROVIDER_META[id]
      expect(meta.id).toBe(id)
      expect(meta.name.length).toBeGreaterThan(0)
      expect(meta.logo.length).toBeGreaterThan(0)
      expect(meta.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(meta.placeholder.length).toBeGreaterThan(0)
      expect(meta.prefix.length).toBeGreaterThan(0)
    }
    expect(new Set(PROVIDER_IDS).size).toBe(5)
  })

  it('maskedDisplay 用 prefix + *** + lastFour 合成', () => {
    const row = fakeRow({ provider: 'openai', lastFour: 'cdef' })
    expect(maskedDisplay(row)).toBe('sk-***cdef')
  })

  it('formatLastUsed 处理 null / 数值 / 字符串', () => {
    expect(formatLastUsed(null)).toBe('从未使用')
    expect(formatLastUsed(Date.now())).toBe('刚刚')
  })

  it('countConfigured 计算已配置 / 未配置 provider 数', () => {
    const rows = [
      fakeRow({ provider: 'openai' }),
      fakeRow({ provider: 'anthropic', id: 'k2' })
    ]
    const r = countConfigured(rows)
    expect(r.configured).toBe(2)
    expect(r.unconfigured).toBe(3)
  })
})

/* ========================================================== *
 * 2. fetchApiKeys · 列表解析
 * ========================================================== */
describe('fetchApiKeys · GET /api/v1/user/api-keys 解析', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    localStorage.setItem('token', 'jwt-test-token')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('GET 解析 envelope, 透传 Authorization Bearer 头', async () => {
    const rows = [fakeRow({ provider: 'openai', lastFour: 'abcd' })]
    fetchSpy.mockResolvedValueOnce(jsonResp(rows))

    const data = await fetchApiKeys()
    expect(data).toEqual(rows)
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/v1/user/api-keys')
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-test-token')
  })

  it('空数组正常解析', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResp([]))
    const data = await fetchApiKeys()
    expect(data).toEqual([])
  })
})

/* ========================================================== *
 * 3. createApiKey · POST 字段
 * ========================================================== */
describe('createApiKey · POST /api/v1/user/api-keys 字段', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    localStorage.setItem('token', 'jwt')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('不带 label 时 body 只有 provider + apiKey', async () => {
    const created = fakeRow({ provider: 'openai' })
    fetchSpy.mockResolvedValueOnce(jsonResp(created, { status: 201, message: 'created' }))

    const data = await createApiKey('openai', 'sk-abc123def456')
    expect(data).toEqual(created)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/v1/user/api-keys')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ provider: 'openai', apiKey: 'sk-abc123def456' })
  })

  it('带 label 时 body 包含 alias', async () => {
    const created = fakeRow({ provider: 'google' })
    fetchSpy.mockResolvedValueOnce(jsonResp(created, { status: 201 }))

    await createApiKey('google', 'AIza-XYZ', '主力 Gemini')
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body).toEqual({ provider: 'google', apiKey: 'AIza-XYZ', alias: '主力 Gemini' })
  })

  it('空字符串 label 不写入 alias', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResp(fakeRow()))
    await createApiKey('deepseek', 'sk-ds-test', '   ')
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body).not.toHaveProperty('alias')
  })
})

/* ========================================================== *
 * 4. deleteApiKey · DELETE URL encode
 * ========================================================== */
describe('deleteApiKey · DELETE /api/v1/user/api-keys/:id', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    localStorage.setItem('token', 'jwt')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('DELETE 带 URL-encode id', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResp({ id: 'k/with slash' }))
    await deleteApiKey('k/with slash')
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/v1/user/api-keys/k%2Fwith%20slash')
    expect(init.method).toBe('DELETE')
  })
})

/* ========================================================== *
 * 5. revealApiKey · 真返回明文
 * ========================================================== */
describe('revealApiKey · GET /:id/reveal 返回明文', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    localStorage.setItem('token', 'jwt')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('GET /:id/reveal 解析 {apiKey: 明文}', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResp({ apiKey: 'sk-plaintext-1234abcd' }))
    const data = await revealApiKey('key-abc')
    expect(data).toEqual({ apiKey: 'sk-plaintext-1234abcd' })
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/v1/user/api-keys/key-abc/reveal')
    expect(init.method).toBe('GET')
  })
})

/* ========================================================== *
 * 6. 错误处理
 * ========================================================== */
describe('错误处理 · HTTP 5xx 与 envelope code != 0', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    localStorage.setItem('token', 'jwt')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('HTTP 500 抛 ApiKeyError (status=500)', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResp({ message: 'db down' }, { status: 500, code: -1 }))
    await expect(fetchApiKeys()).rejects.toThrow(ApiKeyError)
  })

  it('envelope code=1001 (业务错) 抛 ApiKeyError', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResp(null, { status: 200, code: 1001, message: 'key_invalid' }))
    await expect(createApiKey('openai', 'sk-bad')).rejects.toThrow(/key_invalid/)
  })
})

/* ========================================================== *
 * 7. useApiKeys composable
 * ========================================================== */
describe('useApiKeys composable · 30s 倒计时 + load/reveal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.setItem('token', 'jwt-composable')
  })

  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  it('REVEAL_TTL_MS = 30 秒', () => {
    expect(REVEAL_TTL_MS).toBe(30_000)
  })

  it('load: 拉取 + 填 keys + 关 loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResp([fakeRow()])))

    const scope = effectScope()
    let api: ReturnType<typeof useApiKeys> | null = null
    scope.run(() => { api = useApiKeys() })
    expect(api!.loading.value).toBe(false)

    const p = api!.load()
    expect(api!.loading.value).toBe(true)
    await p
    expect(api!.loading.value).toBe(false)
    expect(api!.keys.value).toHaveLength(1)
    expect(api!.hasKeys.value).toBe(true)

    scope.stop()
    vi.unstubAllGlobals()
  })

  it('reveal: 调 revealApiKey, fill revealText + 启动 30s 倒计时', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(jsonResp([fakeRow()]))
      .mockResolvedValueOnce(jsonResp({ apiKey: 'sk-plain-revealed-9999' }))
    vi.stubGlobal('fetch', fetchSpy)

    const scope = effectScope()
    let api: ReturnType<typeof useApiKeys> | null = null
    scope.run(() => { api = useApiKeys() })
    await api!.load()
    await api!.reveal('key-1234')

    expect(api!.revealText.value).toBe('sk-plain-revealed-9999')
    expect(api!.revealing.value).toBe(false)
    expect(api!.revealExpiresAt.value).not.toBeNull()
    expect(api!.revealSecondsLeft.value).toBe(30)

    // 跳 30 秒 → 自动关
    vi.advanceTimersByTime(30_500)
    await nextTick()
    expect(api!.revealText.value).toBeNull()
    expect(api!.revealSecondsLeft.value).toBe(0)

    scope.stop()
    vi.unstubAllGlobals()
  })

  it('reveal 失败 → error 字段, revealText 不填', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(jsonResp([fakeRow()]))
      .mockResolvedValueOnce(jsonResp(null, { status: 500, code: -1, message: 'reveal_disabled' }))
    vi.stubGlobal('fetch', fetchSpy)

    const scope = effectScope()
    let api: ReturnType<typeof useApiKeys> | null = null
    scope.run(() => { api = useApiKeys() })
    await api!.load()
    const result = await api!.reveal('key-1234')
    expect(result).toBeNull()
    expect(api!.revealText.value).toBeNull()
    expect(api!.error.value).toMatch(/reveal_disabled/)

    scope.stop()
    vi.unstubAllGlobals()
  })

  it('add/remove: 创建后 keys+1, remove 后 keys-1', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(jsonResp([fakeRow()]))                              // load
      .mockResolvedValueOnce(jsonResp(fakeRow({ id: 'new-key', provider: 'google' }), { status: 201 }))  // add
      .mockResolvedValueOnce(jsonResp([fakeRow(), fakeRow({ id: 'new-key', provider: 'google' })]))      // load after add
      .mockResolvedValueOnce(jsonResp({ id: 'new-key' }))                       // delete
    vi.stubGlobal('fetch', fetchSpy)

    const scope = effectScope()
    let api: ReturnType<typeof useApiKeys> | null = null
    scope.run(() => { api = useApiKeys() })
    await api!.load()
    expect(api!.keys.value).toHaveLength(1)

    const ok = await api!.add('google', 'AIza-1234abcd5678', '备用')
    expect(ok).toBe(true)
    expect(api!.keys.value).toHaveLength(2)

    const rm = await api!.remove('new-key')
    expect(rm).toBe(true)
    expect(api!.keys.value).toHaveLength(1)
    expect(api!.keys.value[0].id).toBe('key-1234')

    scope.stop()
    vi.unstubAllGlobals()
  })
})
