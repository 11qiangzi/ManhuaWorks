<template>
  <div class="loading-page min-h-[60vh] flex flex-col items-center justify-center p-8" role="status" aria-live="polite">
    <div class="loading-spinner w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
    <p v-if="message" class="mt-4 text-sm text-gray-600">{{ message }}</p>
    <p v-else class="mt-4 text-sm text-gray-500">加载中…</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  message?: string
}
withDefaults(defineProps<Props>(), { message: '' })
</script>
