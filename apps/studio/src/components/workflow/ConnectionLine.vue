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

/** 端口在节点上的位置（简化：节点宽度 180/200，高度 80-140） */
function portPosition(
  node: WorkflowNode,
  portId: string,
  side: 'input' | 'output',
): { x: number; y: number } {
  const def = side === 'input' ? props.targetDef : props.sourceDef
  const w = node.size.width
  const h = node.size.height
  const ports = def?.[side === 'input' ? 'inputs' : 'outputs'] ?? []
  const idx = Math.max(0, ports.findIndex(p => p.id === portId))
  // 端口平均分布在节点的左/右边
  const count = Math.max(1, ports.length)
  const portSpacing = h / (count + 1)
  const y = portSpacing * (idx + 1)
  return {
    x: side === 'input' ? node.position.x : node.position.x + w,
    y: node.position.y + y,
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

const stroke = computed(() => (props.selected ? '#3b82f6' : '#94a3b8'))
const strokeWidth = computed(() => (props.selected ? 2.5 : 1.5))

function onClick(e: MouseEvent) {
  emit('click', e)
}
</script>

<template>
  <g class="connection-line" @click="onClick" @contextmenu.prevent="emit('remove')">
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
      class="pointer-events-none transition-[stroke,stroke-width] duration-150"
    />
    <!-- 选中时箭头 -->
    <circle
      v-if="selected"
      :cx="end.x - 6"
      :cy="end.y"
      r="3"
      fill="#3b82f6"
      class="pointer-events-none"
    />
  </g>
</template>
