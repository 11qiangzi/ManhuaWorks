/**
 * useProjects — 我的项目状态管理
 * 千机工坊 · W4 用户后台
 *
 * 功能：
 * 1. 项目列表（分页 / 排序 / 筛选）
 * 2. 状态筛选（draft / active / archived / published）
 * 3. 关键字搜索
 * 4. 创建 / 删除 / 归档 / 取消归档
 */

import { ref, computed, watch, type Ref } from 'vue'
import {
  projectService,
  type Project,
  type ProjectStatus,
  type ProjectFilter,
  type CreateProjectReq
} from '@/api/project-service'

export interface UseProjectsOptions {
  pageSize?: number
  autoLoad?: boolean
}

export interface UseProjectsReturn {
  projects: Ref<Project[]>
  total: Ref<number>
  loading: Ref<boolean>
  error: Ref<string | null>

  page: Ref<number>
  pageSize: Ref<number>

  statusFilter: Ref<ProjectStatus | 'all'>
  searchKeyword: Ref<string>

  counts: Ref<Record<ProjectStatus | 'all', number>>

  load: () => Promise<void>
  create: (req: CreateProjectReq) => Promise<Project | null>
  remove: (id: string) => Promise<boolean>
  archive: (id: string) => Promise<boolean>
  unarchive: (id: string) => Promise<boolean>
  refresh: () => Promise<void>
  reset: () => void
}

export function useProjects(options: UseProjectsOptions = {}): UseProjectsReturn {
  const { pageSize: initPageSize = 20, autoLoad = true } = options

  /* ===== 状态 ===== */
  const projects = ref<Project[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const page = ref(1)
  const pageSize = ref(initPageSize)

  const statusFilter = ref<ProjectStatus | 'all'>('all')
  const searchKeyword = ref('')

  /* ===== 衍生 ===== */
  const counts = computed<Record<ProjectStatus | 'all', number>>(() => {
    const list = projects.value ?? []
    const all = list.length
    const c: Record<ProjectStatus | 'all', number> = { draft: 0, active: 0, archived: 0, published: 0, all }
    for (const p of list) {
      c[p.status] = (c[p.status] ?? 0) + 1
    }
    return c
  })

  /* ===== 操作 ===== */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    page.value = 1
    try {
      const filter: ProjectFilter = {
        status: statusFilter.value === 'all' ? undefined : statusFilter.value,
        keyword: searchKeyword.value.trim() || undefined,
        page: page.value,
        pageSize: pageSize.value,
        sortBy: 'updatedAt',
        sortDir: 'desc'
      }
      const result = await projectService.list(filter)
      projects.value = result.list
      total.value = result.total
    } catch (err) {
      error.value = (err as Error).message
      projects.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  async function create(req: CreateProjectReq): Promise<Project | null> {
    try {
      const p = await projectService.create(req)
      projects.value.unshift(p)
      total.value += 1
      return p
    } catch (err) {
      error.value = (err as Error).message
      return null
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      await projectService.remove(id)
      projects.value = projects.value.filter((p) => p.id !== id)
      total.value = Math.max(0, total.value - 1)
      return true
    } catch (err) {
      error.value = (err as Error).message
      return false
    }
  }

  async function archive(id: string): Promise<boolean> {
    try {
      const updated = await projectService.archive(id)
      const idx = projects.value.findIndex((p) => p.id === id)
      if (idx >= 0) projects.value[idx] = updated
      return true
    } catch (err) {
      error.value = (err as Error).message
      return false
    }
  }

  async function unarchive(id: string): Promise<boolean> {
    try {
      const updated = await projectService.unarchive(id)
      const idx = projects.value.findIndex((p) => p.id === id)
      if (idx >= 0) projects.value[idx] = updated
      return true
    } catch (err) {
      error.value = (err as Error).message
      return false
    }
  }

  async function refresh(): Promise<void> {
    await load()
  }

  function reset(): void {
    projects.value = []
    total.value = 0
    page.value = 1
    statusFilter.value = 'all'
    searchKeyword.value = ''
    error.value = null
  }

  /* ===== 监听 ===== */
  watch([statusFilter, searchKeyword], () => {
    load()
  })

  /* ===== 自动加载 ===== */
  if (autoLoad) {
    load()
  }

  return {
    projects,
    total,
    loading,
    error,
    page,
    pageSize,
    statusFilter,
    searchKeyword,
    counts,
    load,
    create,
    remove,
    archive,
    unarchive,
    refresh,
    reset
  }
}