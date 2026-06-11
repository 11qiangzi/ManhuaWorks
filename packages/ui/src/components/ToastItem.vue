<template>
  <div
    class="toast-item flex items-start gap-2 p-3 pr-2 rounded-lg shadow-md border min-w-[280px] max-w-[400px] bg-white"
    :class="borderClass"
    role="status"
    :aria-live="toast.type === 'error' ? 'assertive' : 'polite'"
  >
    <component :is="iconComponent" :type="toast.type" />
    <div class="flex-1 min-w-0">
      <p v-if="toast.title" class="font-medium text-sm leading-snug">{{ toast.title }}</p>
      <p class="text-sm leading-snug break-words whitespace-pre-line">{{ toast.message }}</p>
      <button
        v-if="toast.action"
        type="button"
        class="mt-1 text-xs font-medium underline"
        @click="onAction"
      >
        {{ toast.action.label }}
      </button>
    </div>
    <button
      v-if="!toast.persistent"
      type="button"
      class="text-gray-400 hover:text-gray-600 flex-shrink-0"
      aria-label="关闭"
      @click="onClose"
    >
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, onBeforeUnmount } from 'vue'
import type { Toast } from '../stores/toast'
import ToastSuccess from './ToastSuccess.vue'
import ToastError from './ToastError.vue'
import ToastWarning from './ToastWarning.vue'
import ToastInfo from './ToastInfo.vue'
import ToastLoading from './ToastLoading.vue'
import ToastPromise from './ToastPromise.vue'

interface Props {
  toast: Toast
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'close'): void }>()

const iconComponent = computed(() => {
  if (props.toast.type === 'promise') return ToastPromise
  if (props.toast.type === 'loading') return ToastLoading
  if (props.toast.type === 'success') return ToastSuccess
  if (props.toast.type === 'error') return ToastError
  if (props.toast.type === 'warning') return ToastWarning
  return ToastInfo
})

const borderClass = computed(() => {
  switch (props.toast.type) {
    case 'success':
      return 'border-green-200'
    case 'error':
      return 'border-red-200'
    case 'warning':
      return 'border-yellow-200'
    case 'loading':
      return 'border-blue-200'
    case 'promise':
      return props.toast.promiseStatus === 'rejected'
        ? 'border-red-200'
        : props.toast.promiseStatus === 'fulfilled'
          ? 'border-green-200'
          : 'border-blue-200'
    default:
      return 'border-blue-200'
  }
})

let timer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  if (!props.toast.persistent && props.toast.duration > 0) {
    timer = setTimeout(() => emit('close'), props.toast.duration)
  }
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

function onClose() {
  emit('close')
}

function onAction() {
  if (props.toast.action) {
    props.toast.action.handler()
    emit('close')
  }
}

// 静默引用避免 unused 警告
const _suppress = h
</script>
