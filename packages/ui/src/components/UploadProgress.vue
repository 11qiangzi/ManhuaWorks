<template>
  <div class="upload-progress p-3 border border-gray-200 rounded bg-white shadow-sm" role="status" aria-live="polite">
    <div class="flex items-center gap-3">
      <div class="upload-icon w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0">
        <span v-if="status === 'success'">✓</span>
        <span v-else-if="status === 'error'">✕</span>
        <span v-else>↑</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate">{{ filename }}</p>
        <p class="text-xs text-gray-500">
          {{ statusText }} · {{ formatBytes(loaded) }} / {{ formatBytes(total) }}
        </p>
        <div class="mt-1 h-1.5 bg-gray-200 rounded overflow-hidden">
          <div
            class="h-full transition-all"
            :class="barClass"
            :style="{ width: `${percent}%` }"
          ></div>
        </div>
      </div>
      <button
        v-if="status === 'uploading'"
        type="button"
        class="text-xs text-gray-500 hover:text-red-500"
        @click="$emit('cancel')"
      >
        取消
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type UploadStatus = 'uploading' | 'success' | 'error'

interface Props {
  filename: string
  loaded: number
  total: number
  status?: UploadStatus
}

const props = withDefaults(defineProps<Props>(), {
  status: 'uploading'
})

defineEmits<{ (e: 'cancel'): void }>()

const percent = computed(() => {
  if (props.total <= 0) return 0
  return Math.min(100, Math.round((props.loaded / props.total) * 100))
})

const statusText = computed(() => {
  if (props.status === 'success') return '上传成功'
  if (props.status === 'error') return '上传失败'
  return `上传中 ${percent.value}%`
})

const barClass = computed(() => {
  if (props.status === 'success') return 'bg-green-500'
  if (props.status === 'error') return 'bg-red-500'
  return 'bg-blue-500'
})

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}
</script>
