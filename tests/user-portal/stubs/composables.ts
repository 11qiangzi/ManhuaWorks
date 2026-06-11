/**
 * user-portal · 组合式 API stubs
 *
 * 真实实现位于 `apps/user-portal/src/composables/`（W4 任务 1 完成后）
 *
 * 覆盖：useUser / useProjects / useWorks / useAssetLibrary
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type {
  User,
  Usage,
  Project,
  Work,
  LibraryView,
  LibraryGroup,
  Asset,
} from './types'

/* ==================== 抽象：fetcher ==================== */

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

export interface UseApiOptions {
  fetcher?: Fetcher
  /** 测试用：直接灌入数据，不走网络 */
  mockData?: unknown
}

/* ==================== useUser ==================== */

export interface UseUserReturn {
  me: Ref<User | null>
  usage: Ref<Usage | null>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  isPro: ComputedRef<boolean>
  storagePercent: ComputedRef<number>
  fetchMe: () => Promise<void>
  fetchUsage: () => Promise<void>
  updateProfile: (patch: Partial<Pick<User, 'display_name' | 'bio' | 'avatar_url'>>) => Promise<void>
  logout: () => Promise<void>
}

export function useUser(options: UseApiOptions = {}): UseUserReturn {
  const fetcher = options.fetcher ?? (() => fetch(...arguments as [string, RequestInit?]))
  const me = ref<User | null>(null)
  const usage = ref<Usage | null>(null)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  const isPro = computed(() => me.value?.plan === 'pro' || me.value?.plan === 'enterprise')
  const storagePercent = computed(() => usage.value?.storage.percent ?? 0)

  async function fetchMe() {
    isLoading.value = true
    error.value = null
    try {
      if (options.mockData !== undefined) {
        me.value = options.mockData as User
        return
      }
      const res = await fetcher('/v1/users/me')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      me.value = await res.json()
    } catch (e) {
      error.value = e as Error
    } finally {
      isLoading.value = false
    }
  }

  async function fetchUsage() {
    isLoading.value = true
    try {
      if (options.mockData !== undefined) {
        usage.value = options.mockData as Usage
        return
      }
      const res = await fetcher('/v1/users/me/usage')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      usage.value = await res.json()
    } finally {
      isLoading.value = false
    }
  }

  async function updateProfile(patch: Partial<Pick<User, 'display_name' | 'bio' | 'avatar_url'>>) {
    if (!me.value) throw new Error('not loaded')
    const res = await fetcher('/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    me.value = { ...me.value, ...patch }
  }

  async function logout() {
    await fetcher('/v1/auth/logout', { method: 'POST' })
    me.value = null
    usage.value = null
  }

  return { me, usage, isLoading, error, isPro, storagePercent, fetchMe, fetchUsage, updateProfile, logout }
}

/* ==================== useProjects ==================== */

export interface UseProjectsReturn {
  list: Ref<Project[]>
  cursor: Ref<string | null>
  hasMore: Ref<boolean>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  fetch: (reset?: boolean) => Promise<void>
  create: (input: { name: string; type: Project['type']; cover_url?: string | null }) => Promise<Project>
  remove: (id: string) => Promise<void>
  restore: (id: string) => Promise<void>
}

export interface UseProjectsOptions extends UseApiOptions {
  pageSize?: number
}

export function useProjects(options: UseProjectsOptions = {}): UseProjectsReturn {
  const pageSize = options.pageSize ?? 20
  const fetcher = options.fetcher ?? (() => fetch(...arguments as [string, RequestInit?]))
  const list = ref<Project[]>([])
  const cursor = ref<string | null>(null)
  const hasMore = ref(false)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  async function fetch(reset = false) {
    isLoading.value = true
    error.value = null
    try {
      if (reset) {
        list.value = []
        cursor.value = null
      }
      if (options.mockData !== undefined && reset) {
        list.value = options.mockData as Project[]
        return
      }
      const params = new URLSearchParams({ limit: String(pageSize) })
      if (cursor.value) params.set('cursor', cursor.value)
      const res = await fetcher(`/v1/projects?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { data: Project[]; next_cursor: string | null; has_more: boolean }
      list.value = [...list.value, ...data.data]
      cursor.value = data.next_cursor
      hasMore.value = data.has_more
    } catch (e) {
      error.value = e as Error
    } finally {
      isLoading.value = false
    }
  }

  async function create(input: { name: string; type: Project['type']; cover_url?: string | null }): Promise<Project> {
    const res = await fetcher('/v1/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const project = await res.json()
    list.value = [project, ...list.value]
    return project
  }

  async function remove(id: string) {
    const res = await fetcher(`/v1/projects/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    list.value = list.value.filter(p => p.id !== id)
  }

  async function restore(id: string) {
    const res = await fetcher(`/v1/projects/${id}/restore`, { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await fetch(true)
  }

  return { list, cursor, hasMore, isLoading, error, fetch, create, remove, restore }
}

/* ==================== useWorks ==================== */

export interface UseWorksReturn {
  list: Ref<Work[]>
  isLoading: Ref<boolean>
  fetch: () => Promise<void>
  create: (input: { title: string; type: Work['type']; project_id: string }) => Promise<Work>
  duplicate: (id: string) => Promise<Work>
  export: (id: string, opts: { format: string; resolution: string }) => Promise<{ task_id: string }>
}

export function useWorks(options: UseApiOptions = {}): UseWorksReturn {
  const fetcher = options.fetcher ?? (() => fetch(...arguments as [string, RequestInit?]))
  const list = ref<Work[]>([])
  const isLoading = ref(false)

  async function fetch() {
    isLoading.value = true
    try {
      if (options.mockData !== undefined) {
        list.value = options.mockData as Work[]
        return
      }
      const res = await fetcher('/v1/works')
      const data = await res.json() as { data: Work[] }
      list.value = data.data
    } finally {
      isLoading.value = false
    }
  }

  async function create(input: { title: string; type: Work['type']; project_id: string }): Promise<Work> {
    const res = await fetcher('/v1/works', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const work = await res.json()
    list.value = [work, ...list.value]
    return work
  }

  async function duplicate(id: string): Promise<Work> {
    const res = await fetcher(`/v1/works/${id}/duplicate`, { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  }

  async function exportWork(id: string, opts: { format: string; resolution: string }) {
    const res = await fetcher(`/v1/works/${id}/export`, {
      method: 'POST',
      body: JSON.stringify(opts),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json() as { task_id: string }
  }

  return { list, isLoading, fetch, create, duplicate, export: exportWork }
}

/* ==================== useAssetLibrary ==================== */

export interface UseAssetLibraryReturn {
  view: Ref<LibraryView | null>
  assets: Ref<Asset[]>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  fetch: () => Promise<void>
  upload: (file: { name: string; size: number; type: string }, projectId?: string) => Promise<Asset>
  remove: (id: string) => Promise<void>
  totalSizeMb: ComputedRef<number>
  byType: ComputedRef<Record<string, Asset[]>>
}

export function useAssetLibrary(options: UseApiOptions = {}): UseAssetLibraryReturn {
  const fetcher = options.fetcher ?? (() => fetch(...arguments as [string, RequestInit?]))
  const view = ref<LibraryView | null>(null)
  const assets = ref<Asset[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  const totalSizeMb = computed(() => view.value?.total_mb ?? 0)
  const byType = computed(() => {
    const m: Record<string, Asset[]> = {}
    for (const a of assets.value) {
      ;(m[a.type] ??= []).push(a)
    }
    return m
  })

  async function fetch() {
    isLoading.value = true
    try {
      if (options.mockData !== undefined) {
        const data = options.mockData as { view: LibraryView; assets: Asset[] }
        view.value = data.view
        assets.value = data.assets
        return
      }
      const res = await fetcher('/v1/assets/library?group_by=type')
      const data = await res.json() as { groups: LibraryGroup[]; total: number; total_mb: number }
      view.value = { groups: data.groups, total: data.total, total_mb: data.total_mb }
      const res2 = await fetcher('/v1/assets?limit=100')
      const data2 = await res2.json() as { data: Asset[] }
      assets.value = data2.data
    } catch (e) {
      error.value = e as Error
    } finally {
      isLoading.value = false
    }
  }

  async function upload(file: { name: string; size: number; type: string }, projectId?: string): Promise<Asset> {
    const initRes = await fetcher('/v1/assets/uploads/init', {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        size: file.size,
        content_type: file.type,
        project_id: projectId,
      }),
    })
    if (!initRes.ok) throw new Error('init failed')
    const init = await initRes.json() as { upload_url: string; asset_id: string }
    // 真实上传到 S3（这里 mock）
    const asset: Asset = {
      id: init.asset_id,
      filename: file.name,
      type: file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('video/') ? 'video'
        : file.type.startsWith('audio/') ? 'audio'
        : 'document',
      size_mb: file.size / (1024 * 1024),
      url: init.upload_url,
      thumbnail_url: null,
      project_id: projectId ?? null,
      created_at: new Date().toISOString(),
    }
    await fetcher('/v1/assets/uploads/complete', {
      method: 'POST',
      body: JSON.stringify({ asset_id: init.asset_id }),
    })
    assets.value = [asset, ...assets.value]
    return asset
  }

  async function remove(id: string) {
    const res = await fetcher(`/v1/assets/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('remove failed')
    assets.value = assets.value.filter(a => a.id !== id)
  }

  return { view, assets, isLoading, error, fetch, upload, remove, totalSizeMb, byType }
}
