<script setup lang="ts">
/**
 * CharacterEditView.vue — 角色详情编辑 (1:1 复刻 studio-character-edit.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const charName = ref('林启')
const charDesc = ref('本作男主角。少年剑修，出身没落宗门，凭一柄断剑踏上复仇与觉醒之路。')
const archetype = ref('主角 · 剑修')
const prompt = ref('少年剑修，白衣黑发，眼神坚定，古风仙侠风格')
const negativePrompt = ref('女性, 现代服饰, 眼镜, 双人')
const consistency = ref(99.2)
const tags = ref(['主角', '剑修', '少年', '白衣', '复仇', '成长'])
const expressions = ['😐','😤','😊','😢','😠','😨','🤔','😎','😏','😲','😴']
const activeExpr = ref(2)

function goBack() { router.push('/materials?tab=characters') }
const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

async function saveChar() {
  saving.value = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    const r = await fetch('/api/characters/' + (route.params.id || 'new'), {
      method: route.params.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('mhw.access_token') || '') },
      body: JSON.stringify({ name: charName.value, description: charDesc.value, archetype: archetype.value, prompt: prompt.value, negative_prompt: negativePrompt.value, tags: tags.value })
    })
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || '保存失败 (' + r.status + ')') }
    saveSuccess.value = true
    setTimeout(() => router.push('/materials?tab=characters'), 1200)
  } catch (err: any) {
    saveError.value = err.message || '保存失败'
  } finally { saving.value = false }
}
</script>

<template>
  <div class="character-edit">
    <div class="ce-header">
      <div class="ce-header-left">
        <a href="#" class="ce-back-link" @click.prevent="goBack">← 返回素材库</a>
        <span class="ce-title">🗡️ 编辑角色 · {{ charName }}</span>
        <span class="badge badge-purple">主角</span>
      </div>
      <div v-if="saveError" class="ce-error">⚠️ {{ saveError }}</div>
      <div class="ce-header-right">
        <button class="btn btn-sm btn-secondary">🔄 重置</button>
        <button class="btn btn-sm btn-primary" @click="saveChar" :disabled="saving">
          {{ saving ? '保存中...' : saveSuccess ? '✅ 已保存' : '💾 保存' }}
        </button>
      </div>
    </div>
    <div class="cd-layout">
      <div class="cd-left">
        <div class="cd-preview">🗡️</div>
        <div class="section-title">😊 表情集 (12)</div>
        <div class="expression-grid">
          <div v-for="(e, i) in expressions" :key="i" class="expr-card" :class="{ active: activeExpr === i }" @click="activeExpr = i">{{ e }}</div>
          <div class="expr-card expr-card--add">➕</div>
        </div>
      </div>
      <div class="cd-right">
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <div class="form-grid">
            <div><label class="form-label">名称</label><input class="input" v-model="charName"></div>
            <div><label class="form-label">Archetype</label><select class="input" v-model="archetype"><option>主角 · 剑修</option><option>主角 · 法师</option><option>反派</option><option>配角</option></select></div>
            <div><label class="form-label">描述</label><textarea class="input" rows="3" v-model="charDesc"></textarea></div>
          </div>
        </div>
        <div class="form-section">
          <div class="section-title">🎨 一致性参数</div>
          <div class="form-grid">
            <div><label class="form-label">主视觉图 Prompt</label><textarea class="input" rows="2" v-model="prompt"></textarea></div>
            <div><label class="form-label">Negative Prompt</label><input class="input" v-model="negativePrompt"></div>
            <div class="consistency-bar">
              <span class="form-label" style="width:60px;flex-shrink:0">一致性</span>
              <div style="flex:1"><div class="progress-bar"><div class="progress-fill" :style="{ width: consistency + '%' }"></div></div></div>
              <span class="consistency-value">{{ consistency }}%</span>
            </div>
          </div>
        </div>
        <div class="form-section">
          <div class="section-title">🏷️ 标签</div>
          <div class="tag-list">
            <span v-for="t in tags" :key="t" class="tag">{{ t }}</span>
            <span class="tag tag--add">+ 添加</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-edit { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.ce-header { padding: 12px 20px; background: var(--bg-secondary, #111827); border-bottom: 1px solid var(--border, #1e293b); display: flex; align-items: center; justify-content: space-between; }
.ce-header-left { display: flex; align-items: center; gap: 12px; }
.ce-back-link { color: var(--text-secondary, #94a3b8); text-decoration: none; font-size: 13px; }
.ce-title { font-size: 15px; font-weight: 700; color: var(--text-primary, #e2e8f0); }
.ce-header-right { display: flex; gap: 8px; }
.cd-layout { display: flex; gap: 20px; padding: 20px; flex: 1; overflow: hidden; }
.cd-left { flex: 1; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
.cd-right { width: 340px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
.cd-preview { aspect-ratio: 4/3; border-radius: var(--radius, 12px); background: linear-gradient(135deg,rgba(102,126,234,.2),rgba(118,75,162,.1)); display: flex; align-items: center; justify-content: center; font-size: 80px; border: 1px solid var(--border, #1e293b); }
.expression-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
.expr-card { aspect-ratio: 1; border-radius: 8px; border: 1px solid var(--border, #1e293b); background: var(--bg-tertiary, #1a2332); display: flex; align-items: center; justify-content: center; font-size: 32px; cursor: pointer; }
.expr-card:hover { border-color: var(--accent, #818cf8); }
.expr-card.active { border-color: var(--accent, #818cf8); box-shadow: 0 0 0 2px rgba(99,102,241,.3); }
.expr-card--add { border-style: dashed; }
.consistency-bar { display: flex; align-items: center; gap: 10px; }
.consistency-value { font-size: 12px; color: #34d399; font-weight: 700; }
.progress-bar { width: 100%; height: 6px; background: var(--bg-tertiary, #1a2332); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 3px; transition: width .3s; }
.form-section { background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); padding: 16px; }
.form-grid { display: flex; flex-direction: column; gap: 12px; }
.form-label { font-size: 11px; color: var(--text-secondary, #94a3b8); margin-bottom: 4px; display: block; }
.tag-list { display: flex; gap: 6px; flex-wrap: wrap; }
.tag { padding: 4px 10px; border-radius: 12px; font-size: 11px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-secondary, #94a3b8); }
.tag--add { border-style: dashed; cursor: pointer; }
.section-title { font-size: 16px; font-weight: 700; color: var(--text-primary, #e2e8f0); margin-bottom: 12px; }
.badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-purple { background: rgba(139,92,246,.15); color: #a78bfa; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; text-decoration: none; transition: all .2s; white-space: nowrap; }
.btn-primary { background: var(--accent, #818cf8); color: #fff; }
.btn-primary:hover { background: var(--accent-strong, #6366f1); box-shadow: 0 0 20px rgba(99,102,241,.3); }
.btn-secondary { background: var(--bg-tertiary, #1a2332); color: var(--text-primary, #e2e8f0); border: 1px solid var(--border, #1e293b); }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.input { padding: 10px 14px; border-radius: 8px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 14px; outline: none; font-family: var(--font-sans); width: 100%; transition: border .2s; }
.input:focus { border-color: var(--accent, #818cf8); }
textarea.input { resize: vertical; }
</style>
