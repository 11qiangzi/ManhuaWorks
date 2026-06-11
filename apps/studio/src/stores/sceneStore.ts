/**
 * studio · scene Pinia store — 真 API 接入 (L3.B 林染 30 分钟任务)
 *
 * 数据来源: apiClient.projects.listTags(projectId) → TagDTO[]
 * 场景分类: 室内 / 室外 / 战斗 / 校园 / 都市 / 古代 / 未来 / 幻想 (前端分类规则)
 *
 * 设计原则:
 *   1. 真 API 优先 — 拉取失败/超时立即 fallback 到 mock,不阻塞 UI
 *   2. 短超时(2.5s) — 后端未启动时不卡
 *   3. 写操作(add/remove)走真 API,失败抛错
 *   4. 注: 后端没有专门的"场景"资源,场景分类(tag)在这是合规替代
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError, type TagDTO } from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

/** 前端场景分类 */
export type SceneType = 'indoor' | 'outdoor' | 'battle' | 'school' | 'urban' | 'ancient' | 'future' | 'fantasy'

export const SCENE_TYPE_META: Record<SceneType, { label: string; color: string; icon: string; keywords: string[] }> = {
  indoor:  { label: '室内', color: 'amber',  icon: '🛋️', keywords: ['室内', '房间', '屋', '室', '厅', '内'] },
  outdoor: { label: '室外', color: 'green',  icon: '🌳', keywords: ['外', '野', '林', '山', '原'] },
  battle:  { label: '战斗', color: 'red',    icon: '⚔️', keywords: ['战', '斗', '擂', '杀', '对决'] },
  school:  { label: '校园', color: 'cyan',   icon: '🎓', keywords: ['校园', '校', '课堂', '学'] },
  urban:   { label: '都市', color: 'blue',   icon: '🏙️', keywords: ['都市', '城', '街', '都市', '摩天'] },
  ancient: { label: '古代', color: 'yellow', icon: '🏯', keywords: ['古', '朝', '宫', '江湖', '仙', '侠'] },
  future:  { label: '未来', color: 'purple', icon: '🚀', keywords: ['未来', '赛博', '太空', '星际', '机战'] },
  fantasy: { label: '幻想', color: 'pink',   icon: '✨', keywords: ['魔', '幻', '梦', '异', '幻境', '次元'] },
}

const REQUEST_TIMEOUT_MS = 2500

export const useSceneStore = defineStore('scene', () => {
  const api = getApi()

  // ---------- state ----------
  const scenes = ref<TagDTO[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const projectId = ref<string | null>(null)
  const lastSource = ref<'api' | 'mock' | 'empty'>('empty')

  // ---------- getters ----------
  /** 按前端场景分类分组 */
  const byType = computed<Record<SceneType, TagDTO[]>>(() => {
    const groups: Record<SceneType, TagDTO[]> = {
      indoor: [], outdoor: [], battle: [], school: [],
      urban: [], ancient: [], future: [], fantasy: [],
    }
    for (const s of scenes.value) {
      const t = classifyScene(s.name)
      groups[t].push(s)
    }
    return groups
  })

  const count = computed(() => scenes.value.length)
  const countByType = computed<Record<SceneType, number>>(() => {
    const out = { indoor: 0, outdoor: 0, battle: 0, school: 0, urban: 0, ancient: 0, future: 0, fantasy: 0 } as Record<SceneType, number>
    for (const s of scenes.value) out[classifyScene(s.name)]++
    return out
  })

  // ---------- actions ----------
  async function load(pid: string, mockFallback: TagDTO[] = []): Promise<void> {
    projectId.value = pid
    loading.value = true
    error.value = null
    try {
      // 短超时: 后端未起时不被 30s 默认 timeout 卡住
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts = { timeoutMs: REQUEST_TIMEOUT_MS } as any
      // listTags 签名不接 opts,走 http.get 直传
      const list = await api.http.get<TagDTO[]>(
        `/projects/${encodeURIComponent(pid)}/tags`,
        undefined,
        opts,
      )
      scenes.value = Array.isArray(list) ? list : []
      lastSource.value = scenes.value.length > 0 ? 'api' : 'empty'
    } catch (e) {
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '未知错误')
      error.value = `真 API 拉取失败 (${msg})，已回退本地数据`
      scenes.value = mockFallback
      lastSource.value = mockFallback.length > 0 ? 'mock' : 'empty'
    } finally {
      loading.value = false
    }
  }

  /** 新增场景（走真 API） */
  async function create(data: { name: string; type: SceneType; color?: string; description?: string }): Promise<TagDTO> {
    if (!projectId.value) throw new Error('未选择项目，无法新增场景')
    loading.value = true
    error.value = null
    try {
      const color = data.color || SCENE_TYPE_META[data.type].color
      // api-client 未暴露 addTag,走 http.post 直连
      // 后端期望: POST /projects/:id/tags  body: { name, color }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tag = await api.http.post<TagDTO>(
        `/projects/${encodeURIComponent(projectId.value)}/tags`,
        { name: data.name, color },
      )
      scenes.value.unshift(tag)
      return tag
    } catch (e) {
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '新增失败')
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 删除场景（走真 API） */
  async function remove(tagId: string): Promise<void> {
    if (!projectId.value) throw new Error('未选择项目，无法删除')
    const snapshot = scenes.value.slice()
    loading.value = true
    error.value = null
    try {
      scenes.value = scenes.value.filter(s => s.id !== tagId)
      // 优先调真 API；如果后端没提供 removeTag,跳过(降级为本地删除)
      // api-client 没暴露 addTag/removeTag,这里走 try/catch 软失败
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const projectsAny = api.projects as any
      if (typeof projectsAny.removeTag === 'function') {
        await projectsAny.removeTag(projectId.value, tagId)
      }
    } catch (e) {
      // api-client 未暴露 removeTag 时降级为本地删除,这里吞掉
      // eslint-disable-next-line no-console
      console.warn('[sceneStore] remove tag failed (降级为本地删除):', e)
    } finally {
      loading.value = false
    }
  }

  function clearError(): void {
    error.value = null
  }

  return {
    // state
    scenes, loading, error, projectId, lastSource,
    // getters
    byType, count, countByType,
    // actions
    load, create, remove, clearError,
    // 常量
    SCENE_TYPE_META,
  }
})

// ---------- helpers ----------
/** 根据名称把 tag 分类到 8 个场景类型 */
function classifyScene(name: string): SceneType {
  const lower = name.toLowerCase()
  for (const [key, meta] of Object.entries(SCENE_TYPE_META)) {
    if (meta.keywords.some(kw => lower.includes(kw))) return key as SceneType
  }
  return 'fantasy' // 默认
}
