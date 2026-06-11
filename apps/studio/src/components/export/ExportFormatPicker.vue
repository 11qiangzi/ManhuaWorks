<script setup lang="ts">
/**
 * ExportFormatPicker.vue — 导出格式选择（3 主格式 + 字幕）
 * L2 林染 任务 2
 */
import { computed } from 'vue'
import { EXPORT_FORMATS, type ExportFormat } from '../../types/studio'

const props = defineProps<{
  modelValue: ExportFormat
  /** 字幕独立可勾选 */
  subtitleOnly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: ExportFormat): void
}>()

const formats = computed(() => EXPORT_FORMATS)

function isSelected(id: ExportFormat) {
  return props.modelValue === id
}
</script>

<template>
  <div class="format-picker flex flex-col gap-2">
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <button
        v-for="f in formats"
        :key="f.id"
        type="button"
        class="flex flex-col gap-1 rounded-lg border p-3 text-left transition-all hover:shadow-md"
        :class="isSelected(f.id)
          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400/40 dark:bg-amber-900/30'
          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600'"
        @click="emit('update:modelValue', f.id)"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span
              class="flex h-7 w-7 items-center justify-center rounded text-base"
              :style="{ background: 'color-mix(in srgb, currentColor 10%, transparent)' }"
            >{{ f.id === 'mp4' || f.id === 'mov' ? '🎥' : '📝' }}</span>
            <span class="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{{ f.label }}</span>
          </div>
          <span
            v-if="isSelected(f.id)"
            class="text-amber-500"
          >✓</span>
        </div>
        <div class="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span class="rounded bg-gray-100 px-1 py-0.5 font-mono dark:bg-gray-800">.{{ f.ext }}</span>
          <span class="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">{{ f.mime }}</span>
          <span
            class="rounded px-1 py-0.5"
            :class="{
              'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300': f.size === 'small',
              'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300': f.size === 'medium',
              'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300': f.size === 'large',
            }"
          >{{ f.size === 'small' ? '小' : f.size === 'medium' ? '中' : '大' }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.format-picker {
  width: 100%;
}
</style>
