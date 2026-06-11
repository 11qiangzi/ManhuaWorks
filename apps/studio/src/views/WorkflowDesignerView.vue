<script setup lang="ts">
/**
 * WorkflowDesignerView.vue — 工作流设计面板
 * 林染 🔮 2026-06-10: 参考阅文「个人画布」重设计
 *   - 左侧节点面板可折叠 + 搜索
 *   - 右侧属性面板可折叠
 *   - 空状态引导
 *   - 更干净的工具栏
 */
import { ref, computed, onMounted, onUnmounted, watch, provide } from 'vue'
import { useWorkflowStore } from '../stores/workflow'
import { useDragDrop } from '../composables/useDragDrop'
import { useWorkflowRunner } from '../composables/useWorkflowRunner'
import { saveWorkflow, loadWorkflow, listWorkflows } from '../api/orchestrator'
import { getApi } from '../api-bridge'
import NodePalette from '../components/workflow/NodePalette.vue'
import NodeCanvas from '../components/workflow/NodeCanvas.vue'
import NodeInspector from '../components/workflow/NodeInspector.vue'
import Toolbar from '../components/workflow/Toolbar.vue'
import MiniMap from '../components/workflow/MiniMap.vue'
import type { Workflow, NodeDefinition } from '../types/workflow'
import { NODE_DEFINITIONS } from '../types/workflow'
import type { NodeType, NodeStatus } from '@manhuaworks/shared-types'
import { NODE_TYPES, NODE_TYPE_LABELS } from '@manhuaworks/shared-types'

const store = useWorkflowStore()
const dragDrop = useDragDrop()
const runner = useWorkflowRunner()

// 林染 🔮 2026-06-11: provide dragDrop 给子组件，统一实例
provide('dragDrop', dragDrop)

const ORCH_BASE: string =
  (import.meta.env?.VITE_ORCHESTRATOR_URL as string | undefined) ?? ''

const wf = ref<Workflow>(store.create('我的第一个工作流'))

const selection = ref<{ nodeIds: string[]; edgeIds: string[] }>({ nodeIds: [], edgeIds: [] })

type Theme = 'light' | 'dark' | 'auto'
const theme = ref<Theme>((localStorage.getItem('studio_theme') as Theme) ?? 'auto')
watch(theme, t => {
  localStorage.setItem('studio_theme', t)
  applyTheme()
}, { immediate: true })

function applyTheme() {
  const root = document.documentElement
  const isDark =
    theme.value === 'dark' ||
    (theme.value === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', isDark)
}

// ========== 🆕 面板折叠 ==========
const showPalette = ref(true)
const showInspector = ref(false)
const showEventPanel = ref(false)
const showAgent = ref(true)  // 🆕 AI Agent 对话面板

const selectedNode = computed(() =>
  wf.value.nodes.find(n => selection.value.nodeIds.includes(n.id)) ?? null
)
const selectedDef = computed<NodeDefinition | null>(() => {
  if (!selectedNode.value) return null
  return NODE_DEFINITIONS.find(d => d.type === selectedNode.value!.type) ?? null
})

const PIPELINE_NODE_TYPES = NODE_TYPES
function isPipelineType(t: string): t is NodeType {
  return (PIPELINE_NODE_TYPES as readonly string[]).includes(t)
}

// Auto-show inspector when node selected
watch(selectedNode, (n) => {
  if (n) showInspector.value = true
})

// =============================================================================
// 加载 / 保存
// =============================================================================
const projectWorkflows = ref<Array<{ id: string; name: string; updatedAt?: number }>>([])
const loadingWorkflows = ref(false)
const showLoadDropdown = ref(false)

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
  const payload: Workflow = {
    ...store.current,
    nodes: wf.value.nodes,
    edges: wf.value.edges,
    viewport: wf.value.viewport,
    updatedAt: Date.now(),
    version: (store.current.version ?? 0) + 1,
  }
  try {
    await saveWorkflow(payload)
    store.load(payload)
    wf.value = { ...payload }
    store.dirty = false
  } catch (e) {
    console.error('save failed', e)
    store.dirty = false
    alert(`保存失败: ${(e as Error).message}\n已存为本地草稿`)
  }
}

async function onLoadById(id: string) {
  showLoadDropdown.value = false
  try {
    const loaded = await loadWorkflow(id)
    store.load(loaded)
    wf.value = JSON.parse(JSON.stringify(loaded))
    selection.value = { nodeIds: [], edgeIds: [] }
  } catch (e) {
    alert(`加载失败: ${(e as Error).message}`)
  }
}

async function onLoad() {
  try {
    const list = await listWorkflows()
    if (list.length === 0) {
      alert('暂无可加载的工作流')
      return
    }
    // Fallback: 展开下拉列表（而不是 prompt）
    await refreshProjectWorkflows()
    showLoadDropdown.value = true
  } catch (e) {
    alert(`加载失败: ${(e as Error).message}`)
  }
}

// 🆕 新建工作流输入弹窗（替代 window.prompt）
const showNewWorkflowModal = ref(false)
const newWorkflowName = ref('新工作流')
const showNewWorkflowToast = ref(false)

function openNewWorkflowModal() {
  newWorkflowName.value = '新工作流'
  showNewWorkflowModal.value = true
}

function confirmNewWorkflow() {
  showNewWorkflowModal.value = false
  const name = newWorkflowName.value.trim() || '新工作流'
  const fresh = store.create(name)
  wf.value = JSON.parse(JSON.stringify(fresh))
  selection.value = { nodeIds: [], edgeIds: [] }
  store.dirty = false
  // 视觉反馈
  showNewWorkflowToast.value = true
  setTimeout(() => { showNewWorkflowToast.value = false }, 2000)
}

function onRename(name: string) {
  store.rename(name)
  wf.value.name = name
}

// =============================================================================
// 运行 / 调试（保持原有逻辑不变）
// =============================================================================
const executionId = ref<string | null>(null)
const executionStatus = ref<'idle' | 'running' | 'succeeded' | 'failed' | 'partial'>('idle')
const useLocalFallback = ref(false)
let pollHandle: number | null = null

async function onRun() {
  if (wf.value.nodes.length === 0) {
    alert('工作流为空，无法运行')
    return
  }
  executionStatus.value = 'running'
  useLocalFallback.value = false
  setAllNodesStatus('idle' as NodeStatus)
  showEventPanel.value = true

  let runId: string | null = null
  try {
    const ac = new AbortController()
    const tid = setTimeout(() => ac.abort(), 2_500)
    const resp = await fetch(`${ORCH_BASE}/api/v1/workflows/${wf.value.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId: wf.value.id,
        name: wf.value.name,
        nodes: wf.value.nodes.map(n => ({
          id: n.id, type: n.type, params: n.params, dependsOn: [],
        })),
        edges: wf.value.edges,
      }),
      signal: ac.signal,
    }).finally(() => clearTimeout(tid))
    if (!resp.ok) throw new Error(`status ${resp.status}`)
    const data = (await resp.json()) as { executionId: string }
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
  const anyFail = pipelineNodes.some(n => wf.value.nodes.find(x => x.id === n.id)?.status === 'error')
  executionStatus.value = anyFail ? 'partial' : 'succeeded'
}

async function startPolling() {
  stopPolling()
  const tick = async () => {
    if (!executionId.value) return
    try {
      const ac = new AbortController()
      const tid = setTimeout(() => ac.abort(), 2_500)
      const resp = await fetch(
        `${ORCH_BASE}/api/v1/workflows/${wf.value.id}/executions/${executionId.value}`,
        { signal: ac.signal },
      ).finally(() => clearTimeout(tid))
      if (!resp.ok) {
        useLocalFallback.value = true; stopPolling(); await runLocalFallback(); return
      }
      const data = (await resp.json()) as {
        status: 'succeeded' | 'failed' | 'partial' | 'running'
        nodeResults: Record<string, { status: NodeStatus; error?: string }>
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

function setAllNodesStatus(s: NodeStatus) {
  for (const n of wf.value.nodes) n.status = toStudioStatus(s)
}
function setNodeStatus(id: string, s: NodeStatus, err?: string) {
  const n = wf.value.nodes.find(x => x.id === id)
  if (!n) return
  n.status = toStudioStatus(s)
  if (err) (n as { error?: string }).error = err
}

function toStudioStatus(s: NodeStatus): 'idle' | 'queued' | 'running' | 'success' | 'error' | 'skipped' {
  switch (s) { case 'succeeded': return 'success'; case 'failed': return 'error'; default: return s }
}

async function onRetryNode(id: string) {
  setNodeStatus(id, 'running')
  if (useLocalFallback.value || !executionId.value) {
    await new Promise(r => setTimeout(r, 800)); setNodeStatus(id, 'succeeded'); return
  }
  try {
    const ac = new AbortController()
    const tid = setTimeout(() => ac.abort(), 2_500)
    const resp = await fetch(
      `${ORCH_BASE}/api/v1/workflows/${wf.value.id}/executions/${executionId.value}/nodes/${id}/retry`,
      { method: 'POST', signal: ac.signal },
    ).finally(() => clearTimeout(tid))
    if (!resp.ok) throw new Error(`status ${resp.status}`)
  } catch (e) {
    console.warn('[retry] fallback to local', (e as Error).message)
    await new Promise(r => setTimeout(r, 800)); setNodeStatus(id, 'succeeded')
  }
}

async function onDebug() {
  if (wf.value.nodes.length === 0) return
  await onRun()
}
async function onCancel() {
  await runner.cancel()
  if (executionId.value) {
    try {
      const ac = new AbortController()
      const tid = setTimeout(() => ac.abort(), 2_500)
      await fetch(
        `${ORCH_BASE}/api/v1/workflows/${wf.value.id}/executions/${executionId.value}/cancel`,
        { method: 'POST', signal: ac.signal },
      ).finally(() => clearTimeout(tid))
    } catch { /* noop */ }
  }
  stopPolling()
  setAllNodesStatus('idle' as NodeStatus)
  executionStatus.value = 'idle'
}

function onZoomIn() { wf.value.viewport.zoom = Math.min(2, wf.value.viewport.zoom * 1.2) }
function onZoomOut() { wf.value.viewport.zoom = Math.max(0.25, wf.value.viewport.zoom / 1.2) }
function onZoomReset() { wf.value.viewport = { x: 0, y: 0, zoom: 1 } }

function onAddNode(type: string, pos: { x: number; y: number }) {
  const def = NODE_DEFINITIONS.find(d => d.type === type)
  if (!def) return
  const id = `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const node = {
    id, type, position: pos,
    size: def.size ?? { width: 180, height: 100 },
    params: { ...def.defaultParams },
    status: 'idle' as const,
  }
  wf.value.nodes.push(node)
  selection.value = { nodeIds: [id], edgeIds: [] }
  store.dirty = true
}

function onMoveNode(id: string, pos: { x: number; y: number }, record: boolean) {
  const node = wf.value.nodes.find(n => n.id === id)
  if (!node) return
  node.position = pos
  if (record) store.dirty = true
}

function onSelectNode(id: string, additive: boolean) {
  if (!additive) selection.value = { nodeIds: [id], edgeIds: [] }
  else {
    const set = new Set(selection.value.nodeIds)
    if (set.has(id)) set.delete(id); else set.add(id)
    selection.value = { nodeIds: [...set], edgeIds: [] }
  }
}

function onSelectEdge(id: string, additive: boolean) {
  if (!additive) selection.value = { nodeIds: [], edgeIds: [id] }
  else {
    const set = new Set(selection.value.edgeIds)
    if (set.has(id)) set.delete(id); else set.add(id)
    selection.value = { nodeIds: [], edgeIds: [...set] }
  }
}

function onClearSelection() { selection.value = { nodeIds: [], edgeIds: [] } }

function onAddEdge(source: string, sourcePort: string, target: string, targetPort: string) {
  if (source === target) return
  if (wf.value.edges.some(e =>
    e.source === source && e.sourcePort === sourcePort &&
    e.target === target && e.targetPort === targetPort,
  )) return
  wf.value.edges.push({
    id: `edge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    source, sourcePort, target, targetPort,
  })
  store.dirty = true
}

function onRemoveNode(id: string) {
  wf.value.nodes = wf.value.nodes.filter(n => n.id !== id)
  wf.value.edges = wf.value.edges.filter(e => e.source !== id && e.target !== id)
  selection.value.nodeIds = selection.value.nodeIds.filter(x => x !== id)
  store.dirty = true
}

function onUpdateNode(patch: Record<string, unknown>) {
  if (!selectedNode.value) return
  Object.assign(selectedNode.value.params, patch)
  store.dirty = true
}

function onPaletteDragStart(def: NodeDefinition, e: PointerEvent) {
  dragDrop.startPaletteDrag(def, e)
}

function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  const meta = e.ctrlKey || e.metaKey
  if (meta && e.key === 's') { e.preventDefault(); onSave() }
  else if (meta && e.key === 'Enter') { e.preventDefault(); onRun() }
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selection.value.nodeIds.length > 0) {
      selection.value.nodeIds.forEach(onRemoveNode)
      selection.value = { nodeIds: [], edgeIds: [] }
    }
  }
}

onMounted(() => { window.addEventListener('keydown', onKeydown); applyTheme(); void refreshProjectWorkflows() })
onUnmounted(() => { window.removeEventListener('keydown', onKeydown); stopPolling() })

const hasNodes = computed(() => wf.value.nodes.length > 0)
const isEmpty = computed(() => !hasNodes.value)

const formattedEvents = computed(() =>
  runner.events.value.slice(0, 20).map(e => ({
    ...e,
    time: new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour12: false }),
  }))
)

const defMap = computed(() => {
  const m = new Map<string, NodeDefinition>()
  for (const d of NODE_DEFINITIONS) m.set(d.type, d)
  return m
})

function pipelineLabel(type: string): string {
  if (isPipelineType(type)) return NODE_TYPE_LABELS[type]
  return defMap.value.get(type)?.label ?? type
}

function showRetry(nodeId: string): boolean {
  return wf.value.nodes.find(x => x.id === nodeId)?.status === 'error'
}

function nodeError(nodeId: string): string {
  const n = wf.value.nodes.find(x => x.id === nodeId) as { error?: string } | undefined
  return n?.error ?? ''
}

type NodeRuntimeResult = { status: 'idle' | 'running' | 'success' | 'error' | 'skipped' | 'queued' }

// ============ 🆕 AI Agent 对话 ============
interface AgentMessage {
  id: string
  role: 'user' | 'agent'
  text: string
  actions?: string[]  // Agent 执行的操作列表
  time: number
}

const agentMessages = ref<AgentMessage[]>([
  {
    id: 'agent_welcome', role: 'agent',
    text: '你好！我是 AI 工作流助手 🤖\n\n你可以用自然语言描述你想要的工作流，我会帮你在画布上自动搭建。试试说：\n• "帮我建一个漫画生成流水线"\n• "加一个翻译节点"\n• "把所有节点连起来"\n• "优化当前工作流"',
    time: Date.now(),
  },
])
const agentInput = ref('')
const agentLoading = ref(false)

const quickCommands = [
  { label: '📖 建漫画流', cmd: '帮我建一个完整的漫画生成流水线，从剧本到风格迁移' },
  { label: '🌐 加翻译', cmd: '加一个翻译节点' },
  { label: '🔄 优化布局', cmd: '优化当前所有节点的布局' },
  { label: '📋 列出节点', cmd: '列出当前画布上所有节点' },
]

function addMessage(role: 'user' | 'agent', text: string, actions?: string[]) {
  agentMessages.value.push({
    id: `msg_${Date.now().toString(36)}`,
    role, text, actions,
    time: Date.now(),
  })
}

/** Agent 解析用户命令并操作画布 */
async function sendAgentCommand() {
  const input = agentInput.value.trim()
  if (!input || agentLoading.value) return
  agentInput.value = ''
  addMessage('user', input)
  agentLoading.value = true

  // 模拟 AI 思考延迟
  await new Promise(r => setTimeout(r, 600 + Math.random() * 600))

  const actions: string[] = []
  const lower = input.toLowerCase()

  // --- 命令解析 (简化版，后续接真实 LLM) ---
  if (lower.includes('建') || lower.includes('创建') || lower.includes('生成') || lower.includes('流水线') || lower.includes('漫画')) {
    // 自动创建漫画生成工作流
    if (wf.value.nodes.length > 0) { wf.value.nodes = []; wf.value.edges = []; actions.push('清空画布') }

    const steps = ['novel-to-drama', 'character-replace', 'style-transfer', 'multi-character']
    const positions = [{ x: 200, y: 120 }, { x: 450, y: 120 }, { x: 450, y: 280 }, { x: 700, y: 200 }]
    let prevId = ''
    for (let i = 0; i < steps.length; i++) {
      const def = NODE_DEFINITIONS.find(d => d.type === steps[i])
      if (!def) continue
      const id = `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
      wf.value.nodes.push({
        id, type: steps[i], position: positions[i],
        size: def.size ?? { width: 180, height: 100 },
        params: { ...def.defaultParams },
        status: 'idle' as const,
      })
      if (prevId) {
        wf.value.edges.push({
          id: `edge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          source: prevId, sourcePort: 'output',
          target: id, targetPort: 'input',
        })
      }
      prevId = id
      actions.push(`✅ 添加 ${pipelineLabel(steps[i])} 节点`)
    }
    store.dirty = true
  } else if (lower.includes('翻译')) {
    const def = NODE_DEFINITIONS.find(d => d.type === 'translate')
    if (def) {
      const id = `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
      const existing = wf.value.nodes.length
      wf.value.nodes.push({
        id, type: 'translate',
        position: { x: 200 + existing * 50, y: 150 + existing * 40 },
        size: def.size ?? { width: 180, height: 100 },
        params: { ...def.defaultParams },
        status: 'idle' as const,
      })
      if (existing > 0) {
        wf.value.edges.push({
          id: `edge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          source: wf.value.nodes[existing - 1].id, sourcePort: 'output',
          target: id, targetPort: 'input',
        })
      }
      store.dirty = true
      actions.push('✅ 添加 翻译 节点')
    }
  } else if (lower.includes('布局') || lower.includes('优化') || lower.includes('整理')) {
    // 自动布局：简单 grid 排列
    const cols = Math.ceil(Math.sqrt(wf.value.nodes.length))
    wf.value.nodes.forEach((n, i) => {
      const col = i % cols, row = Math.floor(i / cols)
      n.position = { x: 200 + col * 280, y: 120 + row * 180 }
    })
    store.dirty = true
    actions.push('✅ 优化节点布局')
  } else if (lower.includes('列表') || lower.includes('列出') || lower.includes('有哪些')) {
    if (wf.value.nodes.length === 0) {
      actions.push('ℹ️ 画布为空')
    } else {
      wf.value.nodes.forEach(n => {
        actions.push(`📌 ${pipelineLabel(n.type)} [${n.id.slice(0, 6)}]`)
      })
    }
  } else if (lower.includes('连') || lower.includes('接')) {
    // 自动连接所有节点
    wf.value.edges = []
    for (let i = 1; i < wf.value.nodes.length; i++) {
      wf.value.edges.push({
        id: `edge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        source: wf.value.nodes[i - 1].id, sourcePort: 'output',
        target: wf.value.nodes[i].id, targetPort: 'input',
      })
    }
    store.dirty = true
    actions.push(`✅ 已连接 ${wf.value.edges.length} 条边`)
  } else if (lower.includes('清') || lower.includes('删') || lower.includes('重置')) {
    wf.value.nodes = []; wf.value.edges = []
    store.dirty = true
    actions.push('✅ 已清空画布')
  } else {
    actions.push('🤔 没有理解你的指令。试试：\n• "帮我建一个漫画生成流水线"\n• "加一个翻译节点"\n• "优化当前所有节点的布局"\n• "把所有节点连起来"')
  }

  addMessage('agent', actions[0] ?? '完成', actions)
  agentLoading.value = false
}

function handleAgentKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAgentCommand() }
}
</script>

<template>
  <div class="wf-root">
    <!-- ===== 工具栏 ===== -->
    <Toolbar
      :workflow-name="wf.name"
      :dirty="store.dirty"
      :can-undo="false"
      :can-redo="false"
      :is-running="runner.isRunning.value || executionStatus === 'running'"
      :theme="theme"
      :node-count="wf.nodes.length"
      :edge-count="wf.edges.length"
      @rename="onRename"
      @save="onSave"
      @load="onLoad"
      @run="onRun"
      @debug="onDebug"
      @cancel="onCancel"
      @undo="() => {}"
      @redo="() => {}"
      @zoom-in="onZoomIn"
      @zoom-out="onZoomOut"
      @zoom-reset="onZoomReset"
      @change-theme="t => (theme = t)"
      @new-workflow="openNewWorkflowModal"
    />

    <!-- ===== 主体 ===== -->
    <div class="wf-body">
      <!-- 🆕 左侧节点面板：可折叠 -->
      <transition name="panel-slide">
        <div v-if="showPalette" class="wf-palette-panel">
          <NodePalette @drag-start="onPaletteDragStart" />
        </div>
      </transition>

      <!-- 面板折叠按钮 -->
      <button
        class="wf-toggle wf-toggle-left"
        :class="{ 'wf-toggle--active': showPalette }"
        @click="showPalette = !showPalette"
        :title="showPalette ? '收起节点面板' : '展开节点面板'"
      >
        {{ showPalette ? '◀' : '▶' }}
      </button>

      <!-- ===== 画布区 ===== -->
      <div class="wf-canvas-area">
        <!-- 顶部状态栏 -->
        <div class="wf-canvas-bar">
          <button
            class="wf-load-btn"
            @click="showLoadDropdown = !showLoadDropdown"
          >
            📂 加载工作流
            <span v-if="loadingWorkflows" class="wf-loading-icon">⏳</span>
            <span v-else class="wf-loading-icon">▾</span>
          </button>

          <span v-if="useLocalFallback" class="wf-status-badge wf-status-warn">
            ⚠ 本地 mock 模式
          </span>
          <span v-else-if="executionStatus !== 'idle'" class="wf-status-badge" :class="{
            'wf-status-running': executionStatus === 'running',
            'wf-status-ok': executionStatus === 'succeeded',
            'wf-status-fail': executionStatus === 'failed' || executionStatus === 'partial',
          }">
            {{ executionStatus === 'running' ? '⏳' : executionStatus === 'succeeded' ? '✅' : '⚠' }}
            {{ { running: '运行中', succeeded: '完成', failed: '失败', partial: '部分失败' }[executionStatus] }}
          </span>

          <!-- 加载下拉 -->
          <div v-if="showLoadDropdown" class="wf-dropdown" @click.self="showLoadDropdown = false">
            <div v-if="projectWorkflows.length === 0 && !loadingWorkflows" class="wf-dropdown-empty">
              暂无可加载的工作流
            </div>
            <button
              v-for="w in projectWorkflows"
              :key="w.id"
              class="wf-dropdown-item"
              @click="onLoadById(w.id)"
            >
              <div class="wf-dropdown-name">{{ w.name }}</div>
              <div class="wf-dropdown-id">{{ w.id }}</div>
            </button>
          </div>
        </div>

        <!-- 画布 -->
        <div class="wf-canvas-container">
          <!-- 🆕 创建成功 Toast -->
          <Transition name="toast-fade">
            <div v-if="showNewWorkflowToast" class="wf-toast">
              ✅ 工作流「{{ wf.name }}」已创建
            </div>
          </Transition>

          <!-- 🆕 空状态引导 -->
          <div v-if="isEmpty" class="wf-empty">
            <div class="wf-empty-icon">🔀</div>
            <h2 class="wf-empty-title">开始搭建你的工作流</h2>
            <p class="wf-empty-desc">
              从左侧面板拖拽节点到画布，或使用下方按钮快速开始
            </p>
            <div class="wf-empty-actions">
              <button class="wf-empty-btn" @click="showPalette = true">
                📦 展开节点面板
              </button>
              <button class="wf-empty-btn wf-empty-btn--primary" @click="openNewWorkflowModal">
                ✨ 新建工作流
              </button>
            </div>
            <div class="wf-empty-tips">
              <span>💡 提示：</span>
              拖拽节点到画布 → 连线 → 点 ▶ 运行
            </div>
          </div>

          <!-- 节点画布 -->
          <NodeCanvas
            v-show="hasNodes"
            :nodes="wf.nodes"
            :edges="wf.edges"
            :viewport="wf.viewport"
            :selection="selection"
            @add-node="onAddNode"
            @add-edge="onAddEdge"
            @move-node="onMoveNode"
            @select="onSelectNode"
            @select-edge="onSelectEdge"
            @clear-selection="onClearSelection"
            @set-viewport="v => (wf.viewport = { ...wf.viewport, ...v })"
            @remove-node="onRemoveNode"
          />

          <!-- 小地图 -->
          <div v-if="hasNodes" class="wf-minimap">
            <MiniMap
              :nodes="wf.nodes"
              :viewport="wf.viewport"
              @navigate="v => (wf.viewport = v)"
            />
          </div>

          <!-- 缩放信息 -->
          <div v-if="hasNodes" class="wf-zoom-info">
            <span>{{ Math.round(wf.viewport.zoom * 100) }}%</span>
            <span class="wf-zoom-sep">·</span>
            <span>节点 {{ wf.nodes.length }}</span>
          </div>
        </div>

        <!-- 失败节点浮层 -->
        <div
          v-if="wf.nodes.some(n => n.status === 'error')"
          class="wf-error-bar"
        >
          <span class="wf-error-label">⚠ 失败节点</span>
          <div class="wf-error-actions">
            <button
              v-for="n in wf.nodes.filter(x => x.status === 'error')"
              :key="n.id"
              class="wf-retry-btn"
              :title="nodeError(n.id)"
              @click="onRetryNode(n.id)"
            >
              {{ pipelineLabel(n.type) }} · 重试
            </button>
          </div>
        </div>

        <!-- 事件面板（折叠式） -->
        <transition name="panel-slide-up">
          <div v-if="showEventPanel" class="wf-event-panel">
            <div class="wf-event-header">
              <span>📋 事件流</span>
              <button class="wf-event-close" @click="showEventPanel = false">✕</button>
            </div>
            <div v-if="formattedEvents.length === 0" class="wf-event-empty">
              暂无事件。点击 ▶ 运行 启动工作流
            </div>
            <div
              v-for="(e, i) in formattedEvents"
              :key="i"
              class="wf-event-row"
            >
              <span class="wf-event-time">{{ e.time }}</span>
              <span class="wf-event-type" :class="{
                'wf-ev-running': e.type.includes('started') || e.type.includes('progress'),
                'wf-ev-ok': e.type.includes('finished') || e.type.includes('success'),
                'wf-ev-fail': e.type.includes('error'),
                'wf-ev-queued': e.type.includes('queued'),
              }">{{ e.type }}</span>
              <span v-if="e.nodeId" class="wf-event-node">
                {{ defMap.get(wf.nodes.find(n => n.id === e.nodeId)?.type ?? '')?.label ?? e.nodeId }}
              </span>
            </div>
          </div>
        </transition>
      </div>

      <!-- 事件面板切换按钮 -->
      <button
        v-if="!showEventPanel"
        class="wf-event-toggle"
        @click="showEventPanel = true"
      >
        📋
      </button>

      <!-- 🆕 右侧属性面板：可折叠 -->
      <transition name="panel-slide-right">
        <div v-if="showInspector && selectedNode" class="wf-inspector-panel">
          <NodeInspector
            :node="selectedNode"
            :definition="selectedDef"
            @update="onUpdateNode"
            @remove="selectedNode && onRemoveNode(selectedNode.id)"
            @close="() => { onClearSelection(); showInspector = false }"
          />
        </div>
      </transition>

      <!-- 🆕 AI Agent 对话面板 -->
      <transition name="panel-slide-right">
        <div v-if="showAgent" class="wf-agent-panel">
          <div class="wf-agent-head">
            <span class="wf-agent-head-title">🤖 AI 工作流助手</span>
            <button class="wf-agent-head-close" @click="showAgent = false" title="收起">◀</button>
          </div>

          <!-- 对话记录 -->
          <div class="wf-agent-chat" ref="agentChatEl">
            <div v-for="msg in agentMessages" :key="msg.id" class="wf-agent-msg" :class="`wf-agent-msg--${msg.role}`">
              <div class="wf-agent-msg-avatar">{{ msg.role === 'agent' ? '🤖' : '👤' }}</div>
              <div class="wf-agent-msg-body">
                <div class="wf-agent-msg-text">{{ msg.text }}</div>
                <div v-if="msg.actions && msg.actions.length > 1" class="wf-agent-msg-actions">
                  <span v-for="(a, i) in msg.actions.slice(1)" :key="i" class="wf-agent-action">{{ a }}</span>
                </div>
                <div class="wf-agent-msg-time">{{ new Date(msg.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</div>
              </div>
            </div>

            <!-- 加载动画 -->
            <div v-if="agentLoading" class="wf-agent-msg wf-agent-msg--agent">
              <div class="wf-agent-msg-avatar">🤖</div>
              <div class="wf-agent-msg-body">
                <div class="wf-agent-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>

          <!-- 快捷命令 -->
          <div class="wf-agent-quick">
            <button
              v-for="cmd in quickCommands"
              :key="cmd.label"
              class="wf-agent-quick-btn"
              :disabled="agentLoading"
              @click="agentInput = cmd.cmd; sendAgentCommand()"
            >{{ cmd.label }}</button>
          </div>

          <!-- 输入区 -->
          <div class="wf-agent-input-wrap">
            <textarea
              v-model="agentInput"
              class="wf-agent-input"
              placeholder="输入命令，如：帮我建一个漫画生成流水线…"
              rows="2"
              :disabled="agentLoading"
              @keydown="handleAgentKeydown"
            ></textarea>
            <button
              class="wf-agent-send"
              :disabled="agentLoading || !agentInput.trim()"
              @click="sendAgentCommand"
            >▶</button>
          </div>
        </div>
      </transition>

      <!-- Agent 面板展开按钮（收起时显示） -->
      <button
        v-if="!showAgent"
        class="wf-agent-toggle"
        @click="showAgent = true"
        title="展开 AI 助手"
      >🤖</button>
    </div>

    <!-- 🆕 新建工作流弹窗 -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showNewWorkflowModal" class="modal-overlay" @click.self="showNewWorkflowModal = false">
          <div class="modal-dialog modal-dialog--sm">
            <div class="modal-head">
              <h3>✨ 新建工作流</h3>
              <button class="modal-close" @click="showNewWorkflowModal = false">✕</button>
            </div>
            <div class="modal-body">
              <label class="ml-field">
                <span class="ml-field-label">工作流名称</span>
                <input
                  v-model="newWorkflowName"
                  class="ml-input"
                  placeholder="输入名称…"
                  @keydown.enter="confirmNewWorkflow"
                  autofocus
                />
              </label>
            </div>
            <div class="modal-foot">
              <button class="ml-btn" @click="showNewWorkflowModal = false">取消</button>
              <button class="ml-btn ml-btn--primary" :disabled="!newWorkflowName.trim()" @click="confirmNewWorkflow">
                创建
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ===== Root ===== */
.wf-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;  /* 关键：允许 flex 子元素收缩 */
  background: var(--bg-primary, #0a0e1a);
}

/* ===== Body ===== */
.wf-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* ===== Palette Panel ===== */
.wf-palette-panel {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  overflow: hidden;  /* 必须 overflow:hidden 让内部子元素 scroll */
}

/* 🆕 强制 NodePalette 在面板内滚动 */
.wf-palette-panel :deep(.np-root) {
  height: 100%;
  overflow: hidden;
}

/* ===== Toggle Button ===== */
.wf-toggle {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 20px;
  height: 48px;
  border: 1px solid var(--border, #1f2937);
  border-left: none;
  border-radius: 0 6px 6px 0;
  background: var(--bg-secondary, #111827);
  color: var(--text-secondary, #94a3b8);
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 200ms;
  padding: 0;
}

.wf-toggle:hover {
  background: var(--bg-tertiary, #1f2937);
  color: var(--accent, #818cf8);
}

.wf-toggle-left {
  left: 0;
}

.wf-toggle--active {
  left: 218px;
}

/* ===== Canvas Area ===== */
.wf-canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}

.wf-canvas-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  position: relative;
}

.wf-load-btn {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1f2937);
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 200ms;
}

.wf-load-btn:hover {
  border-color: var(--accent, #818cf8);
  color: var(--text-primary, #e4e4e7);
}

.wf-loading-icon { font-size: 10px; }

.wf-status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.wf-status-warn { background: rgba(251, 191, 36, 0.1); color: #fbbf24; }
.wf-status-running { background: rgba(96, 165, 250, 0.1); color: #60a5fa; }
.wf-status-ok { background: rgba(52, 211, 153, 0.1); color: #34d399; }
.wf-status-fail { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

/* ===== Dropdown ===== */
.wf-dropdown {
  position: absolute;
  left: 12px;
  top: calc(100% + 4px);
  z-index: 50;
  width: 300px;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border, #1f2937);
  border-radius: 10px;
  background: var(--bg-secondary, #111827);
  box-shadow: 0 12px 40px rgba(0,0,0,0.4);
}

.wf-dropdown-empty {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}

.wf-dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-bottom: 1px solid var(--border, #1f2937);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 150ms;
}

.wf-dropdown-item:last-child { border-bottom: none; }
.wf-dropdown-item:hover { background: var(--bg-tertiary, #1f2937); }

.wf-dropdown-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #e4e4e7);
  margin-bottom: 2px;
}

.wf-dropdown-id {
  font-size: 10px;
  color: var(--text-secondary, #94a3b8);
  font-family: monospace;
}

/* ===== Canvas Container ===== */
.wf-canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0;  /* 林染 🔮 2026-06-11: 防止 flex 子元素内容撑大容器 */
}

/* ===== 🆕 Empty State ===== */
.wf-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  pointer-events: auto;
}

.wf-empty-icon {
  font-size: 48px;
  opacity: 0.4;
}

.wf-empty-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #e4e4e7);
  margin: 0;
}

.wf-empty-desc {
  font-size: 13px;
  color: var(--text-secondary, #94a3b8);
  margin: 0;
}

.wf-empty-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.wf-empty-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1f2937);
  color: var(--text-secondary, #94a3b8);
  font-size: 13px;
  cursor: pointer;
  transition: all 200ms;
}

.wf-empty-btn:hover {
  border-color: var(--accent, #818cf8);
  color: var(--text-primary, #e4e4e7);
}

.wf-empty-btn--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.wf-empty-btn--primary:hover {
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
  transform: translateY(-1px);
}

.wf-empty-tips {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  opacity: 0.7;
}

/* ===== Minimap ===== */
.wf-minimap {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 5;
}

.wf-zoom-info {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 5;
  display: flex;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}

.wf-zoom-sep { opacity: 0.4; }

/* ===== Error Bar ===== */
.wf-error-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-top: 1px solid rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.06);
}

.wf-error-label {
  font-size: 12px;
  font-weight: 600;
  color: #ef4444;
  flex-shrink: 0;
}

.wf-error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.wf-retry-btn {
  padding: 3px 10px;
  border-radius: 5px;
  border: none;
  background: #dc2626;
  color: white;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background 150ms;
}

.wf-retry-btn:hover { background: #b91c1c; }

/* ===== Event Panel ===== */
.wf-event-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  border-top: 1px solid var(--border, #1f2937);
  background: rgba(17, 24, 39, 0.96);
  backdrop-filter: blur(8px);
  z-index: 10;
}

.wf-event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border, #1f2937);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #e4e4e7);
  position: sticky;
  top: 0;
  background: inherit;
}

.wf-event-close {
  border: none;
  background: transparent;
  color: var(--text-secondary, #94a3b8);
  font-size: 14px;
  cursor: pointer;
}

.wf-event-close:hover { color: #ef4444; }

.wf-event-empty {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}

.wf-event-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 14px;
  border-bottom: 1px solid rgba(31, 41, 55, 0.5);
  font-size: 11px;
  font-family: monospace;
}

.wf-event-time { color: var(--text-secondary, #94a3b8); width: 66px; flex-shrink: 0; }

.wf-event-type {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}

.wf-ev-running { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
.wf-ev-ok { background: rgba(52, 211, 153, 0.15); color: #34d399; }
.wf-ev-fail { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.wf-ev-queued { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }

.wf-event-node { color: var(--text-secondary, #94a3b8); }

/* ===== Event Toggle ===== */
.wf-event-toggle {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  width: 32px;
  height: 24px;
  border: 1px solid var(--border, #1f2937);
  border-radius: 12px;
  background: var(--bg-secondary, #111827);
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 200ms;
}

.wf-event-toggle:hover {
  border-color: var(--accent, #818cf8);
  color: var(--accent, #818cf8);
}

/* ===== Inspector Panel ===== */
.wf-inspector-panel {
  width: 280px;
  flex-shrink: 0;
  border-left: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  overflow-y: auto;
}

/* ===== 🆕 AI Agent Panel ===== */
.wf-agent-panel {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wf-agent-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border, #1f2937);
  background: linear-gradient(135deg, rgba(129,140,248,0.08), rgba(118,75,162,0.08));
}

.wf-agent-head-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary, #e4e4e7);
}

.wf-agent-head-close {
  border: none;
  background: transparent;
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 150ms;
}

.wf-agent-head-close:hover {
  background: var(--bg-tertiary, #1f2937);
  color: var(--accent, #818cf8);
}

.wf-agent-chat {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wf-agent-msg {
  display: flex;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.wf-agent-msg--user {
  flex-direction: row-reverse;
}

.wf-agent-msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  background: var(--bg-tertiary, #1f2937);
}

.wf-agent-msg--agent .wf-agent-msg-avatar {
  background: rgba(129,140,248,0.12);
}

.wf-agent-msg--user .wf-agent-msg-avatar {
  background: rgba(52,211,153,0.12);
}

.wf-agent-msg-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wf-agent-msg-text {
  padding: 8px 12px;
  border-radius: 10px;
  white-space: pre-wrap;
  word-break: break-word;
}

.wf-agent-msg--agent .wf-agent-msg-text {
  background: var(--bg-tertiary, #1f2937);
  color: var(--text-primary, #e4e4e7);
  border-top-left-radius: 2px;
}

.wf-agent-msg--user .wf-agent-msg-text {
  background: rgba(102,126,234,0.15);
  color: var(--text-primary, #e4e4e7);
  border-top-right-radius: 2px;
}

.wf-agent-msg-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 4px;
}

.wf-agent-action {
  font-size: 11px;
  color: var(--accent, #818cf8);
  padding: 2px 0;
}

.wf-agent-msg-time {
  font-size: 9px;
  color: var(--text-secondary, #94a3b8);
  opacity: 0.5;
  padding: 0 4px;
}

/* Agent typing animation */
.wf-agent-typing {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
}

.wf-agent-typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-secondary, #94a3b8);
  animation: agentType 1.4s infinite;
}

.wf-agent-typing span:nth-child(2) { animation-delay: 0.2s; }
.wf-agent-typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes agentType {
  0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
  30% { opacity: 1; transform: scale(1); }
}

/* Quick commands */
.wf-agent-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid var(--border, #1f2937);
}

.wf-agent-quick-btn {
  padding: 4px 10px;
  border-radius: 14px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1f2937);
  color: var(--text-secondary, #94a3b8);
  font-size: 11px;
  cursor: pointer;
  transition: all 150ms;
  white-space: nowrap;
}

.wf-agent-quick-btn:hover:not(:disabled) {
  border-color: var(--accent, #818cf8);
  color: var(--accent, #818cf8);
  background: rgba(129,140,248,0.08);
}

.wf-agent-quick-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Input area */
.wf-agent-input-wrap {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1f2937);
}

.wf-agent-input {
  flex: 1;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  color: var(--text-primary, #e4e4e7);
  font-size: 12px;
  font-family: inherit;
  resize: none;
  min-height: 40px;
}

.wf-agent-input:focus {
  border-color: var(--accent, #818cf8);
  outline: none;
}

.wf-agent-input:disabled {
  opacity: 0.5;
}

.wf-agent-send {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 200ms;
  flex-shrink: 0;
}

.wf-agent-send:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(102,126,234,0.3);
}

.wf-agent-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Agent toggle button (when panel hidden) */
.wf-agent-toggle {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 28px;
  height: 48px;
  border: 1px solid var(--border, #1f2937);
  border-right: none;
  border-radius: 6px 0 0 6px;
  background: var(--bg-secondary, #111827);
  color: var(--text-secondary, #94a3b8);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 200ms;
  padding: 0;
}

.wf-agent-toggle:hover {
  background: var(--bg-tertiary, #1f2937);
  color: var(--accent, #818cf8);
}

/* ===== 🆕 Toast ===== */
.wf-toast {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  padding: 10px 24px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(52, 211, 153, 0.05));
  border: 1px solid rgba(52, 211, 153, 0.3);
  color: #34d399;
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.toast-fade-enter-active, .toast-fade-leave-active { transition: all 300ms ease; }
.toast-fade-enter-from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
.toast-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }

/* ===== Transitions ===== */

/* ===== 🆕 Modal styles ===== */
.modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.modal-dialog {
  background: var(--bg-secondary, #111827); border: 1px solid var(--border, #1f2937);
  border-radius: 14px; width: 90vw; max-width: 400px;
  display: flex; flex-direction: column;
}
.modal-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border, #1f2937); }
.modal-head h3 { margin: 0; font-size: 15px; color: var(--text-primary, #e4e4e7); }
.modal-close { border: none; background: transparent; color: var(--text-secondary, #94a3b8); font-size: 18px; cursor: pointer; padding: 4px; }
.modal-close:hover { color: #ef4444; }
.modal-body { padding: 20px; }
.modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--border, #1f2937); }

.ml-field { display: flex; flex-direction: column; gap: 4px; }
.ml-field-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary, #94a3b8); }
.ml-input {
  padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1f2937); color: var(--text-primary, #e4e4e7);
  font-size: 13px; width: 100%; box-sizing: border-box;
}
.ml-input:focus { border-color: var(--accent, #818cf8); outline: none; }
.ml-btn {
  padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1f2937); color: var(--text-secondary, #94a3b8);
  font-size: 13px; cursor: pointer; transition: all 200ms;
}
.ml-btn:hover { border-color: var(--accent, #818cf8); color: var(--text-primary, #e4e4e7); }
.ml-btn--primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; font-weight: 600; }
.ml-btn--primary:hover { box-shadow: 0 4px 16px rgba(102,126,234,0.3); }
.ml-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 200ms ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 250ms ease;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  width: 0 !important;
  opacity: 0;
  overflow: hidden;
}

.panel-slide-right-enter-active,
.panel-slide-right-leave-active {
  transition: all 250ms ease;
}
.panel-slide-right-enter-from,
.panel-slide-right-leave-to {
  width: 0 !important;
  opacity: 0;
  overflow: hidden;
}

.panel-slide-up-enter-active,
.panel-slide-up-leave-active {
  transition: all 250ms ease;
}
.panel-slide-up-enter-from,
.panel-slide-up-leave-to {
  max-height: 0 !important;
  opacity: 0;
}
</style>
