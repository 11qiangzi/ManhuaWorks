<!--
/**
 * WorkflowDesignerView · 工作流设计面板
 *
 * ⚠️ 大组件 (1400+ 行) — 已拆分为多个 composable:
 *   - useDragDrop: 拖拽交互
 *   - useWorkflowRunner: 运行状态管理
 *   - useTheme: 主题切换
 *   - useWorkflowPersistence: 工作流持久化/加载/保存
 *   - useWorkflowExecution: 工作流执行/重试/调试
 *   - useAgentChat: AI Agent 对话
 *
 * 建议进一步拆分:
 *   - NodePalette / NodeCanvas / NodeInspector / Toolbar / MiniMap 已为独立组件 ✅
 *   - EventPanel: 事件面板可独立为组件 (~50行模板+样式)
 *   - AgentChatPanel: AI 对话面板可独立为组件 (~80行模板+样式)
 *
 * 当前状态: 架构合理，composable 拆分到位，样式部分较大 (~800行) 可提取为独立 CSS
 */
-->

<script setup lang="ts">
/**
 * WorkflowDesignerView.vue — 工作流设计面板
 * 林染 🔮 2026-06-10: 参考阅文「个人画布」重设计
 * P3-3: 拆分为 4 个 composable，script 从 624 行精简至 ~180 行
 */
import { ref, computed, onMounted, onUnmounted, watch, provide, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkflowStore } from '../stores/workflow'
import { useDragDrop } from '../composables/useDragDrop'
import { useWorkflowRunner } from '../composables/useWorkflowRunner'
import { useTheme } from '../composables/useTheme'
import { useWorkflowPersistence } from '../composables/useWorkflowPersistence'
import { useWorkflowExecution } from '../composables/useWorkflowExecution'
import { useAgentChat } from '../composables/useAgentChat'
import NodePalette from '../components/workflow/NodePalette.vue'
import NodeCanvas from '../components/workflow/NodeCanvas.vue'
import NodeInspector from '../components/workflow/NodeInspector.vue'
import Toolbar from '../components/workflow/Toolbar.vue'
import MiniMap from '../components/workflow/MiniMap.vue'
import type { Workflow, NodeDefinition } from '../types/workflow'
import { NODE_DEFINITIONS } from '../types/workflow'
import type { NodeType, NodeStatus } from '@manhuaworks/shared-types'
import { NODE_TYPE_LABELS } from '@manhuaworks/shared-types'

const store = useWorkflowStore()
const dragDrop = useDragDrop()
const runner = useWorkflowRunner()
const router = useRouter()

provide('dragDrop', dragDrop)

const wf = ref<Workflow>(
  store.current && store.current.nodes.length > 0
    ? { ...store.current }
    : store.create('我的第一个工作流'),
)
const selection = ref<{ nodeIds: string[]; edgeIds: string[] }>({ nodeIds: [], edgeIds: [] })

function syncToStore() {
  if (store.current) {
    store.current.nodes = wf.value.nodes
    store.current.edges = wf.value.edges
    store.current.viewport = wf.value.viewport
  }
}

// ── composable: 主题 ──
const { theme, applyTheme } = useTheme()

// ── composable: 持久化 ──
const {
  projectWorkflows, loadingWorkflows, showLoadDropdown,
  showNewWorkflowModal, newWorkflowName, showNewWorkflowToast,
  refreshProjectWorkflows, onSave, onLoadById, onLoad,
  openNewWorkflowModal, confirmNewWorkflow, onRename,
} = useWorkflowPersistence(wf)

// ── composable: 执行 ──
const {
  executionStatus, useLocalFallback,
  onRun: execRun, onRetryNode, onDebug, onCancel, stopPolling,
} = useWorkflowExecution(wf)

// ── composable: AI Agent ──
const {
  agentMessages, agentInput, agentLoading, quickCommands,
  sendAgentCommand, handleAgentKeydown,
} = useAgentChat()

const agentChatEl = ref<HTMLElement | null>(null)

watch(agentMessages, () => {
  nextTick(() => {
    if (agentChatEl.value) {
      agentChatEl.value.scrollTop = agentChatEl.value.scrollHeight
    }
  })
}, { deep: true })

// ========== 撤销/重做 — 最多 50 步的节点/边状态栈 ==========
const undoStack = ref<string[]>([])
const redoStack = ref<string[]>([])

function pushUndo() {
  undoStack.value.push(JSON.stringify({ nodes: wf.value.nodes, edges: wf.value.edges }))
  redoStack.value = []
  if (undoStack.value.length > 50) undoStack.value.shift()
}

function onUndo() {
  if (!undoStack.value.length) return
  redoStack.value.push(JSON.stringify({ nodes: wf.value.nodes, edges: wf.value.edges }))
  const state = JSON.parse(undoStack.value.pop()!)
  wf.value.nodes = state.nodes
  wf.value.edges = state.edges
  syncToStore()
  store.dirty = true
}

function onRedo() {
  if (!redoStack.value.length) return
  undoStack.value.push(JSON.stringify({ nodes: wf.value.nodes, edges: wf.value.edges }))
  const state = JSON.parse(redoStack.value.pop()!)
  wf.value.nodes = state.nodes
  wf.value.edges = state.edges
  syncToStore()
  store.dirty = true
}

// ========== 面板折叠 — 节点面板/属性面板/事件面板/AI面板的展开/收起 ==========
const showPalette = ref(true)
const showInspector = ref(false)
const showEventPanel = ref(false)
const showAgent = ref(true)

const selectedNode = computed(() =>
  wf.value.nodes.find(n => selection.value.nodeIds.includes(n.id)) ?? null,
)
const selectedDef = computed<NodeDefinition | null>(() => {
  if (!selectedNode.value) return null
  return NODE_DEFINITIONS.find(d => d.type === selectedNode.value!.type) ?? null
})

watch(selectedNode, (n) => { if (n) showInspector.value = true })

// ========== 运行桥接 — 连接执行 composable 与事件面板 ==========
function onRun() { execRun(() => { showEventPanel.value = true }) }

// ========== 画布操作 — 缩放/节点增删移选/连线/双击/键盘快捷键 ==========
function onZoomIn() { wf.value.viewport.zoom = Math.min(2, wf.value.viewport.zoom * 1.2) }
function onZoomOut() { wf.value.viewport.zoom = Math.max(0.25, wf.value.viewport.zoom / 1.2) }
function onZoomReset() { wf.value.viewport = { x: 0, y: 0, zoom: 1 } }

function onAddNode(type: string, pos: { x: number; y: number }) {
  const def = NODE_DEFINITIONS.find(d => d.type === type)
  if (!def) return
  const id = `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  pushUndo()
  wf.value.nodes = [...wf.value.nodes, {
    id, type, position: pos,
    size: def.size ?? { width: 180, height: 100 },
    params: { ...def.defaultParams },
    status: 'idle' as const,
  }]
  selection.value = { nodeIds: [id], edgeIds: [] }
  store.dirty = true
  syncToStore()
}

function onMoveNode(id: string, pos: { x: number; y: number }, record: boolean) {
  const node = wf.value.nodes.find(n => n.id === id)
  if (!node) return
  node.position = pos
  if (record) {
    pushUndo()
    store.dirty = true
    syncToStore()
  }
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
function onDblClickNode(nodeId: string) { router.push(`/workflow/node/${nodeId}`) }
function goToBatchGenerate() { router.push('/workflow/batch') }

function onAddEdge(source: string, sourcePort: string, target: string, targetPort: string) {
  if (source === target) return
  if (wf.value.edges.some(e =>
    e.source === source && e.sourcePort === sourcePort &&
    e.target === target && e.targetPort === targetPort,
  )) return
  pushUndo()
  wf.value.edges = [...wf.value.edges, {
    id: `edge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    source, sourcePort, target, targetPort,
  }]
  store.dirty = true
  syncToStore()
}

function onRemoveNode(id: string) {
  pushUndo()
  wf.value.nodes = wf.value.nodes.filter(n => n.id !== id)
  wf.value.edges = wf.value.edges.filter(e => e.source !== id && e.target !== id)
  selection.value.nodeIds = selection.value.nodeIds.filter(x => x !== id)
  store.dirty = true
  syncToStore()
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
    if (selection.value.edgeIds.length > 0 && store.current) {
      const deleteSet = new Set(selection.value.edgeIds)
      store.current.edges = store.current.edges.filter(e => !deleteSet.has(e.id))
      wf.value.edges = wf.value.edges.filter(e => !deleteSet.has(e.id))
      selection.value = { nodeIds: [], edgeIds: [] }
      store.dirty = true
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
  })),
)

const defMap = computed(() => {
  const m = new Map<string, NodeDefinition>()
  for (const d of NODE_DEFINITIONS) m.set(d.type, d)
  return m
})

function pipelineLabel(type: string): string {
  return NODE_TYPE_LABELS[type as NodeType] ?? defMap.value.get(type)?.label ?? type
}

function nodeError(nodeId: string): string {
  const n = wf.value.nodes.find(x => x.id === nodeId) as { error?: string } | undefined
  return n?.error ?? ''
}
</script>

<template>
  <div class="wf-root">
    <!-- ===== 工具栏 ===== -->
    <Toolbar
      :workflow-name="wf.name"
      :dirty="store.dirty"
      :can-undo="undoStack.length > 0"
      :can-redo="redoStack.length > 0"
      :is-running="runner.isRunning.value || executionStatus === 'running'"
      :theme="theme"
      :node-count="wf.nodes.length"
      :edge-count="wf.edges.length"
      @rename="onRename"
      @save="onSave"
      @load="onLoad"
      @run="onRun"
      @debug="onDebug(() => { showEventPanel = true })"
      @cancel="onCancel"
      @undo="onUndo"
      @redo="onRedo"
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

          <button
            class="wf-load-btn"
            @click="goToBatchGenerate"
          >
            📦 批量生成
          </button>

          <button
            class="wf-load-btn"
            @click="router.push('/workflow/branch')"
          >
            🌿 分支配置
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

          <!-- 🆕 空状态引导 (overlay, 不阻挡画布拖拽) -->
          <div v-if="isEmpty" class="wf-empty">
            <div class="wf-empty-inner">
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
          </div>

          <!-- 节点画布 (始终渲染，空时接受拖拽放置) -->
          <NodeCanvas
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
            @dblclick-node="onDblClickNode"
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
            <div v-for="msg in agentMessages" :key="msg.timestamp" class="wf-agent-msg" :class="`wf-agent-msg--${msg.role === 'assistant' ? 'agent' : msg.role}`">
              <div class="wf-agent-msg-avatar">{{ msg.role === 'assistant' ? '🤖' : '👤' }}</div>
              <div class="wf-agent-msg-body">
                <div class="wf-agent-msg-text">{{ msg.content }}</div>
                <div class="wf-agent-msg-time">{{ new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</div>
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
              @click="sendAgentCommand(cmd.cmd)"
            >{{ cmd.label }}</button>
          </div>

          <!-- 输入区 -->
          <div class="wf-agent-input-wrap">
            <textarea
              v-model="agentInput"
              class="wf-agent-input"
              placeholder="输入命令，如：帮我建一个动画生成流水线…"
              rows="2"
              :disabled="agentLoading"
              @keydown="handleAgentKeydown"
            ></textarea>
            <button
              class="wf-agent-send"
              :disabled="agentLoading || !agentInput.trim()"
              @click="sendAgentCommand()"
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

.wf-canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
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
  pointer-events: none;
  z-index: 5;
}

.wf-empty-inner {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border, #1f2937);
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
