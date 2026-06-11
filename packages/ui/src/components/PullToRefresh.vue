<template>
  <div
    class="pull-to-refresh relative overflow-hidden"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div
      v-if="distance > 0"
      class="pull-to-refresh-indicator absolute left-0 right-0 flex flex-col items-center justify-center text-xs text-gray-500 transition-transform"
      :style="{ height: `${distance}px`, transform: `translateY(-${60 - distance}px)` }"
    >
      <div
        class="loading-spinner w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full"
        :class="{ 'animate-spin': refreshing }"
      ></div>
      <span class="mt-1">{{ statusText }}</span>
    </div>
    <div :style="{ transform: `translateY(${distance}px)`, transition: refreshing ? 'none' : 'transform 0.2s' }">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  refreshing: boolean
  threshold?: number
  /** 下拉文案 */
  pullText?: string
  /** 释放文案 */
  releaseText?: string
  /** 刷新中文案 */
  refreshingText?: string
}
const props = withDefaults(defineProps<Props>(), {
  threshold: 60,
  pullText: '下拉刷新',
  releaseText: '释放立即刷新',
  refreshingText: '刷新中…'
})
const emit = defineEmits<{ (e: 'refresh'): void }>()

const startY = ref(0)
const distance = ref(0)
const triggered = ref(false)

const statusText = computed(() => {
  if (props.refreshing) return props.refreshingText
  if (triggered.value) return props.releaseText
  return props.pullText
})

function onTouchStart(ev: TouchEvent) {
  if (props.refreshing) return
  startY.value = ev.touches[0].clientY
  distance.value = 0
}

function onTouchMove(ev: TouchEvent) {
  if (props.refreshing) return
  const dy = ev.touches[0].clientY - startY.value
  if (dy > 0) {
    // 阻尼
    distance.value = Math.min(dy * 0.4, props.threshold * 2)
    triggered.value = distance.value >= props.threshold
  }
}

function onTouchEnd() {
  if (props.refreshing) return
  if (triggered.value) {
    emit('refresh')
  } else {
    distance.value = 0
  }
}

defineExpose({ reset: () => (distance.value = 0) })
</script>
