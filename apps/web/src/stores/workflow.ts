/**
 * stores/workflow.ts — minimal stub for BatchGenerateView
 * The full workflow designer was removed per v3.0 spec.
 * This stub supports batch generation only.
 */
import { ref, computed, reactive } from 'vue'
import { defineStore } from 'pinia'

export interface WorkflowNode {
  id: string
  type: string
  label: string
  config: Record<string, unknown>
}

export interface WorkflowDTO {
  id: string
  name: string
  nodes: WorkflowNode[]
}

export const useWorkflowStore = defineStore('workflow', () => {
  const current = ref<WorkflowDTO | null>(null)
  const dirty = ref(false)

  function markDirty() {
    dirty.value = true
  }

  function loadWorkflow(wf: WorkflowDTO) {
    current.value = wf
    dirty.value = false
  }

  return { current, dirty, markDirty, loadWorkflow }
})
