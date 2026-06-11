<script setup lang="ts">
/**
 * NodeConfigView.vue — 工作流节点配置 (1:1 复刻 studio-node-config.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const nodeModel = ref('Stable Diffusion XL')
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

const saving = ref(false); const saveError = ref(''); const saveSuccess = ref(false)
async function saveNode() {
  saving.value = true; saveError.value = ''; saveSuccess.value = false
  try {
    const config = { model: nodeModel.value, width: width.value, height: height.value, steps: steps.value, cfg: cfg.value, seed: seed.value, positive: positivePrompt.value, negative: negativePrompt.value, outputFormat: outputFormat.value, autoRetry: autoRetry.value, batchMode: batchMode.value }
    localStorage.setItem('mhw.nodeConfig', JSON.stringify(config))
    saveSuccess.value = true
  } catch (err: any) { saveError.value = err.message || '保存失败' }
  finally { saving.value = false }
}
function goBack() { router.push('/workflow') }
</script>

<template>
  <div class="node-config">
    <div class="nc-header">
      <span class="nc-header-title">🔄 我的第一个工作流</span>
      <span class="nc-header-sub">· 节点: 图像生成</span>
      <button class="btn btn-sm btn-primary nc-save-btn" @click="saveNode" :disabled="saving">{{ saving ? '保存中...' : saveSuccess ? '✅ 已保存' : '💾 保存' }}</button>
    </div>
    <div class="nc-layout">
      <div class="nc-canvas">
        <div class="nnode">
          <div class="nnode-header"><div class="nnode-dot"></div><span class="nnode-name">图像生成</span></div>
          <div class="nnode-sub">🎨 风格迁移 · 已连接</div>
        </div>
      </div>
      <div class="nc-panel">
        <div class="section-title">🎨 图像生成节点配置</div>
        <div class="param-section">
          <div class="section-title">基本参数</div>
          <div class="form-grid">
            <div><label class="form-label">模型</label><select class="input" v-model="nodeModel"><option>Stable Diffusion XL</option><option>AnimeGen v3</option><option>ComicCraft Pro</option></select></div>
            <div class="param-row-2">
              <div><label class="form-label">宽度</label><input class="input" v-model.number="width"></div>
              <div><label class="form-label">高度</label><input class="input" v-model.number="height"></div>
              <div><label class="form-label">步数</label><input class="input" v-model.number="steps"></div>
              <div><label class="form-label">CFG</label><input class="input" v-model.number="cfg"></div>
            </div>
            <div><label class="form-label">Seed</label><input class="input" v-model="seed"></div>
          </div>
        </div>
        <div class="param-section">
          <div class="section-title">🎯 提示词</div>
          <div><label class="form-label">Positive Prompt</label><textarea class="input" rows="3" v-model="positivePrompt"></textarea></div>
          <div style="margin-top:8px"><label class="form-label">Negative Prompt</label><input class="input" v-model="negativePrompt"></div>
        </div>
        <div class="param-section">
          <div class="section-title">⚙ 高级</div>
          <div class="form-grid">
            <div><label class="form-label">输入节点</label><div class="code-block">📥 角色提取 (node_char_extract)<br>📥 章节拆解 (node_chapter_split)</div></div>
            <div><label class="form-label">输出格式</label><select class="input" v-model="outputFormat"><option>PNG (默认)</option><option>JPG</option><option>WebP</option></select></div>
            <div class="checkbox-row"><input type="checkbox" id="retry" v-model="autoRetry"><label for="retry">失败自动重试 (最多 3 次)</label></div>
            <div class="checkbox-row"><input type="checkbox" id="batch" v-model="batchMode"><label for="batch">批量模式 (同时生成多张)</label></div>
          </div>
        </div>
      </div>
    </div>
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
</style>
