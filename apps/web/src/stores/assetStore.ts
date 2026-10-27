/**
 * studio · asset Pinia store — 素材资产 CRUD 真 API 接入
 *
 * 数据来源: GET /api/v1/assets?projectId=xxx[&category=yyy] → AssetItem[]
 * 后端字段: id, project_id, category(weapon|prop|accessory|effect), name,
 *           description, prompt, thumbnail_url, video_url, tags
 *
 * 设计原则（与 characterStore / sceneStore 一致）:
 *   1. 真 API 优先 — 拉取失败/超时立即 fallback 到 mock,不阻塞 UI
 *   2. 短超时(2.5s) — 后端未启动时不卡
 *   3. 状态机: idle → loading → ready / error
 *   4. 写操作(create/update/remove)走真 API,失败抛错/回滚
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

export type AssetCategory = 'weapon' | 'prop' | 'accessory' | 'effect'

/** 素材资产条目 — 对应后端 /api/v1/assets 资源 */
export interface AssetItem {
  id: string
  project_id: string
  category: AssetCategory
  name: string
  description?: string
  prompt?: string
  thumbnail_url?: string
  /** 特效·技能短视频 clip（mp4/webm） */
  video_url?: string
  tags?: string[]
  created_at?: string
  updated_at?: string
}

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  weapon: '武器',
  prop: '道具',
  accessory: '饰品',
  effect: '特效·技能',
}

const REQUEST_TIMEOUT_MS = 2500

export const useAssetStore = defineStore('asset', () => {
  const api = getApi()

  // ---------- state ----------
  const assets = ref<AssetItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const projectId = ref<string | null>(null)
  const lastSource = ref<'api' | 'mock' | 'empty'>('empty')

  // ---------- getters ----------
  /** 按 category 分类分组 */
  const byCategory = computed<Record<AssetCategory, AssetItem[]>>(() => {
    const groups: Record<AssetCategory, AssetItem[]> = {
      weapon: [], prop: [], accessory: [], effect: [],
    }
    for (const a of assets.value) {
      const key = (a.category || 'prop') as AssetCategory
      if (!groups[key]) groups[key] = []
      groups[key].push(a)
    }
    return groups
  })

  const count = computed(() => assets.value.length)

  // ---------- actions ----------

  /** 拉取资产列表（可按 category 过滤），失败时 fallback 到 mockFallback */
  async function load(pid: string, category?: AssetCategory, mockFallback: AssetItem[] = []): Promise<void> {
    projectId.value = pid
    loading.value = true
    error.value = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts = { timeoutMs: REQUEST_TIMEOUT_MS } as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: Record<string, unknown> = { projectId: pid }
      if (category) params.category = category
      const resp = await api.http.get<any>(
        `/api/v1/assets`,
        params,
        opts,
      )
      // 兼容 {items:[...]}, {list:[...]}, {data:[...]} 或直接数组
      const list = Array.isArray(resp) ? resp : (resp?.items ?? resp?.list ?? resp?.data ?? [])
      assets.value = Array.isArray(list) ? list : []
      lastSource.value = assets.value.length > 0 ? 'api' : 'empty'
    } catch (e) {
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '未知错误')
      error.value = `API 拉取失败 (${msg})，已回退本地数据`
      assets.value = mockFallback
      lastSource.value = mockFallback.length > 0 ? 'mock' : 'empty'
    } finally {
      loading.value = false
    }
  }

  /** 新增资产（走真 API） */
  async function create(data: Partial<AssetItem> & { name: string; category: AssetCategory }): Promise<AssetItem> {
    if (!projectId.value) throw new Error('未选择项目')
    loading.value = true
    error.value = null
    try {
      const item = await api.http.post<AssetItem>(
        `/api/v1/assets`,
        {
          projectId: projectId.value,
          category: data.category,
          name: data.name,
          description: data.description,
          prompt: data.prompt,
          thumbnail_url: data.thumbnail_url,
          video_url: data.video_url,
          tags: data.tags,
        },
      )
      assets.value.unshift(item)
      return item
    } catch (e) {
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '新增失败')
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 更新资产（乐观更新 + 真 API）— 主要用于特效生成视频后回填 video_url */
  async function update(id: string, patch: Partial<AssetItem>): Promise<AssetItem> {
    if (!projectId.value) throw new Error('未选择项目')
    const snapshot = assets.value.slice()
    loading.value = true
    error.value = null
    try {
      const item = await api.http.patch<AssetItem>(
        `/api/v1/assets/${encodeURIComponent(id)}`,
        patch,
      )
      const idx = assets.value.findIndex(a => a.id === id)
      if (idx >= 0) assets.value[idx] = { ...assets.value[idx], ...item }
      else assets.value.unshift(item)
      return item
    } catch (e) {
      assets.value = snapshot
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '更新失败')
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 删除资产（乐观更新 + 真 API） */
  async function remove(assetId: string): Promise<void> {
    if (!projectId.value) throw new Error('未选择项目')
    const snapshot = assets.value.slice()
    loading.value = true
    error.value = null
    try {
      assets.value = assets.value.filter(a => a.id !== assetId)
      await api.http.delete(
        `/api/v1/assets/${encodeURIComponent(assetId)}`,
      )
    } catch (e) {
      // 回滚
      assets.value = snapshot
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
    assets, loading, error, projectId, lastSource,
    // getters
    byCategory, count,
    // actions
    load, create, update, remove, clearError,
  }
})

export { REQUEST_TIMEOUT_MS }
