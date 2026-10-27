/**
 * composables/useWorkflowRunner.ts — minimal stub for BatchGenerateView
 */
import { ref } from 'vue'

export function useWorkflowRunner() {
  const isRunning = ref(false)

  async function runWorkflow(_workflow: unknown): Promise<void> {
    isRunning.value = true
    // Stub — real runner was removed per v3.0
    await new Promise(r => setTimeout(r, 2000))
    isRunning.value = false
  }

  async function cancel(): Promise<void> {
    isRunning.value = false
  }

  return { isRunning, runWorkflow, cancel }
}
