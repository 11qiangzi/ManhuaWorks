<template>
  <div class="infinite-scroll-container relative" @scroll.passive="onScroll">
    <slot />
    <div v-if="loading" class="infinite-scroll-loader py-4 flex items-center justify-center text-xs text-gray-500">
      <div class="loading-spinner w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2"></div>
      加载更多…
    </div>
    <div v-else-if="finished" class="py-4 text-center text-xs text-gray-400">
      {{ finishedText }}
    </div>
    <div v-else-if="error" class="py-4 text-center text-xs text-red-500">
      加载失败
      <button class="ml-2 underline" @click="$emit('loadMore')">重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  loading: boolean
  finished: boolean
  error?: boolean
  /** 距离底部阈值（px） */
  threshold?: number
  finishedText?: string
}
const props = withDefaults(defineProps<Props>(), {
  error: false,
  threshold: 100,
  finishedText: '— 没有更多了 —'
})
const emit = defineEmits<{
  (e: 'loadMore'): void
}>()

function onScroll(ev: Event) {
  const el = ev.target as HTMLElement
  if (props.loading || props.finished || props.error) return
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight
  if (distance < props.threshold) {
    emit('loadMore')
  }
}
</script>
