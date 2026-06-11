<template>
  <div class="loading-section flex flex-col items-center justify-center p-6" role="status" aria-live="polite">
    <div class="loading-spinner w-8 h-8 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
    <p v-if="message" class="mt-2 text-xs text-gray-500">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  message?: string
  /** 高度（默认 200px） */
  height?: string
}
withDefaults(defineProps<Props>(), { message: '', height: '200px' })
</script>
