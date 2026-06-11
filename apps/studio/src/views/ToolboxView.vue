<script setup lang="ts">
/**
 * ToolboxView.vue — 工具箱主视图 (L3.G 林染: 6 类 × 24 工具)
 *
 * L2: 5 类别 mock 工具
 * L3.G: 6 大类 × 24 工具，深色渐变蓝紫风格，composable 接入
 *
 * 数据流：
 *   1. useToolbox(projectId) → tools, categories
 *   2. 点击工具 → 弹 modal，调 runTool() (2.5s 超时回退本地 mock)
 *   3. 搜索/分类过滤
 */
import { ref, computed, onMounted } from 'vue'
import { useToolbox, type ToolDefinition, type ToolboxCategory } from '../composables/toolbox'

// ---------- 默认 project ----------
const projectId = ref('proj_default_001')

// ---------- composable ----------
const {
  categories,
  tools,
  loading,
  error,
  searchQuery,
  activeCategory,
  filteredTools,
  toolCountByCategory,
  runTool,
  refresh,
} = useToolbox(projectId)

// ---------- 状态 ----------
const activeTool = ref<ToolDefinition | null>(null)
const modalInput = ref('')
const modalOutput = ref('')
const modalRunning = ref(false)
const modalError = ref<string | null>(null)

const activeCategoryChips: Array<ToolboxCategory | 'all'> = ['all', 'text', 'character', 'plot', 'dialogue', 'world', 'export']

// ---------- 主题 ----------
const themeAccent = '#8b5cf6'
onMounted(() => {
  document.documentElement.style.setProperty('--studio-accent', themeAccent)
})

// ---------- 操作 ----------
function openToolModal(t: ToolDefinition) {
  activeTool.value = t
  modalInput.value = ''
  modalOutput.value = ''
  modalError.value = null
  modalRunning.value = false
}

function closeToolModal() {
  activeTool.value = null
}

async function executeTool() {
  if (!activeTool.value || modalRunning.value) return
  modalRunning.value = true
  modalError.value = null
  modalOutput.value = ''
  try {
    const r = await runTool(activeTool.value.id, modalInput.value)
    if (r.ok) {
      modalOutput.value = r.output
    } else {
      modalError.value = r.error ?? '运行失败'
    }
  } catch (e) {
    modalError.value = (e as Error).message
  } finally {
    modalRunning.value = false
  }
}

// SVG 图标 map
const ICON_PATHS: Record<string, string> = {
  count: 'M3 3h18v4H3zm0 6h12v4H3zm0 6h18v4H3z',
  clean: 'M9 11l-4 4-2-2 4-4-4-4 2-2 4 4 4-4 2 2-4 4 4 4-2 2z',
  rename: 'M3 17v4h4l11-11-4-4zm17-12a1 1 0 00-1.4 0l-2.6 2.6 4 4 2.6-2.6a1 1 0 000-1.4z',
  style: 'M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z',
  name: 'M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z',
  graph: 'M12 2a3 3 0 100 6 3 3 0 000-6zM6 18a3 3 0 100 6 3 3 0 000-6zm12 0a3 3 0 100 6 3 3 0 000-6zM9 11l-3 7m12-7l-3 7M12 8v6',
  radar: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 100 12 6 6 0 000-12zm0 4a2 2 0 100 4 2 2 0 000-4z',
  card: 'M4 4h16v16H4zm4 4v8h8V8z',
  conflict: 'M12 2L2 22h20zm0 7l6 11H6z',
  beat: 'M3 12l3-3 3 3 3-3 3 3 3-3 3 3',
  act: 'M3 3h18v6H3zm0 12h18v6H3z',
  foreshadow: 'M12 2v20M2 12h20M5 5l14 14M19 5L5 19',
  polish: 'M5 3l4 14 2-6 6-2z',
  style2: 'M12 2L9 9l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1z',
  inner: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 4v6l4 2',
  subtitle: 'M3 5h18v14H3zm3 4h4v2H6zm6 0h6v2h-6z',
  check: 'M9 16l-3-3 1-1 2 2 6-6 1 1zm0-10L5 2 6 1l3 3 9-9 1 1z',
  graph2: 'M3 3h18v18H3zm4 4v10h10V7z',
  namespace: 'M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm12 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4z',
  concept: 'M12 2a7 7 0 014 12.7V17h-8v-2.3A7 7 0 0112 2zm-3 18h6v2H9z',
  ep: 'M4 4h16v16H4zm2 4h12v8H6z',
  'exp-char': 'M12 2a4 4 0 110 8 4 4 0 010-8zm0 10c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6z',
  bible: 'M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4zm4 4v12h12V8z',
  script: 'M3 4h18v16H3zm2 4h14v2H5zm0 4h14v2H5zm0 4h10v2H5z',
}
</script>

<template>
  <div class="toolbox-view relative flex h-full w-full flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-gray-100">
    <!-- 顶部 -->
    <header class="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/5 bg-slate-900/60 px-4 backdrop-blur">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-base shadow-lg">
          🧰
        </div>
        <div class="flex flex-col">
          <h1 class="text-sm font-semibold tracking-wide text-white">工具库</h1>
          <p class="text-[10px] text-slate-400">6 大类 · {{ tools.length }} 工具 · 创作小工具集合</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索工具…"
            class="w-56 rounded-lg border border-white/10 bg-slate-800/80 px-3 py-1.5 text-[12px] text-white placeholder-slate-500 outline-none transition focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50"
          />
          <span class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
        </div>
        <button
          class="rounded-lg border border-white/10 bg-slate-800/80 px-3 py-1.5 text-[11px] text-slate-300 transition hover:bg-slate-700"
          :disabled="loading"
          @click="refresh"
        >
          {{ loading ? '刷新中…' : '🔄 刷新' }}
        </button>
      </div>
    </header>

    <!-- 分类筛选 -->
    <div class="flex flex-shrink-0 items-center gap-2 overflow-x-auto border-b border-white/5 bg-slate-900/40 px-4 py-2.5">
      <button
        v-for="c in activeCategoryChips"
        :key="c"
        type="button"
        class="flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all"
        :class="activeCategory === c
          ? 'border-purple-500/50 bg-purple-500/20 text-purple-200 shadow-[0_0_12px_rgba(139,92,246,0.25)]'
          : 'border-white/5 bg-slate-800/40 text-slate-400 hover:border-white/10 hover:text-slate-200'"
        @click="activeCategory = c"
      >
        <span class="text-[14px]">
          {{ c === 'all' ? '✨' : (categories.find(x => x.id === c)?.icon ?? '🔧') }}
        </span>
        <span>{{ c === 'all' ? '全部' : categories.find(x => x.id === c)?.name }}</span>
        <span class="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-mono">
          {{ toolCountByCategory[c] ?? 0 }}
        </span>
      </button>
    </div>

    <!-- 错误条 -->
    <div
      v-if="error"
      class="flex flex-shrink-0 items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-1.5 text-[11px] text-red-300"
    >
      <span>⚠️</span>
      <span>{{ error }}（已回退本地 mock）</span>
    </div>

    <!-- 主体 -->
    <main class="flex-1 overflow-y-auto p-4">
      <div
        v-if="filteredTools.length === 0"
        class="flex h-40 flex-col items-center justify-center text-[12px] text-slate-500"
      >
        <span class="text-3xl">🔍</span>
        <span class="mt-2">无匹配工具</span>
      </div>
      <div
        v-else
        class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4"
      >
        <button
          v-for="t in filteredTools"
          :key="t.id"
          type="button"
          class="group relative flex flex-col gap-2 rounded-xl border border-white/5 bg-slate-900/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-purple-500/30 hover:bg-slate-800/80 hover:shadow-[0_8px_30px_rgba(139,92,246,0.15)]"
          @click="openToolModal(t)"
        >
          <!-- 顶部：图标 + 徽章 -->
          <div class="flex items-start justify-between">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-md"
              :class="categories.find(c => c.id === t.category)?.color ?? 'from-slate-500 to-slate-700'"
            >
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path :d="ICON_PATHS[t.icon] ?? ICON_PATHS.style" />
              </svg>
            </div>
            <div class="flex flex-col items-end gap-1">
              <span
                v-if="t.isNew"
                class="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300"
              >
                NEW
              </span>
              <span
                v-if="t.isHot"
                class="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-rose-300"
              >
                🔥 HOT
              </span>
            </div>
          </div>

          <!-- 名称 + 描述 -->
          <div class="flex flex-col gap-1">
            <h3 class="text-[13px] font-semibold text-white">{{ t.name }}</h3>
            <p class="line-clamp-2 text-[11px] leading-relaxed text-slate-400">{{ t.description }}</p>
          </div>

          <!-- 底部信息 -->
          <div class="mt-auto flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-slate-500">
            <span class="flex items-center gap-1">
              <span class="h-1 w-1 rounded-full bg-emerald-400"></span>
              ${{ t.estimatedCost.toFixed(3) }}
            </span>
            <span>~{{ t.estimatedTime }}s</span>
            <span class="text-purple-300/70 group-hover:text-purple-200">运行 →</span>
          </div>
        </button>
      </div>
    </main>

    <!-- 工具详情 Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="activeTool"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          @click.self="closeToolModal"
        >
          <div class="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3.5">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-md"
                  :class="categories.find(c => c.id === activeTool.category)?.color ?? 'from-slate-500 to-slate-700'"
                >
                  <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path :d="ICON_PATHS[activeTool.icon] ?? ICON_PATHS.style" />
                  </svg>
                </div>
                <div>
                  <h2 class="text-[15px] font-semibold text-white">{{ activeTool.name }}</h2>
                  <p class="text-[11px] text-slate-400">
                    {{ categories.find(c => c.id === activeTool.category)?.name }} ·
                    ${{ activeTool.estimatedCost.toFixed(3) }} · ~{{ activeTool.estimatedTime }}s
                  </p>
                </div>
              </div>
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white"
                @click="closeToolModal"
              >
                ✕
              </button>
            </div>

            <!-- Body -->
            <div class="flex-1 overflow-y-auto p-5">
              <p class="mb-3 text-[12px] leading-relaxed text-slate-300">
                {{ activeTool.description }}
              </p>
              <label class="block">
                <span class="text-[11px] font-medium text-slate-300">输入内容（可选）</span>
                <textarea
                  v-model="modalInput"
                  rows="5"
                  placeholder="粘贴文本、角色名、剧情片段等…"
                  class="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-[12px] text-white placeholder-slate-500 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50"
                />
              </label>

              <div
                v-if="modalError"
                class="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-[11px] text-red-300"
              >
                ⚠️ {{ modalError }}
              </div>

              <div
                v-if="modalOutput"
                class="mt-3 rounded-lg border border-white/5 bg-slate-950/60 p-3"
              >
                <div class="mb-2 flex items-center justify-between">
                  <span class="text-[11px] font-semibold text-slate-300">运行结果</span>
                  <button
                    class="rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-white/5"
                    @click="modalOutput = ''"
                  >
                    清空
                  </button>
                </div>
                <pre class="max-h-72 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-200">{{ modalOutput }}</pre>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end gap-2 border-t border-white/10 bg-slate-900/60 px-5 py-3">
              <button
                class="rounded-lg border border-white/10 bg-slate-800 px-4 py-1.5 text-[12px] text-slate-300 transition hover:bg-slate-700"
                @click="closeToolModal"
              >
                关闭
              </button>
              <button
                class="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-5 py-1.5 text-[12px] font-semibold text-white shadow-lg transition hover:shadow-purple-500/50 disabled:opacity-50"
                :disabled="modalRunning"
                @click="executeTool"
              >
                <span v-if="modalRunning" class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                <span>{{ modalRunning ? '运行中…' : '🚀 运行' }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.toolbox-view {
  min-height: 0;
  flex: 1;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
