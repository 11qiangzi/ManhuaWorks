<template>
  <div class="toast-icon-promise flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs font-bold" :class="colorClass">
    <span v-if="status === 'pending'" class="block w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></span>
    <span v-else-if="status === 'fulfilled'" class="block w-5 h-5 rounded-full bg-green-500 text-white text-center leading-5">✓</span>
    <span v-else-if="status === 'rejected'" class="block w-5 h-5 rounded-full bg-red-500 text-white text-center leading-5">✕</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  type?: string
  status?: 'pending' | 'fulfilled' | 'rejected'
}
const props = withDefaults(defineProps<Props>(), { status: 'pending' })

const colorClass = computed(() => {
  if (props.status === 'fulfilled') return 'text-green-500'
  if (props.status === 'rejected') return 'text-red-500'
  return 'text-blue-500'
})
</script>
