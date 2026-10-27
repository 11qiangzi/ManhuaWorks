<script setup lang="ts">
/**
 * ConnectionLine.vue — 连线渲染：贝塞尔曲线
 * W5 任务 3
 */
import { computed } from 'vue'
import type { WorkflowEdge, WorkflowNode, NodeDefinition } from '../../types/workflow'

const props = defineProps<{
  edge: WorkflowEdge
  sourceNode: WorkflowNode
  targetNode: WorkflowNode
  sourceDef: NodeDefinition | null
  targetDef: NodeDefinition | null
  selected?: boolean
  /** 临时连线（拖拽过程中） */
  pending?: { x: number; y: number }
}>()

const emit = defineEmits<{
  click: [e: MouseEvent]
  remove: []
}>()

/** 端口在节点上的位置 — 必须与 NodeCanvas.vue 模板中的实际 DOM 布局一致
 *  布局结构: header(~28px) + 端口容器 padding-top(~6px) + 行 padding-top(~4px)
 *  每行: top = 4 + i*22, 端口高 14px, 中心 = top + 7
 *  所以 portY = node.position.y + 28 + 6 + 4 + (4 + i*22) + 7 = y + 49 + i*22
 */
const HEADER_H = 28
const PORT_CONTAINER_PAD_TOP = 6
const PORT_ROW_PAD_TOP = 4
const PORT_ROW_SPACING = 22
const PORT_TOP_OFFSET = 4
const PORT_RADIUS = 7  // 14px / 2

function portPosition(
  node: WorkflowNode,
  portId: string,
  side: 'input' | 'output',
): { x: number; y: number } {
  const def = side === 'input' ? props.targetDef : props.sourceDef
  const w = node.size.width
  const ports = def?.[side === 'input' ? 'inputs' : 'outputs'] ?? []
  const idx = Math.max(0, ports.findIndex(p => p.id === portId))
  // Y: header + container padding + row offset + center
  const y = node.position.y
    + HEADER_H + PORT_CONTAINER_PAD_TOP + PORT_ROW_PAD_TOP
    + (PORT_TOP_OFFSET + idx * PORT_ROW_SPACING)
    + PORT_RADIUS
  return {
    x: side === 'input' ? node.position.x : node.position.x + w,
    y,
  }
}

const start = computed(() => portPosition(props.sourceNode, props.edge.sourcePort, 'output'))
const end = computed(() =>
  props.pending
    ? props.pending
    : portPosition(props.targetNode, props.edge.targetPort, 'input'),
)

/** 贝塞尔曲线控制点（横向偏移） */
const controlOffset = computed(() => {
  const dx = end.value.x - start.value.x
  return Math.max(40, Math.abs(dx) * 0.5)
})

const path = computed(() => {
  const s = start.value
  const e = end.value
  const co = controlOffset.value
  return `M ${s.x} ${s.y} C ${s.x + co} ${s.y}, ${e.x - co} ${e.y}, ${e.x} ${e.y}`
})

const stroke = computed(() => (props.selected ? '#3b82f6' : '#6366f1'))
const strokeWidth = computed(() => (props.selected ? 4 : 3))

const arrowheadPoints = computed(() => {
  const tp = end.value
  // Arrow points left (towards the input port from right)
  const size = 8
  return `${tp.x},${tp.y} ${tp.x + size},${tp.y - size / 2} ${tp.x + size},${tp.y + size / 2}`
})

function onClick(e: MouseEvent) {
  emit('click', e)
}
</script>

<template>
  <g class="connection-line pointer-events-auto" @click="onClick" @contextmenu.prevent="emit('remove')">
    <!-- 不可见粗线，便于点击 -->
    <path
      :d="path"
      stroke="transparent"
      :stroke-width="12"
      fill="none"
      class="cursor-pointer"
    />
    <!-- 主线 -->
    <path
      :d="path"
      :stroke="stroke"
      :stroke-width="strokeWidth"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="pointer-events-none transition-[stroke,stroke-width] duration-150"
      style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3))"
    />
    <!-- Arrowhead at target end -->
    <polygon
      :points="arrowheadPoints"
      :fill="stroke"
      :opacity="0.9"
      class="pointer-events-none"
    />
    <!-- 🔧 临时调试：显示路径坐标（红色文字应在曲线中点可见） -->
    <text
      :x="(start.x + end.x) / 2"
      :y="(start.y + end.y) / 2 - 10"
      fill="red"
      font-size="11"
      font-family="monospace"
      text-anchor="middle"
      class="pointer-events-none"
      style="paint-order: stroke; stroke: white; stroke-width: 3px;"
    >S({{ Math.round(start.x) }},{{ Math.round(start.y) }}) → E({{ Math.round(end.x) }},{{ Math.round(end.y) }})</text>
  </g>
</template>
