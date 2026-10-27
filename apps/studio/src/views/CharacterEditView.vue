<script setup lang="ts">
/**
 * CharacterEditView.vue — 角色详情编辑 (1:1 复刻 studio-character-edit.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ImagePreview from '../components/ImagePreview.vue'
import { getApi } from '../api-bridge'
import { useCharacterStore } from '../stores/characterStore'
import { CHARACTER_ARCHETYPES_V2 } from '../data/character-archetypes-v2'

const route = useRoute()
const router = useRouter()
const charStore = useCharacterStore()

const loading = ref(false)
const loadError = ref<string | null>(null)

// -- mock fallback (used when API unavailable) --
const MOCK_CHAR = {
  name: '林启',
  description: '本作男主角。少年剑修，出身没落宗门，凭一柄断剑踏上复仇与觉醒之路。',
  archetype: '主角 · 剑修',
  prompt: '少年剑修，白衣黑发，眼神坚定，古风仙侠风格',
  negativePrompt: '女性, 现代服饰, 眼镜, 双人',
  consistency: 99.2,
  tags: ['主角', '剑修', '少年', '白衣', '复仇', '成长'],
}

const charName = ref(MOCK_CHAR.name)
const imageUrl = ref<string | null>(null)
const charDesc = ref(MOCK_CHAR.description)
const archetype = ref(MOCK_CHAR.archetype)
const prompt = ref(MOCK_CHAR.prompt)
const negativePrompt = ref(MOCK_CHAR.negativePrompt)
const consistency = ref(MOCK_CHAR.consistency)
const tags = ref<string[]>([...MOCK_CHAR.tags])
const expressions = ref(['😐','😤','😊','😢','😠','😨','🤔','😎','😏','😲','😴'])
const activeExpr = ref(2)

const originalData = ref<Record<string, any>>({})
const archetypeOptions = CHARACTER_ARCHETYPES_V2.map(a => `${a.icon} ${a.label}`)

/** Populate reactive refs from API character data */
function applyCharData(char: Record<string, any>) {
  if (char.name) charName.value = char.name
  if (char.description) charDesc.value = char.description
  if (char.archetype) archetype.value = char.archetype
  if (char.prompt) prompt.value = char.prompt
  if (char.negative_prompt) negativePrompt.value = char.negative_prompt
  if (char.consistency != null) consistency.value = char.consistency
  if (char.thumbnail_url) imageUrl.value = char.thumbnail_url
  if (Array.isArray(char.tags)) tags.value = char.tags
}

/** Capture current form state as the original baseline for reset */
function saveOriginalSnapshot() {
  originalData.value = {
    charName: charName.value,
    charDesc: charDesc.value,
    archetype: archetype.value,
    prompt: prompt.value,
    negativePrompt: negativePrompt.value,
    consistency: consistency.value,
    imageUrl: imageUrl.value,
    tags: [...tags.value],
    expressions: [...expressions.value],
    activeExpr: activeExpr.value,
  }
}

/** Revert all form fields to the originally loaded data */
function resetForm() {
  charName.value = originalData.value.charName ?? ''
  charDesc.value = originalData.value.charDesc ?? ''
  archetype.value = originalData.value.archetype ?? ''
  prompt.value = originalData.value.prompt ?? ''
  negativePrompt.value = originalData.value.negativePrompt ?? ''
  consistency.value = originalData.value.consistency ?? 0
  imageUrl.value = originalData.value.imageUrl ?? null
  tags.value = [...(originalData.value.tags ?? [])]
  expressions.value = [...(originalData.value.expressions ?? [])]
  activeExpr.value = originalData.value.activeExpr ?? 0
}

/** Add a new empty expression card */
function addExpression() {
  expressions.value.push('🆕')
}

/** Add a new tag */
function addTag() {
  tags.value.push('新标签')
}

onMounted(async () => {
  const charId = route.params.id as string
  if (!charId || charId === 'new') { saveOriginalSnapshot(); return }
  loading.value = true
  loadError.value = null
  try {
    // Try to find character in already-loaded store first
    const existing = charStore.characters.find((c) => c.id === charId)
    if (existing) {
      applyCharData(existing)
      saveOriginalSnapshot()
      return
    }
    // Fetch from API using project ID from store or localStorage
    const pid = charStore.projectId || localStorage.getItem('mhw.project_id')
    if (!pid) {
      loadError.value = '未关联项目，无法加载角色数据'
      return
    }
    const api = getApi()
    try {
      const char = await api.http.get<Record<string, any>>(
        `/projects/${encodeURIComponent(pid)}/characters/${encodeURIComponent(charId)}`,
      )
      applyCharData(char)
      saveOriginalSnapshot()
    } catch {
      // Direct endpoint may not exist — try list lookup
      const resp = await api.http.get<any>(
        `/projects/${encodeURIComponent(pid)}/characters`,
        undefined,
        { timeoutMs: 2500 } as any,
      )
      const list = Array.isArray(resp) ? resp : (resp?.items ?? resp?.list ?? resp?.data ?? [])
      const found = list.find((c: any) => c.id === charId)
      if (found) {
        applyCharData(found)
        saveOriginalSnapshot()
      } else {
        loadError.value = '未找到对应角色'
      }
    }
  } catch (e: any) {
    loadError.value = e?.message || '加载失败'
    // keep mock data as fallback
  } finally {
    loading.value = false
  }
})

function goBack() { router.push('/characters') }
const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

async function saveChar() {
  saving.value = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    const api = getApi()
    const id = route.params.id as string
    const pid = charStore.projectId || localStorage.getItem('mhw.project_id')
    if (!pid) { saveError.value = '未关联项目，无法保存'; return }
    const payload = {
      name: charName.value,
      description: charDesc.value,
      archetype: archetype.value,
      prompt: prompt.value,
      negative_prompt: negativePrompt.value,
      tags: tags.value,
    }
    if (id && id !== 'new') {
      await api.http.patch(`/projects/${encodeURIComponent(pid)}/characters/${encodeURIComponent(id)}`, payload)
    } else {
      await api.http.post(`/projects/${encodeURIComponent(pid)}/characters`, payload)
    }
    saveSuccess.value = true
    setTimeout(() => router.push('/characters'), 1200)
  } catch (err: any) {
    saveError.value = err.message || '保存失败'
  } finally { saving.value = false }
}
</script>

<template>
  <div class="character-edit">
    <div v-if="loading" class="ce-loading">⏳ 加载角色数据中...</div>
    <div v-if="loadError" class="ce-load-error">⚠️ {{ loadError }}</div>
    <div class="ce-header">
      <div class="ce-header-left">
        <a href="#" class="ce-back-link" @click.prevent="goBack">← 返回素材库</a>
        <span class="ce-title">🗡️ 编辑角色 · {{ charName }}</span>
        <span class="badge badge-purple">主角</span>
      </div>
      <div v-if="saveError" class="ce-error">⚠️ {{ saveError }}</div>
      <div class="ce-header-right">
        <button class="btn btn-sm btn-secondary" @click="resetForm">🔄 重置</button>
        <button class="btn btn-sm btn-primary" @click="saveChar" :disabled="saving">
          {{ saving ? '保存中...' : saveSuccess ? '✅ 已保存' : '💾 保存' }}
        </button>
      </div>
    </div>
    <div class="cd-layout">
      <div class="cd-left">
        <ImagePreview :src="imageUrl" fallback="🗡️" aspect="4:3" class="cd-preview" />
        <div class="section-title">😊 表情集 ({{ expressions?.length || 0 }})</div>
        <div class="expression-grid">
          <div v-for="(e, i) in expressions" :key="i" class="expr-card" :class="{ active: activeExpr === i }" @click="activeExpr = i">{{ e }}</div>
          <div class="expr-card expr-card--add" @click="addExpression">➕</div>
        </div>
      </div>
      <div class="cd-right">
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <div class="form-grid">
            <div><label class="form-label">名称</label><input class="input" v-model="charName"></div>
            <div><label class="form-label">角色原型</label><select class="input" v-model="archetype"><option v-for="opt in archetypeOptions" :key="opt" :value="opt">{{ opt }}</option></select></div>
            <div><label class="form-label">描述</label><textarea class="input" rows="3" v-model="charDesc"></textarea></div>
          </div>
        </div>
        <div class="form-section">
          <div class="section-title">🎨 一致性参数</div>
          <div class="form-grid">
            <div><label class="form-label">主视觉图提示词</label><textarea class="input" rows="2" v-model="prompt"></textarea></div>
            <div><label class="form-label">反向提示词</label><input class="input" v-model="negativePrompt"></div>
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
            <span class="tag tag--add" @click="addTag">+ 添加</span>
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
.cd-preview { width: 100%; }
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
.tag-list { display: flex; gap: 6px; flex-wrap: wrap; }
.tag { padding: 4px 10px; border-radius: 12px; font-size: 11px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-secondary, #94a3b8); }
.tag--add { border-style: dashed; cursor: pointer; }
.section-title { font-size: 16px; font-weight: 700; color: var(--text-primary, #e2e8f0); margin-bottom: 12px; }
.ce-loading { padding: 10px 20px; background: rgba(99,102,241,.08); color: var(--accent, #818cf8); font-size: 13px; text-align: center; }
.ce-load-error { padding: 10px 20px; background: rgba(239,68,68,.1); color: #f87171; font-size: 13px; text-align: center; }
</style>
