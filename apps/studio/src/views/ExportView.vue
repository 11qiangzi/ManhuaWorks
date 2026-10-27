<script setup lang="ts">
/**
 * ExportView.vue — 导出中心主视图 (L3.G 林染: 5 大类 × 13+ 格式)
 *
 * L2: 5 格式 + 平台发布
 * L3.G: 5 大类 × 13+ 格式，历史记录持久化，深色渐变蓝紫
 *
 * 数据流：
 *   1. useExport(projectId) → formats, categories, records
 *   2. 点击导出按钮 → triggerExport(formatId) → 后端 POST 走 2.5s 超时回退
 *   3. 模拟进度（前端推进）→ ready / failed
 *   4. 历史记录 localStorage 持久化（最近 20 条）
 */
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@manhuaworks/ui'
import { useProjectStore } from '../stores/project'
import {
  useExport,
  type ExportFormat,
  type ExportCategory,
  type ExportRecord,
  type ExportStatus,
  type VideoExportOptions,
  type PlatformPresetId,
  type ResolutionId,
  PLATFORM_PRESETS,
  RESOLUTION_OPTIONS,
  createDefaultVideoOptions,
} from '../composables/export'

// ---------- 默认 project ----------
const route = useRoute()
const projectStore = useProjectStore()
const projectId = computed(() =>
  projectStore.current?.id ?? (route.params.projectId as string) ?? 'proj_default_001',
)
const router = useRouter()
const toast = useToast()

function goToExportSettings() {
  router.push('/export/settings')
}

// ---------- composable ----------
const {
  categories,
  formats,
  records,
  loading,
  error,
  activeCategory,
  filteredFormats,
  formatCountByCategory,
  videoOptions,
  batchQueue,
  triggerExport,
  cancelExport,
  retryExport,
  removeRecord,
  clearCompleted,
  addToBatch,
  removeFromBatch,
  clearBatch,
  triggerBatchExport,
  cleanupTimers,
} = useExport(projectId)

const activeCategoryChips: Array<ExportCategory | 'all'> = ['all', 'episode', 'character', 'project', 'asset', 'video']

// ---------- 视频选项面板 ----------
const showVideoPanel = ref(false)
const showBatchPanel = ref(false)
const batchRunning = ref(false)

// ---------- 🎵 音频导出选项 ----------
const showAudioPanel = ref(false)
const audioExportOptions = ref({
  includeBGM: true,
  includeSFX: true,
  includeVoiceover: true,
  exportSeparateTrack: false,
  separateTrackFormat: 'mp3' as 'mp3' | 'flac' | 'wav',
  syncToMaterialLib: false,
  audioQuality: 'high' as 'standard' | 'high' | 'lossless',
})

const selectedPlatform = computed({
  get: () => videoOptions.value.platform,
  set: (v: PlatformPresetId) => { videoOptions.value.platform = v },
})
const selectedResolution = computed({
  get: () => videoOptions.value.resolution,
  set: (v: ResolutionId) => { videoOptions.value.resolution = v },
})

// ---------- 主题 ----------
const themeAccent = '#6366f1'
onMounted(() => {
  document.documentElement.style.setProperty('--studio-accent', themeAccent)
})

// ---------- 派生 ----------
const recentRecords = computed<ExportRecord[]>(() => records.value.slice(0, 20))

const activeCount = computed(() =>
  records.value.filter((r: ExportRecord) =>
    ['queued', 'preparing', 'processing', 'packaging'].includes(r.status),
  ).length,
)

const readyCount = computed(() =>
  records.value.filter((r: ExportRecord) => r.status === 'ready').length,
)

const totalSize = computed(() => {
  let bytes = 0
  for (const r of records.value) {
    if (r.status === 'ready' && r.sizeBytes > 0) bytes += r.sizeBytes
  }
  return bytes
})

// ---------- 操作 ----------
async function onExport(fmt: ExportFormat) {
  try {
    const isVideo = ['video-mp4', 'video-mov', 'video-gif', 'video-vertical'].includes(fmt.id)
    await triggerExport(fmt.id, isVideo ? videoOptions.value : undefined)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Export failed', e)
    const msg = e instanceof Error ? e.message : '导出失败，请重试'
    error.value = msg
    toast.error(`导出失败: ${msg}`)
  }
}

function onAddToBatch(fmt: ExportFormat) {
  addToBatch(fmt.id, fmt.name)
  showBatchPanel.value = true
  toast.info(`已加入批量队列: ${fmt.name}`)
}

async function onBatchExport() {
  if (batchQueue.length === 0 || batchRunning.value) return
  batchRunning.value = true
  try {
    const ids = await triggerBatchExport()
    toast.success(`批量导出已启动: ${ids.length} 个任务`)
    showBatchPanel.value = false
  } catch (e) {
    const msg = e instanceof Error ? e.message : '批量导出失败'
    toast.error(`批量导出失败: ${msg}`)
  } finally {
    batchRunning.value = false
  }
}

function statusLabel(s: ExportStatus): string {
  return {
    idle: '空闲',
    queued: '排队',
    preparing: '准备',
    processing: '处理',
    packaging: '打包',
    ready: '完成',
    failed: '失败',
    cancelled: '取消',
  }[s]
}

function statusColor(s: ExportStatus): string {
  return {
    idle: 'text-slate-400 bg-slate-500/20',
    queued: 'text-amber-300 bg-amber-500/20',
    preparing: 'text-amber-300 bg-amber-500/20',
    processing: 'text-blue-300 bg-blue-500/20',
    packaging: 'text-indigo-300 bg-indigo-500/20',
    ready: 'text-emerald-300 bg-emerald-500/20',
    failed: 'text-rose-300 bg-rose-500/20',
    cancelled: 'text-slate-300 bg-slate-500/20',
  }[s]
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function formatTime(ts: number | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts)
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s 前`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m 前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h 前`
  return `${Math.floor(diff / 86_400_000)}d 前`
}

function downloadRecord(r: ExportRecord) {
  if (!r.outputUrl) return
  if (r.outputUrl.startsWith('blob:manhuaworks')) {
    toast.info('模拟导出暂不支持下载')
    return
  }
  if (r.outputUrl.startsWith('blob:') || r.outputUrl.startsWith('http')) {
    window.open(r.outputUrl, '_blank')
  } else {
    // 模拟下载 — mock URL 不会真正下载
    toast.info(`下载: ${r.formatName} — ${r.outputUrl || '(本地 mock 不会真正下载)'}`)
  }
}

// SVG 图标 map (按 ext 分类)
function extIcon(ext: string): string {
  return {
    md: 'M3 5h18v14H3z',
    docx: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zm-2 12H8v-2h4zm4-4H8V8h8z',
    pdf: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9z',
    txt: 'M3 3h18v18H3z',
    json: 'M5 3h14v4h-2V5H7v2H5zm0 6h2v6h2v2H5zm14 0v8h-4v-2h2v-6z',
    png: 'M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5z',
    zip: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zm-1 7V3.5L18.5 9zM12 18v-2h-1v-2h1v-1h-1v-2h3v2h-1v1h1v2h-1v2z',
    sqlite: 'M12 3a9 9 0 109 9 9 9 0 00-9-9zm0 4a3 3 0 11-3 3 3 3 0 013-3z',
    mp4: 'M4 4h16v16H4zm6 4v8l6-4z',
    mov: 'M4 4h16v16H4zm6 4v8l6-4z',
    gif: 'M4 4h16v16H4zm3 5h2v6H7zm4 0h2v4h2v2h-4zm6 0h2v6h-2z',
  }[ext] ?? 'M3 3h18v18H3z'
}

onUnmounted(() => {
  cleanupTimers?.()
  document.documentElement.style.removeProperty('--studio-accent')
})
</script>

<template>
  <div class="export-view relative flex h-full w-full flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-gray-100">
    <!-- 顶部 -->
    <header class="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/5 bg-slate-900/60 px-4 backdrop-blur">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-base shadow-lg">
          📤
        </div>
        <div class="flex flex-col">
          <h1 class="text-sm font-semibold tracking-wide text-white">导出中心</h1>
          <p class="text-[10px] text-slate-400">5 大类 · {{ formats.length }} 格式 · 多场景导出</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-[11px] text-slate-300">
        <div class="flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"></span>
          <span>运行 <strong class="font-mono text-amber-300">{{ activeCount }}</strong></span>
        </div>
        <span class="text-slate-600">|</span>
        <div class="flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
          <span>完成 <strong class="font-mono text-emerald-300">{{ readyCount }}</strong></span>
        </div>
        <span class="text-slate-600">|</span>
        <span>总计 <strong class="font-mono">{{ formatBytes(totalSize) }}</strong></span>
        <button
          v-if="batchQueue.length > 0"
          class="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[11px] font-medium text-violet-200 transition hover:bg-violet-500/25"
          @click="showBatchPanel = !showBatchPanel"
        >📋 批量队列 ({{ batchQueue.length }})</button>
        <button
          v-if="activeCategory === 'video' || activeCategory === 'all'"
          class="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-rose-500/50 hover:bg-slate-700"
          @click="showVideoPanel = !showVideoPanel"
        >🎥 {{ showVideoPanel ? '收起' : '视频选项' }}</button>
        <button
          class="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-amber-500/50 hover:bg-slate-700"
          @click="showAudioPanel = !showAudioPanel"
        >🎵 {{ showAudioPanel ? '收起' : '音频选项' }}</button>
        <button
          class="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-indigo-500/50 hover:bg-slate-700"
          @click="goToExportSettings"
        >⚙️ 导出设置</button>
      </div>
    </header>

    <!-- 错误条 -->
    <div
      v-if="error"
      class="flex flex-shrink-0 items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-1.5 text-[11px] text-red-300"
    >
      <span>⚠️</span>
      <span>{{ error }}</span>
    </div>

    <!-- 分类筛选 -->
    <div class="flex flex-shrink-0 items-center gap-2 overflow-x-auto border-b border-white/5 bg-slate-900/40 px-4 py-2.5">
      <button
        v-for="c in activeCategoryChips"
        :key="c"
        type="button"
        class="flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all"
        :class="activeCategory === c
          ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
          : 'border-white/5 bg-slate-800/40 text-slate-400 hover:border-white/10 hover:text-slate-200'"
        @click="activeCategory = c"
      >
        <span class="text-[14px]">{{ c === 'all' ? '✨' : (categories.find(x => x.id === c)?.icon ?? '📤') }}</span>
        <span>{{ c === 'all' ? '全部' : categories.find(x => x.id === c)?.name }}</span>
        <span class="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-mono">
          {{ formatCountByCategory[c] ?? 0 }}
        </span>
      </button>
    </div>

    <!-- 视频导出选项面板 -->
    <Transition name="panel">
      <div
        v-if="showVideoPanel"
        class="flex-shrink-0 border-b border-rose-500/20 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-rose-950/30 px-4 py-3"
      >
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-[12px] font-semibold text-rose-200">🎥 视频导出选项</h3>
          <span class="text-[10px] text-slate-500">选择平台预设、分辨率和音频配置</span>
        </div>
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <!-- 平台适配 -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] font-medium text-slate-400">平台适配</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="p in PLATFORM_PRESETS.filter(x => x.id !== 'custom')"
                :key="p.id"
                type="button"
                class="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-all"
                :class="selectedPlatform === p.id
                  ? 'border-rose-500/50 bg-rose-500/20 text-rose-200'
                  : 'border-white/5 bg-slate-800/50 text-slate-400 hover:border-white/10'"
                @click="selectedPlatform = p.id"
              >
                <span>{{ p.icon }}</span>
                <span>{{ p.name }}</span>
                <span class="font-mono text-[9px] opacity-60">{{ p.aspectRatio }}</span>
              </button>
            </div>
          </div>

          <!-- 分辨率 -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] font-medium text-slate-400">分辨率</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="r in RESOLUTION_OPTIONS"
                :key="r.id"
                type="button"
                class="flex flex-col items-start rounded-md border px-2.5 py-1.5 text-[10px] transition-all"
                :class="selectedResolution === r.id
                  ? 'border-rose-500/50 bg-rose-500/20 text-rose-200'
                  : 'border-white/5 bg-slate-800/50 text-slate-400 hover:border-white/10'"
                @click="selectedResolution = r.id"
              >
                <span class="font-semibold">{{ r.name }}</span>
                <span class="text-[9px] opacity-60">{{ r.description }}</span>
              </button>
            </div>
          </div>

          <!-- 音频选项 -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] font-medium text-slate-400">音频选项</span>
            <div class="flex flex-col gap-1.5 rounded-md border border-white/5 bg-slate-800/30 p-2">
              <label class="flex cursor-pointer items-center gap-2 text-[10px] text-slate-300">
                <input
                  v-model="videoOptions.audio.includeBGM"
                  type="checkbox"
                  class="h-3 w-3 rounded border-white/20 bg-slate-700 accent-rose-500"
                />
                <span>包含背景音乐 (BGM)</span>
              </label>
              <label class="flex cursor-pointer items-center gap-2 text-[10px] text-slate-300">
                <input
                  v-model="videoOptions.audio.includeSFX"
                  type="checkbox"
                  class="h-3 w-3 rounded border-white/20 bg-slate-700 accent-rose-500"
                />
                <span>包含音效 (SFX)</span>
              </label>
              <div class="flex items-center gap-2 text-[10px] text-slate-300">
                <span>音质:</span>
                <select
                  v-model="videoOptions.audio.audioQuality"
                  class="rounded border border-white/10 bg-slate-800 px-1.5 py-0.5 text-[10px] text-white outline-none"
                >
                  <option value="low">低 (128kbps)</option>
                  <option value="medium">中 (256kbps)</option>
                  <option value="high">高 (320kbps)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 🎵 音频导出选项面板 -->
    <Transition name="panel">
      <div
        v-if="showAudioPanel"
        class="flex-shrink-0 border-b border-amber-500/20 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-amber-950/20 px-4 py-3"
      >
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-[12px] font-semibold text-amber-200">🎵 音频导出选项</h3>
          <span class="text-[10px] text-slate-500">配置音频轨道导出参数</span>
        </div>
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <!-- 左列：音频轨道包含选项 -->
          <div class="flex flex-col gap-2">
            <span class="text-[10px] font-medium text-slate-400">包含音频轨道</span>
            <div class="flex flex-col gap-1.5 rounded-md border border-white/5 bg-slate-800/30 p-2.5">
              <label class="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
                <input
                  v-model="audioExportOptions.includeBGM"
                  type="checkbox"
                  class="h-3.5 w-3.5 rounded border-white/20 bg-slate-700 accent-amber-500"
                />
                <span>包含BGM</span>
                <span class="ml-auto rounded bg-indigo-500/15 px-1.5 py-0.5 text-[9px] text-indigo-300">背景音乐</span>
              </label>
              <label class="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
                <input
                  v-model="audioExportOptions.includeSFX"
                  type="checkbox"
                  class="h-3.5 w-3.5 rounded border-white/20 bg-slate-700 accent-amber-500"
                />
                <span>包含音效</span>
                <span class="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-300">SFX</span>
              </label>
              <label class="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
                <input
                  v-model="audioExportOptions.includeVoiceover"
                  type="checkbox"
                  class="h-3.5 w-3.5 rounded border-white/20 bg-slate-700 accent-amber-500"
                />
                <span>包含配音</span>
                <span class="ml-auto rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-300">VO</span>
              </label>

              <div class="mt-1 border-t border-white/5 pt-2">
                <label class="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
                  <input
                    v-model="audioExportOptions.exportSeparateTrack"
                    type="checkbox"
                    class="h-3.5 w-3.5 rounded border-white/20 bg-slate-700 accent-amber-500"
                  />
                  <span>导出单独音频轨</span>
                  <select
                    v-if="audioExportOptions.exportSeparateTrack"
                    v-model="audioExportOptions.separateTrackFormat"
                    class="ml-auto rounded border border-white/10 bg-slate-800 px-2 py-0.5 text-[10px] text-white outline-none"
                  >
                    <option value="mp3">MP3</option>
                    <option value="flac">FLAC</option>
                    <option value="wav">WAV</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <!-- 右列：音质与同步 -->
          <div class="flex flex-col gap-2">
            <span class="text-[10px] font-medium text-slate-400">音质与同步</span>
            <div class="flex flex-col gap-2.5 rounded-md border border-white/5 bg-slate-800/30 p-2.5">
              <!-- 音频质量 -->
              <div class="flex flex-col gap-1.5">
                <span class="text-[10px] font-medium text-slate-400">音频质量</span>
                <div class="flex gap-1.5">
                  <button
                    v-for="q in [
                      { id: 'standard', label: '标准', detail: '128kbps', icon: '🔈' },
                      { id: 'high', label: '高', detail: '320kbps', icon: '🔉' },
                      { id: 'lossless', label: '无损', detail: 'FLAC/WAV', icon: '🔊' },
                    ]"
                    :key="q.id"
                    type="button"
                    class="flex flex-1 flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-[10px] transition-all"
                    :class="audioExportOptions.audioQuality === q.id
                      ? 'border-amber-500/50 bg-amber-500/20 text-amber-200'
                      : 'border-white/5 bg-slate-800/50 text-slate-400 hover:border-white/10'"
                    @click="audioExportOptions.audioQuality = q.id as any"
                  >
                    <span class="text-[14px]">{{ q.icon }}</span>
                    <span class="font-semibold">{{ q.label }}</span>
                    <span class="text-[9px] opacity-60">{{ q.detail }}</span>
                  </button>
                </div>
              </div>

              <!-- 同步导出 -->
              <label class="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
                <input
                  v-model="audioExportOptions.syncToMaterialLib"
                  type="checkbox"
                  class="h-3.5 w-3.5 rounded border-white/20 bg-slate-700 accent-amber-500"
                />
                <span>配乐文件同步导出至素材库</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 批量导出队列面板 -->
    <Transition name="panel">
      <div
        v-if="showBatchPanel && batchQueue.length > 0"
        class="flex-shrink-0 border-b border-violet-500/20 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-violet-950/30 px-4 py-3"
      >
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-[12px] font-semibold text-violet-200">📋 批量导出队列 ({{ batchQueue.length }})</h3>
          <div class="flex items-center gap-2">
            <button
              class="rounded border border-white/10 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 transition hover:bg-slate-700"
              @click="clearBatch"
            >清空队列</button>
            <button
              class="flex items-center gap-1 rounded-md bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-1 text-[10px] font-semibold text-white shadow-sm transition hover:shadow-violet-500/50 disabled:opacity-50"
              :disabled="batchRunning"
              @click="onBatchExport"
            >
              <span v-if="batchRunning" class="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
              <span>{{ batchRunning ? '导出中…' : '🚀 批量导出' }}</span>
            </button>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <div
            v-for="(item, idx) in batchQueue"
            :key="idx"
            class="flex items-center gap-1.5 rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200"
          >
            <span class="font-medium">{{ item.label }}</span>
            <button
              class="ml-1 text-violet-400/60 transition hover:text-rose-300"
              @click="removeFromBatch(idx)"
            >✕</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 主体：左导出格式 / 右历史记录 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 左：导出格式网格 -->
      <div class="flex-1 overflow-y-auto p-4">
        <div
          v-if="filteredFormats.length === 0"
          class="flex h-40 flex-col items-center justify-center text-[12px] text-slate-500"
        >
          <span class="text-3xl">📭</span>
          <span class="mt-2">无匹配格式</span>
        </div>
        <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
          <div
            v-for="fmt in filteredFormats"
            :key="fmt.id"
            class="group flex flex-col gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-4 transition-all hover:border-indigo-500/30 hover:bg-slate-800/80 hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)]"
          >
            <!-- 顶部：图标 + 类别标签 -->
            <div class="flex items-start justify-between">
              <div
                class="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-md"
                :class="categories.find(c => c.id === fmt.category)?.color ?? 'from-slate-500 to-slate-700'"
              >
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path :d="extIcon(fmt.ext)" />
                </svg>
              </div>
              <span class="rounded-md border border-white/10 bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] uppercase text-slate-400">
                {{ fmt.ext }}
              </span>
            </div>

            <!-- 名称 + 描述 -->
            <div class="flex flex-col gap-1">
              <h3 class="text-[13px] font-semibold text-white">{{ fmt.name }}</h3>
              <p class="line-clamp-2 text-[11px] leading-relaxed text-slate-400">{{ fmt.description }}</p>
            </div>

            <!-- 底部信息 -->
            <div class="mt-auto flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-slate-500">
              <span class="flex items-center gap-1">
                <span>📦</span>
                <span>{{ fmt.estimatedSize }}</span>
              </span>
              <div class="flex items-center gap-1.5">
                <button
                  class="flex items-center gap-1 rounded-md border border-white/10 bg-slate-800/80 px-2 py-1 text-[10px] text-slate-300 transition hover:border-violet-500/30 hover:bg-slate-700"
                  :disabled="loading"
                  title="加入批量队列"
                  @click="onAddToBatch(fmt)"
                >
                  <span>📋</span>
                  <span>批量</span>
                </button>
                <button
                  class="flex items-center gap-1 rounded-md bg-gradient-to-r from-indigo-500 to-violet-600 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm transition hover:shadow-indigo-500/50 disabled:opacity-50"
                  :disabled="loading"
                  @click="onExport(fmt)"
                >
                  <span>📤</span>
                  <span>导出</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右：历史记录 -->
      <aside class="w-96 flex-shrink-0 overflow-hidden border-l border-white/5 bg-slate-900/40">
        <div class="flex items-center justify-between border-b border-white/5 bg-slate-900/60 px-4 py-2.5">
          <div>
            <h3 class="text-[12px] font-semibold text-white">历史记录</h3>
            <p class="text-[10px] text-slate-500">最近 {{ recentRecords.length }} 条</p>
          </div>
          <button
            v-if="readyCount > 0"
            class="rounded border border-white/10 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 transition hover:bg-slate-700"
            @click="clearCompleted"
          >
            清空已完成
          </button>
        </div>
        <div class="h-full overflow-y-auto p-3">
          <div
            v-if="recentRecords.length === 0"
            class="flex h-40 flex-col items-center justify-center text-[12px] text-slate-500"
          >
            <span class="text-2xl">📭</span>
            <span class="mt-1.5">暂无导出记录</span>
            <span class="mt-0.5 text-[10px]">点击左侧卡片开始</span>
          </div>
          <div v-else class="flex flex-col gap-2">
            <div
              v-for="r in recentRecords"
              :key="r.id"
              class="flex flex-col gap-1.5 rounded-lg border border-white/5 bg-slate-900/60 p-2.5"
            >
              <!-- 顶部：名称 + 状态 -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span
                    class="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                    :class="statusColor(r.status)"
                  >
                    {{ statusLabel(r.status) }}
                  </span>
                  <span class="text-[11px] font-medium text-white">{{ r.formatName }}</span>
                </div>
                <span class="text-[9px] text-slate-500">{{ timeAgo(r.createdAt) }}</span>
              </div>

              <!-- 进度条 -->
              <div v-if="['queued', 'preparing', 'processing', 'packaging'].includes(r.status)" class="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                  :style="{ width: r.progress + '%' }"
                ></div>
              </div>

              <!-- 步骤 -->
              <div class="flex items-center justify-between text-[10px] text-slate-400">
                <span class="truncate">{{ r.step }}</span>
                <span class="font-mono">{{ r.progress }}%</span>
              </div>

              <!-- 大小 / 时间 -->
              <div class="flex items-center justify-between text-[9px] text-slate-500">
                <span>大小: {{ formatBytes(r.sizeBytes) }}</span>
                <span v-if="r.finishedAt">完成: {{ formatTime(r.finishedAt) }}</span>
              </div>

              <!-- 错误 -->
              <div v-if="r.error" class="rounded bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300">
                ⚠️ {{ r.error }}
              </div>

              <!-- 操作 -->
              <div class="mt-1 flex items-center gap-1.5 border-t border-white/5 pt-1.5">
                <button
                  v-if="r.status === 'ready' && r.outputUrl"
                  class="flex-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300 transition hover:bg-emerald-500/30"
                  @click="downloadRecord(r)"
                >
                  ⬇ 下载
                </button>
                <button
                  v-if="['queued', 'preparing', 'processing', 'packaging'].includes(r.status)"
                  class="flex-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300 transition hover:bg-amber-500/30"
                  @click="cancelExport(r.id)"
                >
                  取消
                </button>
                <button
                  v-if="r.status === 'failed' || r.status === 'cancelled'"
                  class="flex-1 rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300 transition hover:bg-blue-500/30"
                  @click="retryExport(r.id)"
                >
                  🔄 重试
                </button>
                <button
                  v-if="r.status === 'ready' || r.status === 'failed' || r.status === 'cancelled'"
                  class="rounded bg-slate-700/50 px-2 py-0.5 text-[10px] text-slate-400 transition hover:bg-slate-700"
                  @click="removeRecord(r.id)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.export-view {
  min-height: 0;
  flex: 1;
}

.panel-enter-active,
.panel-leave-active {
  transition: all 0.2s ease;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  overflow: hidden;
}
.panel-enter-to,
.panel-leave-from {
  opacity: 1;
  max-height: 300px;
  overflow: hidden;
}
</style>
