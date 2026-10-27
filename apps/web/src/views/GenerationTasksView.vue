<script setup lang="ts">
/**
 * GenerationTasksView.vue — AI 生成任务管理
 * ManhuaWorks P0 · 生成任务管理器前端
 *
 * 功能: 查看/筛选/分页浏览/取消 AI 生成任务
 * 后端: api.generation (submit/get/list/cancel @ /v1/generation)
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGenerationStore } from '../stores/generationStore'
import type { GenerationStatus, GenerationTaskType } from '@manhuaworks/api-client'

const store = useGenerationStore()

// ============ 状态筛选 Tab ============
const STATUS_TABS: { id: GenerationStatus | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: '全部', icon: '📋' },
  { id: 'queued', label: '排队中', icon: '⏳' },
  { id: 'running', label: '运行中', icon: '⚡' },
  { id: 'succeeded', label: '成功', icon: '✅' },
  { id: 'failed', label: '失败', icon: '❌' },
  { id: 'cancelled', label: '已取消', icon: '🚫' },
]

const activeStatus = ref<GenerationStatus | 'all'>('all')

// ============ 任务类型下拉 ============
const TASK_TYPES: { id: GenerationTaskType | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: '全部类型', icon: '🗂' },
  { id: 'image', label: '图片', icon: '🖼' },
  { id: 'video', label: '视频', icon: '🎬' },
  { id: 'audio', label: '音频', icon: '🎵' },
  { id: 'tts', label: '语音', icon: '🗣' },
]

const activeType = ref<GenerationTaskType | 'all'>('all')

// ============ Provider 标签 ============
const PROVIDER_LABELS: Record<string, string> = {
  seedream: 'Seedream',
  seedance: 'Seedance',
  minimax: 'MiniMax',
  volcengine: '火山引擎',
  suno: 'Suno',
  openai: 'OpenAI',
}

// ============ 过滤后列表 ============
const filteredTasks = computed(() => {
  let list = store.tasks
  if (activeStatus.value !== 'all') {
    list = list.filter(t => t.status === activeStatus.value)
  }
  if (activeType.value !== 'all') {
    list = list.filter(t => t.taskType === activeType.value)
  }
  return list
})

const hasMore = computed(() => store.tasks.length < store.total)

// ============ 状态徽章样式 ============
function statusClass(status: string): string {
  const map: Record<string, string> = {
    queued: 'gt-badge--queued',
    running: 'gt-badge--running',
    succeeded: 'gt-badge--success',
    failed: 'gt-badge--danger',
    cancelled: 'gt-badge--cancelled',
    expired: 'gt-badge--expired',
  }
  return map[status] ?? ''
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    queued: '排队中',
    running: '运行中',
    succeeded: '成功',
    failed: '失败',
    cancelled: '已取消',
    expired: '已过期',
  }
  return map[status] ?? status
}

// ============ 时间格式化 ============
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

// ============ 取消任务 ============
const cancellingIds = ref(new Set<string>())

async function onCancel(taskId: string) {
  cancellingIds.value.add(taskId)
  try {
    await store.cancel(taskId)
  } catch {
    // error in store
  } finally {
    cancellingIds.value.delete(taskId)
  }
}

// ============ Tab 切换 ============
watch(activeStatus, () => {
  store.loadList({
    status: activeStatus.value === 'all' ? undefined : activeStatus.value,
    reset: true,
  })
})

// ============ 生命周期 ============
onMounted(async () => {
  await store.loadList({ reset: true })
  store.startAutoRefresh()
})

onUnmounted(() => {
  store.stopAutoRefresh()
})
</script>

<template>
  <div class="gt-root">
    <!-- ===== 顶栏 ===== -->
    <header class="gt-header">
      <div class="gt-header-info">
        <h1 class="gt-title">⚡ AI 生成任务</h1>
        <p class="gt-subtitle">
          {{ store.total }} 个任务
          <span v-if="store.active.length > 0" class="gt-active-count">
            · {{ store.active.length }} 个活跃
          </span>
        </p>
      </div>
      <div class="gt-header-actions">
        <button class="gt-btn gt-btn--ghost" @click="store.loadList({ status: activeStatus === 'all' ? undefined : activeStatus, reset: true })">
          🔄 刷新
        </button>
      </div>
    </header>

    <!-- ===== 状态 Tab ===== -->
    <nav class="gt-tabs">
      <button
        v-for="tab in STATUS_TABS"
        :key="tab.id"
        class="gt-tab"
        :class="{ 'gt-tab--active': activeStatus === tab.id }"
        @click="activeStatus = tab.id"
      >
        <span class="gt-tab-icon">{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
        <span v-if="tab.id !== 'all' && store.statusCounts[tab.id]" class="gt-tab-count">
          {{ store.statusCounts[tab.id] }}
        </span>
      </button>
    </nav>

    <!-- ===== 工具栏 ===== -->
    <div class="gt-toolbar">
      <select v-model="activeType" class="gt-select">
        <option v-for="t in TASK_TYPES" :key="t.id" :value="t.id">{{ t.icon }} {{ t.label }}</option>
      </select>
    </div>

    <!-- ===== 错误提示 ===== -->
    <div v-if="store.error" class="gt-error">
      ⚠ {{ store.error }}
      <button class="gt-error-close" @click="store.clearError()">&times;</button>
    </div>

    <!-- ===== 加载骨架 ===== -->
    <div v-if="store.loading && store.tasks.length === 0" class="gt-skeleton">
      <div v-for="n in 4" :key="n" class="gt-skeleton-card" />
    </div>

    <!-- ===== 空状态 ===== -->
    <div v-else-if="filteredTasks.length === 0" class="gt-empty">
      <span class="gt-empty-icon">⚡</span>
      <h3>暂无生成任务</h3>
      <p>在创作空间中提交 AI 生成请求后，任务会出现在这里</p>
    </div>

    <!-- ===== 任务列表 ===== -->
    <div v-else class="gt-list">
      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="gt-card"
        :class="{ 'gt-card--running': task.status === 'running' }"
      >
        <!-- 左侧状态条 -->
        <div class="gt-card-status-bar" :class="statusClass(task.status)" />

        <!-- 主体 -->
        <div class="gt-card-body">
          <div class="gt-card-header">
            <div class="gt-card-badges">
              <span class="gt-badge" :class="statusClass(task.status)">{{ statusLabel(task.status) }}</span>
              <span class="gt-badge gt-badge--type">{{ TASK_TYPES.find(t => t.id === task.taskType)?.icon }} {{ task.taskType }}</span>
              <span class="gt-provider">{{ PROVIDER_LABELS[task.provider] ?? task.provider }}</span>
            </div>
            <span class="gt-card-time">{{ timeAgo(task.createdAt) }}</span>
          </div>

          <!-- Prompt -->
          <p class="gt-card-prompt">{{ task.prompt }}</p>

          <!-- 进度条 (running) -->
          <div v-if="task.status === 'running'" class="gt-progress">
            <div class="gt-progress-bar">
              <div class="gt-progress-fill" :style="{ width: task.progress + '%' }" />
            </div>
            <span class="gt-progress-text">{{ task.progress }}%</span>
          </div>

          <!-- 结果预览 (succeeded image) -->
          <div v-if="task.status === 'succeeded' && task.resultUrl && task.taskType === 'image'" class="gt-result-preview">
            <img :src="task.resultStoredUrl ?? task.resultUrl" alt="result" loading="lazy" />
          </div>

          <!-- 错误信息 (failed) -->
          <div v-if="task.status === 'failed' && task.errorMessage" class="gt-error-msg">
            {{ task.errorMessage }}
          </div>

          <!-- 底部信息 -->
          <div class="gt-card-footer">
            <span class="gt-card-id">{{ String(task.id).slice(0, 8) }}...</span>
            <div class="gt-card-actions">
              <button
                v-if="task.status === 'queued' || task.status === 'running'"
                class="gt-btn gt-btn--sm gt-btn--danger"
                :disabled="cancellingIds.has(task.id as string)"
                @click="onCancel(task.id as string)"
              >
                {{ cancellingIds.has(task.id as string) ? '取消中...' : '取消任务' }}
              </button>
              <a
                v-if="task.status === 'succeeded' && (task.resultStoredUrl ?? task.resultUrl)"
                :href="task.resultStoredUrl ?? task.resultUrl"
                target="_blank"
                class="gt-btn gt-btn--sm gt-btn--ghost"
              >
                查看结果 ↗
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <div v-if="hasMore" class="gt-load-more">
        <button class="gt-btn gt-btn--ghost" :disabled="store.loading" @click="store.loadMore()">
          {{ store.loading ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gt-root {
  min-height: 100vh;
  background: var(--bg-primary, #09090b);
  color: var(--text-primary, #fafafa);
  display: flex;
  flex-direction: column;
}

/* ===== Header ===== */
.gt-header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 28px;
  background: color-mix(in srgb, var(--bg-primary, #09090b) 92%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border, #27272a);
}
.gt-header-info { flex: 1; }
.gt-header-actions { display: flex; gap: 8px; }
.gt-title { font-size: 20px; font-weight: 700; margin: 0; }
.gt-subtitle { font-size: 13px; color: var(--text-secondary, #a1a1aa); margin: 2px 0 0; }
.gt-active-count { color: var(--accent, #00d4aa); }

/* ===== Tabs ===== */
.gt-tabs {
  display: flex;
  gap: 6px;
  padding: 12px 28px;
  flex-wrap: wrap;
}
.gt-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg-secondary, #18181b);
  border: 1px solid var(--border, #27272a);
  border-radius: 8px;
  color: var(--text-secondary, #a1a1aa);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.gt-tab:hover { color: var(--text-primary, #fafafa); border-color: var(--accent, #00d4aa); }
.gt-tab--active {
  background: var(--accent, #00d4aa);
  color: #000;
  border-color: var(--accent, #00d4aa);
  font-weight: 600;
}
.gt-tab-icon { font-size: 14px; }
.gt-tab-count {
  padding: 1px 7px;
  background: color-mix(in srgb, var(--text-primary, #fafafa) 10%, transparent);
  border-radius: 10px;
  font-size: 11px;
}
.gt-tab--active .gt-tab-count {
  background: color-mix(in srgb, #000 20%, transparent);
}

/* ===== Toolbar ===== */
.gt-toolbar {
  display: flex;
  gap: 8px;
  padding: 0 28px 12px;
}
.gt-select {
  padding: 8px 14px;
  background: var(--bg-secondary, #18181b);
  border: 1px solid var(--border, #27272a);
  border-radius: 8px;
  color: var(--text-primary, #fafafa);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}
.gt-select:focus { outline: none; border-color: var(--accent, #00d4aa); }

/* ===== Error ===== */
.gt-error {
  margin: 0 28px 12px;
  padding: 10px 14px;
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #fca5a5;
  border: 1px solid color-mix(in srgb, #ef4444 30%, transparent);
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.gt-error-close {
  margin-left: auto;
  background: none;
  border: none;
  color: #fca5a5;
  font-size: 18px;
  cursor: pointer;
  font-family: inherit;
}

/* ===== Skeleton ===== */
.gt-skeleton {
  padding: 0 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.gt-skeleton-card {
  height: 120px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--bg-secondary, #18181b), var(--bg-tertiary, #27272a));
  animation: gt-pulse 1.5s ease-in-out infinite;
}
@keyframes gt-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.3; }
}

/* ===== Empty ===== */
.gt-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 28px;
  color: var(--text-secondary, #a1a1aa);
}
.gt-empty-icon { font-size: 48px; opacity: 0.5; }
.gt-empty h3 { margin: 0; font-size: 18px; color: var(--text-primary, #fafafa); }
.gt-empty p { margin: 0; font-size: 14px; }

/* ===== Task List ===== */
.gt-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 28px 28px;
}
.gt-card {
  display: flex;
  border-radius: 12px;
  background: var(--bg-secondary, #18181b);
  border: 1px solid var(--border, #27272a);
  overflow: hidden;
  transition: border-color 0.15s;
}
.gt-card:hover { border-color: var(--border-hover, #3f3f46); }
.gt-card--running { border-color: color-mix(in srgb, var(--accent, #00d4aa) 40%, var(--border, #27272a)); }

/* Status bar (left accent) */
.gt-card-status-bar {
  width: 4px;
  flex-shrink: 0;
}
.gt-badge--queued { background: #eab308; }
.gt-badge--running { background: var(--accent, #00d4aa); }
.gt-badge--success { background: #22c55e; }
.gt-badge--danger { background: #ef4444; }
.gt-badge--cancelled { background: #6b7280; }
.gt-badge--expired { background: #78716c; }

/* Card body */
.gt-card-body {
  flex: 1;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.gt-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.gt-card-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.gt-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}
.gt-badge--type {
  background: color-mix(in srgb, var(--accent, #00d4aa) 30%, transparent);
  color: var(--accent, #00d4aa);
}
.gt-provider {
  font-size: 11px;
  color: var(--text-secondary, #a1a1aa);
  font-weight: 500;
}
.gt-card-time {
  font-size: 11px;
  color: var(--text-secondary, #a1a1aa);
  white-space: nowrap;
  flex-shrink: 0;
}

/* Prompt */
.gt-card-prompt {
  font-size: 13px;
  color: var(--text-primary, #fafafa);
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Progress */
.gt-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}
.gt-progress-bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-tertiary, #27272a);
  overflow: hidden;
}
.gt-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent, #00d4aa);
  transition: width 0.5s ease;
}
.gt-progress-text {
  font-size: 12px;
  color: var(--accent, #00d4aa);
  font-weight: 600;
  min-width: 36px;
  text-align: right;
}

/* Result preview */
.gt-result-preview {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}
.gt-result-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Error message */
.gt-error-msg {
  font-size: 12px;
  color: #fca5a5;
  padding: 6px 10px;
  background: color-mix(in srgb, #ef4444 8%, transparent);
  border-radius: 6px;
}

/* Footer */
.gt-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}
.gt-card-id {
  font-size: 11px;
  color: var(--text-secondary, #a1a1aa);
  font-family: 'JetBrains Mono', monospace;
  opacity: 0.7;
}
.gt-card-actions {
  display: flex;
  gap: 6px;
}

/* Buttons */
.gt-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border, #27272a);
  background: var(--bg-secondary, #18181b);
  color: var(--text-primary, #fafafa);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}
.gt-btn:hover { background: var(--bg-tertiary, #27272a); }
.gt-btn--ghost { background: transparent; border-color: transparent; }
.gt-btn--ghost:hover { background: var(--bg-secondary, #18181b); }
.gt-btn--danger { color: #f87171; border-color: #7f1d1d; }
.gt-btn--danger:hover { background: color-mix(in srgb, #ef4444 15%, transparent); }
.gt-btn--sm { padding: 4px 10px; font-size: 12px; }
.gt-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Load more */
.gt-load-more {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}
</style>
