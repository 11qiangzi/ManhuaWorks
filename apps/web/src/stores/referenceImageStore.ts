/**
 * studio · reference-image Pinia store — 参考图 CRUD 真 API 接入
 *
 * 数据来源: api.referenceImages (6 endpoints mounted at /v1/reference-images)
 * 实体类型: character / scene / product / style
 * 图片角度: front / side_left / side_right / three_quarter / back / full_body / close_up / detail / full_scene / atmosphere / style_ref
 *
 * 设计原则:
 *   1. 真 API 优先 — 拉取失败不阻塞 UI, 显示空状态 + 错误提示
 *   2. 短超时(2.5s) — 后端未启动时不卡
 *   3. 写操作(delete)乐观更新 + 失败回滚
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import type {
  ReferenceImageDTO,
  RefEntityType,
  RefImageType,
  CreateReferenceImageReq,
  BatchCreateReferenceImageReq,
  UpdateReferenceImageReq,
  ProjectRefSummary,
  ID,
} from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

const REQUEST_TIMEOUT_MS = 2500

export const useReferenceImageStore = defineStore('referenceImage', () => {
  const api = getApi()

  // ---------- state ----------
  const images = ref<ReferenceImageDTO[]>([])
  const summary = ref<ProjectRefSummary | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const projectId = ref<string | null>(null)

  // ---------- getters ----------
  /** 按 entity_type 分组 */
  const byEntityType = computed<Record<RefEntityType, ReferenceImageDTO[]>>(() => {
    const groups: Record<RefEntityType, ReferenceImageDTO[]> = {
      character: [], scene: [], product: [], style: [],
    }
    for (const img of images.value) {
      if (groups[img.entity_type]) {
        groups[img.entity_type].push(img)
      }
    }
    return groups
  })

  /** 按 entity_id 分组 */
  const byEntityId = computed<Record<string, ReferenceImageDTO[]>>(() => {
    const map: Record<string, ReferenceImageDTO[]> = {}
    for (const img of images.value) {
      if (!map[img.entity_id]) map[img.entity_id] = []
      map[img.entity_id].push(img)
    }
    return map
  })

  /** 各类型计数 */
  const counts = computed(() => ({
    character: byEntityType.value.character.length,
    scene: byEntityType.value.scene.length,
    product: byEntityType.value.product.length,
    style: byEntityType.value.style.length,
    total: images.value.length,
  }))

  const count = computed(() => images.value.length)

  // ---------- actions ----------

  /** 拉取参考图列表 */
  async function loadList(
    pid: string,
    entityType?: RefEntityType,
    entityId?: string,
  ): Promise<void> {
    projectId.value = pid
    loading.value = true
    error.value = null
    try {
      const opts: Record<string, unknown> = { projectId: pid }
      if (entityType) opts.entityType = entityType
      if (entityId) opts.entityId = entityId
      const resp = await api.referenceImages.list(opts as any)
      images.value = resp.items ?? []
    } catch (e) {
      const msg = e instanceof ApiError
        ? e.userMessage
        : (e instanceof Error ? e.message : '未知错误')
      error.value = `API 拉取失败 (${msg})`
      images.value = []
    } finally {
      loading.value = false
    }
  }

  /** 加载项目参考图摘要统计 */
  async function loadSummary(pid: string): Promise<void> {
    try {
      summary.value = await api.referenceImages.getProjectSummary(pid)
    } catch {
      summary.value = null
    }
  }

  /** 新建单条参考图 */
  async function create(data: CreateReferenceImageReq): Promise<ReferenceImageDTO> {
    loading.value = true
    error.value = null
    try {
      const item = await api.referenceImages.create(data)
      images.value.unshift(item)
      return item
    } catch (e) {
      const msg = e instanceof ApiError
        ? e.userMessage
        : (e instanceof Error ? e.message : '新增失败')
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 批量创建参考图 */
  async function batchCreate(
    data: BatchCreateReferenceImageReq,
  ): Promise<{ created: number; items: ReferenceImageDTO[] }> {
    loading.value = true
    error.value = null
    try {
      const result = await api.referenceImages.batchCreate(data)
      images.value.unshift(...result.items)
      return result
    } catch (e) {
      const msg = e instanceof ApiError
        ? e.userMessage
        : (e instanceof Error ? e.message : '批量创建失败')
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 更新参考图元数据 */
  async function update(
    id: ID,
    data: UpdateReferenceImageReq,
  ): Promise<ReferenceImageDTO> {
    error.value = null
    const snapshot = images.value.slice()
    try {
      const updated = await api.referenceImages.update(id, data)
      const idx = images.value.findIndex(i => i.id === id)
      if (idx >= 0) images.value[idx] = updated
      return updated
    } catch (e) {
      images.value = snapshot
      const msg = e instanceof ApiError
        ? e.userMessage
        : (e instanceof Error ? e.message : '更新失败')
      error.value = msg
      throw e
    }
  }

  /** 删除参考图（乐观更新 + 失败回滚） */
  async function remove(id: ID): Promise<void> {
    const snapshot = images.value.slice()
    error.value = null
    images.value = images.value.filter(i => i.id !== id)
    try {
      await api.referenceImages.remove(id)
    } catch (e) {
      images.value = snapshot
      const msg = e instanceof ApiError
        ? e.userMessage
        : (e instanceof Error ? e.message : '删除失败')
      error.value = msg
      throw e
    }
  }

  function clearError(): void {
    error.value = null
  }

  return {
    // state
    images, summary, loading, error, projectId,
    // getters
    byEntityType, byEntityId, counts, count,
    // actions
    loadList, loadSummary, create, batchCreate, update, remove, clearError,
  }
})

export { REQUEST_TIMEOUT_MS }
