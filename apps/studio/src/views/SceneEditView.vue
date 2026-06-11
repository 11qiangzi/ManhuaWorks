<script setup lang="ts">
/**
 * SceneEditView.vue — 场景详情编辑 (1:1 复刻 studio-scene-edit.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const sceneName = ref('林府书房')
const sceneType = ref('🏠 室内')
const sceneDesc = ref('林启父亲的书房。檀木书桌靠窗，竹影透过纱帘投在地面，墙上挂一柄祖传断剑。')
const lightPreset = ref('暖黄')
const colorTemp = ref(3200)
const brightness = ref(75)
const prompt = ref('中式古典书房，檀木家具，窗外竹林摇曳，暖黄灯光，氛围安静庄严')
const negativePrompt = ref('现代电器, 塑料材质, 过多人, 杂乱')
const subScenes = ref([
  { name: '🛋️ 沙发区', angle: '正面视角 · 暖光主光源', active: true },
  { name: '🪟 窗边书桌', angle: '侧光氛围 · 竹影投窗', active: false },
  { name: '📚 书架角', angle: '纵深构图 · 暗角补光', active: false },
])
const activeSub = ref(0)

function goBack() { router.push('/materials?tab=scenes') }
const saving = ref(false); const saveError = ref(''); const saveSuccess = ref(false)
async function saveScene() {
  saving.value = true; saveError.value = ''; saveSuccess.value = false
  try {
    const r = await fetch('/api/scenes/' + (route.params.id || 'new'), {
      method: route.params.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('mhw.access_token') || '') },
      body: JSON.stringify({ name: sceneName.value, type: sceneType.value, description: sceneDesc.value, light_preset: lightPreset.value, color_temp: colorTemp.value, brightness: brightness.value, prompt: prompt.value, negative_prompt: negativePrompt.value, sub_scenes: subScenes.value })
    })
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || '保存失败 (' + r.status + ')') }
    saveSuccess.value = true; setTimeout(() => router.push('/materials?tab=scenes'), 1200)
  } catch (err: any) { saveError.value = err.message || '保存失败' }
  finally { saving.value = false }
}
function selectSub(i: number) { activeSub.value = i; subScenes.value.forEach((s, j) => s.active = j === i) }
</script>

<template>
  <div class="scene-edit">
    <div class="se-header">
      <div class="se-header-left">
        <a href="#" class="se-back-link" @click.prevent="goBack">← 返回素材库</a>
        <span class="se-title">🏠 编辑场景 · {{ sceneName }}</span>
        <span class="badge badge-amber">室内</span>
      </div>
      <div class="se-header-right">
        <button class="btn btn-sm btn-secondary">🔄 重置</button>
        <button class="btn btn-sm btn-primary" @click="saveScene" :disabled="saving">{{ saving ? '保存中...' : saveSuccess ? '✅ 已保存' : '💾 保存' }}</button>
      </div>
    </div>
    <div class="sd-layout">
      <div class="sd-left">
        <div class="sd-preview">🏠</div>
        <div class="section-title">📐 子场景 (3)</div>
        <div class="subscene-grid">
          <div v-for="(s, i) in subScenes" :key="i" class="sub-card" :class="{ active: s.active }" @click="selectSub(i)">
            <div class="sub-name">{{ s.name }}</div>
            <div class="sub-angle">{{ s.angle }}</div>
          </div>
          <div class="sub-card sub-card--add"><span>+ 新增子场景</span></div>
        </div>
      </div>
      <div class="sd-right">
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <div class="form-grid">
            <div><label class="form-label">名称</label><input class="input" v-model="sceneName"></div>
            <div><label class="form-label">类型</label><select class="input" v-model="sceneType"><option>🏠 室内</option><option>🌳 室外</option><option>⚔️ 战斗</option></select></div>
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
              <div class="range-labels"><span>冷 (2000K)</span><span>{{ colorTemp }}K</span><span>暖 (8000K)</span></div>
            </div>
            <div>
              <label class="form-label">亮度</label>
              <input type="range" style="width:100%" v-model.number="brightness" min="0" max="100">
            </div>
          </div>
        </div>
        <div class="form-section">
          <div class="section-title">🎨 场景 Prompt</div>
          <textarea class="input" rows="3" v-model="prompt"></textarea>
          <div style="margin-top:8px"><label class="form-label">Negative</label><input class="input" v-model="negativePrompt"></div>
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
.sd-preview { aspect-ratio: 16/9; border-radius: var(--radius, 12px); background: linear-gradient(135deg,rgba(245,158,11,.2),rgba(245,158,11,.05)); display: flex; align-items: center; justify-content: center; font-size: 72px; border: 1px solid var(--border, #1e293b); }
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
</style>
