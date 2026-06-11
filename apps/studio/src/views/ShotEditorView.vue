<script setup lang="ts">
/**
 * ShotEditorView.vue — 分镜编辑 (1:1 复刻 studio-shot-editor.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const shotNum = ref(2)
const shotTitle = ref('书房对白')
const camOptions = [
  { id: 'mid', icon: '🎬', name: '中景', desc: '人物对话', active: true },
  { id: 'close', icon: '🔍', name: '特写', desc: '表情强调', active: false },
  { id: 'wide', icon: '🏞️', name: '远景', desc: '场景交代', active: false },
  { id: 'top', icon: '📐', name: '俯拍', desc: '空间关系', active: false },
]
const activeCam = ref('mid')
const camMovement = ref('静态固定')
const duration = ref(18)
const transition = ref('硬切')
const tone = ref('跟随场景')
const artStyle = ref('跟随项目')
const dialogues = ref([
  { char: '🎭 林启', text: '父亲，我想下山去看看外面的世界。' },
  { char: '🎭 林父', text: '你可知山外是什么？不是风景，是江湖。' },
])

function selectCam(id: string) { activeCam.value = id }
function addDialogue() { dialogues.value.push({ char: '🎭 新角色', text: '' }) }
function prevShot() { if (shotNum.value > 1) { shotNum.value--; router.push(`/project/${route.params.id}/shots/${shotNum.value}`) } }
function nextShot() { shotNum.value++; router.push(`/project/${route.params.id}/shots/${shotNum.value}`) }
function goBack() { router.push(`/project/${route.params.id}`) }
const saving = ref(false); const saveError = ref(''); const saveSuccess = ref(false)
async function saveShot() {
  saving.value = true; saveError.value = ''; saveSuccess.value = false
  try {
    const r = await fetch('/api/projects/' + route.params.id + '/shots' + (route.params.shotId ? '/' + route.params.shotId : ''), {
      method: route.params.shotId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('mhw.access_token') || '') },
      body: JSON.stringify({ order: shotNum.value, title: shotTitle.value, camera: activeCam.value, movement: camMovement.value, duration_sec: duration.value, transition: transition.value, tone: tone.value, art_style: artStyle.value, dialogues: dialogues.value })
    })
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || '保存失败 (' + r.status + ')') }
    saveSuccess.value = true
  } catch (err: any) { saveError.value = err.message || '保存失败' }
  finally { saving.value = false }
}
</script>

<template>
  <div class="shot-editor">
    <div class="shot-header">
      <div class="shot-nav">
        <button class="btn btn-xs btn-ghost" @click="prevShot">← 上一镜</button>
        <span class="shot-title">第 {{ shotNum }} 镜 · {{ shotTitle }}</span>
        <span class="badge badge-green">脚本完成</span>
        <button class="btn btn-xs btn-ghost" @click="nextShot">下一镜 →</button>
      </div>
      <div class="shot-actions">
        <button class="btn btn-xs btn-ghost" @click="goBack">📋 查看宫格</button>
        <button class="btn btn-primary btn-sm" @click="saveShot" :disabled="saving">{{ saving ? '保存中...' : saveSuccess ? '✅ 已保存' : '💾 保存' }}</button>
      </div>
    </div>
    <div class="se-layout">
      <div class="se-canvas">
        <div class="se-preview">🎬 预览区</div>
      </div>
      <div class="se-panel">
        <div class="section-title">🎥 机位选择</div>
        <div class="cam-grid">
          <div v-for="cam in camOptions" :key="cam.id" class="cam-option" :class="{ active: activeCam === cam.id }" @click="selectCam(cam.id)">
            <span class="cam-icon">{{ cam.icon }}</span>{{ cam.name }}<br><span class="cam-desc">{{ cam.desc }}</span>
          </div>
        </div>
        <div class="section-title">🎭 运镜参数</div>
        <div class="param-row"><span class="param-label">运镜</span><select v-model="camMovement" class="param-value input" style="width:100%"><option>静态固定</option><option>缓慢推近</option><option>水平横移</option></select></div>
        <div class="param-row"><span class="param-label">时长</span><div class="param-value"><input v-model.number="duration" class="input" style="width:70px"> 秒</div></div>
        <div class="param-row"><span class="param-label">转场</span><select v-model="transition" class="param-value input" style="width:100%"><option>硬切</option><option>淡入淡出</option><option>叠化</option></select></div>
        <div class="section-title">💬 对白</div>
        <div v-for="(d, i) in dialogues" :key="i" class="dialogue-item">
          <div class="dialogue-char">{{ d.char }}</div>
          <div class="dialogue-text">{{ d.text }}</div>
        </div>
        <button class="btn btn-sm btn-secondary" style="width:100%" @click="addDialogue">+ 添加对白</button>
        <div class="section-title">🎨 风格覆盖</div>
        <div class="param-row"><span class="param-label">色调</span><select v-model="tone" class="param-value input" style="width:100%"><option>跟随场景</option><option>暖黄</option><option>冷蓝</option></select></div>
        <div class="param-row"><span class="param-label">画风</span><select v-model="artStyle" class="param-value input" style="width:100%"><option>跟随项目</option><option>动漫</option><option>写实</option></select></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shot-editor { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.shot-header { padding: 12px 20px; background: var(--bg-secondary, #111827); border-bottom: 1px solid var(--border, #1e293b); display: flex; align-items: center; justify-content: space-between; }
.shot-nav { display: flex; align-items: center; gap: 8px; }
.shot-title { font-size: 14px; font-weight: 700; color: var(--text-primary, #e2e8f0); }
.shot-actions { display: flex; gap: 8px; }
.se-layout { display: flex; flex: 1; overflow: hidden; }
.se-canvas { flex: 1; background: var(--bg-primary, #0a0e1a); display: flex; align-items: center; justify-content: center; position: relative; }
.se-preview { width: 720px; height: 405px; border: 1px solid var(--border, #1e293b); border-radius: 8px; background: linear-gradient(135deg,rgba(102,126,234,.15),rgba(118,75,162,.08)); display: flex; align-items: center; justify-content: center; font-size: 64px; }
.se-panel { width: 380px; background: var(--bg-secondary, #111827); border-left: 1px solid var(--border, #1e293b); padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.cam-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }
.cam-option { padding: 12px; border: 1px solid var(--border, #1e293b); border-radius: 8px; background: var(--bg-card, #141a2e); cursor: pointer; text-align: center; font-size: 11px; }
.cam-option.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.08); }
.cam-option:hover { border-color: var(--border-strong, #334155); }
.cam-icon { font-size: 24px; margin-bottom: 4px; display: block; }
.cam-desc { font-size: 9px; color: var(--text-muted, #64748b); }
.param-row { display: flex; align-items: center; gap: 10px; }
.param-label { width: 60px; font-size: 12px; color: var(--text-secondary, #94a3b8); flex-shrink: 0; }
.param-value { flex: 1; }
.dialogue-item { padding: 10px; background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: 6px; margin-bottom: 6px; }
.dialogue-char { font-size: 11px; color: var(--accent, #818cf8); font-weight: 600; margin-bottom: 2px; }
.dialogue-text { font-size: 12px; color: var(--text-primary, #e2e8f0); }
.section-title { font-size: 16px; font-weight: 700; color: var(--text-primary, #e2e8f0); margin-bottom: 12px; }
/* shared.css inline utilities */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; text-decoration: none; transition: all .2s; white-space: nowrap; }
.btn-primary { background: var(--accent, #818cf8); color: #fff; }
.btn-primary:hover { background: var(--accent-strong, #6366f1); box-shadow: 0 0 20px rgba(99,102,241,.3); }
.btn-secondary { background: var(--bg-tertiary, #1a2332); color: var(--text-primary, #e2e8f0); border: 1px solid var(--border, #1e293b); }
.btn-ghost { background: transparent; color: var(--text-secondary, #94a3b8); }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-xs { padding: 4px 8px; font-size: 11px; }
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-green { background: rgba(16,185,129,.15); color: #34d399; }
.input { padding: 10px 14px; border-radius: 8px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 14px; outline: none; font-family: var(--font-sans); width: 100%; transition: border .2s; }
.input:focus { border-color: var(--accent, #818cf8); }
</style>
