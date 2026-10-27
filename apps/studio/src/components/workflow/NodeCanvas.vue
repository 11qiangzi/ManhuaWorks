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
  dblclickNode: [id: string]
}>()

const containerRef = ref<HTMLElement | null>(null)

// 林染 🔮 2026-06-11: inject 父级统一 dragDrop 实例，修复多实例断裂
const dragDrop = inject<DragDropInstance>('dragDrop')!

/** Filter out orphan edges whose source or target node has been deleted */
const validEdges = computed(() =>
  props.edges.filter(e =>
    props.nodes.some(n => n.id === e.source) &&
    props.nodes.some(n => n.id === e.target),
  ),
)

/** 临时连线状态：用户从某端口拖出 */
const pendingEdge = ref<{
  source: string
  sourcePort: string
  pointer: { x: number; y: number }
  /** pointerdown 时的屏幕坐标，用于区分点击 vs 拖拽 */
  startClient: { x: number; y: number }
} | null>(null)

/** 正在拖动的节点 */
const draggingNode = ref<{
  id: string
  startPointer: { x: number; y: number }
  startPos: { x: number; y: number }
  lastPos: { x: number; y: number }
} | null>(null)

/** 画布平移状态：拖拽背景时移动视口 */
const panning = ref<{
  startClient: { x: number; y: number }
  startViewport: { x: number; y: number }
} | null>(null)

/** viewport 容器尺寸（用于 pan/zoom 边界） */
const containerSize = ref({ w: 10000, h: 10000 })  // 林染 🔮 2026-06-11: 固定尺寸，避免 ResizeObserver 反馈循环

/** 端口命中检测半径（世界坐标 px）— 80px 足够宽容 */
const PORT_HIT_RADIUS = 80

/** 拖拽阈值（屏幕坐标 px）— 低于此值视为点击，不创建连线 */
const EDGE_DRAG_THRESHOLD = 5

/** 查找距离 (wx,wy) 最近的 input 端口 */
function findNearestInputPort(wx: number, wy: number): { nodeId: string; portId: string } | null {
  let best: { nodeId: string; portId: string; dist: number } | null = null
  for (const node of props.nodes) {
    const def = getDefinition(node.type)
    if (!def?.inputs?.length) continue
    for (let i = 0; i < def.inputs.length; i++) {
      // Port position: node.position + offset within the node body
      // Header ~28px, port container padding ~6px, row padding ~4px, port top ~4px, center ~7px
      const portY = node.position.y + 28 + 6 + 4 + (4 + i * 22) + 7
      const portX = node.position.x // input ports are on the left edge
      const dx = wx - portX
      const dy = wy - portY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < PORT_HIT_RADIUS && (!best || dist < best.dist)) {
        best = { nodeId: node.id, portId: def.inputs[i].id, dist }
      }
    }
  }
  return best ? { nodeId: best.nodeId, portId: best.portId } : null
}

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

// Template helpers: unwrap dragDrop.payload Ref (inject objects don't auto-unwrap nested refs in template)
const isPaletteDrag = computed(() =>
  dragDrop.isDragging.value && dragDrop.payload.value?.source === 'palette',
)
const paletteDragType = computed(() =>
  dragDrop.payload.value?.source === 'palette' ? (dragDrop.payload.value.nodeType ?? '') : '',
)

function onContainerPointerMove(e: PointerEvent) {
  // 🔧 画布平移：拖拽背景时移动视口
  if (panning.value) {
    const dx = e.clientX - panning.value.startClient.x
    const dy = e.clientY - panning.value.startClient.y
    emit('setViewport', {
      x: panning.value.startViewport.x + dx,
      y: panning.value.startViewport.y + dy,
    })
  }
  if (draggingNode.value) {
    const dx = (e.clientX - draggingNode.value.startPointer.x) / props.viewport.zoom
    const dy = (e.clientY - draggingNode.value.startPointer.y) / props.viewport.zoom
    const newPos = {
      x: draggingNode.value.startPos.x + dx,
      y: draggingNode.value.startPos.y + dy,
    }
    draggingNode.value.lastPos = newPos
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
  // 🔧 释放浏览器自动指针捕获，让后续 pointermove/pointerup 路由到光标下的真实元素
  try { (e.currentTarget as Element).releasePointerCapture(e.pointerId) } catch { /* noop */ }
  emit('select', node.id, e.shiftKey)
  draggingNode.value = {
    id: node.id,
    startPointer: { x: e.clientX, y: e.clientY },
    startPos: { ...node.position },
    lastPos: { ...node.position },
  }
}

/** 🔧 临时调试：端口事件状态指示器 */
const portDebugMsg = ref('')

function onPortPointerDown(
  node: WorkflowNode,
  portId: string,
  side: 'input' | 'output',
  e: PointerEvent,
) {
  e.stopPropagation()
  portDebugMsg.value = `[pointerdown] ${side} ${node.id.slice(-6)} port=${portId} at (${e.clientX},${e.clientY})`
  // 🔧 释放浏览器自动指针捕获 — 关键修复！
  // 不释放的话，pointerup 会被锁定在源端口上，导致连线永远 source===target
  try { (e.currentTarget as Element).releasePointerCapture(e.pointerId) } catch { /* noop */ }
  const w = screenToWorld(e.clientX, e.clientY)
  const startClient = { x: e.clientX, y: e.clientY }
  if (side === 'output') {
    pendingEdge.value = { source: node.id, sourcePort: portId, pointer: w, startClient }
  } else {
    // 从 input 拖出 → 反向连接（互换 source/target）
    pendingEdge.value = { source: node.id, sourcePort: portId, pointer: w, startClient }
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
  const { source, sourcePort } = pendingEdge.value
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
}

function onCanvasPointerDown(e: PointerEvent) {
  const tgt = e.target as HTMLElement
  // Background click: container itself, or any element marked data-canvas-bg
  if (e.target === e.currentTarget || tgt?.dataset?.canvasBg === '1') {
    emit('clearSelection')
    // 🔧 开始画布平移
    panning.value = {
      startClient: { x: e.clientX, y: e.clientY },
      startViewport: { x: props.viewport.x, y: props.viewport.y },
    }
  }
}

// ---------- 🔧 关键修复：capture-phase 端口事件委托 ----------
// 完全绕过 Vue 事件系统，使用原生 DOM capture 阶段拦截。
// 解决 pointerdown 事件不触达端口 @pointerdown 处理器的根本问题。

let portCaptureCount = 0

/** capture-phase pointerdown: 在所有 target/bubble 处理器之前运行 */
function onPortCaptureDown(e: PointerEvent) {
  const el = e.target as HTMLElement
  if (!el?.closest) return
  const portEl = el.closest('[data-port-id]') as HTMLElement | null
  if (!portEl) return

  e.stopPropagation()
  e.preventDefault()
  portCaptureCount++
  const side = portEl.dataset.portSide as 'input' | 'output'
  const portId = portEl.dataset.portId!
  const nodeId = portEl.dataset.portNode!
  const node = props.nodes.find(n => n.id === nodeId)
  if (!node) return

  portDebugMsg.value = `[CAPTURE #${portCaptureCount}] ${side} ${nodeId.slice(-6)} port=${portId} (${e.clientX},${e.clientY})`

  try { el.releasePointerCapture(e.pointerId) } catch { /* noop */ }

  const w = screenToWorld(e.clientX, e.clientY)
  const startClient = { x: e.clientX, y: e.clientY }
  pendingEdge.value = { source: node.id, sourcePort: portId, pointer: w, startClient }
}

/** capture-phase mousedown: pointerdown 的后备方案 */
function onPortCaptureMouseDown(e: MouseEvent) {
  const el = e.target as HTMLElement
  if (!el?.closest) return
  const portEl = el.closest('[data-port-id]') as HTMLElement | null
  if (!portEl) return
  e.stopPropagation()
  portDebugMsg.value = `[MOUSEDOWN-CAPTURE] ${portEl.dataset.portSide} port=${portEl.dataset.portId}`
}

/** 端口 pointerenter 诊断（确认悬停检测正常） */
function onPortEnter(nodeId: string, portId: string, side: string) {
  portDebugMsg.value = `[ENTER] ${side} node=${nodeId.slice(-6)} port=${portId}`
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
    case 'queued': return 'border-dashed border-yellow-400'
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
/** Capture-phase pointerup on container: fires BEFORE useDragDrop's
 *  window bubble handler, ensuring we can read drag state before it's cleared.
 *  🔧 关键修复：连线创建也在此处理，绕过 releasePointerCapture 失败导致的
 *  pointerup 路由错误问题。capture 阶段在 target/bubble 之前，无论
 *  pointerup 实际落在哪个子元素上都能可靠拦截。 */
function onContainerPointerUpCapture(e: PointerEvent) {
  // 1. Handle palette drop (from NodePalette drag-in)
  if (dragDrop.isDragging.value && dragDrop.payload.value?.source === 'palette') {
    const nodeType = dragDrop.payload.value.nodeType
    if (nodeType) {
      const pos = screenToWorld(e.clientX, e.clientY)
      emit('addNode', nodeType, { x: pos.x - 80, y: pos.y - 40 })
    }
    dragDrop.isDragging.value = false
    dragDrop.payload.value = null
    ghostPos.value = null
    return
  }

  // 2. Handle pending edge creation (🔧 核心修复)
  if (pendingEdge.value) {
    const { source, sourcePort, startClient } = pendingEdge.value
    // Check drag distance — ignore accidental clicks (< 5px movement)
    const dx = e.clientX - startClient.x
    const dy = e.clientY - startClient.y
    const dragDist = Math.sqrt(dx * dx + dy * dy)
    if (dragDist > EDGE_DRAG_THRESHOLD) {
      const w = screenToWorld(e.clientX, e.clientY)
      const hit = findNearestInputPort(w.x, w.y)
      if (hit && hit.nodeId !== source) {
        emit('addEdge', source, sourcePort, hit.nodeId, hit.portId)
      }
    }
    pendingEdge.value = null
    // Stop propagation: prevents port-level @pointerup.stop and window
    // onWindowPointerUp from double-handling this event.
    e.stopPropagation()
  }
}

// 🔧 全局诊断：记录所有 pointerdown 事件的真实 target（不阻止任何事件）
function onDocPointerDiagnostic(e: PointerEvent) {
  const el = e.target as HTMLElement
  const tag = el?.tagName ?? '?'
  const cls = el?.className?.toString?.()?.slice(0, 60) ?? ''
  const portId = el?.dataset?.portId ?? ''
  const isPort = !!el?.closest?.('[data-port-id]')
  portDebugMsg.value = `[DOC] ${tag} cls="${cls}" portId=${portId} nearPort=${isPort} (${e.clientX},${e.clientY})`
}

onMounted(() => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    containerSize.value = { w: rect.width || 10000, h: rect.height || 10000 }
    // Register capture-phase listener to intercept pointerup before useDragDrop
    containerRef.value.addEventListener('pointerup', onContainerPointerUpCapture, true)
    // 🔧 关键：capture-phase pointerdown/mousedown 端口事件委托
    // 在 Vue @pointerdown 之前触发，通过 data-port-id 属性识别端口元素
    containerRef.value.addEventListener('pointerdown', onPortCaptureDown, true)
    containerRef.value.addEventListener('mousedown', onPortCaptureMouseDown, true)
  }
  // 全局诊断：捕获 document 上所有 pointerdown（capture 阶段，最先触发）
  document.addEventListener('pointerdown', onDocPointerDiagnostic, true)
})

// 林染 🔮 2026-06-11: window pointermove + pointerup 防鼠标出容器
function onWindowPointerUp(e: PointerEvent) {
  if (draggingNode.value) {
    // Emit lastPos (actual final position), NOT startPos (which would snap back)
    emit('moveNode', draggingNode.value.id, draggingNode.value.lastPos, true)
    draggingNode.value = null
  }
  // Fallback: handle pendingEdge when pointerup is outside the container
  // (capture-phase handler on container won't fire for events outside its DOM tree)
  if (pendingEdge.value) {
    const { source, sourcePort, startClient } = pendingEdge.value
    const dx = e.clientX - startClient.x
    const dy = e.clientY - startClient.y
    if (Math.sqrt(dx * dx + dy * dy) > EDGE_DRAG_THRESHOLD) {
      const w = screenToWorld(e.clientX, e.clientY)
      const hit = findNearestInputPort(w.x, w.y)
      if (hit && hit.nodeId !== source) {
        emit('addEdge', source, sourcePort, hit.nodeId, hit.portId)
      }
    }
    pendingEdge.value = null
  }
  // Also clear ghost preview (in case palette drop was outside canvas)
  ghostPos.value = null
  // 🔧 结束画布平移
  panning.value = null
}
window.addEventListener('pointermove', onContainerPointerMove)
window.addEventListener('pointerup', onWindowPointerUp)
onUnmounted(() => {
  containerRef.value?.removeEventListener('pointerup', onContainerPointerUpCapture, true)
  containerRef.value?.removeEventListener('pointerdown', onPortCaptureDown, true)
  containerRef.value?.removeEventListener('mousedown', onPortCaptureMouseDown, true)
  document.removeEventListener('pointerdown', onDocPointerDiagnostic, true)
  window.removeEventListener('pointermove', onContainerPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative h-full w-full overflow-hidden bg-gray-50 dark:bg-gray-950"
    @wheel="onWheel"
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
      <rect width="100%" height="100%" fill="url(#grid)" class="pointer-events-none" />
    </svg>

    <!-- 主世界层（应用 viewport 变换） -->
    <div
      class="absolute left-0 top-0 will-change-transform"
      :style="viewBoxStyle"
      :data-canvas-bg="1"
    >
      <!-- 林染 🔮 2026-06-11 fix: 固定 SVG 尺寸，避免 ResizeObserver 反馈循环 -->
      <!-- 连线层 — 🔧 关键修复：移除 -5000px 偏移，让 SVG 坐标与世界坐标对齐 -->
      <svg
        class="pointer-events-none absolute overflow-visible"
        width="5000"
        height="5000"
        :style="{ left: '0', top: '0' }"
      >
        <g class="pointer-events-none">
          <!-- 🔧 SVG 渲染测试：红色圆点 + 文字（如果看不到说明 SVG 层有问题） -->
          <circle cx="200" cy="80" r="20" fill="red" opacity="0.8" />
          <text x="200" y="120" fill="red" font-size="14" text-anchor="middle" font-family="monospace"
            style="paint-order:stroke;stroke:white;stroke-width:3px;">SVG OK</text>
          <ConnectionLine
            v-for="edge in validEdges"
            :key="edge.id"
            :edge="edge"
            :source-node="nodes.find(n => n.id === edge.source)!"
            :target-node="nodes.find(n => n.id === edge.target)!"
            :source-def="getDefinition(nodes.find(n => n.id === edge.source)?.type ?? '') ?? null"
            :target-def="getDefinition(nodes.find(n => n.id === edge.target)?.type ?? '') ?? null"
            :selected="selection.edgeIds.includes(edge.id)"
            @click="emit('selectEdge', edge.id, false)"
            @remove="() => { /* handled in store */ }"
          />
          <!-- 临时连线（拖拽中） -->
          <ConnectionLine
            v-if="pendingEdge"
            :edge="{
              id: 'pending',
              source: pendingEdge!.source,
              sourcePort: pendingEdge!.sourcePort,
              target: 'pending',
              targetPort: 'pending',
            }"
            :source-node="nodes.find(n => n.id === pendingEdge!.source)!"
            :target-node="{
              id: 'pending',
              type: '',
              position: pendingEdge!.pointer,
              size: { width: 0, height: 0 },
              params: {},
            }"
            :source-def="getDefinition(nodes.find(n => n.id === pendingEdge!.source)?.type ?? '') ?? null"
            :target-def="null"
            :pending="pendingEdge!.pointer"
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
        @dblclick="emit('dblclickNode', node.id)"
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
            class="relative flex items-center py-1 text-[10px] text-gray-600 dark:text-gray-300"
          >
            <!-- 端口圆点（14px，带 hover 光晕） -->
            <span
              class="port-dot absolute rounded-full border-2 border-white shadow-sm dark:border-gray-700 cursor-crosshair transition-all duration-100 hover:scale-150 hover:shadow-lg hover:brightness-125"
              :class="portClass('input', p.dataType)"
              :style="{ top: `${4 + i * 22}px`, width: '14px', height: '14px' }"
              :data-port-id="p.id"
              :data-port-side="'input'"
              :data-port-node="node.id"
              @pointerdown.stop="onPortPointerDown(node, p.id, 'input', $event)"
              @pointerup.stop="onPortPointerUp(node, p.id, 'input', $event)"
              @mouseenter="onPortEnter(node.id, p.id, 'input')"
              @click.stop="portDebugMsg = `[CLICK] input port=${p.id}`"
            />
            <!-- 扩大点击区域（40px） -->
            <span
              class="absolute rounded-full cursor-crosshair"
              :style="{ top: `${4 + i * 22 - 13}px`, left: '-18px', width: '40px', height: '40px' }"
              :data-port-id="p.id"
              :data-port-side="'input'"
              :data-port-node="node.id"
              @pointerdown.stop="onPortPointerDown(node, p.id, 'input', $event)"
              @pointerup.stop="onPortPointerUp(node, p.id, 'input', $event)"
            />
            <span class="ml-5 truncate">{{ p.label }}</span>
          </div>
          <!-- 输出端口 -->
          <div
            v-for="(p, i) in getDefinition(node.type)?.outputs ?? []"
            :key="`out-${p.id}`"
            class="relative flex items-center justify-end py-1 text-[10px] text-gray-600 dark:text-gray-300"
          >
            <span class="mr-5 truncate">{{ p.label }}</span>
            <!-- 端口圆点（14px，带 hover 光晕） -->
            <span
              class="port-dot absolute rounded-full border-2 border-white shadow-sm dark:border-gray-700 cursor-crosshair transition-all duration-100 hover:scale-150 hover:shadow-lg hover:brightness-125"
              :class="portClass('output', p.dataType)"
              :style="{ top: `${4 + i * 22}px`, width: '14px', height: '14px' }"
              :data-port-id="p.id"
              :data-port-side="'output'"
              :data-port-node="node.id"
              @pointerdown.stop="onPortPointerDown(node, p.id, 'output', $event)"
              @pointerup.stop="onPortPointerUp(node, p.id, 'output', $event)"
              @mouseenter="onPortEnter(node.id, p.id, 'output')"
              @click.stop="portDebugMsg = `[CLICK] output port=${p.id}`"
            />
            <!-- 扩大点击区域（40px） -->
            <span
              class="absolute rounded-full cursor-crosshair"
              :style="{ top: `${4 + i * 22 - 13}px`, right: '-18px', width: '40px', height: '40px' }"
              :data-port-id="p.id"
              :data-port-side="'output'"
              :data-port-node="node.id"
              @pointerdown.stop="onPortPointerDown(node, p.id, 'output', $event)"
              @pointerup.stop="onPortPointerUp(node, p.id, 'output', $event)"
            />
          </div>
        </div>
      </div>

      <!-- Ghost 节点（从 palette 拖入时） -->
      <div
        v-if="isPaletteDrag && ghostPos"
        class="pointer-events-none absolute rounded-lg border-2 border-dashed border-blue-400 bg-blue-100/40 px-3 py-2 text-xs text-blue-600 shadow-sm"
        :style="{
          left: `${ghostPos.x - 80}px`,
          top: `${ghostPos.y - 40}px`,
          width: '160px',
        }"
      >
        <div class="flex items-center gap-1.5">
          <span>{{ getDefinition(paletteDragType)?.icon }}</span>
          <span class="font-semibold">
            {{ getDefinition(paletteDragType)?.label }}
          </span>
        </div>
      </div>
    </div>

    <!-- 缩放提示 -->
    <div class="pointer-events-none absolute bottom-2 right-2 rounded bg-white/70 px-2 py-0.5 text-[10px] text-gray-500 backdrop-blur dark:bg-gray-900/70">
      {{ Math.round(viewport.zoom * 100) }}%
    </div>

    <!-- 🔧 临时调试：端口事件状态 -->
    <Teleport to="body">
      <div
        v-if="portDebugMsg"
        style="position:fixed;left:8px;top:8px;z-index:999999;max-width:500px;padding:8px 12px;border-radius:8px;background:rgba(34,197,94,0.95);color:white;font-family:monospace;font-size:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);pointer-events:none;"
      >
        {{ portDebugMsg }}
      </div>
    </Teleport>
  </div>
</template>
