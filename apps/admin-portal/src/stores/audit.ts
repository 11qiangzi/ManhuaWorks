/**
 * admin-portal · audit Pinia store — 接 user-service 审计日志
 * ManhuaWorks · L2 task 8
 *
 * user-service 暴露 /audit/*（假设）；若无则降级到 collab-service 的 activities。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import type { AuditLogDTO, PageResp, AuditLogQuery, ActivityDTO } from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

export const useAuditStore = defineStore('audit', () => {
  const api = getApi()

  const logs = ref<AuditLogDTO[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(50)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const filter = ref<AuditLogQuery>({})

  async function loadList(reset = true): Promise<void> {
    loading.value = true
    error.value = null
    try {
      if (reset) { page.value = 1; logs.value = [] }
      // user-service /audit（若后端未实现，回退到 activities）
      let r: PageResp<AuditLogDTO> | null = null
      try {
        r = await api.http.get<PageResp<AuditLogDTO>>('/audit', {
          page: page.value,
          page_size: pageSize.value,
          ...filter.value,
        })
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 501)) {
          // 降级：把 collab activities 映射为 audit
          const acts = await api.collab.listActivities({ page: page.value, pageSize: pageSize.value })
          logs.value = acts.list.map((a) => ({
            id: a.id,
            actor_id: a.user_id,
            action: a.type,
            resource: a.project_id,
            resource_id: a.project_id,
            payload: a.payload,
            created_at: a.created_at,
          }))
          total.value = acts.total
          return
        }
        throw e
      }
      logs.value = r.list
      total.value = r.total
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '加载审计日志失败'
      throw e
    } finally { loading.value = false }
  }

  async function setFilter(f: Partial<AuditLogQuery>): Promise<void> {
    filter.value = { ...filter.value, ...f }
    await loadList(true)
  }

  async function loadActivities(projectId?: string): Promise<ActivityDTO[]> {
    const r = await api.collab.listActivities({ project_id: projectId, pageSize: 50 })
    return r.list
  }

  return { logs, total, page, pageSize, loading, error, filter, loadList, setFilter, loadActivities }
})
