<template>
  <div
    :class="[
      'flex items-start gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer',
      !item.read && 'bg-blue-50/40'
    ]"
    @click="emit('click')"
  >
    <div
      :class="[
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs',
        iconBgClass
      ]"
    >
      {{ iconChar }}
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium truncate">{{ item.title }}</p>
      <p class="text-xs text-gray-500 line-clamp-2">{{ item.body }}</p>
    </div>
    <div v-if="!item.read" class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NotificationItem } from '../stores/notification'

const props = defineProps<{ item: NotificationItem }>()
const emit = defineEmits<{ (e: 'click'): void }>()

const iconBgClass = computed(() => {
  switch (props.item.level) {
    case 'error':
      return 'bg-red-500'
    case 'warning':
      return 'bg-yellow-500'
    case 'success':
      return 'bg-green-500'
    case 'mention':
      return 'bg-purple-500'
    default:
      return 'bg-blue-500'
  }
})

const iconChar = computed(() => {
  switch (props.item.level) {
    case 'error':
      return '✕'
    case 'warning':
      return '!'
    case 'success':
      return '✓'
    case 'mention':
      return '@'
    default:
      return 'i'
  }
})
</script>
