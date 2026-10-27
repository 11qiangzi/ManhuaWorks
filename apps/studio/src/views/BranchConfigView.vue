<script setup lang="ts">
/**
 * BranchConfigView.vue — 条件分支配置
 * 从 workflow store 读取 condition 类型节点，编辑其 expression 参数
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkflowStore } from '../stores/workflow'
import { getApi } from '../api-bridge'
import { saveWorkflow } from '../api/orchestrator'
import type { WorkflowNode } from '../types/workflow'

const router = useRouter()
const store = useWorkflowStore()

const defaultRoute = ref('人工审核队列')

/** 从当前工作流中筛选所有 condition 类型节点 */
const conditionNodes = computed(() => {
  if (!store.current) return []
  return store.current.nodes.filter((n) => n.type === 'condition')
})

function goBack() {
  router.push('/workflow')
}

const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

/** 保存：更新节点参数到 store，标记 dirty，并持久化到后端或本地草稿 */
async function saveBranch() {
  saving.value = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    if (!store.current) throw new Error('没有可保存的工作流')
    store.markDirty()

    const payload = {
      ...store.current,
      updatedAt: Date.now(),
      version: (store.current.version ?? 0) + 1,
    }

    // Try api-bridge first (has auth headers), then fall back to orchestrator
    try {
      const api = getApi()
      await api.http.post('/v1/workflows', payload)
    } catch {
      await saveWorkflow(payload)
    }

    // Mark as clean on successful save
    store.dirty = false
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 2000)
  } catch (err: any) {
    // Persist as local draft so data isn't lost
    if (store.current) {
      try {
        localStorage.setItem('mhw.workflow.draft', JSON.stringify({
          ...store.current,
          _savedAt: Date.now(),
          _error: err.message,
        }))
      } catch { /* storage full — silently skip */ }
    }
    saveError.value = err.message || '保存失败'
  } finally {
    saving.value = false
  }
}

/** 更新某个 condition 节点的 expression */
function updateExpression(nodeId: string, value: string) {
  if (!store.current) return
  const node = store.current.nodes.find((n) => n.id === nodeId)
  if (node) {
    node.params = { ...node.params, expression: value }
    store.markDirty()
  }
}

/** 更新某个 condition 节点的 label */
function updateLabel(nodeId: string, value: string) {
  if (!store.current) return
  const node = store.current.nodes.find((n) => n.id === nodeId)
  if (node) {
    node.label = value
    store.markDirty()
  }
}

/** 添加一个新的 condition 节点到工作流 */
function addBranch() {
  if (!store.current) return
  const idx = conditionNodes.value.length
  const newNode: WorkflowNode = {
    id: `node_cond_${Date.now().toString(36)}`,
    type: 'condition',
    position: { x: 280, y: 40 + idx * 120 },
    size: { width: 180, height: 100 },
    params: { expression: 'input.length > 0' },
    label: `条件分支 ${idx + 1}`,
  }
  store.current.nodes.push(newNode)
  store.markDirty()
}

/** 删除某个 condition 节点 */
function deleteBranch(nodeId: string) {
  if (!store.current) return
  store.current.nodes = store.current.nodes.filter((n) => n.id !== nodeId)
  store.current.edges = store.current.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)
  store.markDirty()
}

/** 调色板：按索引循环取色 */
const branchColors = ['#34d399', '#f59e0b', '#ef4444', '#64748b', '#818cf8', '#ec4899', '#14b8a6', '#f97316']
function branchColor(i: number) {
  return branchColors[i % branchColors.length]
}
</script>

<template>
  <div class="branch-config">
    <div class="br-toolbar">
      <span class="br-title">🔄 {{ store.current?.name ?? '未加载工作流' }} · 条件分支</span>
      <span class="br-sub">条件节点数</span>
      <span class="br-count">{{ conditionNodes.length }} 条分支 · 1 条默认路由</span>
      <button class="btn btn-sm btn-primary" style="margin-left:auto" @click="saveBranch" :disabled="saving">{{ saving ? '保存中...' : saveSuccess ? '✅ 已保存' : '💾 保存' }}</button>
    </div>
    <div class="br-layout">
      <div class="br-canvas">
        <div class="br-node br-node--selected" style="top:20px;left:40px">
          <div class="br-node-header"><div class="br-node-dot" style="background:#fbbf24"></div><span>条件分支 🔀</span></div>
          <span class="br-node-sub">🔀 condition · {{ conditionNodes.length }} 分支</span>
        </div>
        <div
          v-for="(node, i) in conditionNodes"
          :key="node.id"
          class="br-node"
          :style="{ top: (160 + i * 120) + 'px', left: '280px', borderColor: branchColor(i) }"
        >
          <div class="br-node-header">
            <div class="br-node-dot" :style="{ background: branchColor(i) }"></div>
            <span>{{ node.label || `条件 ${i + 1}` }}</span>
          </div>
          <span class="br-node-sub">{{ node.params.expression }}</span>
        </div>
        <div v-if="conditionNodes.length === 0" class="br-empty-canvas">
          <span>暂无条件节点</span>
          <span class="br-empty-hint">点击右侧「+ 添加分支条件」创建</span>
        </div>
      </div>
      <div class="br-panel">
        <div class="section-title">🔀 条件分支配置</div>
        <p class="br-panel-desc">配置工作流中的条件分支节点，每个条件节点根据表达式结果路由到不同下游</p>

        <template v-if="conditionNodes.length > 0">
          <div
            v-for="(node, i) in conditionNodes"
            :key="node.id"
            class="branch-item"
            :class="{ active: i === 0 }"
          >
            <div class="branch-header">
              <span class="branch-label">
                <span class="branch-label-num" :style="{ background: branchColor(i) }">{{ String.fromCharCode(65 + i) }}</span>
                <input
                  class="branch-label-input"
                  :value="node.label || `条件 ${i + 1}`"
                  @input="updateLabel(node.id, ($event.target as HTMLInputElement).value)"
                >
              </span>
              <button class="branch-delete" @click="deleteBranch(node.id)" title="删除此条件">✕</button>
            </div>
            <div class="condition-row">
              <span class="cond-label">表达式</span>
              <input
                class="cond-value"
                :value="node.params.expression"
                @input="updateExpression(node.id, ($event.target as HTMLInputElement).value)"
              >
            </div>
            <div class="target-node">→ 节点 ID: {{ node.id }}</div>
          </div>
        </template>

        <div v-else class="br-empty-state">
          <div class="br-empty-icon">🔀</div>
          <div class="br-empty-text">暂无条件节点</div>
          <div class="br-empty-desc">点击下方按钮添加第一个条件分支</div>
        </div>

        <div class="add-branch" @click="addBranch">+ 添加分支条件</div>

        <div class="default-route">
          <div class="dr-title">⚡ 默认路由</div>
          <div class="dr-desc">当所有条件都不匹配时，走默认路径</div>
          <div class="dr-row">
            <span>默认 →</span>
            <select class="cond-select" v-model="defaultRoute">
              <option>人工审核队列</option>
              <option>直接丢弃</option>
              <option>重试</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.branch-config { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.br-toolbar { display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: var(--bg-secondary, #111827); border-bottom: 1px solid var(--border, #1e293b); }
.br-title { font-size: 13px; font-weight: 700; color: var(--text-primary, #e2e8f0); }
.br-sub { font-size: 10px; color: var(--text-muted, #64748b); }
.br-count { margin-left: auto; font-size: 10px; color: var(--text-muted, #64748b); }
.br-layout { display: flex; flex: 1; overflow: hidden; }
.br-canvas { flex: 1; background: radial-gradient(circle,rgba(99,102,241,.03) 1px,transparent 1px); background-size: 24px 24px; position: relative; }
.br-node { position: absolute; background: var(--bg-card, #141a2e); border: 1.5px solid var(--border, #1e293b); border-radius: 10px; padding: 10px 14px; font-size: 12px; }
.br-node--selected { border-color: var(--accent, #818cf8); }
.br-node-header { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; }
.br-node-dot { width: 6px; height: 6px; border-radius: 50%; }
.br-node-sub { font-size: 10px; color: var(--text-muted, #64748b); }
.br-panel { width: 440px; background: var(--bg-secondary, #111827); border-left: 1px solid var(--border, #1e293b); padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.br-panel-desc { font-size: 11px; color: var(--text-muted, #64748b); margin-top: -8px; }
.branch-item { padding: 14px; background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); }
.branch-item.active { border-color: var(--accent, #818cf8); }
.branch-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.branch-label { font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; color: var(--text-primary, #e2e8f0); }
.branch-label-num { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; }
.condition-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.cond-label { font-size: 10px; color: var(--text-muted, #64748b); width: 36px; }
.cond-select { padding: 5px 8px; border-radius: 6px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 11px; }
.cond-value { padding: 5px 8px; border-radius: 6px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 11px; flex: 1; }
.target-node { display: flex; align-items: center; gap: 6px; margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); font-size: 11px; color: var(--text-secondary, #94a3b8); }
.add-branch { padding: 10px; border: 1px dashed var(--border-strong, #334155); border-radius: 8px; text-align: center; cursor: pointer; color: var(--text-muted, #64748b); font-size: 12px; }
.add-branch:hover { border-color: var(--accent, #818cf8); color: var(--accent, #818cf8); }
.default-route { padding: 12px; background: rgba(245,158,11,.05); border: 1px dashed rgba(245,158,11,.3); border-radius: 8px; }
.dr-title { font-size: 11px; font-weight: 600; color: #fbbf24; margin-bottom: 4px; }
.dr-desc { font-size: 11px; color: var(--text-muted, #64748b); margin-bottom: 6px; }
.dr-row { display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--text-muted, #64748b); }
.section-title { font-size: 16px; font-weight: 700; color: var(--text-primary, #e2e8f0); margin-bottom: 12px; }
.badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-green { background: rgba(16,185,129,.15); color: #34d399; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all .2s; }
.btn-primary { background: var(--accent, #818cf8); color: #fff; }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.branch-label-input { background: transparent; border: none; border-bottom: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 12px; font-weight: 700; width: 120px; outline: none; }
.branch-label-input:focus { border-bottom-color: var(--accent, #818cf8); }
.branch-delete { background: none; border: none; color: var(--text-muted, #64748b); cursor: pointer; font-size: 12px; padding: 2px 6px; border-radius: 4px; }
.branch-delete:hover { color: #ef4444; background: rgba(239,68,68,.1); }
.br-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; gap: 8px; }
.br-empty-icon { font-size: 32px; opacity: .5; }
.br-empty-text { font-size: 13px; font-weight: 600; color: var(--text-secondary, #94a3b8); }
.br-empty-desc { font-size: 11px; color: var(--text-muted, #64748b); }
.br-empty-canvas { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--text-muted, #64748b); font-size: 12px; }
.br-empty-hint { font-size: 10px; opacity: .7; }
</style>
