<script setup lang="ts">
/**
 * SkeletonBlock · 骨架屏 (STA-2)
 * 陈远枢派单54: 千机工坊P2加载态
 */
withDefaults(defineProps<{
  width?: string
  height?: string
  rounded?: string
  variant?: 'text' | 'card' | 'circle' | 'rect'
}>(), {
  width: '100%',
  height: '16px',
  rounded: '6px',
  variant: 'text',
})

const styleMap: Record<string, { width: string; height: string; borderRadius: string }> = {
  text: { width: '60%', height: '14px', borderRadius: '4px' },
  card: { width: '100%', height: '120px', borderRadius: '12px' },
  circle: { width: '40px', height: '40px', borderRadius: '50%' },
  rect: { width: '100%', height: '240px', borderRadius: '12px' },
}
</script>

<template>
  <div
    class="sk"
    :style="{
      width: variant === 'text' ? width : (styleMap[variant]?.width || width),
      height: variant === 'text' ? height : (styleMap[variant]?.height || height),
      borderRadius: variant === 'text' ? rounded : (styleMap[variant]?.borderRadius || rounded),
    }"
  />
</template>

<style scoped>
@keyframes shimmer {
  0% { background-position: -300% 0; }
  100% { background-position: 300% 0; }
}
.sk {
  background: linear-gradient(120deg,
    var(--bg-surface, #111113) 25%,
    var(--bg-elevated, #23262E) 45%,
    var(--bg-surface, #111113) 65%
  );
  background-size: 300% 100%;
  animation: shimmer 1.8s ease infinite;
}
</style>
