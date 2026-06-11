<script setup lang="ts">
/**
 * BranchConfigView.vue — 条件分支配置 (1:1 复刻 studio-branch-config.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const defaultRoute = ref('人工审核队列')

const branches = ref([
  { id: 'A', label: '成功', color: '#34d399', status: '活跃', conditions: [{ field: '状态', op: '=', value: 'success' }, { field: '置信度', op: '≥', value: '0.85' }], target: '🎬 剪辑合成' },
  { id: 'B', label: '画风异常', color: '#f59e0b', conditions: [{ field: '画风一致性', op: '<', value: '0.7' }], target: '🔧 StyleFix 修复' },
  { id: 'C', label: '置信度低', color: '#ef4444', conditions: [{ field: '置信度', op: '<', value: '0.6' }], target: '👤 人工审核队列' },
  { id: 'D', label: '失败', color: '#64748b', conditions: [{ field: '状态', op: '=', value: 'failed' }], target: '🔄 重试 (最多3次)' },
])

function goBack() { router.push('/workflow') }
const saving = ref(false); const saveError = ref(''); const saveSuccess = ref(false)
async function saveBranch() {
  saving.value = true; saveError.value = ''; saveSuccess.value = false
  try {
    localStorage.setItem('mhw.branchConfig', JSON.stringify({ defaultRoute: defaultRoute.value, branches: branches.value }))
    saveSuccess.value = true
  } catch (err: any) { saveError.value = err.message || '保存失败' }
  finally { saving.value = false }
}
</script>

<template>
  <div class="branch-config">
    <div class="br-toolbar">
      <span class="br-title">🔄 我的第一个工作流 · 条件分支</span>
      <span class="br-sub">节点：图像生成</span>
      <span class="br-count">4 条分支 · 1 条默认路由</span>
      <button class="btn btn-sm btn-primary" style="margin-left:auto" @click="saveBranch" :disabled="saving">{{ saving ? '保存中...' : saveSuccess ? '✅ 已保存' : '💾 保存' }}</button>
    </div>
    <div class="br-layout">
      <div class="br-canvas">
        <div class="br-node" style="top:40px;left:40px"><div class="br-node-header"><div class="br-node-dot" style="background:#667eea"></div><span>章节拆解</span></div><span class="br-node-sub">📖 剧本处理</span></div>
        <div class="br-node br-node--selected" style="top:220px;left:40px"><div class="br-node-header"><div class="br-node-dot" style="background:#fbbf24"></div><span>图像生成 🔀</span></div><span class="br-node-sub">🎨 风格迁移 · 4 分支</span></div>
        <div v-for="(b, i) in branches" :key="b.id" class="br-node" :style="{ top: (40+i*120) + 'px', left: '280px', borderColor: b.color }">
          <div class="br-node-header"><div class="br-node-dot" :style="{ background: b.color }"></div><span>{{ b.target.split(' ')[1] }}</span></div>
          <span class="br-node-sub">→ 路径{{ b.id }}：{{ b.label }}</span>
        </div>
      </div>
      <div class="br-panel">
        <div class="section-title">🔀 条件分支配置</div>
        <p class="br-panel-desc">节点「图像生成」根据输出结果自动路由到不同下游节点</p>
        <div v-for="b in branches" :key="b.id" class="branch-item" :class="{ active: b.id === 'A' }">
          <div class="branch-header">
            <span class="branch-label"><span class="branch-label-num" :style="{ background: b.color }">{{ b.id }}</span>{{ b.label }}</span>
            <span v-if="b.id === 'A'" class="badge badge-green">{{ b.status }}</span>
          </div>
          <div v-for="(c, ci) in b.conditions" :key="ci" class="condition-row">
            <span class="cond-label">{{ ci === 0 ? '条件' : '且' }}</span>
            <select class="cond-select"><option>{{ c.field }}</option></select>
            <select class="cond-select"><option>{{ c.op }}</option></select>
            <input class="cond-value" :value="c.value">
          </div>
          <div class="target-node">→ {{ b.target }}</div>
        </div>
        <div class="add-branch">+ 添加分支条件</div>
        <div class="default-route">
          <div class="dr-title">⚡ 默认路由</div>
          <div class="dr-desc">当所有条件都不匹配时，走默认路径</div>
          <div class="dr-row"><span>默认 →</span><select class="cond-select" v-model="defaultRoute"><option>人工审核队列</option><option>直接丢弃</option><option>重试</option></select></div>
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
</style>
