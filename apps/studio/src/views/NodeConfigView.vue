<script setup lang="ts">
/**
 * NodeConfigView.vue — 工作流节点配置 (1:1 复刻 studio-node-config.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 *
 * 2026-06 重构：连接 workflow store，移除 localStorage
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWorkflowStore } from '../stores/workflow'

const router = useRouter()
const route = useRoute()
const store = useWorkflowStore()

// --- form refs (defaults — will be overwritten by node params on mount) ---
const nodeModel = ref('标准模型')
const width = ref(1024)
const height = ref(1024)
const steps = ref(30)
const cfg = ref(7.5)
const seed = ref('-1 (随机)')
const positivePrompt = ref('{{character_prompt}}, {{scene_prompt}}, masterpiece, best quality, anime style')
const negativePrompt = ref('low quality, blurry, extra limbs, deformed')
const outputFormat = ref('PNG (默认)')
const autoRetry = ref(true)
const batchMode = ref(true)

// --- state ---
const nodeNotFound = ref(false)
const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

// --- resolve the node from the store ---
function findNode() {
  if (!store.current) return null
  return store.current.nodes.find(n => n.id === route.params.id) ?? null
}

const currentNode = computed(() => findNode())
const workflowName = computed(() => store.current?.name ?? '未命名工作流')
const nodeLabel = computed(() => currentNode.value?.type ?? '未知')

const incomingEdges = computed(() => {
  if (!store.current?.edges || !currentNode.value) return []
  return store.current.edges.filter((e: any) => e.target === currentNode.value!.id)
})

function incomingNodeName(edge: any): string {
  if (!store.current) return ''
  const src = store.current.nodes.find((n: any) => n.id === edge.source)
  return src ? `${src.label || src.type || '未知'} (${src.id})` : edge.source
}

// --- pre-populate form from node.params ---
onMounted(() => {
  const node = findNode()
  if (!node) {
    nodeNotFound.value = true
    return
  }
  const p = node.params ?? {}
  if (p.model != null) nodeModel.value = String(p.model)
  if (p.width != null) width.value = Number(p.width)
  if (p.height != null) height.value = Number(p.height)
  if (p.steps != null) steps.value = Number(p.steps)
  if (p.guidance != null) cfg.value = Number(p.guidance)
  if (p.cfg != null) cfg.value = Number(p.cfg)
  if (p.seed != null) seed.value = String(p.seed)
  if (p.positive != null) positivePrompt.value = String(p.positive)
  if (p.negative != null) negativePrompt.value = String(p.negative)
  if (p.outputFormat != null) outputFormat.value = String(p.outputFormat)
  if (p.autoRetry != null) autoRetry.value = Boolean(p.autoRetry)
  if (p.batchMode != null) batchMode.value = Boolean(p.batchMode)
})

// --- save back to store ---
async function saveNode() {
  saving.value = true; saveError.value = ''; saveSuccess.value = false
  try {
    const node = findNode()
    if (!node) {
      saveError.value = '节点未找到'
      return
    }
    node.params = {
      ...node.params,
      model: nodeModel.value,
      width: width.value,
      height: height.value,
      steps: steps.value,
      guidance: cfg.value,
      cfg: cfg.value,
      seed: seed.value,
      positive: positivePrompt.value,
      negative: negativePrompt.value,
      outputFormat: outputFormat.value,
      autoRetry: autoRetry.value,
      batchMode: batchMode.value,
    }
    store.markDirty()
    saveSuccess.value = true
  } catch (err: any) {
    saveError.value = err.message || '保存失败'
  } finally {
    saving.value = false
  }
}

function goBack() { router.push('/workflow') }
</script>

<template>
  <div class="node-config">
    <!-- Node not found state -->
    <div v-if="nodeNotFound" class="nc-not-found">
      <div class="nc-not-found-card">
        <div class="nc-not-found-icon">⚠️</div>
        <div class="nc-not-found-title">节点未找到</div>
        <div class="nc-not-found-msg">找不到 ID 为 <code>{{ route.params.id }}</code> 的节点，可能已被删除。</div>
        <button class="btn btn-primary" @click="goBack">← 返回工作流</button>
      </div>
    </div>

    <!-- Normal config form -->
    <template v-else>
      <div class="nc-header">
        <button @click="goBack()" class="btn btn-xs btn-ghost nc-back-btn">← 返回工作流</button>
        <span class="nc-header-title">🔄 {{ workflowName }}</span>
        <span class="nc-header-sub">· 节点: {{ nodeLabel }}</span>
        <button class="btn btn-sm btn-primary nc-save-btn" @click="saveNode" :disabled="saving">{{ saving ? '保存中...' : saveSuccess ? '✅ 已保存' : '💾 保存' }}</button>
      </div>
      <div v-if="saveError" class="nc-error">{{ saveError }}</div>
      <div class="nc-layout">
        <div class="nc-canvas">
          <div class="nnode">
            <div class="nnode-header"><div class="nnode-dot"></div><span class="nnode-name">{{ nodeLabel }}</span></div>
            <div class="nnode-sub">{{ incomingEdges.length }} 个输入连接</div>
          </div>
        </div>
        <div class="nc-panel">
          <div class="section-title">🎨 {{ nodeLabel }}节点配置</div>
          <div class="param-section">
            <div class="section-title">基本参数</div>
            <div class="form-grid">
              <div><label class="form-label">模型</label><select class="input" v-model="nodeModel"><option>标准模型</option><option>高质量模型</option><option>专业模型</option></select></div>
              <div class="param-row-2">
                <div><label class="form-label">宽度</label><input class="input" v-model.number="width"></div>
                <div><label class="form-label">高度</label><input class="input" v-model.number="height"></div>
                <div><label class="form-label">步数</label><input class="input" v-model.number="steps"></div>
                <div><label class="form-label">引导系数</label><input class="input" v-model.number="cfg"></div>
              </div>
              <div><label class="form-label">种子值</label><input class="input" v-model="seed"></div>
            </div>
          </div>
          <div class="param-section">
            <div class="section-title">🎯 提示词</div>
            <div><label class="form-label">正向提示词</label><textarea class="input" rows="3" v-model="positivePrompt"></textarea></div>
            <div style="margin-top:8px"><label class="form-label">反向提示词</label><input class="input" v-model="negativePrompt"></div>
          </div>
          <div class="param-section">
            <div class="section-title">⚙ 高级</div>
            <div class="form-grid">
              <div><label class="form-label">输入节点</label><div class="code-block"><template v-if="incomingEdges.length > 0"><span v-for="edge in incomingEdges" :key="edge.source">📥 {{ incomingNodeName(edge) }}<br></span></template><template v-else>暂无输入连接</template></div></div>
              <div><label class="form-label">输出格式</label><select class="input" v-model="outputFormat"><option>PNG (默认)</option><option>JPG</option><option>WebP</option></select></div>
              <div class="checkbox-row"><input type="checkbox" id="retry" v-model="autoRetry"><label for="retry">失败自动重试 (最多 3 次)</label></div>
              <div class="checkbox-row"><input type="checkbox" id="batch" v-model="batchMode"><label for="batch">批量模式 (同时生成多张)</label></div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.node-config { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.nc-header { display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: var(--bg-secondary, #111827); border-bottom: 1px solid var(--border, #1e293b); }
.nc-header-title { font-size: 14px; font-weight: 600; color: var(--text-primary, #e2e8f0); }
.nc-header-sub { font-size: 11px; color: var(--text-muted, #64748b); }
.nc-save-btn { margin-left: auto; }
.nc-layout { display: flex; flex: 1; overflow: hidden; }
.nc-canvas { flex: 1; background: radial-gradient(circle,rgba(99,102,241,.03) 1px,transparent 1px); background-size: 24px 24px; position: relative; }
.nnode { position: absolute; background: var(--bg-card, #141a2e); border: 2px solid var(--accent, #818cf8); border-radius: 10px; padding: 12px 14px; min-width: 150px; top: 60px; left: 60px; }
.nnode-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.nnode-dot { width: 8px; height: 8px; border-radius: 50%; background: #fbbf24; }
.nnode-name { font-size: 12px; font-weight: 600; color: var(--text-primary, #e2e8f0); }
.nnode-sub { font-size: 10px; color: var(--text-muted, #64748b); }
.nc-panel { width: 420px; background: var(--bg-secondary, #111827); border-left: 1px solid var(--border, #1e293b); padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.param-section { background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); padding: 14px; }
.param-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.form-grid { display: flex; flex-direction: column; gap: 12px; }
.form-label { font-size: 11px; color: var(--text-secondary, #94a3b8); margin-bottom: 4px; display: block; }
.checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary, #94a3b8); }
.code-block { background: #0d1117; border: 1px solid var(--border, #1e293b); border-radius: 6px; padding: 10px; font-family: var(--font-mono, monospace); font-size: 11px; color: #7ee787; overflow-x: auto; }
.section-title { font-size: 16px; font-weight: 700; color: var(--text-primary, #e2e8f0); margin-bottom: 12px; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all .2s; white-space: nowrap; }
.btn-primary { background: var(--accent, #818cf8); color: #fff; }
.btn-primary:hover { background: var(--accent-strong, #6366f1); box-shadow: 0 0 20px rgba(99,102,241,.3); }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.input { padding: 10px 14px; border-radius: 8px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 14px; outline: none; font-family: var(--font-sans); width: 100%; transition: border .2s; }
.input:focus { border-color: var(--accent, #818cf8); }
textarea.input { resize: vertical; }
.nc-not-found { display: flex; align-items: center; justify-content: center; flex: 1; }
.nc-not-found-card { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.nc-not-found-icon { font-size: 48px; }
.nc-not-found-title { font-size: 18px; font-weight: 700; color: var(--text-primary, #e2e8f0); }
.nc-not-found-msg { font-size: 13px; color: var(--text-muted, #64748b); }
.nc-not-found-msg code { background: var(--bg-tertiary, #1a2332); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono, monospace); font-size: 12px; color: #f87171; }
.nc-error { padding: 6px 16px; background: rgba(239,68,68,.15); color: #f87171; font-size: 12px; border-bottom: 1px solid var(--border, #1e293b); }
.nc-back-btn { margin-right: 4px; font-size: 11px; }
</style>
