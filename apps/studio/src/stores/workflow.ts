// =============================================================================
// stores/workflow.ts — Pinia store：当前工作流状态
// W5 任务 3
// =============================================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Workflow, WorkflowNode, WorkflowEdge, Viewport, Selection } from '../types/workflow'

let _wfCounter = 0

export const useWorkflowStore = defineStore('workflow', () => {
  const current = ref<Workflow | null>(null)
  const dirty = ref(false)

  const nodeCount = computed(() => current.value?.nodes.length ?? 0)
  const edgeCount = computed(() => current.value?.edges.length ?? 0)

  function create(name = '未命名工作流'): Workflow {
    const wf: Workflow = {
      id: `wf_${Date.now().toString(36)}_${(++_wfCounter).toString(36)}`,
      name,
      description: '',
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    }
    current.value = wf
    dirty.value = false
    return wf
  }

  function load(wf: Workflow) {
    current.value = JSON.parse(JSON.stringify(wf))
    dirty.value = false
  }

  function markDirty() {
    if (current.value) {
      current.value.updatedAt = Date.now()
      current.value.version += 1
    }
    dirty.value = true
  }

  function setNodes(nodes: WorkflowNode[]) {
    if (!current.value) return
    current.value.nodes = nodes
    markDirty()
  }

  function setEdges(edges: WorkflowEdge[]) {
    if (!current.value) return
    current.value.edges = edges
    markDirty()
  }

  function setViewport(v: Viewport) {
    if (!current.value) return
    current.value.viewport = v
    // viewport 改变不视为 dirty
  }

  function rename(name: string) {
    if (!current.value) return
    current.value.name = name
    markDirty()
  }

  return {
    current,
    dirty,
    nodeCount,
    edgeCount,
    create,
    load,
    markDirty,
    setNodes,
    setEdges,
    setViewport,
    rename,
  }
})
