<script setup lang="ts">
/**
 * ShotEditorView.vue — 镜头编辑 (1:1 复刻 studio-shot-editor.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getApi } from '../api-bridge'
import ImagePreview from '../components/ImagePreview.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const loadError = ref<string | null>(null)

// -- mock fallback (used when API unavailable) --
const MOCK_SHOT = {
  shotNum: 2,
  title: '书房对白',
  camera: 'mid',
  movement: '静态固定',
  durationSec: 18,
  transition: '硬切',
  tone: '跟随场景',
  artStyle: '跟随项目',
  dialogues: [
    { char: '🎭 林启', text: '父亲，我想下山去看看外面的世界。' },
    { char: '🎭 林父', text: '你可知山外是什么？不是风景，是江湖。' },
  ],
}

const shotNum = ref(MOCK_SHOT.shotNum)
const shotTitle = ref(MOCK_SHOT.title)
const camOptions = [
  { id: 'mid', icon: '🎬', name: '中景', desc: '人物对话', active: true },
  { id: 'close', icon: '🔍', name: '特写', desc: '表情强调', active: false },
  { id: 'wide', icon: '🏞️', name: '远景', desc: '场景交代', active: false },
  { id: 'top', icon: '📐', name: '俯拍', desc: '空间关系', active: false },
]
const activeCam = ref(MOCK_SHOT.camera)
const camMovement = ref(MOCK_SHOT.movement)
const duration = ref(MOCK_SHOT.durationSec)
const transition = ref(MOCK_SHOT.transition)
const tone = ref(MOCK_SHOT.tone)
const artStyle = ref(MOCK_SHOT.artStyle)
const imageUrl = ref<string | null>(null)
const dialogues = ref(MOCK_SHOT.dialogues.map(d => ({ ...d })))
const shotStatus = ref<string>('scripted')

const STATUS_LABEL_MAP: Record<string, string> = {
  draft: '草稿', scripted: '脚本完成', generating: '生成中',
  ready: '待审核', approved: '已通过', rejected: '已拒绝',
  wip: '制作中', review: '待审核', done: '已完成',
}

/** Populate reactive refs from API shot data */
function applyShotData(shot: Record<string, any>) {
  if (shot.order_index != null) shotNum.value = shot.order_index + 1
  if (shot.name) shotTitle.value = shot.name
  if (shot.title) shotTitle.value = shot.title
  if (shot.camera) activeCam.value = shot.camera
  if (shot.movement) camMovement.value = shot.movement
  if (shot.duration_sec != null) duration.value = shot.duration_sec
  if (shot.duration_ms != null) duration.value = Math.round(shot.duration_ms / 1000)
  if (shot.transition) transition.value = shot.transition
  if (shot.tone) tone.value = shot.tone
  if (shot.art_style) artStyle.value = shot.art_style
  if (shot.status) shotStatus.value = shot.status
  if (shot.thumbnail_url || shot.image_url) imageUrl.value = shot.thumbnail_url || shot.image_url
  if (Array.isArray(shot.dialogues)) dialogues.value = shot.dialogues
}

onMounted(async () => {
  const projectId = route.params.id as string
  const shotId = route.params.shotId as string
  if (!projectId || !shotId) return
  loading.value = true
  loadError.value = null
  try {
    const api = getApi()
    // Try direct shot endpoint first, then fall back to list lookup
    try {
      const shot = await api.http.get<Record<string, any>>(
        `/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}`,
      )
      applyShotData(shot)
    } catch {
      // Direct endpoint may not exist — fetch list and find matching shot
      const resp = await api.projects.listShots(projectId, { pageSize: 200 })
      const found = resp.list.find((s) => s.id === shotId)
      if (found) {
        applyShotData(found)
      } else {
        loadError.value = '未找到对应镜头'
      }
    }
  } catch (e: any) {
    loadError.value = e?.message || '加载失败'
    // keep mock data as fallback — already set
  } finally {
    loading.value = false
  }
})

function selectCam(id: string) { activeCam.value = id }
function addDialogue() { dialogues.value.push({ char: '🎭 新角色', text: '' }) }
function prevShot() { router.push(`/project/${route.params.id}/shots`) }
function nextShot() { router.push(`/project/${route.params.id}/shots`) }
function goBack() { router.push(`/project/${route.params.id}/shots`) }
const saving = ref(false); const saveError = ref(''); const saveSuccess = ref(false)
async function saveShot() {
  saving.value = true; saveError.value = ''; saveSuccess.value = false
  try {
    const api = getApi()
    const projectId = route.params.id as string
    const shotId = route.params.shotId as string
    const payload = {
      name: shotTitle.value,
      order_index: shotNum.value - 1,
      description: dialogues.value.map(d => `${d.char}: ${d.text}`).join('\n'),
      duration_ms: duration.value * 1000,
    }
    if (shotId) {
      await api.http.patch(`/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}`, payload)
    } else {
      await api.http.post(`/projects/${encodeURIComponent(projectId)}/shots`, payload)
    }
    saveSuccess.value = true
  } catch (err: any) { saveError.value = err.message || '保存失败' }
  finally { saving.value = false }
}
</script>

<template>
  <div class="shot-editor">
    <div v-if="loading" class="se-loading">⏳ 加载镜头中...</div>
    <div v-else-if="loadError" class="se-error">⚠️ {{ loadError }}</div>
    <template v-else>
    <div class="shot-header">
      <div class="shot-nav">
        <button class="btn btn-xs btn-ghost" @click="prevShot">← 上一镜</button>
        <span class="shot-title">第 {{ shotNum }} 镜 · {{ shotTitle }}</span>
        <span class="badge" :class="{ 'badge-green': shotStatus === 'approved' || shotStatus === 'done' || shotStatus === 'scripted', 'badge-yellow': shotStatus === 'generating' || shotStatus === 'wip' || shotStatus === 'ready' || shotStatus === 'review', 'badge-gray': shotStatus === 'draft' || shotStatus === 'rejected' }">{{ STATUS_LABEL_MAP[shotStatus] ?? shotStatus }}</span>
        <button class="btn btn-xs btn-ghost" @click="nextShot">下一镜 →</button>
      </div>
      <div class="shot-actions">
        <button class="btn btn-xs btn-ghost" @click="goBack">📋 查看宫格</button>
        <button class="btn btn-primary btn-sm" @click="saveShot" :disabled="saving">{{ saving ? '保存中...' : saveSuccess ? '✅ 已保存' : '💾 保存' }}</button>
        <span v-if="saveError" class="ml-2 text-xs text-red-500">{{ saveError }}</span>
      </div>
    </div>
    <div class="se-layout">
      <div class="se-canvas">
        <ImagePreview :src="imageUrl" fallback="🎬" aspect="16:9" rounded="8px" class="se-preview" />
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
        <div v-for="(d, i) in dialogues" :key="i" class="flex items-center gap-2 py-1">
          <input
            v-model="d.char"
            class="w-24 rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            placeholder="角色"
          />
          <span class="text-gray-400">:</span>
          <input
            v-model="d.text"
            class="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            placeholder="对白内容"
          />
          <button
            @click="dialogues.splice(i, 1)"
            class="text-gray-400 hover:text-red-500"
            title="删除"
          >×</button>
        </div>
        <button class="btn btn-sm btn-secondary" style="width:100%" @click="addDialogue">+ 添加对白</button>
        <div class="section-title">🎨 风格覆盖</div>
        <div class="param-row"><span class="param-label">色调</span><select v-model="tone" class="param-value input" style="width:100%"><option>跟随场景</option><option>暖黄</option><option>冷蓝</option></select></div>
        <div class="param-row"><span class="param-label">画风</span><select v-model="artStyle" class="param-value input" style="width:100%"><option>跟随项目</option><option>动漫</option><option>写实</option></select></div>
      </div>
    </div>
    </template>
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
.se-preview { width: 720px; height: 405px; }
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
.se-loading { padding: 10px 20px; background: rgba(99,102,241,.08); color: var(--accent, #818cf8); font-size: 13px; text-align: center; }
.se-error { padding: 10px 20px; background: rgba(239,68,68,.1); color: #f87171; font-size: 13px; text-align: center; }
</style>
