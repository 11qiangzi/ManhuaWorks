<template>
  <Teleport to="body">
    <Transition name="error-modal-fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="onClose"
      >
        <div
          class="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 p-6"
          role="alertdialog"
          aria-modal="true"
        >
          <div class="flex items-start gap-3">
            <div :class="['text-2xl', iconColor]">{{ icon }}</div>
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-semibold mb-1">{{ title || '出错了' }}</h3>
              <p class="text-sm text-gray-700 break-words">{{ message }}</p>
              <p v-if="error?.code" class="text-xs text-gray-400 mt-1">
                错误码: {{ error.code }}
              </p>
            </div>
          </div>

          <div v-if="showStack && error?.stack" class="mt-4">
            <pre
              class="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40"
            >{{ error.stack }}</pre>
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <button
              v-if="showDetails"
              type="button"
              class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
              @click="showStack = !showStack"
            >
              {{ showStack ? '收起' : '详情' }}
            </button>
            <button
              type="button"
              class="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              @click="onClose"
            >
              关闭
            </button>
            <button
              v-if="showRetry"
              type="button"
              class="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              @click="onRetry"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AppError } from '../errors'

interface Props {
  visible: boolean
  error?: AppError | null
  title?: string
  message?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  showRetry?: boolean
  showDetails?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  error: null,
  title: '',
  severity: 'medium',
  showRetry: true,
  showDetails: true
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'retry'): void
}>()

const showStack = ref(false)

const message = computed(() => props.message || props.error?.message || '未知错误')

const icon = computed(() => {
  switch (props.severity) {
    case 'critical':
      return '🛑'
    case 'high':
      return '⛔'
    case 'low':
      return 'ℹ️'
    default:
      return '⚠️'
  }
})

const iconColor = computed(() => {
  switch (props.severity) {
    case 'critical':
      return 'text-red-600'
    case 'high':
      return 'text-red-500'
    case 'low':
      return 'text-blue-500'
    default:
      return 'text-yellow-500'
  }
})

function onClose() {
  emit('close')
}

function onRetry() {
  emit('retry')
}

watch(
  () => props.visible,
  (v) => {
    if (!v) showStack.value = false
  }
)
</script>

<style scoped>
.error-modal-fade-enter-active,
.error-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.error-modal-fade-enter-from,
.error-modal-fade-leave-to {
  opacity: 0;
}
</style>
