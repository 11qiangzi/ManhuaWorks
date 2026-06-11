// =============================================================================
// useDragDrop.ts — 拖拽逻辑（节点从面板拖到画布）
// W5 任务 3
// =============================================================================

import { ref, onUnmounted } from 'vue'
import type { NodeDefinition } from '../types/workflow'

export interface DragPayload {
  source: 'palette' | 'canvas'
  nodeType?: string             // palette 来源
  nodeId?: string               // canvas 来源（已存在节点拖动）
  offsetX: number
  offsetY: number
}

export type DragDropInstance = ReturnType<typeof useDragDrop>

export function useDragDrop() {
  const isDragging = ref(false)
  const payload = ref<DragPayload | null>(null)
  /** 屏幕坐标 */
  const pointer = ref({ x: 0, y: 0 })

  function onPointerMove(e: PointerEvent) {
    if (!isDragging.value) return
    pointer.value = { x: e.clientX, y: e.clientY }
  }

  function onPointerUp() {
    isDragging.value = false
    payload.value = null
  }

  // 全局监听（mount 时绑定）
  if (typeof window !== 'undefined') {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  })

  function startPaletteDrag(def: NodeDefinition, e: PointerEvent) {
    e.preventDefault()
    isDragging.value = true
    payload.value = {
      source: 'palette',
      nodeType: def.type,
      offsetX: 80,    // 节点中心
      offsetY: 40,
    }
    pointer.value = { x: e.clientX, y: e.clientY }
  }

  function startCanvasDrag(nodeId: string, e: PointerEvent) {
    e.preventDefault()
    isDragging.value = true
    payload.value = {
      source: 'canvas',
      nodeId,
      offsetX: 0,
      offsetY: 0,
    }
    pointer.value = { x: e.clientX, y: e.clientY }
  }

  return {
    isDragging,
    payload,
    pointer,
    startPaletteDrag,
    startCanvasDrag,
  }
}
