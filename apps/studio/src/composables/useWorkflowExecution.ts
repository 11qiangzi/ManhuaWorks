import { ref } from 'vue'
import { useWorkflowRunner } from './useWorkflowRunner'
import { useToast } from '@manhuaworks/ui'
import { getApi } from '../api-bridge'
import type { Workflow } from '../types/workflow'
import type { NodeType, NodeStatus } from '@manhuaworks/shared-types'

const ORCH_BASE: string =
  (import.meta.env?.VITE_ORCHESTRATOR_URL as string | undefined) ?? ''

export function useWorkflowExecution(wf: { value: Workflow }) {
  const runner = useWorkflowRunner()
  const toast = useToast()

  const executionId = ref<string | null>(null)
  const executionStatus = ref<'idle' | 'running' | 'succeeded' | 'failed' | 'partial'>('idle')
  const useLocalFallback = ref(false)
  let pollHandle: number | null = null

  function toStudioStatus(s: NodeStatus): 'idle' | 'queued' | 'running' | 'success' | 'error' | 'skipped' {
    switch (s) { case 'succeeded': return 'success'; case 'failed': return 'error'; default: return s as any }
  }

  function setAllNodesStatus(s: NodeStatus) {
    for (const n of wf.value.nodes) n.status = toStudioStatus(s)
  }

  function setNodeStatus(id: string, s: NodeStatus, err?: string) {
    const n = wf.value.nodes.find(x => x.id === id)
    if (!n) return
    n.status = toStudioStatus(s)
    if (err) (n as { error?: string }).error = err
  }

  const PIPELINE_NODE_TYPES: readonly string[] = [
    'translate', 'character-replace', 'episode-batch',
    'style-transfer', 'novel-to-drama', 'multi-character',
    'decompose', 'compose-video',
  ]
  function isPipelineType(t: string): t is NodeType {
    return PIPELINE_NODE_TYPES.includes(t)
  }

  async function onRun(onShowEvents?: () => void) {
    if (wf.value.nodes.length === 0) {
      toast.warning('工作流为空，无法运行')
      return
    }
    executionStatus.value = 'running'
    useLocalFallback.value = false
    setAllNodesStatus('idle' as NodeStatus)
    onShowEvents?.()

    let runId: string | null = null
    try {
      const executePayload = {
        workflowId: wf.value.id,
        name: wf.value.name,
        nodes: wf.value.nodes.map(n => ({
          id: n.id, type: n.type, params: n.params, dependsOn: [],
        })),
        edges: wf.value.edges,
      }
      let data: { executionId: string }
      try {
        const api = getApi()
        data = await api.http.post<{ executionId: string }>(
          `/v1/workflows/${wf.value.id}/execute`,
          executePayload,
          { timeoutMs: 2_500 },
        )
      } catch {
        // Fallback to raw orchestrator fetch
        const ac = new AbortController()
        const tid = setTimeout(() => ac.abort(), 2_500)
        const resp = await fetch(`${ORCH_BASE}/api/v1/workflows/${wf.value.id}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(executePayload),
          signal: ac.signal,
        }).finally(() => clearTimeout(tid))
        if (!resp.ok) throw new Error(`status ${resp.status}`)
        data = (await resp.json()) as { executionId: string }
      }
      runId = data.executionId
      executionId.value = runId
    } catch (e) {
      console.warn('[run] orchestrator unreachable, using local fallback:', (e as Error).message)
      useLocalFallback.value = true
      runId = `local-${Date.now().toString(36)}`
      executionId.value = runId
    }

    if (useLocalFallback.value) {
      await runLocalFallback()
    } else {
      startPolling()
    }
  }

  async function runLocalFallback() {
    const pipelineNodes = wf.value.nodes.filter(n => isPipelineType(n.type))
    for (const node of pipelineNodes) {
      setNodeStatus(node.id, 'running')
      await new Promise(r => setTimeout(r, 600))
      if (Math.random() < 0.9) {
        setNodeStatus(node.id, 'succeeded')
      } else {
        setNodeStatus(node.id, 'failed', '本地 mock 随机失败（用于演示重试按钮）')
      }
    }
    // Process non-pipeline nodes (text-input, llm-generate, image-generate, etc.)
    const otherNodes = wf.value.nodes.filter(n => !isPipelineType(n.type))
    for (const node of otherNodes) {
      setNodeStatus(node.id, 'running')
      await new Promise(r => setTimeout(r, 300))
      setNodeStatus(node.id, 'succeeded')
    }
    const anyFail = wf.value.nodes.some(n => n.status === 'error')
    executionStatus.value = anyFail ? 'partial' : 'succeeded'
  }

  async function startPolling() {
    stopPolling()
    const tick = async () => {
      if (!executionId.value) return
      try {
        let data: { status: 'succeeded' | 'failed' | 'partial' | 'running'; nodeResults: Record<string, { status: NodeStatus; error?: string }> }
        try {
          const api = getApi()
          data = await api.http.get(
            `/v1/workflows/${wf.value.id}/executions/${executionId.value}`,
            undefined,
            { timeoutMs: 2_500 },
          )
        } catch {
          const ac = new AbortController()
          const tid = setTimeout(() => ac.abort(), 2_500)
          const resp = await fetch(
            `${ORCH_BASE}/api/v1/workflows/${wf.value.id}/executions/${executionId.value}`,
            { signal: ac.signal },
          ).finally(() => clearTimeout(tid))
          if (!resp.ok) throw new Error(`status ${resp.status}`)
          data = (await resp.json()) as typeof data
        }
        executionStatus.value = data.status
        if (data.nodeResults) {
          for (const [nid, r] of Object.entries(data.nodeResults)) {
            setNodeStatus(nid, r.status, r.error)
          }
        }
        if (data.status !== 'running') { stopPolling(); return }
      } catch (e) {
        console.warn('[poll] error:', (e as Error).message)
        useLocalFallback.value = true; stopPolling(); await runLocalFallback()
      }
    }
    pollHandle = window.setInterval(tick, 1_000)
    void tick()
  }

  function stopPolling() {
    if (pollHandle != null) { clearInterval(pollHandle); pollHandle = null }
  }

  async function onRetryNode(id: string) {
    setNodeStatus(id, 'running')
    if (useLocalFallback.value || !executionId.value) {
      await new Promise(r => setTimeout(r, 800)); setNodeStatus(id, 'succeeded'); return
    }
    try {
      try {
        const api = getApi()
        await api.http.post(
          `/v1/workflows/${wf.value.id}/executions/${executionId.value}/nodes/${id}/retry`,
          undefined,
          { timeoutMs: 2_500 },
        )
      } catch {
        const ac = new AbortController()
        const tid = setTimeout(() => ac.abort(), 2_500)
        const resp = await fetch(
          `${ORCH_BASE}/api/v1/workflows/${wf.value.id}/executions/${executionId.value}/nodes/${id}/retry`,
          { method: 'POST', signal: ac.signal },
        ).finally(() => clearTimeout(tid))
        if (!resp.ok) throw new Error(`status ${resp.status}`)
      }
    } catch (e) {
      console.warn('[retry] fallback to local', (e as Error).message)
      await new Promise(r => setTimeout(r, 800)); setNodeStatus(id, 'succeeded')
    }
  }

  async function onDebug(onShowEvents?: () => void) {
    if (wf.value.nodes.length === 0) return
    await onRun(onShowEvents)
  }

  async function onCancel() {
    await runner.cancel()
    if (executionId.value) {
      try {
        try {
          const api = getApi()
          await api.http.post(
            `/v1/workflows/${wf.value.id}/executions/${executionId.value}/cancel`,
            undefined,
            { timeoutMs: 2_500 },
          )
        } catch {
          const ac = new AbortController()
          const tid = setTimeout(() => ac.abort(), 2_500)
          await fetch(
            `${ORCH_BASE}/api/v1/workflows/${wf.value.id}/executions/${executionId.value}/cancel`,
            { method: 'POST', signal: ac.signal },
          ).finally(() => clearTimeout(tid))
        }
      } catch { /* noop */ }
    }
    stopPolling()
    setAllNodesStatus('idle' as NodeStatus)
    executionStatus.value = 'idle'
  }

  return {
    executionId, executionStatus, useLocalFallback,
    onRun, onRetryNode, onDebug, onCancel, stopPolling,
    setNodeStatus, setAllNodesStatus, isPipelineType,
  }
}
