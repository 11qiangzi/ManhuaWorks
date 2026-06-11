/**
 * studio · character Pinia store — 真 API 接入 (L3.B 林染 30 分钟任务)
 *
 * 数据来源: apiClient.projects.listMembers(projectId) → ProjectMemberDTO[]
 * 角色分类: 管理员(0/admin) / 编剧 / 画师 / 配音 / 字幕 (前端映射 ProjectMemberDTO.role)
 *
 * 设计原则:
 *   1. 真 API 优先 — 拉取失败/超时立即 fallback 到 mock,不阻塞 UI
 *   2. 短超时(2.5s) — 后端未启动时不卡
 *   3. 状态机: idle → loading → ready / error
 *   4. 写操作(add/remove)走真 API,失败抛错
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError, type ProjectMemberDTO } from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

/** 前端角色分类(对应项目成员在创作流程中的职能) */
export type StudioRole = 'admin' | 'writer' | 'artist' | 'voice' | 'subtitle'

const ROLE_BADGE: Record<StudioRole, { label: string; color: string; icon: string }> = {
  admin:    { label: '管理员', color: 'red',    icon: '👑' },
  writer:   { label: '编剧',   color: 'blue',   icon: '📝' },
  artist:   { label: '画师',   color: 'pink',   icon: '🎨' },
  voice:    { label: '配音',   color: 'green',  icon: '🎙️' },
  subtitle: { label: '字幕',   color: 'cyan',   icon: '💬' },
}

const REQUEST_TIMEOUT_MS = 2500

export const useCharacterStore = defineStore('character', () => {
  const api = getApi()

  // ---------- state ----------
  const characters = ref<ProjectMemberDTO[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const projectId = ref<string | null>(null)
  const lastSource = ref<'api' | 'mock' | 'empty'>('empty')

  // ---------- getters ----------
  /** 按前端角色分类分组 */
  const byRole = computed<Record<StudioRole, ProjectMemberDTO[]>>(() => {
    const groups: Record<StudioRole, ProjectMemberDTO[]> = {
      admin: [], writer: [], artist: [], voice: [], subtitle: [],
    }
    for (const c of characters.value) {
      const r = mapBackendRoleToStudio(c.role)
      groups[r].push(c)
    }
    return groups
  })

  const count = computed(() => characters.value.length)
  const countByRole = computed<Record<StudioRole, number>>(() => {
    const out = { admin: 0, writer: 0, artist: 0, voice: 0, subtitle: 0 } as Record<StudioRole, number>
    for (const c of characters.value) out[mapBackendRoleToStudio(c.role)]++
    return out
  })

  // ---------- actions ----------
  async function load(pid: string, mockFallback: ProjectMemberDTO[] = []): Promise<void> {
    projectId.value = pid
    loading.value = true
    error.value = null
    try {
      // 短超时: 后端未起时不被 30s 默认 timeout 卡住
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts = { timeoutMs: REQUEST_TIMEOUT_MS } as any
      // listMembers 签名不接 opts,走 http.get 直传
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const projectsAny = api.projects as any
      let list: ProjectMemberDTO[]
      if (typeof projectsAny.listMembersWithOpts === 'function') {
        list = await projectsAny.listMembersWithOpts(pid, opts)
      } else {
        // 走 http.get 直接调用，避开默认 30s
        list = await api.http.get<ProjectMemberDTO[]>(
          `/projects/${encodeURIComponent(pid)}/members`,
          undefined,
          opts,
        )
      }
      characters.value = Array.isArray(list) ? list : []
      lastSource.value = characters.value.length > 0 ? 'api' : 'empty'
    } catch (e) {
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '未知错误')
      error.value = `真 API 拉取失败 (${msg})，已回退本地数据`
      characters.value = mockFallback
      lastSource.value = mockFallback.length > 0 ? 'mock' : 'empty'
      // 不 throw — UI 继续可用
    } finally {
      loading.value = false
    }
  }

  /** 新增成员（走真 API） */
  async function create(data: { email: string; displayName?: string; studioRole: StudioRole }): Promise<ProjectMemberDTO> {
    if (!projectId.value) throw new Error('未选择项目，无法新增成员')
    loading.value = true
    error.value = null
    try {
      const backendRole = mapStudioRoleToBackend(data.studioRole)
      const m = await api.projects.inviteMember(projectId.value, {
        email: data.email,
        role: backendRole,
      })
      // 后端可能不返回 displayName,补一下
      const enriched: ProjectMemberDTO = {
        ...m,
        display_name: data.displayName || m.display_name || data.email,
      }
      characters.value.unshift(enriched)
      return enriched
    } catch (e) {
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '新增失败')
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 删除成员（走真 API） */
  async function remove(userId: string): Promise<void> {
    if (!projectId.value) throw new Error('未选择项目，无法删除')
    const snapshot = characters.value.slice()
    loading.value = true
    error.value = null
    try {
      // 乐观更新
      characters.value = characters.value.filter(c => c.user_id !== userId)
      await api.projects.removeMember(projectId.value, userId)
    } catch (e) {
      // 回滚
      characters.value = snapshot
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '删除失败')
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearError(): void {
    error.value = null
  }

  return {
    // state
    characters, loading, error, projectId, lastSource,
    // getters
    byRole, count, countByRole,
    // actions
    load, create, remove, clearError,
    // 常量
    ROLE_BADGE,
  }
})

// ---------- helpers ----------
/** 后端角色 → 前端创作工坊角色 */
function mapBackendRoleToStudio(backend: 'owner' | 'editor' | 'viewer'): StudioRole {
  switch (backend) {
    case 'owner':  return 'admin'
    case 'editor': return 'writer'   // editor 默认按编剧处理(view 层可改)
    case 'viewer': return 'subtitle' // viewer 默认按字幕/旁观
  }
}

function mapStudioRoleToBackend(studio: StudioRole): 'owner' | 'editor' | 'viewer' {
  switch (studio) {
    case 'admin':    return 'owner'
    case 'writer':
    case 'artist':
    case 'voice':    return 'editor'
    case 'subtitle': return 'viewer'
  }
}

export { ROLE_BADGE, REQUEST_TIMEOUT_MS }
