/**
 * useWorks — 我的作品状态管理
 * 千机工坊 · W4 用户后台
 */

import { ref, computed, watch, type Ref } from 'vue'
import {
  workService,
  type Work,
  type WorkType,
  type WorkVisibility,
  type WorkFilter
} from '@/api/work-service'

export interface UseWorksOptions {
  pageSize?: number
  autoLoad?: boolean
}

export interface UseWorksReturn {
  works: Ref<Work[]>
  total: Ref<number>
  loading: Ref<boolean>
  error: Ref<string | null>

  typeFilter: Ref<WorkType | 'all'>
  visibilityFilter: Ref<WorkVisibility | 'all'>
  searchKeyword: Ref<string>

  byType: Ref<Record<WorkType, Work[]>>

  load: () => Promise<void>
  remove: (id: string) => Promise<boolean>
  updateVisibility: (id: string, v: WorkVisibility) => Promise<boolean>
  getShareLink: (id: string) => Promise<{ url: string; expiresAt: string }>
  refresh: () => Promise<void>
}

export function useWorks(options: UseWorksOptions = {}): UseWorksReturn {
  const { pageSize: initPageSize = 24, autoLoad = true } = options

  /* ===== 状态 ===== */
  const works = ref<Work[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const typeFilter = ref<WorkType | 'all'>('all')
  const visibilityFilter = ref<WorkVisibility | 'all'>('all')
  const searchKeyword = ref('')

  /* ===== 衍生 ===== */
  const byType = computed<Record<WorkType, Work[]>>(() => {
    const map: Record<string, Work[]> = { video: [], animation: [], comic: [], audiobook: [] }
    for (const w of works.value) {
      if (map[w.type]) map[w.type]!.push(w)
    }
    return map as Record<WorkType, Work[]>
  })

  /* ===== 操作 ===== */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const filter: WorkFilter = {
        type: typeFilter.value === 'all' ? undefined : typeFilter.value,
        visibility: visibilityFilter.value === 'all' ? undefined : visibilityFilter.value,
        keyword: searchKeyword.value.trim() || undefined,
        page: 1,
        pageSize: initPageSize,
        sortBy: 'publishedAt',
        sortDir: 'desc'
      }
      const result = await workService.list(filter)
      works.value = result.list
      total.value = result.total
    } catch (err) {
      error.value = (err as Error).message
      works.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      await workService.remove(id)
      works.value = works.value.filter((w) => w.id !== id)
      total.value = Math.max(0, total.value - 1)
      return true
    } catch (err) {
      error.value = (err as Error).message
      return false
    }
  }

  async function updateVisibility(id: string, v: WorkVisibility): Promise<boolean> {
    try {
      const updated = await workService.updateVisibility(id, v)
      const idx = works.value.findIndex((w) => w.id === id)
      if (idx >= 0) works.value[idx] = updated
      return true
    } catch (err) {
      error.value = (err as Error).message
      return false
    }
  }

  async function getShareLink(id: string) {
    return workService.getShareLink(id)
  }

  async function refresh(): Promise<void> {
    await load()
  }

  /* ===== 监听 ===== */
  watch([typeFilter, visibilityFilter, searchKeyword], () => {
    load()
  })

  /* ===== 自动加载 ===== */
  if (autoLoad) {
    load()
  }

  return {
    works,
    total,
    loading,
    error,
    typeFilter,
    visibilityFilter,
    searchKeyword,
    byType,
    load,
    remove,
    updateVisibility,
    getShareLink,
    refresh
  }
}