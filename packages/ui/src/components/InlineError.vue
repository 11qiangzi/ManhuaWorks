<template>
  <div
    v-if="visible && message"
    class="inline-error flex items-start gap-2 p-3 rounded text-sm"
    :class="containerClass"
    role="alert"
  >
    <span class="text-base leading-none flex-shrink-0">{{ icon }}</span>
    <div class="flex-1 min-w-0">
      <p v-if="title" class="font-medium mb-0.5">{{ title }}</p>
      <p class="break-words">{{ message }}</p>
    </div>
    <button
      v-if="dismissible"
      type="button"
      class="text-current opacity-60 hover:opacity-100"
      aria-label="关闭"
      @click="onDismiss"
    >
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  visible?: boolean
  title?: string
  message?: string
  /** 'error' | 'warning' | 'info' | 'success' */
  type?: 'error' | 'warning' | 'info' | 'success'
  /** 是否可关闭 */
  dismissible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
  type: 'error',
  dismissible: false
})

const emit = defineEmits<{
  (e: 'dismiss'): void
}>()

const icon = computed(() => {
  switch (props.type) {
    case 'warning':
      return '⚠️'
    case 'info':
      return 'ℹ️'
    case 'success':
      return '✅'
    default:
      return '❌'
  }
})

const containerClass = computed(() => {
  switch (props.type) {
    case 'warning':
      return 'bg-yellow-50 text-yellow-800 border border-yellow-200'
    case 'info':
      return 'bg-blue-50 text-blue-800 border border-blue-200'
    case 'success':
      return 'bg-green-50 text-green-800 border border-green-200'
    default:
      return 'bg-red-50 text-red-800 border border-red-200'
  }
})

function onDismiss() {
  emit('dismiss')
}
</script>
