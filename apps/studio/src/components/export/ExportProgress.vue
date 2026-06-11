<script setup lang="ts">
/**
 * ExportProgress.vue — 导出进度条
 * L2 林染 任务 2
 *
 * 展示：进度 / 状态 / 步骤 / 平台 / 大小 / 成本 / 错误
 * 状态：queued / preparing / encoding / uploading / success / failed / cancelled
 */
import { computed } from 'vue'
import type { ExportTask } from '../../types/studio'
import { PLATFORMS, EXPORT_FORMATS } from '../../types/studio'

const props = defineProps<{
  task: ExportTask
}>()

const emit = defineEmits<{
  (e: 'cancel', id: string): void
  (e: 'retry', id: string): void
  (e: 'open', id: string): void
}>()

const statusColor = computed(() => {
  switch (props.task.status) {
    case 'queued': return 'gray'
    case 'preparing': return 'blue'
    case 'encoding': return 'amber'
    case 'uploading': return 'cyan'
    case 'success': return 'green'
    case 'failed': return 'red'
    case 'cancelled': return 'gray'
  }
})

const statusLabel = computed(() => {
  switch (props.task.status) {
    case 'queued': return '排队中'
    case 'preparing': return '准备中'
    case 'encoding': return '编码中'
    case 'uploading': return '上传中'
    case 'success': return '已完成'
    case 'failed': return '失败'
    case 'cancelled': return '已取消'
  }
})

const formatMeta = computed(() =>
  EXPORT_FORMATS.find(f => f.id === props.task.format),
)

const platformMetas = computed(() =>
  props.task.platforms
    .map(id => PLATFORMS.find(p => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p)),
)

const sizeText = computed(() => {
  if (props.task.sizeBytes <= 0) return '—'
  const mb = props.task.sizeBytes / (1024 * 1024)
  if (mb < 1) return `${(props.task.sizeBytes / 1024).toFixed(1)} KB`
  if (mb < 1024) return `${mb.toFixed(2)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
})

const elapsedText = computed(() => {
  const ms = Date.now() - props.task.createdAt
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}min`
  return `${(ms / 3600000).toFixed(1)}h`
})

const isActive = computed(() =>
  ['queued', 'preparing', 'encoding', 'uploading'].includes(props.task.status),
)
</script>

<template>
  <div
    class="export-progress flex flex-col gap-2 rounded-lg border p-3 transition-all"
    :class="{
      'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900': statusColor === 'gray',
      'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20': statusColor === 'blue',
      'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20': statusColor === 'amber',
      'border-cyan-200 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-900/20': statusColor === 'cyan',
      'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20': statusColor === 'green',
      'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20': statusColor === 'red',
    }"
  >
    <!-- 顶部：状态 + 格式 + 平台 -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span
          class="rounded px-1.5 py-0.5 text-[10px] font-semibold"
          :class="{
            'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300': statusColor === 'gray',
            'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-300': statusColor === 'blue',
            'bg-amber-200 text-amber-700 dark:bg-amber-800 dark:text-amber-300': statusColor === 'amber',
            'bg-cyan-200 text-cyan-700 dark:bg-cyan-800 dark:text-cyan-300': statusColor === 'cyan',
            'bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-300': statusColor === 'green',
            'bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-300': statusColor === 'red',
          }"
        >{{ statusLabel }}</span>
        <span class="text-[11px] text-gray-500">
          {{ formatMeta?.label ?? task.format }}
        </span>
        <span class="text-[10px] text-gray-400">·</span>
        <div class="flex items-center gap-0.5">
          <span
            v-for="p in platformMetas"
            :key="p.id"
            class="text-[14px]"
            :title="p.label"
          >{{ p.icon }}</span>
        </div>
      </div>
      <span class="text-[10px] text-gray-400">{{ elapsedText }}</span>
    </div>

    <!-- 进度条 -->
    <div class="flex flex-col gap-0.5">
      <div class="flex items-center justify-between text-[10px] text-gray-500">
        <span class="truncate">{{ task.step }}</span>
        <span class="font-mono">{{ task.progress }}%</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          class="h-full transition-all duration-300"
          :class="{
            'bg-gray-400': statusColor === 'gray',
            'bg-blue-500': statusColor === 'blue',
            'bg-amber-500': statusColor === 'amber',
            'bg-cyan-500': statusColor === 'cyan',
            'bg-green-500': statusColor === 'green',
            'bg-red-500': statusColor === 'red',
          }"
          :style="{ width: `${task.progress}%` }"
        ></div>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-if="task.error" class="rounded bg-red-100 px-2 py-1 text-[10px] text-red-700 dark:bg-red-900/40 dark:text-red-300">
      ⚠ {{ task.error }}
    </div>

    <!-- 底部：大小 / 成本 / 操作 -->
    <div class="flex items-center justify-between text-[10px] text-gray-500">
      <div class="flex items-center gap-2">
        <span>📦 {{ sizeText }}</span>
        <span>·</span>
        <span class="font-mono">${{ task.costUsd.toFixed(3) }}</span>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-if="task.status === 'success' && task.outputUrl"
          class="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-600"
          @click="emit('open', task.id)"
        >📂 打开</button>
        <button
          v-if="isActive"
          class="rounded bg-red-100 px-2 py-0.5 text-[10px] text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
          @click="emit('cancel', task.id)"
        >取消</button>
        <button
          v-if="task.status === 'failed' || task.status === 'cancelled'"
          class="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-600"
          @click="emit('retry', task.id)"
        >重试</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-progress {
  width: 100%;
}
</style>
