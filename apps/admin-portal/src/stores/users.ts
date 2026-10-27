/**
 * admin-portal · users Pinia store — 接 user-service
 * 千机工坊 · L2 task 8
 *
 * 列表 / 搜索 / 详情 / 改密 / 改 role / 禁用（封禁）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import type { UserDTO, PageResp } from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

export const useUsersStore = defineStore('users', () => {
  const api = getApi()

  const list = ref<UserDTO[]>([])
  const current = ref<UserDTO | null>(null)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const keyword = ref('')
  const statusFilter = ref<0 | 1 | undefined>(undefined)
  const roleFilter = ref<number | undefined>(undefined)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const hasMore = computed(() => list.value.length < total.value)

  async function loadList(reset = true): Promise<void> {
    loading.value = true
    error.value = null
    try {
      if (reset) {
        page.value = 1
        list.value = []
      }
      const r: PageResp<UserDTO> = await api.projects.listUsers({
        page: page.value,
        pageSize: pageSize.value,
        keyword: keyword.value || undefined,
        status: statusFilter.value,
        role: roleFilter.value,
      })
      list.value = r.list
      total.value = r.total
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '加载用户失败'
      throw e
    } finally { loading.value = false }
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value) return
    page.value += 1
    try {
      const r = await api.projects.listUsers({
        page: page.value,
        pageSize: pageSize.value,
        keyword: keyword.value || undefined,
        status: statusFilter.value,
        role: roleFilter.value,
      })
      list.value.push(...r.list)
    } catch (e) {
      page.value -= 1
      throw e
    }
  }

  async function search(text: string): Promise<void> {
    keyword.value = text
    await loadList(true)
  }

  async function setStatusFilter(s: 0 | 1 | undefined): Promise<void> {
    statusFilter.value = s
    await loadList(true)
  }

  async function setRoleFilter(r: number | undefined): Promise<void> {
    roleFilter.value = r
    await loadList(true)
  }

  async function loadOne(id: string): Promise<void> {
    current.value = await api.projects.getUser(id)
  }

  async function updateRole(id: string, role: number): Promise<void> {
    await api.projects.updateUser(id, { role })
    await loadOne(id)
  }

  async function updateStatus(id: string, status: 0 | 1): Promise<void> {
    await api.projects.updateUser(id, { status })
    await loadOne(id)
  }

  /** 封禁用户（软删除：status=0） */
  async function ban(id: string): Promise<void> {
    await api.projects.disableUser(id)
    const idx = list.value.findIndex((u) => u.id === id)
    if (idx >= 0) list.value[idx] = { ...list.value[idx]!, status: 0 }
    if (current.value?.id === id) current.value = { ...current.value, status: 0 }
  }

  /** 解封 */
  async function unban(id: string): Promise<void> {
    await api.projects.updateUser(id, { status: 1 })
    const idx = list.value.findIndex((u) => u.id === id)
    if (idx >= 0) list.value[idx] = { ...list.value[idx]!, status: 1 }
    if (current.value?.id === id) current.value = { ...current.value, status: 1 }
  }

  function clearCurrent(): void {
    current.value = null
  }

  return {
    list, current, total, page, pageSize, keyword, statusFilter, roleFilter,
    loading, error, hasMore,
    loadList, loadMore, search, setStatusFilter, setRoleFilter,
    loadOne, updateRole, updateStatus, ban, unban, clearCurrent,
  }
})
