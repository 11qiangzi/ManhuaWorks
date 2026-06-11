/**
 * web · project Pinia store — 接 project-service
 * ManhuaWorks · L2 task 8
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import type { ProjectDTO, ProjectMemberDTO, ShotDTO, CreateProjectReq } from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

export const useProjectStore = defineStore('project', () => {
  const api = getApi()

  const projects = ref<ProjectDTO[]>([])
  const current = ref<ProjectDTO | null>(null)
  const members = ref<ProjectMemberDTO[]>([])
  const shots = ref<ShotDTO[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)

  const archived = computed(() => projects.value.filter((p) => p.status === 3))
  const active = computed(() => projects.value.filter((p) => p.status !== 3))

  async function loadList(reset = true): Promise<void> {
    loading.value = true
    error.value = null
    try {
      if (reset) {
        page.value = 1
        projects.value = []
      }
      const r = await api.projects.list({ page: page.value, pageSize: pageSize.value })
      projects.value = r.list
      total.value = r.total
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '加载项目失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (projects.value.length >= total.value) return
    page.value += 1
    try {
      const r = await api.projects.list({ page: page.value, pageSize: pageSize.value })
      projects.value.push(...r.list)
    } catch (e) {
      page.value -= 1
      throw e
    }
  }

  async function loadOne(id: string): Promise<void> {
    loading.value = true
    try {
      current.value = await api.projects.get(id)
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '加载失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(req: CreateProjectReq): Promise<ProjectDTO> {
    const p = await api.projects.create(req)
    projects.value.unshift(p)
    return p
  }

  async function update(id: string, patch: import('@manhuaworks/api-client').UpdateProjectReq): Promise<void> {
    const u = await api.projects.update(id, patch)
    const idx = projects.value.findIndex((p) => p.id === id)
    if (idx >= 0) projects.value[idx] = u
    if (current.value?.id === id) current.value = u
  }

  async function archive(id: string): Promise<void> {
    await api.projects.archive(id)
    projects.value = projects.value.filter((p) => p.id !== id)
    if (current.value?.id === id) current.value = null
  }

  /* ---- Members ---- */

  async function loadMembers(projectId: string): Promise<void> {
    members.value = await api.projects.listMembers(projectId)
  }

  async function invite(projectId: string, email: string, role: 'editor' | 'viewer' = 'editor'): Promise<void> {
    const m = await api.projects.inviteMember(projectId, { email, role })
    members.value.push(m)
  }

  async function removeMember(projectId: string, userId: string): Promise<void> {
    await api.projects.removeMember(projectId, userId)
    members.value = members.value.filter((m) => m.user_id !== userId)
  }

  /* ---- Shots ---- */

  async function loadShots(projectId: string): Promise<void> {
    const r = await api.projects.listShots(projectId, { pageSize: 100 })
    shots.value = r.list
  }

  async function createShot(projectId: string, req: { order: number; title: string; description?: string; duration_sec?: number; camera?: string }): Promise<ShotDTO> {
    const s = await api.projects.createShot(projectId, req)
    shots.value.push(s)
    return s
  }

  async function updateShot(projectId: string, shotId: string, patch: import('@manhuaworks/api-client').UpdateShotReq): Promise<void> {
    const u = await api.projects.updateShot(projectId, shotId, patch)
    const idx = shots.value.findIndex((s) => s.id === shotId)
    if (idx >= 0) shots.value[idx] = u
  }

  async function deleteShot(projectId: string, shotId: string): Promise<void> {
    await api.projects.deleteShot(projectId, shotId)
    shots.value = shots.value.filter((s) => s.id !== shotId)
  }

  return {
    projects, current, members, shots, loading, error, total, page, pageSize,
    archived, active,
    loadList, loadMore, loadOne, create, update, archive,
    loadMembers, invite, removeMember,
    loadShots, createShot, updateShot, deleteShot,
  }
})
