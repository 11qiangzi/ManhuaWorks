/**
 * useAssetShelf — 资产货架状态管理
 * ManhuaWorks · W3 工坊流程精修
 *
 * 功能：
 * 1. 资产列表（分页 / 排序 / 筛选）
 * 2. 类型筛选（image / video / audio / all）
 * 3. 标签筛选（多选 AND/OR）
 * 4. 上传（带进度）
 * 5. 删除
 * 6. 收藏 / 重命名
 *
 * 后端协议：/v1/assets
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { assetService, type AssetItem, type AssetType, type AssetFilter, type UploadProgress } from '@/api/asset-service'

export interface UseAssetShelfOptions {
  /** 项目 ID（可空：所有项目共享资产） */
  projectId?: Ref<string | null | undefined> | string | null
  /** 默认类型筛选 */
  defaultType?: AssetType | 'all'
  /** 默认每页条数 */
  pageSize?: number
  /** 自动加载 */
  autoLoad?: boolean
}

export interface UseAssetShelfReturn {
  // 数据
  assets: Ref<AssetItem[]>
  total: Ref<number>
  loading: Ref<boolean>
  error: Ref<string | null>
  // 分页
  page: Ref<number>
  pageSize: Ref<number>
  hasMore: ComputedRef<boolean>
  // 筛选
  typeFilter: Ref<AssetType | 'all'>
  tagFilter: Ref<string[]>
  searchKeyword: Ref<string>
  // 上传
  uploading: Ref<UploadProgress[]>
  // 操作
  load: () => Promise<void>
  loadMore: () => Promise<void>
  upload: (file: File, meta?: { tags?: string[]; alias?: string }) => Promise<AssetItem | null>
  remove: (id: string) => Promise<boolean>
  toggleFavorite: (id: string) => Promise<void>
  rename: (id: string, newName: string) => Promise<void>
  refresh: () => Promise<void>
  reset: () => void
  // 衍生数据
  byType: ComputedRef<Record<AssetType, AssetItem[]>>
  allTags: ComputedRef<string[]>
}

/**
 * 资产货架主 composable
 */
export function useAssetShelf(options: UseAssetShelfOptions = {}): UseAssetShelfReturn {
  const {
    projectId: projectIdOpt,
    defaultType = 'all',
    pageSize: initPageSize = 24,
    autoLoad = true
  } = options

  // 统一 projectId 为 ref
  const projectId = computed<string | null>(() => {
    const v = typeof projectIdOpt === 'string' || projectIdOpt == null
      ? projectIdOpt as string | null
      : (projectIdOpt as Ref<string | null | undefined>).value
    return v ?? null
  })

  // ===== 状态 =====
  const assets = ref<AssetItem[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const page = ref(1)
  const pageSize = ref(initPageSize)

  const typeFilter = ref<AssetType | 'all'>(defaultType)
  const tagFilter = ref<string[]>([])
  const searchKeyword = ref('')

  const uploading = ref<UploadProgress[]>([])

  // ===== 衍生 =====
  const hasMore = computed(() => assets.value.length < total.value)

  const byType = computed<Record<AssetType, AssetItem[]>>(() => {
    const map: Record<string, AssetItem[]> = {
      image: [], video: [], audio: [], other: []
    }
    for (const a of assets.value) {
      (map[a.type] ?? map.other).push(a)
    }
    return map as Record<AssetType, AssetItem[]>
  })

  const allTags = computed<string[]>(() => {
    const set = new Set<string>()
    for (const a of assets.value) {
      for (const t of a.tags ?? []) set.add(t)
    }
    return Array.from(set).sort()
  })

  // ===== 操作 =====
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    page.value = 1
    try {
      const filter: AssetFilter = {
        projectId: projectId.value,
        type: typeFilter.value,
        tags: tagFilter.value.length > 0 ? tagFilter.value : undefined,
        keyword: searchKeyword.value.trim() || undefined,
        page: page.value,
        pageSize: pageSize.value
      }
      const result = await assetService.list(filter)
      assets.value = result.list
      total.value = result.total
    } catch (err) {
      error.value = (err as Error).message
      assets.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      const nextPage = page.value + 1
      const filter: AssetFilter = {
        projectId: projectId.value,
        type: typeFilter.value,
        tags: tagFilter.value.length > 0 ? tagFilter.value : undefined,
        keyword: searchKeyword.value.trim() || undefined,
        page: nextPage,
        pageSize: pageSize.value
      }
      const result = await assetService.list(filter)
      assets.value.push(...result.list)
      total.value = result.total
      page.value = nextPage
    } catch (err) {
      error.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  async function upload(
    file: File,
    meta: { tags?: string[]; alias?: string } = {}
  ): Promise<AssetItem | null> {
    // 占位进度
    const placeholder: UploadProgress = {
      id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filename: file.name,
      loaded: 0,
      total: file.size,
      progress: 0,
      status: 'uploading'
    }
    uploading.value.push(placeholder)
    try {
      const item = await assetService.upload(file, {
        projectId: projectId.value,
        tags: meta.tags,
        alias: meta.alias,
        onProgress: (loaded, total) => {
          placeholder.loaded = loaded
          placeholder.total = total
          placeholder.progress = total > 0 ? Math.round((loaded / total) * 100) : 0
        }
      })
      placeholder.status = 'done'
      placeholder.progress = 100
      // 移除占位 + 插入新资产到头部
      setTimeout(() => {
        uploading.value = uploading.value.filter((u) => u.id !== placeholder.id)
      }, 1500)
      assets.value.unshift(item)
      total.value += 1
      return item
    } catch (err) {
      placeholder.status = 'error'
      placeholder.error = (err as Error).message
      setTimeout(() => {
        uploading.value = uploading.value.filter((u) => u.id !== placeholder.id)
      }, 4000)
      return null
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      await assetService.remove(id)
      assets.value = assets.value.filter((a) => a.id !== id)
      total.value = Math.max(0, total.value - 1)
      return true
    } catch (err) {
      error.value = (err as Error).message
      return false
    }
  }

  async function toggleFavorite(id: string): Promise<void> {
    const target = assets.value.find((a) => a.id === id)
    if (!target) return
    const original = target.favorite
    // 乐观更新
    target.favorite = !original
    try {
      await assetService.update(id, { favorite: !original })
    } catch (err) {
      // 回滚
      target.favorite = original
      error.value = (err as Error).message
    }
  }

  async function rename(id: string, newName: string): Promise<void> {
    const target = assets.value.find((a) => a.id === id)
    if (!target) return
    const original = target.name
    target.name = newName
    try {
      await assetService.update(id, { name: newName })
    } catch (err) {
      target.name = original
      error.value = (err as Error).message
    }
  }

  async function refresh(): Promise<void> {
    await load()
  }

  function reset(): void {
    assets.value = []
    total.value = 0
    page.value = 1
    typeFilter.value = defaultType
    tagFilter.value = []
    searchKeyword.value = ''
    error.value = null
  }

  // 筛选变化 → 自动重新加载
  watch([typeFilter, tagFilter, searchKeyword], () => {
    load()
  }, { deep: true })

  // 项目变化 → 重置 + 重新加载
  watch(projectId, () => {
    reset()
    load()
  })

  // 首次自动加载
  if (autoLoad) {
    // 不 await，避免阻塞
    load()
  }

  return {
    assets,
    total,
    loading,
    error,
    page,
    pageSize,
    hasMore,
    typeFilter,
    tagFilter,
    searchKeyword,
    uploading,
    load,
    loadMore,
    upload,
    remove,
    toggleFavorite,
    rename,
    refresh,
    reset,
    byType,
    allTags
  }
}
