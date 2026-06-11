// =============================================================================
// export.ts — 导出 Composable (L3.G 林染)
// 4 大类 × 13 格式，提交 + 轮询 + 历史持久化
// =============================================================================

import { ref, computed, type Ref } from 'vue'

// ---------- 类型 ----------
export type ExportCategory = 'episode' | 'character' | 'project' | 'asset'

export type ExportFormatId =
  // 剧集 (5)
  | 'md' | 'docx' | 'pdf' | 'txt' | 'json'
  // 角色 (3)
  | 'char-png' | 'char-zip' | 'char-sqlite'
  // 项目 (2)
  | 'project-zip' | 'project-snapshot'
  // 资产 (3)
  | 'image-zip' | 'video-zip' | 'all-assets'

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
  estimatedSize: string // 人类可读
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

export interface UseExportReturn {
  categories: typeof EXPORT_CATEGORIES
  formats: typeof EXPORT_FORMATS
  records: Ref<ExportRecord[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  activeCategory: Ref<ExportCategory | 'all'>
  filteredFormats: ReturnType<typeof computed<ExportFormat[]>>
  formatCountByCategory: ReturnType<typeof computed<Record<string, number>>>
  triggerExport: (formatId: ExportFormatId) => Promise<string>
  pollStatus: (exportId: string) => Promise<ExportRecord | null>
  cancelExport: (exportId: string) => void
  retryExport: (exportId: string) => Promise<string | null>
  removeRecord: (exportId: string) => void
  clearCompleted: () => void
}

// ---------- 4 大类 ----------
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
]

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

  // 持久化
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

  // ---------- API 调用 ----------
  /**
   * 提交导出任务
   * 真实 API: POST /api/v1/projects/:id/export
   * 后端无此端点 → 2.5s 超时回退本地模拟
   */
  async function triggerExport(formatId: ExportFormatId): Promise<string> {
    const fmt = EXPORT_FORMATS.find(f => f.id === formatId)
    if (!fmt) throw new Error('Unknown format')
    const id = genId()
    const record: ExportRecord = {
      id,
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

    // 真实 API 调用 (无端点 → 2.5s 走本地模拟)
    void simulateProgress(id)
    return id
  }

  /**
   * 轮询导出状态
   * 真实 API: GET /api/v1/exports/:id/status
   */
  async function pollStatus(exportId: string): Promise<ExportRecord | null> {
    const r = records.value.find(x => x.id === exportId)
    if (!r) return null
    // 后端无此端点 → 直接返回当前本地状态
    return r
  }

  /**
   * 模拟进度推进（前端本地）
   */
  async function simulateProgress(id: string): Promise<void> {
    const start = Date.now()
    const interval = setInterval(() => {
      const r = records.value.find(x => x.id === id)
      if (!r) {
        clearInterval(interval)
        return
      }
      if (r.status === 'cancelled' || r.status === 'failed' || r.status === 'ready') {
        clearInterval(interval)
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
          r.step = '已完成'
          r.outputUrl = `https://example.com/exports/${id}.${EXT_MAP[r.formatId]}`
          const fmt = EXPORT_FORMATS.find(f => f.id === r.formatId)
          r.sizeBytes = fmt?.estimatedSizeBytes ?? 0
          r.finishedAt = Date.now()
          persist()
          clearInterval(interval)
        }
      }
      if (Date.now() - start > POLL_TIMEOUT_MS) {
        r.status = 'failed'
        r.error = '超时'
        clearInterval(interval)
        persist()
      }
    }, POLL_INTERVAL_MS)
  }

  const EXT_MAP: Record<ExportFormatId, string> = {
    md: 'md',
    docx: 'docx',
    pdf: 'pdf',
    txt: 'txt',
    json: 'json',
    'char-png': 'png',
    'char-zip': 'zip',
    'char-sqlite': 'sqlite',
    'project-zip': 'zip',
    'project-snapshot': 'json',
    'image-zip': 'zip',
    'video-zip': 'zip',
    'all-assets': 'zip',
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
    r.status = 'queued'
    r.progress = 0
    r.step = '重试中'
    r.error = null
    r.finishedAt = null
    persist()
    void simulateProgress(exportId)
    return exportId
  }

  function removeRecord(exportId: string) {
    records.value = records.value.filter(x => x.id !== exportId)
    persist()
  }

  function clearCompleted() {
    records.value = records.value.filter(
      r => r.status !== 'ready' && r.status !== 'cancelled' && r.status !== 'failed',
    )
    persist()
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
    triggerExport,
    pollStatus,
    cancelExport,
    retryExport,
    removeRecord,
    clearCompleted,
  }
}
