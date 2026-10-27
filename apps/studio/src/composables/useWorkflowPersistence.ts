import { ref, watch } from 'vue'
import { useWorkflowStore } from '../stores/workflow'
import { saveWorkflow, loadWorkflow, listWorkflows } from '../api/orchestrator'
import { getApi } from '../api-bridge'
import { useToast } from '@manhuaworks/ui'
import type { Workflow } from '../types/workflow'

const DRAFT_KEY = 'mhw.workflow.draft'

export function useWorkflowPersistence(wf: { value: Workflow }) {
  const store = useWorkflowStore()
  const toast = useToast()

  const projectWorkflows = ref<Array<{ id: string; name: string; updatedAt?: number }>>([])
  const loadingWorkflows = ref(false)
  const showLoadDropdown = ref(false)
  const showNewWorkflowModal = ref(false)
  const newWorkflowName = ref('新工作流')
  const showNewWorkflowToast = ref(false)

  const lastManualSaveTime = ref(0)

  // ── Auto-save: debounce 3s after dirty flag is set ──
  let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null
  watch(() => store.dirty, (dirty) => {
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer)
    if (dirty && store.current) {
      _autoSaveTimer = setTimeout(() => {
        if (Date.now() - lastManualSaveTime.value < 3000) return // Skip — just manually saved
        onSave()
      }, 3000)
    }
  })

  async function refreshProjectWorkflows() {
    loadingWorkflows.value = true
    try {
      const api = getApi()
      try {
        const resp = await api.http.get<Array<{ id: string; name: string; updatedAt?: number }>>(
          '/v1/workflows',
          undefined,
          { timeoutMs: 2_500 },
        )
        projectWorkflows.value = (resp as Array<{ id: string; name: string; updatedAt?: number }>) ?? []
      } catch {
        projectWorkflows.value = await listWorkflows()
      }
    } catch (e) {
      console.warn('load workflows failed', e)
      projectWorkflows.value = []
    } finally {
      loadingWorkflows.value = false
    }
  }

  async function onSave() {
    if (!store.current) return
    lastManualSaveTime.value = Date.now()
    const payload: Workflow = {
      ...store.current,
      nodes: wf.value.nodes,
      edges: wf.value.edges,
      viewport: wf.value.viewport,
      updatedAt: Date.now(),
      version: (store.current.version ?? 0) + 1,
    }
    try {
      // Try api-bridge first (has auth headers), then fall back to orchestrator
      const api = getApi()
      try {
        const isLocalId = typeof payload.id === 'string' && payload.id.startsWith('wf-')
        if (!isLocalId && payload.id) {
          // Existing workflow — update via PUT; fall back to POST on 404
          try {
            await api.http.put(`/v1/workflows/${payload.id}`, payload)
          } catch (putErr: any) {
            const status = putErr?.status ?? putErr?.statusCode ?? putErr?.response?.status
            if (status === 404) {
              await api.http.post('/v1/workflows', payload)
            } else {
              throw putErr
            }
          }
        } else {
          // New workflow — create via POST
          await api.http.post('/v1/workflows', payload)
        }
      } catch {
        // api-bridge failed, try orchestrator directly
        await saveWorkflow(payload)
      }
      store.load(payload)
      wf.value = { ...payload }
      store.dirty = false
      toast.success(`工作流「${payload.name}」已保存`)
      // Clear draft on successful save
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
    } catch (e) {
      console.error('save failed', e)
      // Keep dirty = true so user knows there are unsaved changes
      // Save real draft to localStorage
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          ...payload,
          _savedAt: Date.now(),
          _error: (e as Error).message,
        }))
      } catch { /* storage full — silently skip */ }
      toast.error(`保存失败: ${(e as Error).message}，已存为本地草稿`)
    }
  }

  async function onLoadById(id: string) {
    showLoadDropdown.value = false
    try {
      const api = getApi()
      let loaded: Workflow
      try {
        loaded = await api.http.get(`/v1/workflows/${encodeURIComponent(id)}`) as unknown as Workflow
      } catch {
        loaded = await loadWorkflow(id)
      }
      store.load(loaded)
      wf.value = JSON.parse(JSON.stringify(loaded))
    } catch (e) {
      toast.error(`加载失败: ${(e as Error).message}`)
    }
  }

  async function onLoad() {
    try {
      await refreshProjectWorkflows()
      if (projectWorkflows.value.length === 0) {
        toast.info('暂无可加载的工作流')
        return
      }
      showLoadDropdown.value = true
    } catch (e) {
      toast.error(`加载失败: ${(e as Error).message}`)
    }
  }

  function openNewWorkflowModal() {
    newWorkflowName.value = '新工作流'
    showNewWorkflowModal.value = true
  }

  function confirmNewWorkflow() {
    showNewWorkflowModal.value = false
    const name = newWorkflowName.value.trim() || '新工作流'
    const fresh = store.create(name)
    wf.value = JSON.parse(JSON.stringify(fresh))
    store.dirty = false
    showNewWorkflowToast.value = true
    setTimeout(() => { showNewWorkflowToast.value = false }, 2000)
  }

  function onRename(name: string) {
    store.rename(name)
    wf.value.name = name
  }

  return {
    projectWorkflows, loadingWorkflows, showLoadDropdown,
    showNewWorkflowModal, newWorkflowName, showNewWorkflowToast,
    refreshProjectWorkflows, onSave, onLoadById, onLoad,
    openNewWorkflowModal, confirmNewWorkflow, onRename,
  }
}
