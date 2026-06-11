/**
 * useAssetLibrary — 素材库状态管理
 * ManhuaWorks · W4 用户后台
 *
 * 功能：
 * 1. 列表 + 分页
 * 2. 分类筛选（5 类：图片/视频/音频/角色/场景）
 * 3. 标签筛选（多选）
 * 4. 收藏 / 重命名 / 删除
 * 5. 批量操作
 */

import { ref, computed, watch, type Ref } from 'vue'
import {
  assetLibraryService,
  type LibraryItem,
  type AssetCategory,
  type LibraryFilter
} from '@/api/asset-service'

export interface UseAssetLibraryOptions {
  pageSize?: number
  autoLoad?: boolean
}

export interface UseAssetLibraryReturn {
  items: Ref<LibraryItem[]>
  total: Ref<number>
  loading: Ref<boolean>
  error: Ref<string | null>

  categoryFilter: Ref<AssetCategory | 'all'>
  tagFilter: Ref<string[]>
  favoriteOnly: Ref<boolean>
  searchKeyword: Ref<string>

  selected: Ref<Set<string>>

  counts: Ref<Record<AssetCategory | 'all', number>>
  allTags: Ref<string[]>

  load: () => Promise<void>
  loadMore: () => Promise<void>
  upload: (file: File, meta?: { category?: AssetCategory; tags?: string[] }) => Promise<LibraryItem | null>
  remove: (id: string) => Promise<boolean>
  removeSelected: () => Promise<number>
  toggleFavorite: (id: string) => Promise<void>
  rename: (id: string, newName: string) => Promise<void>
  toggleSelect: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  refresh: () => Promise<void>
  reset: () => void
}

export function useAssetLibrary(options: UseAssetLibraryOptions = {}): UseAssetLibraryReturn {
  const { pageSize: initPageSize = 24, autoLoad = true } = options

  /* ===== 状态 ===== */
  const items = ref<LibraryItem[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const page = ref(1)
  const pageSize = ref(initPageSize)

  const categoryFilter = ref<AssetCategory | 'all'>('all')
  const tagFilter = ref<string[]>([])
  const favoriteOnly = ref(false)
  const searchKeyword = ref('')

  const selected = ref<Set<string>>(new Set())

  /* ===== 衍生 ===== */
  const counts = computed<Record<AssetCategory | 'all', number>>(() => {
    const c: Record<string, number> = {
      image: 0, video: 0, audio: 0, character: 0, scene: 0, all: items.value.length
    }
    for (const i of items.value) c[i.category] = (c[i.category] ?? 0) + 1
    return c as Record<AssetCategory | 'all', number>
  })

  const allTags = computed<string[]>(() => {
    const set = new Set<string>()
    for (const i of items.value) {
      for (const t of i.tags ?? []) set.add(t)
    }
    return Array.from(set).sort()
  })

  /* ===== 操作 ===== */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    page.value = 1
    try {
      const filter: LibraryFilter = {
        category: categoryFilter.value === 'all' ? undefined : categoryFilter.value,
        tags: tagFilter.value.length > 0 ? tagFilter.value : undefined,
        favorite: favoriteOnly.value || undefined,
        keyword: searchKeyword.value.trim() || undefined,
        page: page.value,
        pageSize: pageSize.value,
        sortBy: 'createdAt',
        sortDir: 'desc'
      }
      const result = await assetLibraryService.list(filter)
      items.value = result.list
      total.value = result.total
    } catch (err) {
      error.value = (err as Error).message
      items.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (items.value.length >= total.value || loading.value) return
    loading.value = true
    try {
      const nextPage = page.value + 1
      const filter: LibraryFilter = {
        category: categoryFilter.value === 'all' ? undefined : categoryFilter.value,
        tags: tagFilter.value.length > 0 ? tagFilter.value : undefined,
        favorite: favoriteOnly.value || undefined,
        keyword: searchKeyword.value.trim() || undefined,
        page: nextPage,
        pageSize: pageSize.value,
        sortBy: 'createdAt',
        sortDir: 'desc'
      }
      const result = await assetLibraryService.list(filter)
      items.value.push(...result.list)
      total.value = result.total
      page.value = nextPage
    } catch (err) {
      error.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  async function upload(file: File, meta: { category?: AssetCategory; tags?: string[] } = {}): Promise<LibraryItem | null> {
    try {
      const item = await assetLibraryService.upload(file, meta)
      items.value.unshift(item)
      total.value += 1
      return item
    } catch (err) {
      error.value = (err as Error).message
      return null
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      await assetLibraryService.remove(id)
      items.value = items.value.filter((i) => i.id !== id)
      total.value = Math.max(0, total.value - 1)
      selected.value.delete(id)
      return true
    } catch (err) {
      error.value = (err as Error).message
      return false
    }
  }

  async function removeSelected(): Promise<number> {
    const ids = Array.from(selected.value)
    if (ids.length === 0) return 0
    try {
      await assetLibraryService.removeMany(ids)
      const removedSet = new Set(ids)
      items.value = items.value.filter((i) => !removedSet.has(i.id))
      total.value = Math.max(0, total.value - ids.length)
      clearSelection()
      return ids.length
    } catch (err) {
      error.value = (err as Error).message
      return 0
    }
  }

  async function toggleFavorite(id: string): Promise<void> {
    const target = items.value.find((i) => i.id === id)
    if (!target) return
    const original = target.favorite
    target.favorite = !original
    try {
      await assetLibraryService.toggleFavorite(id)
    } catch (err) {
      target.favorite = original
      error.value = (err as Error).message
    }
  }

  async function rename(id: string, newName: string): Promise<void> {
    const target = items.value.find((i) => i.id === id)
    if (!target) return
    const original = target.name
    target.name = newName
    try {
      await assetLibraryService.update(id, { name: newName })
    } catch (err) {
      target.name = original
      error.value = (err as Error).message
    }
  }

  function toggleSelect(id: string): void {
    if (selected.value.has(id)) selected.value.delete(id)
    else selected.value.add(id)
    selected.value = new Set(selected.value) // 触发响应
  }

  function selectAll(): void {
    for (const i of items.value) selected.value.add(i.id)
    selected.value = new Set(selected.value)
  }

  function clearSelection(): void {
    selected.value = new Set()
  }

  async function refresh(): Promise<void> {
    await load()
  }

  function reset(): void {
    items.value = []
    total.value = 0
    page.value = 1
    categoryFilter.value = 'all'
    tagFilter.value = []
    favoriteOnly.value = false
    searchKeyword.value = ''
    error.value = null
    clearSelection()
  }

  /* ===== 监听 ===== */
  watch([categoryFilter, tagFilter, favoriteOnly, searchKeyword], () => {
    clearSelection()
    load()
  }, { deep: true })

  /* ===== 自动加载 ===== */
  if (autoLoad) {
    load()
  }

  return {
    items,
    total,
    loading,
    error,
    categoryFilter,
    tagFilter,
    favoriteOnly,
    searchKeyword,
    selected,
    counts,
    allTags,
    load,
    loadMore,
    upload,
    remove,
    removeSelected,
    toggleFavorite,
    rename,
    toggleSelect,
    selectAll,
    clearSelection,
    refresh,
    reset
  }
}