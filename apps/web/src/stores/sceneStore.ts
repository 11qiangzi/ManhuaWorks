/**
 * studio · scene Pinia store — 场景 CRUD 真 API 接入
 *
 * 数据来源: GET /api/v1/scenes?projectId=xxx → SceneItem[]
 * 创建/更新: POST /api/v1/scenes  ·  PATCH /api/v1/scenes/:id
 * 后端字段: id, project_id, name, description, scene_type,
 *           light_color_temp, light_brightness, light_preset,
 *           prompt, thumbnail_url, tags
 *
 * 设计原则:
 *   1. 真 API 优先 — 拉取失败/超时立即 fallback 到 mock,不阻塞 UI
 *   2. 短超时(2.5s) — 后端未启动时不卡
 *   3. 写操作(create/update/remove)走真 API,失败抛错
 *   4. SCENE_TYPE_META + classifyScene 保留用于 UI 展示
 *   5. 路径对齐 project-service 真实路由 /api/v1/scenes（原 /projects/:pid/scenes 为失效路径）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

/** 场景条目 — 对应后端 /api/v1/scenes 资源 */
export interface SceneItem {
  id: string
  project_id: string
  name: string
  description?: string
  scene_type?: string
  light_color_temp?: string
  light_direction?: string
  light_intensity?: string
  /** 光照亮度（0-1 或百分比字符串），后端 light_brightness 列 */
  light_brightness?: number | string
  /** 光照预设名（如 golden-hour / neon 等） */
  light_preset?: string
  /** 该场景的 AI 绘图提示词（或描述性 prompt），用于后续章节引用 */
  prompt?: string
  /** 场景主图（通常 /persisted/images/xxx.png 或已落地本地地址），素材库缩略图来源 */
  thumbnail_url?: string
  tags?: string[]
  created_at?: string
  updated_at?: string
}

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
  const scenes = ref<SceneItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const projectId = ref<string | null>(null)
  const lastSource = ref<'api' | 'mock' | 'empty'>('empty')

  // ---------- getters ----------
  /** 按前端场景分类分组 — 优先用后端 scene_type,缺省走 classifyScene(name) */
  const byType = computed<Record<SceneType, SceneItem[]>>(() => {
    const groups: Record<SceneType, SceneItem[]> = {
      indoor: [], outdoor: [], battle: [], school: [],
      urban: [], ancient: [], future: [], fantasy: [],
    }
    for (const s of scenes.value) {
      const t = resolveSceneType(s)
      groups[t].push(s)
    }
    return groups
  })

  const count = computed(() => scenes.value.length)
  const countByType = computed<Record<SceneType, number>>(() => {
    const out = { indoor: 0, outdoor: 0, battle: 0, school: 0, urban: 0, ancient: 0, future: 0, fantasy: 0 } as Record<SceneType, number>
    for (const s of scenes.value) out[resolveSceneType(s)]++
    return out
  })

  // ---------- actions ----------

  /** 拉取场景列表,失败时 fallback 到 mockFallback */
  async function load(pid: string, mockFallback: SceneItem[] = []): Promise<void> {
    projectId.value = pid
    loading.value = true
    error.value = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts = { timeoutMs: REQUEST_TIMEOUT_MS } as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await api.http.get<any>(
        '/api/v1/scenes',
        { projectId: pid },
        opts,
      )
      // 兼容 {items:[...]}, {list:[...]}, {data:[...]} 或直接数组
      // 后端信封经 api-client 剥离为 { items, total, list }，优先取 items
      const list = Array.isArray(resp) ? resp
        : (resp?.items ?? resp?.list ?? (Array.isArray(resp?.data) ? resp.data : []) ?? [])
      scenes.value = Array.isArray(list) ? list : []
      lastSource.value = scenes.value.length > 0 ? 'api' : 'empty'
    } catch (e) {
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '未知错误')
      error.value = `API 拉取失败 (${msg})，已回退本地数据`
      scenes.value = mockFallback
      lastSource.value = mockFallback.length > 0 ? 'mock' : 'empty'
    } finally {
      loading.value = false
    }
  }

  /** 新增场景（走真 API，POST /api/v1/scenes） */
  async function create(data: {
    name: string
    scene_type?: string
    description?: string
    light_color_temp?: string
    light_direction?: string
    light_intensity?: string
    light_brightness?: number | string
    light_preset?: string
    prompt?: string
    thumbnail_url?: string
    tags?: string[]
  }): Promise<SceneItem> {
    if (!projectId.value) throw new Error('未选择项目')
    loading.value = true
    error.value = null
    try {
      const body: Record<string, unknown> = { name: data.name }
      // projectId 由 store 统一注入（路由要求 body.projectId）
      body.projectId = projectId.value
      if (data.scene_type != null) body.scene_type = data.scene_type
      if (data.description != null) body.description = data.description
      if (data.light_color_temp != null) body.light_color_temp = data.light_color_temp
      if (data.light_direction != null) body.light_direction = data.light_direction
      if (data.light_intensity != null) body.light_intensity = data.light_intensity
      if (data.light_brightness != null) body.light_brightness = data.light_brightness
      if (data.light_preset != null) body.light_preset = data.light_preset
      if (data.prompt != null) body.prompt = data.prompt
      if (data.thumbnail_url != null) body.thumbnail_url = data.thumbnail_url
      if (data.tags != null) body.tags = data.tags

      const item = await api.http.post<SceneItem>('/api/v1/scenes', body)
      scenes.value.unshift(item)
      return item
    } catch (e) {
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '新增失败')
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 更新场景（走真 API，PATCH /api/v1/scenes/:id）— 用于回填 thumbnail_url / prompt 等 */
  async function update(id: string, patch: Partial<{
    name: string
    description: string
    scene_type: string
    light_color_temp: string
    light_brightness: number | string
    light_preset: string
    prompt: string
    thumbnail_url: string
    tags: string[]
  }>): Promise<SceneItem> {
    if (!projectId.value) throw new Error('未选择项目')
    loading.value = true
    error.value = null
    try {
      const item = await api.http.patch<SceneItem>(
        `/api/v1/scenes/${encodeURIComponent(id)}`,
        patch,
      )
      const idx = scenes.value.findIndex(s => s.id === id)
      if (idx >= 0) {
        scenes.value = [
          ...scenes.value.slice(0, idx),
          { ...scenes.value[idx], ...item },
          ...scenes.value.slice(idx + 1),
        ]
      }
      return item
    } catch (e) {
      const msg = e instanceof ApiError ? e.userMessage : (e instanceof Error ? e.message : '更新失败')
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 删除场景（乐观更新 + 真 API） */
  async function remove(sceneId: string): Promise<void> {
    if (!projectId.value) throw new Error('未选择项目')
    const snapshot = scenes.value.slice()
    loading.value = true
    error.value = null
    try {
      scenes.value = scenes.value.filter(s => s.id !== sceneId)
      await api.http.delete(
        `/projects/${encodeURIComponent(projectId.value)}/scenes/${encodeURIComponent(sceneId)}`,
      )
    } catch (e) {
      // 回滚
      scenes.value = snapshot
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
    scenes, loading, error, projectId, lastSource,
    // getters
    byType, count, countByType,
    // actions
    load, create, update, remove, clearError,
    // 常量
    SCENE_TYPE_META,
  }
})

// ---------- helpers ----------

/** 优先用后端 scene_type 字段,如果不在 8 个前端分类中则走 classifyScene(name) */
function resolveSceneType(s: SceneItem): SceneType {
  if (s.scene_type && s.scene_type in SCENE_TYPE_META) {
    return s.scene_type as SceneType
  }
  return classifyScene(s.name)
}

/** 根据名称把场景分类到 8 个场景类型 */
function classifyScene(name: string): SceneType {
  const lower = name.toLowerCase()
  for (const [key, meta] of Object.entries(SCENE_TYPE_META)) {
    if (meta.keywords.some(kw => lower.includes(kw))) return key as SceneType
  }
  return 'fantasy' // 默认
}

export { REQUEST_TIMEOUT_MS }
