<script setup lang="ts">
/**
 * MiniMap.vue — 小地图：节点全局视图
 * W5 任务 3
 */
import { computed } from 'vue'
import type { WorkflowNode, Viewport } from '../../types/workflow'

const props = defineProps<{
  nodes: WorkflowNode[]
  viewport: Viewport
  width?: number
  height?: number
}>()

const emit = defineEmits<{
  navigate: [v: { x: number; y: number; zoom: number }]
}>()

const W = computed(() => props.width ?? 200)
const H = computed(() => props.height ?? 140)

/** 计算节点包围盒 */
const bounds = computed(() => {
  if (props.nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600 }
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of props.nodes) {
    minX = Math.min(minX, n.position.x)
    minY = Math.min(minY, n.position.y)
    maxX = Math.max(maxX, n.position.x + n.size.width)
    maxY = Math.max(maxY, n.position.y + n.size.height)
  }
  // 加 padding
  const padX = (maxX - minX) * 0.1
  const padY = (maxY - minY) * 0.1
  return {
    minX: minX - padX,
    minY: minY - padY,
    maxX: maxX + padX,
    maxY: maxY + padY,
  }
})

const scale = computed(() => {
  const bw = bounds.value.maxX - bounds.value.minX
  const bh = bounds.value.maxY - bounds.value.minY
  return Math.min(W.value / bw, H.value / bh)
})

/** 视口框（在小地图上的位置） */
const viewBox = computed(() => {
  // 视口在世界坐标下覆盖的区域
  // 假设画布尺寸 = container 大小；这里简化为 (800, 600) 基础大小
  const vw = 800 / props.viewport.zoom
  const vh = 600 / props.viewport.zoom
  const wx = -props.viewport.x / props.viewport.zoom
  const wy = -props.viewport.y / props.viewport.zoom
  return { x: wx, y: wy, w: vw, h: vh }
})

function nodeRect(n: WorkflowNode) {
  return {
    x: (n.position.x - bounds.value.minX) * scale.value,
    y: (n.position.y - bounds.value.minY) * scale.value,
    w: n.size.width * scale.value,
    h: n.size.height * scale.value,
  }
}

function viewBoxRect() {
  return {
    x: (viewBox.value.x - bounds.value.minX) * scale.value,
    y: (viewBox.value.y - bounds.value.minY) * scale.value,
    w: viewBox.value.w * scale.value,
    h: viewBox.value.h * scale.value,
  }
}

function onClick(e: MouseEvent) {
  const svg = e.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  // 反推世界坐标
  const wx = x / scale.value + bounds.value.minX
  const wy = y / scale.value + bounds.value.minY
  // 居中
  emit('navigate', {
    x: -(wx - 400) * props.viewport.zoom,
    y: -(wy - 300) * props.viewport.zoom,
    zoom: props.viewport.zoom,
  })
}
</script>

<template>
  <div
    class="pointer-events-auto rounded-md border border-gray-200 bg-white/90 p-1.5 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/80"
  >
    <svg
      :width="W"
      :height="H"
      class="block cursor-crosshair"
      @click="onClick"
    >
      <!-- 背景 -->
      <rect
        x="0" y="0"
        :width="W" :height="H"
        fill="transparent"
      />
      <!-- 节点缩略 -->
      <rect
        v-for="n in nodes"
        :key="n.id"
        :x="nodeRect(n).x"
        :y="nodeRect(n).y"
        :width="nodeRect(n).w"
        :height="nodeRect(n).h"
        rx="1"
        class="fill-blue-400 dark:fill-blue-500"
        opacity="0.7"
      />
      <!-- 视口框 -->
      <rect
        :x="viewBoxRect().x"
        :y="viewBoxRect().y"
        :width="viewBoxRect().w"
        :height="viewBoxRect().h"
        fill="none"
        stroke="#3b82f6"
        stroke-width="1"
        stroke-dasharray="3 2"
      />
    </svg>
    <div class="mt-1 text-center text-[10px] text-gray-400">
      小地图 · {{ nodes.length }} 节点
    </div>
  </div>
</template>
