/**
 * studio · project Pinia store — 接 project-service（含镜头 shot 状态机）
 * 千机工坊 · L2 task 8
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import type { ProjectDTO, ShotDTO, CreateProjectReq, CreateShotReq, UpdateShotReq } from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

export const useProjectStore = defineStore('project', () => {
  const api = getApi()

  const projects = ref<ProjectDTO[]>([])
  const current = ref<ProjectDTO | null>(null)
  const shots = ref<ShotDTO[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(50)

  const active = computed(() => projects.value.filter((p) => p.status !== 'archived'))
  const currentShots = computed(() => shots.value)

  const shotStats = computed(() => {
    const list = shots.value
    return {
      total: list.length,
      draft: list.filter((s) => s.status === 'draft').length,
      wip: list.filter((s) => s.status === 'wip').length,
      done: list.filter((s) => s.status === 'done').length,
      archived: list.filter((s) => s.status === 'archived').length,
    }
  })

  async function loadList(reset = true): Promise<void> {
    loading.value = true
    error.value = null
    try {
      if (reset) {
        page.value = 1
        projects.value = []
      }
      const r = await api.projects.list({ page: page.value, pageSize: pageSize.value })
      if (reset) {
        projects.value = r.list
      } else {
        projects.value = [...projects.value, ...r.list]
      }
      total.value = r.total
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '加载项目失败'
      throw e
    } finally { loading.value = false }
  }

  async function loadOne(id: string): Promise<void> {
    loading.value = true
    try {
      current.value = await api.projects.get(id)
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '加载失败'
      throw e
    } finally { loading.value = false }
  }

  async function create(req: CreateProjectReq): Promise<ProjectDTO> {
    loading.value = true
    error.value = null
    try {
      const p = await api.projects.create(req)
      projects.value.unshift(p)
      current.value = p
      return p
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function update(id: string, patch: import('@manhuaworks/api-client').UpdateProjectReq): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const u = await api.projects.update(id, patch)
      const idx = projects.value.findIndex((p) => p.id === id)
      if (idx >= 0) projects.value[idx] = u
      if (current.value?.id === id) current.value = u
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function archive(id: string): Promise<void> {
    await api.projects.archive(id)
    projects.value = projects.value.filter((p) => p.id !== id)
    if (current.value?.id === id) {
      current.value = null
      shots.value = []
    }
  }

  /* ---- Shots（镜头） ---- */

  async function loadShots(projectId: string): Promise<void> {
    const r = await api.projects.listShots(projectId, { pageSize: 200 })
    shots.value = r.list
  }

  async function createShot(projectId: string, req: CreateShotReq): Promise<ShotDTO> {
    const s = await api.projects.createShot(projectId, req)
    shots.value.push(s)
    shots.value.sort((a, b) => a.order_index - b.order_index)
    return s
  }

  async function updateShot(projectId: string, shotId: string, patch: UpdateShotReq): Promise<ShotDTO> {
    const u = await api.projects.updateShot(projectId, shotId, patch)
    const idx = shots.value.findIndex((s) => s.id === shotId)
    if (idx >= 0) shots.value[idx] = u
    return u
  }

  async function deleteShot(projectId: string, shotId: string): Promise<void> {
    await api.projects.deleteShot(projectId, shotId)
    shots.value = shots.value.filter((s) => s.id !== shotId)
  }

  /** 乐观更新：状态机 draft → wip → done / archived */
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['wip'],
    wip: ['review', 'draft'],
    review: ['done', 'wip'],
    done: ['archived'],
    archived: [],
  }

  function optimisticUpdateStatus(shotId: string, status: ShotDTO['status']): void {
    const idx = shots.value.findIndex((s) => s.id === shotId)
    if (idx < 0) return
    const cur = shots.value[idx]!
    const allowed = VALID_TRANSITIONS[cur.status]
    if (!allowed || !allowed.includes(status)) return
    shots.value[idx] = { ...cur, status }
  }

  return {
    projects, current, shots, loading, error, total, page, pageSize,
    active, currentShots, shotStats,
    loadList, loadOne, create, update, archive,
    loadShots, createShot, updateShot, deleteShot, optimisticUpdateStatus,
  }
})
