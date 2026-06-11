<template>
  <span class="loading-inline inline-flex items-center gap-1.5 text-xs text-gray-500" role="status" aria-live="polite">
    <span class="loading-spinner w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></span>
    <span v-if="message">{{ message }}</span>
  </span>
</template>

<script setup lang="ts">
interface Props {
  message?: string
}
withDefaults(defineProps<Props>(), { message: '' })
</script>
