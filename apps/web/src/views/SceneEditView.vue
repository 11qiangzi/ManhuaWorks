<script setup lang="ts">
/**
 * SceneEditView.vue — 场景详情编辑 (1:1 复刻 studio-scene-edit.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ImagePreview from '../components/ImagePreview.vue'
import { getApi } from '../api-bridge'
import { useSceneStore } from '../stores/sceneStore'

const route = useRoute()
const router = useRouter()
const sceneStore = useSceneStore()

const loading = ref(false)
const loadError = ref<string | null>(null)

// -- mock fallback (used when API unavailable) --
const MOCK_SCENE = {
  name: '林府书房',
  type: '🏠 室内',
  description: '林启父亲的书房。檀木书桌靠窗，竹影透过纱帘投在地面，墙上挂一柄祖传断剑。',
  lightPreset: '暖黄',
  colorTemp: 3200,
  brightness: 75,
  prompt: '中式古典书房，檀木家具，窗外竹林摇曳，暖黄灯光，氛围安静庄严',
  negativePrompt: '现代电器, 塑料材质, 过多人, 杂乱',
  subScenes: [
    { name: '🛋️ 沙发区', angle: '正面视角 · 暖光主光源', active: true },
    { name: '🪟 窗边书桌', angle: '侧光氛围 · 竹影投窗', active: false },
    { name: '📚 书架角', angle: '纵深构图 · 暗角补光', active: false },
  ],
}

const sceneName = ref(MOCK_SCENE.name)
const imageUrl = ref<string | null>(null)
const sceneType = ref(MOCK_SCENE.type)
const sceneDesc = ref(MOCK_SCENE.description)
const lightPreset = ref(MOCK_SCENE.lightPreset)
const colorTemp = ref(MOCK_SCENE.colorTemp)
const brightness = ref(MOCK_SCENE.brightness)
const prompt = ref(MOCK_SCENE.prompt)
const negativePrompt = ref(MOCK_SCENE.negativePrompt)
const subScenes = ref(MOCK_SCENE.subScenes.map(s => ({ ...s })))
const activeSub = ref(0)

const originalData = ref<Record<string, any>>({})
const sceneTypeOptions = ['室内', '室外', '战斗', '城镇', '荒野', '地下', '水上', '空中']

/** Populate reactive refs from API scene data */
function applySceneData(scene: Record<string, any>) {
  if (scene.name) sceneName.value = scene.name
  if (scene.scene_type) sceneType.value = scene.scene_type
  if (scene.type) sceneType.value = scene.type
  if (scene.description) sceneDesc.value = scene.description
  if (scene.light_preset) lightPreset.value = scene.light_preset
  if (scene.light_color_temp) lightPreset.value = scene.light_color_temp
  if (scene.color_temp != null) colorTemp.value = scene.color_temp
  if (scene.brightness != null) brightness.value = scene.brightness
  if (scene.light_intensity != null) brightness.value = Math.round(Number(scene.light_intensity || 0) * 100)
  if (scene.prompt) prompt.value = scene.prompt
  if (scene.negative_prompt) negativePrompt.value = scene.negative_prompt
  if (scene.thumbnail_url || scene.image_url) imageUrl.value = scene.thumbnail_url || scene.image_url
  if (Array.isArray(scene.sub_scenes)) subScenes.value = scene.sub_scenes
}

/** Capture current form state as the original baseline for reset */
function saveOriginalSnapshot() {
  originalData.value = {
    sceneName: sceneName.value,
    sceneType: sceneType.value,
    sceneDesc: sceneDesc.value,
    lightPreset: lightPreset.value,
    colorTemp: colorTemp.value,
    brightness: brightness.value,
    prompt: prompt.value,
    negativePrompt: negativePrompt.value,
    imageUrl: imageUrl.value,
    subScenes: subScenes.value.map(s => ({ ...s })),
    activeSub: activeSub.value,
  }
}

/** Revert all form fields to the originally loaded data */
function resetForm() {
  sceneName.value = originalData.value.sceneName ?? ''
  sceneType.value = originalData.value.sceneType ?? ''
  sceneDesc.value = originalData.value.sceneDesc ?? ''
  lightPreset.value = originalData.value.lightPreset ?? ''
  colorTemp.value = originalData.value.colorTemp ?? 3200
  brightness.value = originalData.value.brightness ?? 75
  prompt.value = originalData.value.prompt ?? ''
  negativePrompt.value = originalData.value.negativePrompt ?? ''
  imageUrl.value = originalData.value.imageUrl ?? null
  subScenes.value = (originalData.value.subScenes ?? []).map((s: any) => ({ ...s }))
  activeSub.value = originalData.value.activeSub ?? 0
}

/** Add a new empty sub-scene */
function addSubScene() {
  subScenes.value.push({ name: '🆕 新子场景', angle: '默认视角', active: false })
}

onMounted(async () => {
  const sceneId = route.params.id as string
  if (!sceneId || sceneId === 'new') { saveOriginalSnapshot(); return }
  loading.value = true
  loadError.value = null
  try {
    // Try to find scene in already-loaded store first
    const existing = sceneStore.scenes.find((s) => s.id === sceneId)
    if (existing) {
      applySceneData(existing)
      saveOriginalSnapshot()
      return
    }
    // Fetch from API using project ID from store or localStorage
    const pid = sceneStore.projectId || localStorage.getItem('mhw.project_id')
    if (!pid) {
      loadError.value = '未关联项目，无法加载场景数据'
      return
    }
    const api = getApi()
    try {
      const scene = await api.http.get<Record<string, any>>(
        `/projects/${encodeURIComponent(pid)}/scenes/${encodeURIComponent(sceneId)}`,
      )
      applySceneData(scene)
      saveOriginalSnapshot()
    } catch {
      // Direct endpoint may not exist — try list lookup
      const resp = await api.http.get<any>(
        `/projects/${encodeURIComponent(pid)}/scenes`,
        undefined,
        { timeoutMs: 2500 } as any,
      )
      const list = Array.isArray(resp) ? resp : (resp?.items ?? resp?.list ?? resp?.data ?? [])
      const found = list.find((s: any) => s.id === sceneId)
      if (found) {
        applySceneData(found)
        saveOriginalSnapshot()
      } else {
        loadError.value = '未找到对应场景'
      }
    }
  } catch (e: any) {
    loadError.value = e?.message || '加载失败'
    // keep mock data as fallback
  } finally {
    loading.value = false
  }
})

function goBack() { router.push('/scenes') }
const saving = ref(false); const saveError = ref(''); const saveSuccess = ref(false)
async function saveScene() {
  saving.value = true; saveError.value = ''; saveSuccess.value = false
  try {
    const api = getApi()
    const id = route.params.id as string
    const pid = sceneStore.projectId || localStorage.getItem('mhw.project_id')
    if (!pid) { saveError.value = '未关联项目，无法保存'; return }
    const payload = {
      name: sceneName.value,
      type: sceneType.value,
      description: sceneDesc.value,
      light_preset: lightPreset.value,
      color_temp: colorTemp.value,
      brightness: brightness.value,
      prompt: prompt.value,
      negative_prompt: negativePrompt.value,
      sub_scenes: subScenes.value,
    }
    if (id && id !== 'new') {
      await api.http.patch(`/projects/${encodeURIComponent(pid)}/scenes/${encodeURIComponent(id)}`, payload)
    } else {
      await api.http.post(`/projects/${encodeURIComponent(pid)}/scenes`, payload)
    }
    saveSuccess.value = true; setTimeout(() => router.push('/scenes'), 1200)
  } catch (err: any) { saveError.value = err.message || '保存失败' }
  finally { saving.value = false }
}
function selectSub(i: number) { activeSub.value = i; subScenes.value.forEach((s, j) => s.active = j === i) }
</script>

<template>
  <div class="scene-edit">
    <div v-if="loading" class="se-loading">⏳ 加载场景数据中...</div>
    <div v-if="loadError" class="se-load-error">⚠️ {{ loadError }}</div>
    <div class="se-header">
      <div class="se-header-left">
        <a href="#" class="se-back-link" @click.prevent="goBack">← 返回素材库</a>
        <span class="se-title">🏠 编辑场景 · {{ sceneName }}</span>
        <span class="badge badge-amber">室内</span>
      </div>
      <div class="se-header-right">
        <button class="btn btn-sm btn-secondary" @click="resetForm">🔄 重置</button>
        <button class="btn btn-sm btn-primary" @click="saveScene" :disabled="saving">{{ saving ? '保存中...' : saveSuccess ? '✅ 已保存' : '💾 保存' }}</button>
      </div>
    </div>
    <div class="sd-layout">
      <div class="sd-left">
        <ImagePreview :src="imageUrl" fallback="🏠" aspect="16:9" class="sd-preview" />
        <div class="section-title">📐 子场景 ({{ subScenes?.length || 0 }})</div>
        <div class="subscene-grid">
          <div v-for="(s, i) in subScenes" :key="i" class="sub-card" :class="{ active: s.active }" @click="selectSub(i)">
            <div class="sub-name">{{ s.name }}</div>
            <div class="sub-angle">{{ s.angle }}</div>
          </div>
          <div class="sub-card sub-card--add" @click="addSubScene"><span>+ 新增子场景</span></div>
        </div>
      </div>
      <div class="sd-right">
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <div class="form-grid">
            <div><label class="form-label">名称</label><input class="input" v-model="sceneName"></div>
            <div><label class="form-label">类型</label><select class="input" v-model="sceneType"><option v-for="opt in sceneTypeOptions" :key="opt" :value="opt">{{ opt }}</option></select></div>
            <div><label class="form-label">描述</label><textarea class="input" rows="3" v-model="sceneDesc"></textarea></div>
          </div>
        </div>
        <div class="form-section">
          <div class="section-title">💡 光照设置</div>
          <div class="form-grid">
            <div>
              <label class="form-label">预设</label>
              <div class="light-preset">
                <span v-for="p in ['暖黄','日光','烛光','月光']" :key="p" class="light-chip" :class="{ active: lightPreset === p }" @click="lightPreset = p">{{ p }}</span>
              </div>
            </div>
            <div>
              <label class="form-label">色温</label>
              <input type="range" style="width:100%" v-model.number="colorTemp" min="2000" max="8000">
              <div class="range-labels"><span>暖 (2000K)</span><span>{{ colorTemp }}K</span><span>冷 (8000K)</span></div>
            </div>
            <div>
              <label class="form-label">亮度</label>
              <input type="range" style="width:100%" v-model.number="brightness" min="0" max="100">
            </div>
          </div>
        </div>
        <div class="form-section">
          <div class="section-title">🎨 场景提示词</div>
          <textarea class="input" rows="3" v-model="prompt"></textarea>
          <div style="margin-top:8px"><label class="form-label">反向提示词</label><input class="input" v-model="negativePrompt"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene-edit { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.se-header { padding: 12px 20px; background: var(--bg-secondary, #111827); border-bottom: 1px solid var(--border, #1e293b); display: flex; align-items: center; justify-content: space-between; }
.se-header-left { display: flex; align-items: center; gap: 12px; }
.se-back-link { color: var(--text-secondary, #94a3b8); text-decoration: none; font-size: 13px; }
.se-title { font-size: 15px; font-weight: 700; color: var(--text-primary, #e2e8f0); }
.se-header-right { display: flex; gap: 8px; }
.sd-layout { display: flex; gap: 20px; padding: 20px; flex: 1; overflow: hidden; }
.sd-left { flex: 1; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
.sd-right { width: 340px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
.sd-preview { width: 100%; }
.subscene-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
.sub-card { padding: 14px; border: 1px solid var(--border, #1e293b); border-radius: 8px; background: var(--bg-card, #141a2e); cursor: pointer; }
.sub-card:hover { border-color: var(--accent, #818cf8); }
.sub-card.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.05); }
.sub-card--add { border-style: dashed; display: flex; align-items: center; justify-content: center; min-height: 80px; font-size: 13px; color: var(--text-muted, #64748b); }
.sub-name { font-size: 13px; font-weight: 700; color: var(--text-primary, #e2e8f0); }
.sub-angle { font-size: 11px; color: var(--text-muted, #64748b); }
.light-preset { display: flex; gap: 8px; }
.light-chip { padding: 8px 14px; border: 1px solid var(--border, #1e293b); border-radius: 20px; font-size: 12px; cursor: pointer; background: var(--bg-card, #141a2e); color: var(--text-secondary, #94a3b8); }
.light-chip.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.08); color: var(--accent, #818cf8); }
.range-labels { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted, #64748b); }
.form-section { background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); padding: 16px; }
.form-grid { display: flex; flex-direction: column; gap: 12px; }
.form-label { font-size: 11px; color: var(--text-secondary, #94a3b8); margin-bottom: 4px; display: block; }
.section-title { font-size: 16px; font-weight: 700; color: var(--text-primary, #e2e8f0); margin-bottom: 12px; }
.badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-amber { background: rgba(245,158,11,.15); color: #fbbf24; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; text-decoration: none; transition: all .2s; white-space: nowrap; }
.btn-primary { background: var(--accent, #818cf8); color: #fff; }
.btn-primary:hover { background: var(--accent-strong, #6366f1); box-shadow: 0 0 20px rgba(99,102,241,.3); }
.btn-secondary { background: var(--bg-tertiary, #1a2332); color: var(--text-primary, #e2e8f0); border: 1px solid var(--border, #1e293b); }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.input { padding: 10px 14px; border-radius: 8px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 14px; outline: none; font-family: var(--font-sans); width: 100%; transition: border .2s; }
.input:focus { border-color: var(--accent, #818cf8); }
textarea.input { resize: vertical; }
.se-loading { padding: 10px 20px; background: rgba(99,102,241,.08); color: var(--accent, #818cf8); font-size: 13px; text-align: center; }
.se-load-error { padding: 10px 20px; background: rgba(239,68,68,.1); color: #f87171; font-size: 13px; text-align: center; }
</style>
