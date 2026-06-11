<script setup lang="ts">
/**
 * LoadingDots - 三点跳跳加载指示器
 */
interface Props {
  size?: number
  color?: string
  speed?: 'slow' | 'normal' | 'fast'
}

withDefaults(defineProps<Props>(), {
  size: 8,
  color: 'currentColor',
  speed: 'normal'
})
</script>

<template>
  <span class="loading-dots" :data-speed="speed" role="status" aria-label="loading">
    <span class="dot" :style="{ width: `${size}px`, height: `${size}px`, backgroundColor: color }" />
    <span class="dot" :style="{ width: `${size}px`, height: `${size}px`, backgroundColor: color }" />
    <span class="dot" :style="{ width: `${size}px`, height: `${size}px`, backgroundColor: color }" />
  </span>
</template>

<style scoped>
.loading-dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.dot {
  display: inline-block;
  border-radius: 50%;
  animation: dots-bounce 600ms ease-in-out infinite;
}
.dot:nth-child(2) { animation-delay: 150ms; }
.dot:nth-child(3) { animation-delay: 300ms; }
.loading-dots[data-speed="slow"] .dot { animation-duration: 900ms; }
.loading-dots[data-speed="fast"] .dot { animation-duration: 400ms; }
@media (prefers-reduced-motion: reduce) {
  .dot { animation: dots-fade 1500ms ease-in-out infinite !important; }
}
</style>
