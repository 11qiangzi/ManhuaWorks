/**
 * studio · character Pinia store — 角色 CRUD 真 API 接入
 *
 * 数据来源: GET /projects/:pid/characters → CharacterItem[]
 * 后端字段: id, project_id, name, archetype, description, tags, prompt, thumbnail_url
 *
 * 设计原则:
 *   1. 真 API 优先 — 拉取失败/超时立即 fallback 到 mock,不阻塞 UI
 *   2. 短超时(2.5s) — 后端未启动时不卡
 *   3. 状态机: idle → loading → ready / error
 *   4. 写操作(create/remove)走真 API,失败抛错
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

/** 角色条目 — 对应后端 /api/v1/characters 资源 */
export interface CharacterItem {
  id: string
  project_id: string
  name: string
  archetype: string
  description?: string
  tags?: string[]
  prompt?: string
  thumbnail_url?: string
  created_at?: string
  updated_at?: string
}

const REQUEST_TIMEOUT_MS = 2500

export const useCharacterStore = defineStore('character', () => {
  const api = getApi()

  // ---------- state ----------
  const characters = ref<CharacterItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const projectId = ref<string | null>(null)
  const lastSource = ref<'api' | 'mock' | 'empty'>('empty')

  // ---------- getters ----------
  /** 按 archetype 分类分组 */
  const byArchetype = computed<Record<string, CharacterItem[]>>(() => {
    const groups: Record<string, CharacterItem[]> = {}
    for (const c of characters.value) {
      const key = c.archetype || 'unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(c)
    }
    return groups
  })

  const count = computed(() => characters.value.length)

  // ---------- actions ----------

  /** 拉取角色列表,失败时 fallback 到 mockFallback */
  async function load(pid: string, mockFallback: CharacterItem[] = []): Promise<void> {
    projectId.value = pid
    loading.value = true
    error.value = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts = { timeoutMs: REQUEST_TIMEOUT_MS } as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await api.http.get<any>(
        `/projects/${encodeURIComponent(pid)}/characters`,
        undefined,
        opts,
      )
      // 兼容 {items:[...]}, {list:[...]}, {data:[...]} 或直接数组
      const list = Array.isArray(resp) ? resp : (resp?.items ?? resp?.list ?? resp?.data ?? [])
      characters.value = Array.isArray(list) ? list : []
      lastSource.value = characters.value.length > 0 ? 'api' : 'empty'
    } catch (e) {
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '未知错误')
      error.value = `API 拉取失败 (${msg})，已回退本地数据`
      characters.value = mockFallback
      lastSource.value = mockFallback.length > 0 ? 'mock' : 'empty'
    } finally {
      loading.value = false
    }
  }

  /** 新增角色（走真 API） */
  async function create(data: { name: string; archetype: string; description?: string }): Promise<CharacterItem> {
    if (!projectId.value) throw new Error('未选择项目')
    loading.value = true
    error.value = null
    try {
      const item = await api.http.post<CharacterItem>(
        `/projects/${encodeURIComponent(projectId.value)}/characters`,
        { name: data.name, archetype: data.archetype, description: data.description },
      )
      characters.value.unshift(item)
      return item
    } catch (e) {
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '新增失败')
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 删除角色（乐观更新 + 真 API） */
  async function remove(charId: string): Promise<void> {
    if (!projectId.value) throw new Error('未选择项目')
    const snapshot = characters.value.slice()
    loading.value = true
    error.value = null
    try {
      characters.value = characters.value.filter(c => c.id !== charId)
      await api.http.delete(
        `/projects/${encodeURIComponent(projectId.value)}/characters/${encodeURIComponent(charId)}`,
      )
    } catch (e) {
      // 回滚
      characters.value = snapshot
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '删除失败')
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearError(): void {
    error.value = null
  }

  return {
    // state
    characters, loading, error, projectId, lastSource,
    // getters
    byArchetype, count,
    // actions
    load, create, remove, clearError,
  }
})

export { REQUEST_TIMEOUT_MS }
