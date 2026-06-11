// =============================================================================
// useWorkflowRunner.ts — 运行/调试：调 ai-orchestrator 实时反馈
// W5 任务 3
// =============================================================================

import { ref, computed } from 'vue'
import type { Workflow, WorkflowRun, NodeRuntimeResult } from '../types/workflow'
import { startRun, cancelRun, subscribeRun, getRun } from '../api/orchestrator'

export function useWorkflowRunner() {
  const run = ref<WorkflowRun | null>(null)
  const events = ref<Array<{ type: string; nodeId?: string; timestamp: number; payload?: unknown }>>([])
  const isRunning = computed(() => run.value?.status === 'running' || run.value?.status === 'pending')
  let unsubscribe: (() => void) | null = null

  async function runWorkflow(workflow: Workflow) {
    cleanup()
    events.value = []
    const r = await startRun(workflow)
    run.value = r
    // 订阅事件流
    unsubscribe = subscribeRun(r.runId, (e) => {
      events.value.unshift({
        type: e.type,
        nodeId: e.nodeId,
        timestamp: e.timestamp,
        payload: e.payload,
      })
      // 同步节点结果
      if (e.nodeId && e.payload) {
        if (!run.value) return
        if (!run.value.nodeResults[e.nodeId]) {
          run.value.nodeResults[e.nodeId] = {} as NodeRuntimeResult
        }
        const r = run.value.nodeResults[e.nodeId]
        switch (e.type) {
          case 'node-queued':
            r.status = 'queued'
            break
          case 'node-started':
            r.status = 'running'
            r.startedAt = e.timestamp
            break
          case 'node-finished':
            r.status = 'success'
            r.finishedAt = e.timestamp
            r.output = (e.payload as { output?: unknown }).output
            break
          case 'node-error':
            r.status = 'error'
            r.error = (e.payload as { error?: string }).error
            break
        }
      }
      if (e.type === 'run-finished') {
        // 拉一次最终状态
        getRun(e.runId).then(final => { run.value = final }).catch(() => {})
      }
    })
  }

  async function cancel() {
    if (!run.value) return
    await cancelRun(run.value.runId).catch(() => {})
    if (run.value) run.value.status = 'cancelled'
  }

  function cleanup() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  return {
    run,
    events,
    isRunning,
    runWorkflow,
    cancel,
    cleanup,
  }
}
