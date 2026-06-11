<template>
  <component :is="tag" class="skeleton inline-block bg-gray-200" :class="[shapeClass, animatedClass]" :style="customStyle" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type SkeletonVariant =
  | 'card'
  | 'list'
  | 'table'
  | 'avatar'
  | 'text'
  | 'image'
  | 'button'
  | 'chart'
  | 'grid'
  | 'calendar'

interface Props {
  variant?: SkeletonVariant
  /** 高度（px），部分变体可覆盖 */
  height?: number | string
  /** 宽度（px 或 %） */
  width?: number | string
  /** 圆角（默认按变体） */
  rounded?: string
  /** 是否动画（默认 true） */
  animated?: boolean
  /** 标签 */
  tag?: string
  /** 列表/表格行数 */
  rows?: number
  /** 表格列数 */
  columns?: number
  /** 网格列数 */
  gridCols?: number
  /** 日历单元格数 */
  calendarCells?: number
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'text',
  height: undefined,
  width: undefined,
  rounded: '',
  animated: true,
  tag: 'div',
  rows: 3,
  columns: 4,
  gridCols: 3,
  calendarCells: 35
})

const shapeClass = computed(() => {
  switch (props.variant) {
    case 'avatar':
      return 'rounded-full'
    case 'image':
      return 'rounded-md'
    case 'button':
      return 'rounded-md'
    case 'text':
      return 'rounded'
    case 'card':
      return 'rounded-lg'
    default:
      return props.rounded || 'rounded'
  }
})

const animatedClass = computed(() => (props.animated ? 'animate-pulse' : ''))

const customStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.width !== undefined) {
    style.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  }
  if (props.height !== undefined) {
    style.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }
  return style
})
</script>

<style scoped>
.skeleton {
  display: block;
}
</style>
