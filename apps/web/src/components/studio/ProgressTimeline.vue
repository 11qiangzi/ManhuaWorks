<script setup lang="ts">
/**
 * ProgressTimeline · 时间线（7 步骤进度 + 缩略图）
 * ManhuaWorks · W3 工坊流程精修
 *
 * 显示 7 步生成流程：
 * 1. 解析小说
 * 2. 提取角色
 * 3. 拆解分镜
 * 4. 生成场景
 * 5. 渲染视频
 * 6. 合成输出
 * 7. 字幕/导出
 */
import { computed } from 'vue'

export interface TimelineStep {
  id: string
  label: string
  icon: string
  status: 'pending' | 'running' | 'done' | 'failed'
  message?: string
  thumbnail?: string | null
  /** 步骤时长 (ms) */
  durationMs?: number
}

const props = defineProps<{
  steps: TimelineStep[]
  /** 当前激活的步骤 index */
  currentIndex?: number
  /** 整体进度 0-100 */
  overallProgress?: number
  /** 是否紧凑（高度更小） */
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'clickStep', stepId: string, index: number): void
  (e: 'retry', stepId: string): void
}>()

/** 状态图标 */
function statusIcon(s: TimelineStep['status']): string {
  switch (s) {
    case 'pending': return '○'
    case 'running': return '⏵'
    case 'done': return '✓'
    case 'failed': return '✗'
  }
}

/** 状态文字 */
function statusText(s: TimelineStep['status']): string {
  switch (s) {
    case 'pending': return '等待'
    case 'running': return '进行中'
    case 'done': return '完成'
    case 'failed': return '失败'
  }
}

/** 状态颜色 */
function statusColor(s: TimelineStep['status']): string {
  switch (s) {
    case 'pending': return 'var(--text-secondary)'
    case 'running': return 'var(--accent)'
    case 'done': return 'var(--success)'
    case 'failed': return 'var(--danger)'
  }
}

const doneCount = computed(() => props.steps.filter((s) => s.status === 'done').length)
const totalCount = computed(() => props.steps.length)
const progressText = computed(() => `${doneCount.value} / ${totalCount.value}`)

function onClick(step: TimelineStep, idx: number, e: Event) {
  e.stopPropagation()
  emit('clickStep', step.id, idx)
}
function onRetry(step: TimelineStep, e: Event) {
  e.stopPropagation()
  emit('retry', step.id)
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
</script>

<template>
  <section class="timeline" :class="{ 'timeline--compact': compact }">
    <header class="timeline__head">
      <h3>📋 生成进度</h3>
      <div class="timeline__meta">
        <span class="timeline__count">{{ progressText }}</span>
        <span v-if="overallProgress !== undefined" class="timeline__pct">{{ overallProgress }}%</span>
      </div>
    </header>

    <ol class="timeline__list">
      <li
        v-for="(step, idx) in steps"
        :key="step.id"
        class="tl-step"
        :class="`tl-step--${step.status}`"
        :aria-current="currentIndex === idx ? 'step' : undefined"
      >
        <!-- 连接线（第一个除外） -->
        <span v-if="idx > 0" class="tl-step__line" :class="`tl-step__line--${step.status}`" />

        <!-- 节点 -->
        <button
          type="button"
          class="tl-step__node"
          :style="{ color: statusColor(step.status) }"
          :title="`${step.label} · ${statusText(step.status)}`"
          @click="onClick(step, idx, $event)"
        >
          <span class="tl-step__icon" :class="{ 'tl-step__icon--spin': step.status === 'running' }">
            {{ step.status === 'running' ? step.icon : statusIcon(step.status) }}
          </span>
        </button>

        <!-- 缩略图（可选） -->
        <div v-if="step.thumbnail" class="tl-step__thumb">
          <img :src="step.thumbnail" :alt="step.label" />
        </div>

        <!-- 标签 -->
        <div class="tl-step__label">
          <strong>{{ step.label }}</strong>
          <div class="tl-step__sub">
            <span :style="{ color: statusColor(step.status) }">{{ statusText(step.status) }}</span>
            <span v-if="step.durationMs" class="tl-step__dur">⏱ {{ formatDuration(step.durationMs) }}</span>
          </div>
          <p v-if="step.message" class="tl-step__msg">{{ step.message }}</p>
          <button
            v-if="step.status === 'failed'"
            type="button"
            class="tl-step__retry"
            @click="onRetry(step, $event)"
          >🔄 重试</button>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.timeline {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline--compact { padding: 10px 14px; gap: 8px; }

.timeline__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.timeline__head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.timeline__meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  font-family: monospace;
}

.timeline__count { color: var(--text-secondary); }
.timeline__pct {
  color: var(--accent);
  font-weight: 600;
}

.timeline__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.tl-step {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 10px;
  position: relative;
  padding: 8px 0;
}

.tl-step:not(:last-child) .tl-step__line {
  /* 由元素自身处理 */
}

.tl-step__line {
  position: absolute;
  left: 15px; /* 节点中心 */
  top: 32px;
  width: 2px;
  height: calc(100% - 16px);
  background: var(--border);
  z-index: 0;
}

.tl-step__line--done { background: var(--success); }
.tl-step__line--running { background: linear-gradient(180deg, var(--success) 0%, var(--accent) 100%); }
.tl-step__line--failed { background: var(--danger); }

/* 节点 */
.tl-step__node {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: var(--bg-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  position: relative;
  z-index: 1;
  transition: all 200ms;
  flex-shrink: 0;
}

.tl-step__node:hover { transform: scale(1.1); }

.tl-step--running .tl-step__node {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-primary));
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent);
}

.tl-step--done .tl-step__node {
  border-color: var(--success);
  background: var(--success);
  color: var(--bg-primary) !important;
}

.tl-step--failed .tl-step__node {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 12%, var(--bg-primary));
}

.tl-step--pending .tl-step__node { opacity: 0.6; }

.tl-step__icon--spin {
  display: inline-block;
  animation: spin 2s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* 缩略图 */
.tl-step__thumb {
  position: absolute;
  left: 40px;
  top: 4px;
  width: 48px;
  height: 32px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg-primary);
}

.tl-step__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.timeline--compact .tl-step__thumb { display: none; }

/* 标签 */
.tl-step__label {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.tl-step__label strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tl-step__sub {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
  align-items: center;
}

.tl-step__dur { font-family: monospace; opacity: 0.7; }

.tl-step__msg {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tl-step__retry {
  align-self: flex-start;
  margin-top: 4px;
  border: 1px solid var(--danger);
  background: transparent;
  color: var(--danger);
  font-family: inherit;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 150ms;
}

.tl-step__retry:hover {
  background: var(--danger);
  color: var(--bg-primary);
}

/* 紧凑模式 */
.timeline--compact .tl-step { padding: 4px 0; gap: 8px; }
.timeline--compact .tl-step__node { width: 26px; height: 26px; font-size: 12px; }
.timeline--compact .tl-step__line { left: 12px; top: 26px; }
.timeline--compact .tl-step__label strong { font-size: 12px; }
</style>
