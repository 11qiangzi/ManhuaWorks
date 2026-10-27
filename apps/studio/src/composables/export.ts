// =============================================================================
// export.ts — 导出 Composable (L3.G 林染 → P4-3 真实集成)
// 5 大类 × 13+ 格式，真实 API + 客户端生成 + 模拟兜底
// =============================================================================

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import {
  exportEpisodeZip,
  exportSeasonZip,
  exportSrt,
  downloadBlob,
  downloadText,
} from '../api/asset-service'
import { useProjectStore } from '../stores/project'

// ---------- 类型 ----------
export type ExportCategory = 'episode' | 'character' | 'project' | 'asset' | 'video'

export type ExportFormatId =
  // 剧集 (5)
  | 'md' | 'docx' | 'pdf' | 'txt' | 'json'
  // 角色 (3)
  | 'char-png' | 'char-zip' | 'char-sqlite'
  // 项目 (2)
  | 'project-zip' | 'project-snapshot'
  // 资产 (3)
  | 'image-zip' | 'video-zip' | 'all-assets'
  // 视频 (4)
  | 'video-mp4' | 'video-mov' | 'video-gif' | 'video-vertical'

export type ExportStatus =
  | 'idle'
  | 'queued'
  | 'preparing'
  | 'processing'
  | 'packaging'
  | 'ready'
  | 'failed'
  | 'cancelled'

export interface ExportFormat {
  id: ExportFormatId
  name: string
  category: ExportCategory
  ext: string
  mime: string
  estimatedSize: string
  estimatedSizeBytes: number
  description: string
}

export interface ExportCategoryMeta {
  id: ExportCategory
  name: string
  icon: string
  color: string
  description: string
}

export interface ExportRecord {
  id: string
  projectId: string
  formatId: ExportFormatId
  formatName: string
  status: ExportStatus
  progress: number
  step: string
  outputUrl: string | null
  error: string | null
  sizeBytes: number
  costUsd: number
  createdAt: number
  finishedAt: number | null
}

// ---------- 视频导出选项类型 ----------
export type PlatformPresetId = 'xiaohongshu' | 'douyin' | 'bilibili' | 'kuaishou' | 'custom'

export interface PlatformPreset {
  id: PlatformPresetId
  name: string
  aspectRatio: string
  width: number
  height: number
  description: string
  icon: string
}

export type ResolutionId = '720p' | '1080p' | '4k'

export interface ResolutionOption {
  id: ResolutionId
  name: string
  width: number
  height: number
  bitrate: string
  description: string
}

export interface AudioExportOptions {
  includeBGM: boolean
  includeSFX: boolean
  audioQuality: 'low' | 'medium' | 'high'
}

export interface VideoExportOptions {
  platform: PlatformPresetId
  resolution: ResolutionId
  audio: AudioExportOptions
  customWidth?: number
  customHeight?: number
}

export interface BatchExportItem {
  formatId: ExportFormatId
  label: string
  options?: VideoExportOptions
}

export interface BatchExportConfig {
  items: BatchExportItem[]
  parallelCount: number
}

// ---------- 平台预设数据 ----------
export const PLATFORM_PRESETS: PlatformPreset[] = [
  { id: 'xiaohongshu', name: '小红书', aspectRatio: '3:4', width: 1080, height: 1440, description: '小红书推荐 3:4 竖版', icon: '📕' },
  { id: 'douyin', name: '抖音', aspectRatio: '9:16', width: 1080, height: 1920, description: '抖音推荐 9:16 竖版', icon: '🎵' },
  { id: 'bilibili', name: 'B站', aspectRatio: '16:9', width: 1920, height: 1080, description: 'B站推荐 16:9 横版', icon: '📺' },
  { id: 'kuaishou', name: '快手', aspectRatio: '9:16', width: 1080, height: 1920, description: '快手推荐 9:16 竖版', icon: '📱' },
  { id: 'custom', name: '自定义', aspectRatio: '自定义', width: 1920, height: 1080, description: '自定义宽高', icon: '⚙️' },
]

// ---------- 分辨率选项数据 ----------
export const RESOLUTION_OPTIONS: ResolutionOption[] = [
  { id: '720p', name: '720p', width: 1280, height: 720, bitrate: '5 Mbps', description: '标清 · 文件小 · 快速导出' },
  { id: '1080p', name: '1080p', width: 1920, height: 1080, bitrate: '12 Mbps', description: '高清 · 推荐 · 平衡质量与大小' },
  { id: '4k', name: '4K', width: 3840, height: 2160, bitrate: '35 Mbps', description: '超清 · 最佳质量 · 文件较大' },
]

// ---------- 默认视频导出选项 ----------
export function createDefaultVideoOptions(): VideoExportOptions {
  return {
    platform: 'bilibili',
    resolution: '1080p',
    audio: { includeBGM: true, includeSFX: true, audioQuality: 'high' },
  }
}

export interface UseExportReturn {
  categories: typeof EXPORT_CATEGORIES
  formats: typeof EXPORT_FORMATS
  records: Ref<ExportRecord[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  activeCategory: Ref<ExportCategory | 'all'>
  filteredFormats: ComputedRef<ExportFormat[]>
  formatCountByCategory: ComputedRef<Record<string, number>>
  videoOptions: Ref<VideoExportOptions>
  batchQueue: Ref<BatchExportItem[]>
  triggerExport: (formatId: ExportFormatId, options?: VideoExportOptions) => Promise<string>
  pollStatus: (exportId: string) => Promise<ExportRecord | null>
  cancelExport: (exportId: string) => void
  retryExport: (exportId: string) => Promise<string | null>
  removeRecord: (exportId: string) => void
  clearCompleted: () => void
  addToBatch: (formatId: ExportFormatId, label?: string) => void
  removeFromBatch: (index: number) => void
  clearBatch: () => void
  triggerBatchExport: () => Promise<string[]>
  cleanupTimers: () => void
}

// ---------- 5 大类 ----------
export const EXPORT_CATEGORIES: ExportCategoryMeta[] = [
  {
    id: 'episode',
    name: '剧集导出',
    icon: '🎬',
    color: 'from-blue-500 to-cyan-500',
    description: '剧集内容 5 种格式',
  },
  {
    id: 'character',
    name: '角色导出',
    icon: '👤',
    color: 'from-purple-500 to-pink-500',
    description: '单/多角色 / 数据库',
  },
  {
    id: 'project',
    name: '项目导出',
    icon: '📦',
    color: 'from-orange-500 to-red-500',
    description: '完整项目 / 快照',
  },
  {
    id: 'asset',
    name: '资产导出',
    icon: '🗂️',
    color: 'from-green-500 to-emerald-500',
    description: '图像 / 视频 / 全部',
  },
  {
    id: 'video',
    name: '视频导出',
    icon: '🎥',
    color: 'from-rose-500 to-pink-500',
    description: 'MP4 / MOV / GIF / 竖版',
  },
]

// ---------- 13 格式 ----------
export const EXPORT_FORMATS: ExportFormat[] = [
  // 剧集 (5)
  {
    id: 'md',
    name: 'Markdown',
    category: 'episode',
    ext: 'md',
    mime: 'text/markdown',
    estimatedSize: '~50 KB',
    estimatedSizeBytes: 50_000,
    description: '剧集剧本 Markdown',
  },
  {
    id: 'docx',
    name: 'DOCX',
    category: 'episode',
    ext: 'docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    estimatedSize: '~120 KB',
    estimatedSizeBytes: 120_000,
    description: 'Word 文档剧本',
  },
  {
    id: 'pdf',
    name: 'PDF',
    category: 'episode',
    ext: 'pdf',
    mime: 'application/pdf',
    estimatedSize: '~300 KB',
    estimatedSizeBytes: 300_000,
    description: 'PDF 排版剧本',
  },
  {
    id: 'txt',
    name: '纯文本',
    category: 'episode',
    ext: 'txt',
    mime: 'text/plain',
    estimatedSize: '~30 KB',
    estimatedSizeBytes: 30_000,
    description: '纯文本剧本',
  },
  {
    id: 'json',
    name: 'JSON',
    category: 'episode',
    ext: 'json',
    mime: 'application/json',
    estimatedSize: '~80 KB',
    estimatedSizeBytes: 80_000,
    description: '结构化剧集数据',
  },

  // 角色 (3)
  {
    id: 'char-png',
    name: '单角色卡 (PNG)',
    category: 'character',
    ext: 'png',
    mime: 'image/png',
    estimatedSize: '~500 KB',
    estimatedSizeBytes: 500_000,
    description: '单张角色卡 PNG',
  },
  {
    id: 'char-zip',
    name: '角色集 (ZIP)',
    category: 'character',
    ext: 'zip',
    mime: 'application/zip',
    estimatedSize: '~3 MB',
    estimatedSizeBytes: 3_000_000,
    description: '多角色卡 ZIP 包',
  },
  {
    id: 'char-sqlite',
    name: '角色数据库 (SQLite)',
    category: 'character',
    ext: 'sqlite',
    mime: 'application/x-sqlite3',
    estimatedSize: '~1 MB',
    estimatedSizeBytes: 1_000_000,
    description: 'SQLite 数据库',
  },

  // 项目 (2)
  {
    id: 'project-zip',
    name: '完整项目 (ZIP)',
    category: 'project',
    ext: 'zip',
    mime: 'application/zip',
    estimatedSize: '~50 MB',
    estimatedSizeBytes: 50_000_000,
    description: '项目全量 ZIP',
  },
  {
    id: 'project-snapshot',
    name: '项目快照 (JSON)',
    category: 'project',
    ext: 'json',
    mime: 'application/json',
    estimatedSize: '~2 MB',
    estimatedSizeBytes: 2_000_000,
    description: '项目快照 JSON',
  },

  // 资产 (3)
  {
    id: 'image-zip',
    name: '图像集 (ZIP)',
    category: 'asset',
    ext: 'zip',
    mime: 'application/zip',
    estimatedSize: '~20 MB',
    estimatedSizeBytes: 20_000_000,
    description: '全部图像 ZIP',
  },
  {
    id: 'video-zip',
    name: '视频集 (ZIP)',
    category: 'asset',
    ext: 'zip',
    mime: 'application/zip',
    estimatedSize: '~100 MB',
    estimatedSizeBytes: 100_000_000,
    description: '全部视频 ZIP',
  },
  {
    id: 'all-assets',
    name: '全部资产',
    category: 'asset',
    ext: 'zip',
    mime: 'application/zip',
    estimatedSize: '~150 MB',
    estimatedSizeBytes: 150_000_000,
    description: '所有资产打包',
  },

  // 视频 (4)
  {
    id: 'video-mp4',
    name: 'MP4 视频',
    category: 'video',
    ext: 'mp4',
    mime: 'video/mp4',
    estimatedSize: '~80 MB',
    estimatedSizeBytes: 80_000_000,
    description: 'H.264 MP4 通用格式，兼容所有平台',
  },
  {
    id: 'video-mov',
    name: 'MOV 视频',
    category: 'video',
    ext: 'mov',
    mime: 'video/quicktime',
    estimatedSize: '~120 MB',
    estimatedSizeBytes: 120_000_000,
    description: 'Apple ProRes MOV 高质量，适合后期编辑',
  },
  {
    id: 'video-gif',
    name: 'GIF 动图',
    category: 'video',
    ext: 'gif',
    mime: 'image/gif',
    estimatedSize: '~15 MB',
    estimatedSizeBytes: 15_000_000,
    description: 'GIF 动图，适合社交分享',
  },
  {
    id: 'video-vertical',
    name: '竖版视频',
    category: 'video',
    ext: 'mp4',
    mime: 'video/mp4',
    estimatedSize: '~60 MB',
    estimatedSizeBytes: 60_000_000,
    description: '9:16 竖版视频，适配短视频平台',
  },
]

// ---------- Timer tracking & cleanup ----------
const _activeTimers: Array<ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>> = []

/**
 * Clear all active intervals/timeouts created by this module.
 * Call this in the consuming component's onUnmounted hook.
 */
export function cleanupTimers(): void {
  for (const t of _activeTimers) {
    clearInterval(t)
    clearTimeout(t)
  }
  _activeTimers.length = 0
}

/** Revoke a blob URL if it looks like one (starts with "blob:"). */
function revokeBlobUrl(url: string | null | undefined): void {
  if (url && url.startsWith('blob:')) {
    try { URL.revokeObjectURL(url) } catch { /* noop */ }
  }
}

// ---------- 工具函数 ----------
const STORAGE_KEY = 'manhuaworks.export.history.v1'
const MAX_HISTORY = 20
const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 30_000

function loadHistory(): ExportRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as ExportRecord[]
    return arr.slice(0, MAX_HISTORY)
  } catch {
    return []
  }
}

function saveHistory(records: ExportRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_HISTORY)))
  } catch {
    /* noop */
  }
}

function genId(): string {
  return `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

// ---------- Composable ----------
export function useExport(projectId: Ref<string>): UseExportReturn {
  const records = ref<ExportRecord[]>(loadHistory())
  const loading = ref(false)
  const error = ref<string | null>(null)
  const activeCategory = ref<ExportCategory | 'all'>('all')
  const videoOptions = ref<VideoExportOptions>(createDefaultVideoOptions())
  const batchQueue = ref<BatchExportItem[]>([])

  function persist() {
    saveHistory(records.value)
  }

  // ---------- 派生 ----------
  const filteredFormats = computed(() => {
    if (activeCategory.value === 'all') return EXPORT_FORMATS
    return EXPORT_FORMATS.filter(f => f.category === activeCategory.value)
  })

  const formatCountByCategory = computed(() => {
    const m: Record<string, number> = { all: EXPORT_FORMATS.length }
    for (const f of EXPORT_FORMATS) m[f.category] = (m[f.category] ?? 0) + 1
    return m
  })

  // ---------- 路由表：哪些格式走真实 API ----------
  const BACKEND_ZIP_FORMATS = new Set<ExportFormatId>([
    'image-zip', 'video-zip', 'all-assets', 'project-zip',
  ])
  const CLIENT_TEXT_FORMATS = new Set<ExportFormatId>([
    'md', 'txt', 'json',
  ])
  const VIDEO_FORMATS = new Set<ExportFormatId>([
    'video-mp4', 'video-mov', 'video-gif', 'video-vertical',
  ])
  // 其余 (docx, pdf, char-png, char-zip, char-sqlite, project-snapshot) 走模拟

  // ---------- 创建记录 ----------
  function createRecord(formatId: ExportFormatId): ExportRecord {
    const fmt = EXPORT_FORMATS.find(f => f.id === formatId)
    if (!fmt) throw new Error(`Unknown export format: ${formatId}`)
    const record: ExportRecord = {
      id: genId(),
      projectId: projectId.value,
      formatId,
      formatName: fmt.name,
      status: 'queued',
      progress: 0,
      step: '排队中',
      outputUrl: null,
      error: null,
      sizeBytes: 0,
      costUsd: 0.01,
      createdAt: Date.now(),
      finishedAt: null,
    }
    records.value = [record, ...records.value].slice(0, MAX_HISTORY)
    persist()
    return record
  }

  function updateRecord(id: string, patch: Partial<ExportRecord>) {
    const r = records.value.find(x => x.id === id)
    if (!r) return
    Object.assign(r, patch)
    persist()
  }

  // ---------- 客户端文本生成 ----------

  /** 从 projectStore 取当前项目 + 镜头数据 */
  function getProjectData() {
    const store = useProjectStore()
    return {
      project: store.current,
      shots: store.shots,
    }
  }

  function generateMarkdown(): string {
    const { project, shots } = getProjectData()
    const lines: string[] = []
    lines.push(`# ${project?.name ?? '未命名项目'}`)
    lines.push('')
    if (project?.description) {
      lines.push(`> ${project.description}`)
      lines.push('')
    }
    lines.push(`导出时间：${new Date().toLocaleString('zh-CN')}`)
    lines.push('')
    if (shots.length === 0) {
      lines.push('*暂无镜头数据*')
    } else {
      for (const s of shots) {
        lines.push(`## #${s.order_index} ${s.name} [${s.status}]`)
        lines.push('')
        if (s.description) lines.push(s.description)
        lines.push('')
      }
    }
    return lines.join('\n')
  }

  function generatePlainText(): string {
    const { project, shots } = getProjectData()
    const lines: string[] = []
    lines.push(`${project?.name ?? '未命名项目'}`)
    lines.push(`导出时间: ${new Date().toLocaleString('zh-CN')}`)
    lines.push('─'.repeat(40))
    if (shots.length === 0) {
      lines.push('暂无镜头数据')
    } else {
      for (const s of shots) {
        lines.push(`[#${s.order_index}] ${s.name} (${s.status})`)
        if (s.description) lines.push(s.description)
        lines.push('')
      }
    }
    return lines.join('\n')
  }

  function generateJson(): string {
    const { project, shots } = getProjectData()
    return JSON.stringify(
      {
        project: project
          ? { id: project.id, name: project.name, description: project.description, status: project.status }
          : null,
        shots: shots.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          status: s.status,
          order_index: s.order_index,
        })),
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    )
  }

  // ---------- 真实导出入口 ----------
  async function triggerExport(formatId: ExportFormatId, options?: VideoExportOptions): Promise<string> {
    const record = createRecord(formatId)
    const rid = record.id

    try {
      updateRecord(rid, { status: 'preparing', progress: 10, step: '准备中' })

      if (CLIENT_TEXT_FORMATS.has(formatId)) {
        // ── 客户端文本生成 ──
        await doClientTextExport(rid, formatId)
      } else if (BACKEND_ZIP_FORMATS.has(formatId)) {
        // ── 后端 zip API ──
        await doBackendZipExport(rid, formatId)
      } else if (VIDEO_FORMATS.has(formatId)) {
        // ── 视频导出（模拟 + 选项感知） ──
        const opts = options ?? videoOptions.value
        const resInfo = RESOLUTION_OPTIONS.find(r => r.id === opts.resolution)
        const platInfo = PLATFORM_PRESETS.find(p => p.id === opts.platform)
        const stepDetail = [
          `编码 ${EXT_MAP[formatId]?.toUpperCase()}`,
          resInfo ? `${resInfo.name} ${resInfo.bitrate}` : '',
          platInfo ? `${platInfo.name} ${platInfo.aspectRatio}` : '',
          opts.audio.includeBGM ? '+BGM' : '',
          opts.audio.includeSFX ? '+SFX' : '',
        ].filter(Boolean).join(' · ')
        updateRecord(rid, { step: `视频: ${stepDetail}` })
        void simulateProgress(rid)
        return rid
      } else {
        // ── 模拟兜底 (docx, pdf, char-*, project-snapshot) ──
        void simulateProgress(rid)
        return rid
      }
    } catch (e: any) {
      updateRecord(rid, {
        status: 'failed',
        error: e?.message ?? '导出失败',
        step: '失败',
        finishedAt: Date.now(),
      })
    }
    return rid
  }

  /** 客户端文本导出：md / txt / json */
  async function doClientTextExport(rid: string, formatId: ExportFormatId): Promise<void> {
    updateRecord(rid, { status: 'processing', progress: 40, step: '生成内容' })

    let content: string
    let mime: string
    let ext: string
    switch (formatId) {
      case 'md':
        content = generateMarkdown()
        mime = 'text/markdown'
        ext = 'md'
        break
      case 'txt':
        content = generatePlainText()
        mime = 'text/plain'
        ext = 'txt'
        break
      case 'json':
        content = generateJson()
        mime = 'application/json'
        ext = 'json'
        break
      default:
        throw new Error(`Unsupported text format: ${formatId}`)
    }

    updateRecord(rid, { status: 'packaging', progress: 80, step: '生成下载' })

    const { project } = getProjectData()
    const safeProjectName = (project?.name ?? 'export').replace(/[^\w\u4e00-\u9fff-]/g, '_')
    const filename = `${safeProjectName}-${Date.now()}.${ext}`
    downloadText(content, filename, mime)

    const blob = new Blob([content], { type: `${mime};charset=utf-8` })
    // Revoke any previous blob URL for this record before assigning a new one
    const existing = records.value.find(x => x.id === rid)
    revokeBlobUrl(existing?.outputUrl)
    updateRecord(rid, {
      status: 'ready',
      progress: 100,
      step: '已完成',
      outputUrl: URL.createObjectURL(blob),
      sizeBytes: blob.size,
      finishedAt: Date.now(),
    })
  }

  /** 后端 zip 导出：image-zip / video-zip / all-assets / project-zip */
  async function doBackendZipExport(rid: string, formatId: ExportFormatId): Promise<void> {
    updateRecord(rid, { status: 'processing', progress: 30, step: '请求后端打包' })

    let result: { blob: Blob; filename: string }

    switch (formatId) {
      case 'image-zip':
      case 'video-zip':
      case 'all-assets': {
        // 走 asset-service 整季 zip（按资产类型过滤在前端暂不可控，后端返回全量）
        result = await exportSeasonZip(projectId.value, {
          filePrefix: formatId === 'image-zip' ? 'images'
            : formatId === 'video-zip' ? 'videos'
            : 'all-assets',
        })
        break
      }
      case 'project-zip': {
        result = await exportSeasonZip(projectId.value, {
          filePrefix: 'project',
        })
        break
      }
      default:
        throw new Error(`Unsupported backend format: ${formatId}`)
    }

    updateRecord(rid, { status: 'packaging', progress: 85, step: '下载中' })
    downloadBlob(result.blob, result.filename)

    // Revoke any previous blob URL for this record before assigning a new one
    const existing = records.value.find(x => x.id === rid)
    revokeBlobUrl(existing?.outputUrl)
    updateRecord(rid, {
      status: 'ready',
      progress: 100,
      step: '已完成',
      outputUrl: URL.createObjectURL(result.blob),
      sizeBytes: result.blob.size,
      finishedAt: Date.now(),
    })
  }

  // ---------- 轮询 ----------
  async function pollStatus(exportId: string): Promise<ExportRecord | null> {
    return records.value.find(x => x.id === exportId) ?? null
  }

  // ---------- 模拟进度（兜底：docx / pdf / char-* / project-snapshot） ----------
  async function simulateProgress(id: string): Promise<void> {
    const start = Date.now()
    const interval = setInterval(() => {
      const r = records.value.find(x => x.id === id)
      if (!r || r.status === 'cancelled' || r.status === 'failed' || r.status === 'ready') {
        clearInterval(interval)
        const idx = _activeTimers.indexOf(interval)
        if (idx !== -1) _activeTimers.splice(idx, 1)
        return
      }
      if (r.progress < 100) {
        r.progress = Math.min(100, r.progress + 8)
        if (r.progress < 25) {
          r.status = 'preparing'
          r.step = '准备资源'
        } else if (r.progress < 60) {
          r.status = 'processing'
          r.step = '处理中'
        } else if (r.progress < 95) {
          r.status = 'packaging'
          r.step = '打包中'
        } else {
          r.status = 'ready'
          r.progress = 100
          r.step = '已完成（模拟）'
          r.outputUrl = `blob:manhuaworks/exports/${id}.${EXT_MAP[r.formatId]}`
          const fmt = EXPORT_FORMATS.find(f => f.id === r.formatId)
          r.sizeBytes = fmt?.estimatedSizeBytes ?? 0
          r.finishedAt = Date.now()
          persist()
          clearInterval(interval)
          const idx = _activeTimers.indexOf(interval)
          if (idx !== -1) _activeTimers.splice(idx, 1)
        }
      }
      if (Date.now() - start > POLL_TIMEOUT_MS) {
        r.status = 'failed'
        r.error = '超时'
        clearInterval(interval)
        const idx = _activeTimers.indexOf(interval)
        if (idx !== -1) _activeTimers.splice(idx, 1)
        persist()
      }
    }, POLL_INTERVAL_MS)
    _activeTimers.push(interval)
  }

  const EXT_MAP: Record<ExportFormatId, string> = {
    md: 'md', docx: 'docx', pdf: 'pdf', txt: 'txt', json: 'json',
    'char-png': 'png', 'char-zip': 'zip', 'char-sqlite': 'sqlite',
    'project-zip': 'zip', 'project-snapshot': 'json',
    'image-zip': 'zip', 'video-zip': 'zip', 'all-assets': 'zip',
    'video-mp4': 'mp4', 'video-mov': 'mov', 'video-gif': 'gif', 'video-vertical': 'mp4',
  }

  // ---------- 操作 ----------
  function cancelExport(exportId: string) {
    const r = records.value.find(x => x.id === exportId)
    if (r && ['queued', 'preparing', 'processing', 'packaging'].includes(r.status)) {
      r.status = 'cancelled'
      r.step = '已取消'
      r.finishedAt = Date.now()
      persist()
    }
  }

  async function retryExport(exportId: string): Promise<string | null> {
    const r = records.value.find(x => x.id === exportId)
    if (!r) return null
    // Revoke any existing blob URL before resetting
    revokeBlobUrl(r.outputUrl)
    // 重置状态后重新触发
    r.status = 'queued'
    r.progress = 0
    r.step = '重试中'
    r.error = null
    r.outputUrl = null
    r.finishedAt = null
    persist()
    await triggerExport(r.formatId)
    // 移除旧记录（triggerExport 已创建新记录）
    records.value = records.value.filter(x => x.id !== exportId)
    persist()
    return records.value[0]?.id ?? null
  }

  function removeRecord(exportId: string) {
    const r = records.value.find(x => x.id === exportId)
    if (r) revokeBlobUrl(r.outputUrl)
    records.value = records.value.filter(x => x.id !== exportId)
    persist()
  }

  function clearCompleted() {
    // Revoke blob URLs of records about to be discarded
    for (const r of records.value) {
      if (r.status === 'ready' || r.status === 'cancelled' || r.status === 'failed') {
        revokeBlobUrl(r.outputUrl)
      }
    }
    records.value = records.value.filter(
      r => r.status !== 'ready' && r.status !== 'cancelled' && r.status !== 'failed',
    )
    persist()
  }

  // ---------- 批量导出 ----------
  function addToBatch(formatId: ExportFormatId, label?: string) {
    const fmt = EXPORT_FORMATS.find(f => f.id === formatId)
    if (!fmt) return
    batchQueue.value.push({
      formatId,
      label: label ?? fmt.name,
      options: VIDEO_FORMATS.has(formatId) ? { ...videoOptions.value, audio: { ...videoOptions.value.audio } } : undefined,
    })
  }

  function removeFromBatch(index: number) {
    batchQueue.value.splice(index, 1)
  }

  function clearBatch() {
    batchQueue.value.length = 0
  }

  async function triggerBatchExport(): Promise<string[]> {
    const ids: string[] = []
    for (const item of batchQueue.value) {
      const id = await triggerExport(item.formatId, item.options)
      ids.push(id)
    }
    clearBatch()
    return ids
  }

  return {
    categories: EXPORT_CATEGORIES,
    formats: EXPORT_FORMATS,
    records,
    loading,
    error,
    activeCategory,
    filteredFormats,
    formatCountByCategory,
    videoOptions,
    batchQueue,
    triggerExport,
    pollStatus,
    cancelExport,
    retryExport,
    removeRecord,
    clearCompleted,
    addToBatch,
    removeFromBatch,
    clearBatch,
    triggerBatchExport,
    cleanupTimers,
  }
}
