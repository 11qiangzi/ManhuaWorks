<script setup lang="ts">
/**
 * ExportView.vue — 导出中心主视图 (L3.G 林染: 4 类 × 13 格式)
 *
 * L2: 5 格式 + 平台发布
 * L3.G: 4 大类 × 13 格式，历史记录持久化，深色渐变蓝紫
 *
 * 数据流：
 *   1. useExport(projectId) → formats, categories, records
 *   2. 点击导出按钮 → triggerExport(formatId) → 后端 POST 走 2.5s 超时回退
 *   3. 模拟进度（前端推进）→ ready / failed
 *   4. 历史记录 localStorage 持久化（最近 20 条）
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  useExport,
  type ExportFormat,
  type ExportCategory,
  type ExportRecord,
  type ExportStatus,
} from '../composables/export'

// ---------- 默认 project ----------
const projectId = ref('proj_default_001')

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
  triggerExport,
  cancelExport,
  retryExport,
  removeRecord,
  clearCompleted,
} = useExport(projectId)

const activeCategoryChips: Array<ExportCategory | 'all'> = ['all', 'episode', 'character', 'project', 'asset']

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
    await triggerExport(fmt.id)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Export failed', e)
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
  // 模拟下载 — 实际后端会返回 blob
  alert(`下载: ${r.formatName}\nURL: ${r.outputUrl}\n(本地 mock 不会真正下载)`)
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
  }[ext] ?? 'M3 3h18v18H3z'
}

const _keepRef = onUnmounted // 防止 lint 警告
void _keepRef
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
          <p class="text-[10px] text-slate-400">4 大类 · {{ formats.length }} 格式 · 多场景导出</p>
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
</style>
