<script setup lang="ts">
/**
 * ResponsiveGrid - 响应式网格
 * - mobile: 1 col, tablet: 2, desktop: 3, 4k: 5
 * - 可指定 min item width (auto-fit 模式)
 * - gap / padding 可调
 */
import { computed } from 'vue'
import { useBreakpoint } from '../composables/useBreakpoint'

interface Props {
  minItemWidth?: string         // auto-fit 模式: e.g. "280px"
  gap?: string
  mobileCols?: 1 | 2
  tabletCols?: 1 | 2 | 3
  desktopCols?: 1 | 2 | 3 | 4
  k4Cols?: 2 | 3 | 4 | 5 | 6
  tag?: string
}

const props = withDefaults(defineProps<Props>(), {
  minItemWidth: undefined,
  gap: 'var(--space-4)',
  mobileCols: 1,
  tabletCols: 2,
  desktopCols: 3,
  k4Cols: 5,
  tag: 'div'
})

const bp = useBreakpoint()

const style = computed(() => {
  if (props.minItemWidth) {
    return {
      display: 'grid',
      gap: props.gap,
      gridTemplateColumns: `repeat(auto-fit, minmax(${props.minItemWidth}, 1fr))`
    } as Record<string, string>
  }
  return { gap: props.gap } as Record<string, string>
})

const className = computed(() => {
  if (props.minItemWidth) return 'rg rg-auto'
  const c = bp.current.value
  if (c === 'mobile') return `rg rg-mob-${props.mobileCols}`
  if (c === 'tablet') return `rg rg-tab-${props.tabletCols}`
  if (c === 'desktop') return `rg rg-desk-${props.desktopCols}`
  return `rg rg-4k-${props.k4Cols}`
})
</script>

<template>
  <component :is="tag" :class="className" :style="style">
    <slot />
  </component>
</template>

<style scoped>
.rg { display: grid; }
.rg-mob-1 { grid-template-columns: 1fr; }
.rg-mob-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.rg-tab-1 { grid-template-columns: 1fr; }
.rg-tab-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.rg-tab-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.rg-desk-1 { grid-template-columns: 1fr; }
.rg-desk-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.rg-desk-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.rg-desk-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.rg-4k-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.rg-4k-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.rg-4k-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.rg-4k-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.rg-4k-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.rg-auto { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
</style>
