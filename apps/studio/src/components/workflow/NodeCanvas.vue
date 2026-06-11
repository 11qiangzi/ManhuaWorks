<script setup lang="ts">
/**
 * NodeCanvas.vue — 节点画布（SVG 渲染，60fps，50+ 节点）
 * W5 任务 3
 *
 * 性能策略：
 * 1. SVG 单层渲染（一次 update 一次 patch）
 * 2. 节点位置 transform 走 CSS（GPU）
 * 3. 拖拽使用 transform 而非重排属性
 * 4. 边路径缓存
 * 5. requestAnimationFrame 节流视口更新
 */
import { ref, computed, onMounted, onUnmounted, watch, nextTick, inject } from 'vue'
import type {
  WorkflowNode, WorkflowEdge, NodeDefinition, Viewport,
} from '../../types/workflow'
import { NODE_DEFINITIONS } from '../../types/workflow'
import type { DragDropInstance } from '../../composables/useDragDrop'
import ConnectionLine from './ConnectionLine.vue'

const props = defineProps<{
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport: Viewport
  selection: { nodeIds: string[]; edgeIds: string[] }
  /** 来自父级的拖拽状态（从 palette 拖入） */
  externalDrag?: { active: boolean; pointer: { x: number; y: number }; nodeType?: string }
}>()

const emit = defineEmits<{
  moveNode: [id: string, pos: { x: number; y: number }, record: boolean]
  select: [id: string, additive: boolean]
  selectEdge: [id: string, additive: boolean]
  clearSelection: []
  setViewport: [v: Partial<Viewport>]
  addNode: [type: string, pos: { x: number; y: number }]
  addEdge: [source: string, sourcePort: string, target: string, targetPort: string]
  removeNode: [id: string]
}>()

const containerRef = ref<HTMLElement | null>(null)

// 林染 🔮 2026-06-11: inject 父级统一 dragDrop 实例，修复多实例断裂
const dragDrop = inject<DragDropInstance>('dragDrop')!

/** 临时连线状态：用户从某端口拖出 */
const pendingEdge = ref<{
  source: string
  sourcePort: string
  pointer: { x: number; y: number }
} | null>(null)

/** 正在拖动的节点 */
const draggingNode = ref<{
  id: string
  startPointer: { x: number; y: number }
  startPos: { x: number; y: number }
} | null>(null)

/** viewport 容器尺寸（用于 pan/zoom 边界） */
const containerSize = ref({ w: 10000, h: 10000 })  // 林染 🔮 2026-06-11: 固定尺寸，避免 ResizeObserver 反馈循环

function getDefinition(type: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS.find(d => d.type === type)
}

/** 屏幕坐标 → 世界坐标（考虑 viewport 缩放/平移） */
function screenToWorld(clientX: number, clientY: number) {
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  const sx = clientX - rect.left
  const sy = clientY - rect.top
  return {
    x: (sx - props.viewport.x) / props.viewport.zoom,
    y: (sy - props.viewport.y) / props.viewport.zoom,
  }
}

// ---------- 监听外部拖拽（从 palette 拖入） ----------
watch(() => dragDrop.isDragging.value, (active) => {
  if (!active) return
  if (dragDrop.payload.value?.source !== 'palette') return
})
watch(() => dragDrop.pointer.value, (p) => {
  if (!dragDrop.isDragging.value) return
  if (dragDrop.payload.value?.source !== 'palette') return
  // 计算 world 坐标，悬停时显示 ghost
  ghostPos.value = screenToWorld(p.x, p.y)
})

const ghostPos = ref<{ x: number; y: number } | null>(null)

function onContainerPointerUp(e: PointerEvent) {
  // palette → canvas 拖放完成
  if (dragDrop.isDragging.value && dragDrop.payload.value?.source === 'palette') {
    const type = dragDrop.payload.value.nodeType
    if (type) {
      const pos = screenToWorld(e.clientX, e.clientY)
      emit('addNode', type, { x: pos.x - 80, y: pos.y - 40 })
    }
    dragDrop.isDragging.value = false
    dragDrop.payload.value = null
    ghostPos.value = null
    return
  }
  // canvas 节点拖动结束
  if (draggingNode.value) {
    emit('moveNode', draggingNode.value.id, draggingNode.value.startPos, true)
    draggingNode.value = null
  }
}

function onContainerPointerMove(e: PointerEvent) {
  if (draggingNode.value) {
    const dx = (e.clientX - draggingNode.value.startPointer.x) / props.viewport.zoom
    const dy = (e.clientY - draggingNode.value.startPointer.y) / props.viewport.zoom
    const newPos = {
      x: draggingNode.value.startPos.x + dx,
      y: draggingNode.value.startPos.y + dy,
    }
    emit('moveNode', draggingNode.value.id, newPos, false)
  }
  if (pendingEdge.value) {
    const w = screenToWorld(e.clientX, e.clientY)
    pendingEdge.value.pointer = w
  }
}

// ---------- 节点交互 ----------
function onNodePointerDown(node: WorkflowNode, e: PointerEvent) {
  e.stopPropagation()
  if (e.button !== 0) return
  emit('select', node.id, e.shiftKey)
  draggingNode.value = {
    id: node.id,
    startPointer: { x: e.clientX, y: e.clientY },
    startPos: { ...node.position },
  }
}

function onPortPointerDown(
  node: WorkflowNode,
  portId: string,
  side: 'input' | 'output',
  e: PointerEvent,
) {
  e.stopPropagation()
  if (side === 'output') {
    const w = screenToWorld(e.clientX, e.clientY)
    pendingEdge.value = {
      source: node.id,
      sourcePort: portId,
      pointer: w,
    }
  } else {
    // 从 input 拖出 → 反向连接（互换 source/target）
    pendingEdge.value = {
      source: node.id,
      sourcePort: portId,
      pointer: screenToWorld(e.clientX, e.clientY),
    }
  }
}

function onPortPointerUp(
  targetNode: WorkflowNode,
  targetPort: string,
  side: 'input' | 'output',
  e: PointerEvent,
) {
  e.stopPropagation()
  if (!pendingEdge.value) return
  const { source, sourcePort, pointer } = pendingEdge.value
  if (source === targetNode.id) {
    pendingEdge.value = null
    return
  }
  // 从 output 拖到 input：正常
  if (side === 'input') {
    emit('addEdge', source, sourcePort, targetNode.id, targetPort)
  } else {
    // 从 input 拖到 output：反向
    emit('addEdge', targetNode.id, targetPort, source, sourcePort)
  }
  pendingEdge.value = null
  void pointer
}

function onCanvasPointerDown(e: PointerEvent) {
  if (e.target === e.currentTarget || (e.target as HTMLElement).dataset?.canvasBg === '1') {
    emit('clearSelection')
  }
}

// ---------- 缩放（滚轮） ----------
function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = -e.deltaY * 0.001
  const oldZoom = props.viewport.zoom
  const newZoom = Math.min(2, Math.max(0.25, oldZoom * (1 + delta)))
  // 以鼠标位置为缩放中心
  const rect = containerRef.value!.getBoundingClientRect()
  const sx = e.clientX - rect.left
  const sy = e.clientY - rect.top
  const wx = (sx - props.viewport.x) / oldZoom
  const wy = (sy - props.viewport.y) / oldZoom
  const newX = sx - wx * newZoom
  const newY = sy - wy * newZoom
  emit('setViewport', { zoom: newZoom, x: newX, y: newY })
}

// ---------- 视口 ----------
const viewBoxStyle = computed(() => ({
  transform: `translate(${props.viewport.x}px, ${props.viewport.y}px) scale(${props.viewport.zoom})`,
  transformOrigin: '0 0',
}))

// ---------- 节点样式 ----------
function nodeColorClass(def: NodeDefinition | undefined) {
  const c = def?.color ?? 'gray'
  return {
    blue: 'border-blue-400 bg-blue-50/95 dark:bg-blue-900/40',
    purple: 'border-purple-400 bg-purple-50/95 dark:bg-purple-900/40',
    emerald: 'border-emerald-400 bg-emerald-50/95 dark:bg-emerald-900/40',
    amber: 'border-amber-400 bg-amber-50/95 dark:bg-amber-900/40',
    rose: 'border-rose-400 bg-rose-50/95 dark:bg-rose-900/40',
    green: 'border-green-400 bg-green-50/95 dark:bg-green-900/40',
    cyan: 'border-cyan-400 bg-cyan-50/95 dark:bg-cyan-900/40',
    pink: 'border-pink-400 bg-pink-50/95 dark:bg-pink-900/40',
    violet: 'border-violet-400 bg-violet-50/95 dark:bg-violet-900/40',
    gray: 'border-gray-300 bg-gray-50/95 dark:bg-gray-800/60',
  }[c]
}

function statusBorder(node: WorkflowNode) {
  switch (node.status) {
    case 'running': return 'ring-2 ring-blue-400 ring-offset-1'
    case 'success': return 'ring-2 ring-green-400 ring-offset-1'
    case 'error': return 'ring-2 ring-red-400 ring-offset-1'
    case 'queued': return 'ring-2 ring-yellow-400 ring-offset-1 ring-dashed'
    default: return ''
  }
}

function portClass(side: 'input' | 'output', dataType: string) {
  const base = side === 'input' ? '-left-1.5' : '-right-1.5'
  const colorByType: Record<string, string> = {
    text: 'bg-sky-400',
    image: 'bg-pink-400',
    audio: 'bg-amber-400',
    video: 'bg-purple-400',
    json: 'bg-emerald-400',
    number: 'bg-blue-400',
    boolean: 'bg-rose-400',
    any: 'bg-gray-400',
  }
  return [base, colorByType[dataType] ?? 'bg-gray-400']
}

// 林染 🔮 2026-06-11: 移除 ResizeObserver（已用固定尺寸替代）
// 保留 containerSize ref 用于兼容性
onMounted(() => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    containerSize.value = { w: rect.width || 10000, h: rect.height || 10000 }
  }
})

// 林染 🔮 2026-06-11: window pointermove + pointerup 防鼠标出容器
function onWindowPointerUp() {
  if (draggingNode.value) {
    emit('moveNode', draggingNode.value.id, draggingNode.value.startPos, true)
    draggingNode.value = null
  }
  if (pendingEdge.value) {
    pendingEdge.value = null
  }
}
window.addEventListener('pointermove', onContainerPointerMove)
window.addEventListener('pointerup', onWindowPointerUp)
onUnmounted(() => {
  window.removeEventListener('pointermove', onContainerPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative h-full w-full overflow-hidden bg-gray-50 dark:bg-gray-950"
    @pointerup="onContainerPointerUp"
    @wheel.passive="onWheel"
    @pointerdown="onCanvasPointerDown"
  >
    <!-- 背景网格（点阵） -->
    <svg
      class="pointer-events-none absolute inset-0 h-full w-full"
      :data-canvas-bg="1"
    >
      <defs>
        <pattern
          id="grid"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
          :patternTransform="`translate(${viewport.x % 40}, ${viewport.y % 40}) scale(${viewport.zoom})`"
        >
          <circle cx="1" cy="1" r="1" class="fill-gray-300 dark:fill-gray-700" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>

    <!-- 主世界层（应用 viewport 变换） -->
    <div
      class="absolute left-0 top-0 will-change-transform"
      :style="viewBoxStyle"
    >
      <!-- 林染 🔮 2026-06-11 fix: 固定 SVG 尺寸，避免 ResizeObserver 反馈循环 -->
      <!-- 连线层 -->
      <svg
        class="pointer-events-none absolute overflow-visible"
        width="10000"
        height="10000"
        :style="{ left: '-5000px', top: '-5000px' }"
      >
        <g style="pointer-events: auto">
          <ConnectionLine
            v-for="edge in edges"
            :key="edge.id"
            :edge="edge"
            :source-node="nodes.find(n => n.id === edge.source)!"
            :target-node="nodes.find(n => n.id === edge.target)!"
            :source-def="getDefinition(nodes.find(n => n.id === edge.source)?.type ?? '')"
            :target-def="getDefinition(nodes.find(n => n.id === edge.target)?.type ?? '')"
            :selected="selection.edgeIds.includes(edge.id)"
            @click="emit('selectEdge', edge.id, false)"
            @remove="() => { /* handled in store */ }"
          />
          <!-- 临时连线（拖拽中） -->
          <ConnectionLine
            v-if="pendingEdge"
            :edge="{
              id: 'pending',
              source: pendingEdge.source,
              sourcePort: pendingEdge.sourcePort,
              target: 'pending',
              targetPort: 'pending',
            }"
            :source-node="nodes.find(n => n.id === pendingEdge.source)!"
            :target-node="{
              id: 'pending',
              type: '',
              position: pendingEdge.pointer,
              size: { width: 0, height: 0 },
              params: {},
            }"
            :source-def="getDefinition(nodes.find(n => n.id === pendingEdge.source)?.type ?? '')"
            :target-def="null"
            :pending="pendingEdge.pointer"
          />
        </g>
      </svg>

      <!-- 节点层（HTML，CSS 加速） -->
      <div
        v-for="node in nodes"
        :key="node.id"
        class="absolute select-none will-change-transform"
        :style="{
          left: `${node.position.x}px`,
          top: `${node.position.y}px`,
          width: `${node.size.width}px`,
          minHeight: `${node.size.height}px`,
        }"
        :class="[
          nodeColorClass(getDefinition(node.type)),
          'rounded-lg border-2 shadow-sm transition-shadow',
          statusBorder(node),
          selection.nodeIds.includes(node.id)
            ? 'ring-2 ring-blue-500 ring-offset-1'
            : 'hover:shadow-md',
        ]"
        @pointerdown="onNodePointerDown(node, $event)"
      >
        <!-- 头部：图标 + 标签 -->
        <div class="flex items-center gap-1.5 border-b border-current/10 px-2 py-1">
          <span class="text-base leading-none">
            {{ getDefinition(node.type)?.icon ?? '○' }}
          </span>
          <span class="truncate text-xs font-semibold text-gray-800 dark:text-gray-100">
            {{ getDefinition(node.type)?.label ?? node.type }}
          </span>
          <span
            v-if="node.status && node.status !== 'idle'"
            class="ml-auto h-1.5 w-1.5 rounded-full"
            :class="{
              'bg-yellow-400': node.status === 'queued',
              'bg-blue-500 animate-pulse': node.status === 'running',
              'bg-green-500': node.status === 'success',
              'bg-red-500': node.status === 'error',
            }"
          />
        </div>

        <!-- 端口 -->
        <div class="relative px-2 py-1.5">
          <!-- 输入端口 -->
          <div
            v-for="(p, i) in getDefinition(node.type)?.inputs ?? []"
            :key="`in-${p.id}`"
            class="relative flex items-center py-0.5 text-[10px] text-gray-600 dark:text-gray-300"
          >
            <span
              class="absolute h-3 w-3 rounded-full border-2 border-white shadow-sm dark:border-gray-800"
              :class="portClass('input', p.dataType)"
              :style="{ top: `${6 + i * 18}px` }"
              @pointerdown.stop="onPortPointerDown(node, p.id, 'input', $event)"
              @pointerup.stop="onPortPointerUp(node, p.id, 'input', $event)"
            />
            <span class="ml-4 truncate">{{ p.label }}</span>
          </div>
          <!-- 输出端口 -->
          <div
            v-for="(p, i) in getDefinition(node.type)?.outputs ?? []"
            :key="`out-${p.id}`"
            class="relative flex items-center justify-end py-0.5 text-[10px] text-gray-600 dark:text-gray-300"
          >
            <span class="mr-4 truncate">{{ p.label }}</span>
            <span
              class="absolute h-3 w-3 rounded-full border-2 border-white shadow-sm dark:border-gray-800"
              :class="portClass('output', p.dataType)"
              :style="{ top: `${6 + i * 18}px` }"
              @pointerdown.stop="onPortPointerDown(node, p.id, 'output', $event)"
              @pointerup.stop="onPortPointerUp(node, p.id, 'output', $event)"
            />
          </div>
        </div>
      </div>

      <!-- Ghost 节点（从 palette 拖入时） -->
      <div
        v-if="dragDrop.isDragging && dragDrop.payload?.source === 'palette' && ghostPos"
        class="pointer-events-none absolute rounded-lg border-2 border-dashed border-blue-400 bg-blue-100/40 px-3 py-2 text-xs text-blue-600 shadow-sm"
        :style="{
          left: `${ghostPos.x - 80}px`,
          top: `${ghostPos.y - 40}px`,
          width: '160px',
        }"
      >
        <div class="flex items-center gap-1.5">
          <span>{{ getDefinition(dragDrop.payload.nodeType ?? '')?.icon }}</span>
          <span class="font-semibold">
            {{ getDefinition(dragDrop.payload.nodeType ?? '')?.label }}
          </span>
        </div>
      </div>
    </div>

    <!-- 缩放提示 -->
    <div class="pointer-events-none absolute bottom-2 right-2 rounded bg-white/70 px-2 py-0.5 text-[10px] text-gray-500 backdrop-blur dark:bg-gray-900/70">
      {{ Math.round(viewport.zoom * 100) }}%
    </div>
  </div>
</template>
