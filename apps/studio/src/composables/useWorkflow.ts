// =============================================================================
// useWorkflow.ts — 工作流状态：节点/连线/选中
// W5 任务 3
// =============================================================================

import { ref, computed, reactive } from 'vue'
import type {
  WorkflowNode,
  WorkflowEdge,
  Viewport,
  Selection,
  NodeDefinition,
} from '../types/workflow'
import { NODE_DEFINITIONS } from '../types/workflow'
import { useHistory } from './useHistory'

let _idCounter = 0
function uid(prefix = 'n'): string {
  _idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${_idCounter.toString(36)}`
}

export function useWorkflow() {
  const nodes = ref<WorkflowNode[]>([])
  const edges = ref<WorkflowEdge[]>([])
  const viewport = reactive<Viewport>({ x: 0, y: 0, zoom: 1 })
  const selection = reactive<Selection>({ nodeIds: [], edgeIds: [] })
  const history = useHistory()

  const selectedNodes = computed(() =>
    nodes.value.filter(n => selection.nodeIds.includes(n.id))
  )

  const selectedEdges = computed(() =>
    edges.value.filter(e => selection.edgeIds.includes(e.id))
  )

  function getDefinition(type: string): NodeDefinition | undefined {
    return NODE_DEFINITIONS.find(d => d.type === type)
  }

  function addNode(type: string, position: { x: number; y: number }, skipHistory = false): WorkflowNode | null {
    const def = getDefinition(type)
    if (!def) return null
    const node: WorkflowNode = {
      id: uid('node'),
      type,
      position,
      size: def.size ?? { width: 180, height: 100 },
      params: { ...def.defaultParams },
    }
    const doAdd = () => { nodes.value.push(node) }
    const undoAdd = () => { nodes.value = nodes.value.filter(n => n.id !== node.id) }
    if (skipHistory) doAdd()
    else history.execute({ type: 'add-node', do: doAdd, undo: undoAdd, label: `add ${type}` })
    return node
  }

  function removeNode(id: string) {
    const idx = nodes.value.findIndex(n => n.id === id)
    if (idx < 0) return
    const node = nodes.value[idx]
    const removedEdges = edges.value.filter(e => e.source === id || e.target === id)
    const doRemove = () => {
      nodes.value = nodes.value.filter(n => n.id !== id)
      edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
      selection.nodeIds = selection.nodeIds.filter(x => x !== id)
    }
    const undoRemove = () => {
      nodes.value.splice(idx, 0, node)
      edges.value.push(...removedEdges)
    }
    history.execute({ type: 'remove-node', do: doRemove, undo: undoRemove, label: `remove ${node.type}` })
  }

  function moveNode(id: string, newPos: { x: number; y: number }, record = true) {
    const node = nodes.value.find(n => n.id === id)
    if (!node) return
    const oldPos = { ...node.position }
    if (record) {
      history.execute({
        type: 'move-node',
        do: () => { node.position = newPos },
        undo: () => { node.position = oldPos },
        label: `move ${node.type}`,
      })
    } else {
      node.position = newPos
    }
  }

  function updateNodeParams(id: string, patch: Record<string, unknown>) {
    const node = nodes.value.find(n => n.id === id)
    if (!node) return
    const oldParams = { ...node.params }
    const newParams = { ...node.params, ...patch }
    history.execute({
      type: 'update-node',
      do: () => { node.params = newParams },
      undo: () => { node.params = oldParams },
      label: `update ${node.type}`,
    })
  }

  function addEdge(
    source: string, sourcePort: string,
    target: string, targetPort: string,
  ): WorkflowEdge | null {
    if (source === target) return null
    // 防止重复
    const dup = edges.value.find(
      e => e.source === source && e.sourcePort === sourcePort && e.target === target && e.targetPort === targetPort,
    )
    if (dup) return null
    // 防止环
    if (createsCycle(source, target)) return null
    const edge: WorkflowEdge = {
      id: uid('edge'),
      source, sourcePort, target, targetPort,
    }
    const doAdd = () => { edges.value.push(edge) }
    const undoAdd = () => { edges.value = edges.value.filter(e => e.id !== edge.id) }
    history.execute({ type: 'add-edge', do: doAdd, undo: undoAdd, label: 'add edge' })
    return edge
  }

  function removeEdge(id: string) {
    const idx = edges.value.findIndex(e => e.id === id)
    if (idx < 0) return
    const edge = edges.value[idx]
    history.execute({
      type: 'remove-edge',
      do: () => { edges.value.splice(idx, 1) },
      undo: () => { edges.value.splice(idx, 0, edge) },
      label: 'remove edge',
    })
  }

  function createsCycle(source: string, target: string): boolean {
    // BFS from target to see if we reach source
    const adj = new Map<string, string[]>()
    edges.value.forEach(e => {
      if (!adj.has(e.source)) adj.set(e.source, [])
      adj.get(e.source)!.push(e.target)
    })
    if (!adj.has(target)) return false
    const visited = new Set<string>()
    const queue: string[] = [target]
    while (queue.length) {
      const cur = queue.shift()!
      if (cur === source) return true
      if (visited.has(cur)) continue
      visited.add(cur)
      const next = adj.get(cur) ?? []
      queue.push(...next)
    }
    return false
  }

  function select(id: string, additive = false) {
    if (!additive) {
      selection.nodeIds = [id]
      selection.edgeIds = []
    } else {
      if (!selection.nodeIds.includes(id)) selection.nodeIds.push(id)
    }
  }

  function selectEdge(id: string, additive = false) {
    if (!additive) {
      selection.nodeIds = []
      selection.edgeIds = [id]
    } else {
      if (!selection.edgeIds.includes(id)) selection.edgeIds.push(id)
    }
  }

  function clearSelection() {
    selection.nodeIds = []
    selection.edgeIds = []
  }

  function setViewport(v: Partial<Viewport>) {
    Object.assign(viewport, v)
  }

  function clear() {
    nodes.value = []
    edges.value = []
    selection.nodeIds = []
    selection.edgeIds = []
    history.clear()
  }

  function loadWorkflow(workflow: {
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
    viewport?: Viewport
  }) {
    nodes.value = JSON.parse(JSON.stringify(workflow.nodes))
    edges.value = JSON.parse(JSON.stringify(workflow.edges))
    if (workflow.viewport) Object.assign(viewport, workflow.viewport)
    selection.nodeIds = []
    selection.edgeIds = []
    history.clear()
  }

  function toJSON() {
    return {
      nodes: JSON.parse(JSON.stringify(nodes.value)),
      edges: JSON.parse(JSON.stringify(edges.value)),
      viewport: { ...viewport },
    }
  }

  return {
    nodes,
    edges,
    viewport,
    selection,
    selectedNodes,
    selectedEdges,
    history,
    getDefinition,
    addNode,
    removeNode,
    moveNode,
    updateNodeParams,
    addEdge,
    removeEdge,
    select,
    selectEdge,
    clearSelection,
    setViewport,
    clear,
    loadWorkflow,
    toJSON,
  }
}
