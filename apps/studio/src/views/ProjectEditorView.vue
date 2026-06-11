<script setup lang="ts">
/**
 * ProjectEditorView.vue — 项目编辑器
 * 林染 🔮 2026-06-10: 参照阅文「我的作品」重设计
 *   - 深色主题统一
 *   - 更精致的分镜卡片
 *   - 项目概览 header
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { makeMockProject } from '../data/studio-mock'
import { STUDIO_THEMES, type StudioThemeId } from '../types/studio'
import type { Shot, ShotStatus, Project as StudioProject } from '../types/studio'
import { SCENE_TEMPLATES_V2, getSceneTemplateMeta } from '../data/scene-templates-v2'
import { CHARACTER_ARCHETYPES_V2, getArchetypeMeta } from '../data/character-archetypes-v2'
import { SCENE_TEMPLATES, type SceneTemplate } from '../types/scene'
import { CHARACTER_ARCHETYPES } from '../types/character'
import ShotStream from '../components/project/ShotStream.vue'
import { getApi } from '../api-bridge'
import type { ProjectDTO } from '@manhuaworks/api-client'

const route = useRoute()
const api = getApi()
const project = ref<StudioProject>(makeMockProject(1))
const selectedIds = ref<string[]>([])
const editingId = ref<string | null>(null)
const loadingProject = ref(false)
const projectError = ref<string | null>(null)

const themeId = ref<StudioThemeId>(
  (localStorage.getItem('studio_theme') as StudioThemeId) ?? 'dark-workshop',
)

function applyTheme() {
  document.documentElement.setAttribute('data-theme', themeId.value)
}

watch(themeId, t => { localStorage.setItem('studio_theme', t); applyTheme() }, { immediate: true })

function dtoToStudioProject(dto: ProjectDTO, fallbackName?: string): StudioProject {
  const mock = makeMockProject(1) as unknown as StudioProject
  return {
    ...mock,
    id: dto.id,
    name: (dto as unknown as { title?: string; name?: string }).title ?? dto.name ?? fallbackName ?? mock.name,
    description: dto.description ?? mock.description,
    status: dto.status === 'archived' ? 'archived' : dto.status === 'active' ? 'in-progress' : 'planning',
    createdAt: dto.created_at ? new Date(dto.created_at).getTime() : mock.createdAt,
    updatedAt: dto.updated_at ? new Date(dto.updated_at).getTime() : mock.updatedAt,
  }
}

function shotDtoToStudio(s: { id: string; title?: string; description?: string; duration?: number; status?: string; index?: number; scene_template?: string }, p: StudioProject): Shot {
  const mockShot = makeMockProject(1).shots[0]
  return {
    ...mockShot,
    id: s.id, index: s.index ?? 0,
    title: s.title ?? mockShot.title,
    description: s.description ?? mockShot.description,
    duration: s.duration ?? mockShot.duration,
    status: (s.status as ShotStatus) ?? 'draft',
    sceneTemplate: (s.scene_template ?? mockShot.sceneTemplate) as SceneTemplate,
  }
}

async function loadProject(): Promise<void> {
  const id = (route.params?.id as string | undefined) ?? ''
  if (!id || id === 'new' || id.startsWith('m') || id.startsWith('local-') || id.startsWith('p-')) return
  loadingProject.value = true; projectError.value = null
  try {
    const raw = await api.projects.get(id) as unknown as { data?: ProjectDTO }
    const dto: ProjectDTO = (raw && 'data' in raw ? raw.data : raw) as ProjectDTO
    if (dto?.id) {
      project.value = dtoToStudioProject(dto)
      project.value.shots = []
      try {
        const rawShots = await api.projects.listShots(id, { page: 1, pageSize: 100 }) as unknown as { data?: { items?: unknown[] }; items?: unknown[] }
        const items = rawShots?.data?.items ?? rawShots?.items ?? []
        project.value.shots = (items as Array<{ id: string; title?: string; description?: string; duration?: number; status?: string; index?: number; scene_template?: string }>).map(s => shotDtoToStudio(s, project.value))
      } catch {}
    }
  } catch (e) { projectError.value = (e as Error).message }
  finally { loadingProject.value = false }
}

onMounted(() => { applyTheme(); void loadProject() })

const editingShot = computed<Shot | null>(() => project.value.shots.find(s => s.id === editingId.value) ?? null)
const hasShots = computed(() => project.value.shots.length > 0)

const stats = computed(() => {
  const shots = project.value.shots
  const totalDuration = shots.reduce((s, x) => s + x.duration, 0)
  const byStatus: Record<ShotStatus, number> = { draft: 0, scripted: 0, generating: 0, ready: 0, approved: 0, rejected: 0 }
  for (const s of shots) byStatus[s.status]++
  return { totalDuration, byStatus, total: shots.length }
})

const statusList: ShotStatus[] = ['draft', 'scripted', 'generating', 'ready', 'approved', 'rejected']

const statusConfig: Record<ShotStatus, { label: string; color: string; bg: string }> = {
  draft: { label: '草稿', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
  scripted: { label: '已编剧', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  generating: { label: '生成中', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  ready: { label: '就绪', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  approved: { label: '已审核', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  rejected: { label: '驳回', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
}

function onSelect(shotId: string, additive: boolean) {
  if (!additive) { selectedIds.value = shotId ? [shotId] : [] }
  else { const set = new Set(selectedIds.value); if (set.has(shotId)) set.delete(shotId); else set.add(shotId); selectedIds.value = [...set] }
  editingId.value = shotId
}

function onEdit(shotId: string) { editingId.value = shotId }
function onDelete(shotId: string) {
  const idx = project.value.shots.findIndex(s => s.id === shotId)
  if (idx < 0) return
  project.value.shots.splice(idx, 1)
  project.value.shots.forEach((s, i) => (s.index = i + 1))
  selectedIds.value = selectedIds.value.filter(x => x !== shotId)
  if (editingId.value === shotId) editingId.value = null
}

function onDuplicate(shotId: string) {
  const src = project.value.shots.find(s => s.id === shotId)
  if (!src) return
  const copy: Shot = { ...src, id: `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, index: src.index + 1, title: `${src.title} · 副本`, status: 'draft', locked: false, createdAt: Date.now(), updatedAt: Date.now() }
  const idx = project.value.shots.findIndex(s => s.id === shotId)
  project.value.shots.splice(idx + 1, 0, copy)
  project.value.shots.forEach((s, i) => (s.index = i + 1))
  editingId.value = copy.id
}

function onLock(shotId: string) { const s = project.value.shots.find(x => x.id === shotId); if (s) s.locked = !s.locked }

function onReorder(fromId: string, toId: string) {
  const from = project.value.shots.find(s => s.id === fromId)
  const to = project.value.shots.find(s => s.id === toId)
  if (!from || !to) return
  const fi = project.value.shots.indexOf(from), ti = project.value.shots.indexOf(to)
  if (fi < 0 || ti < 0 || fi === ti) return
  project.value.shots.splice(fi, 1); project.value.shots.splice(ti, 0, from)
  project.value.shots.forEach((s, i) => (s.index = i + 1))
}

function onAddShot() {
  const newShot: Shot = { id: `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, index: project.value.shots.length + 1, title: `新分镜 ${project.value.shots.length + 1}`, description: '点击编辑填写分镜描述…', characterArchetypes: ['youth'], sceneTemplate: 'cyberpunk', subSceneId: null, shotType: 'medium', cameraAngle: 'eye', cameraMove: 'static', dialogue: '', narration: '', duration: 4.0, status: 'draft', imageUrl: null, tags: [], note: '', weight: 1.0, locked: false, createdAt: Date.now(), updatedAt: Date.now() }
  project.value.shots.push(newShot)
  editingId.value = newShot.id; selectedIds.value = [newShot.id]
}

function onUpdateShot(patch: Partial<Shot>) {
  if (!editingShot.value) return
  Object.assign(editingShot.value, patch, { updatedAt: Date.now() })
}

function onRemoveArchetype(arch: string) { if (!editingShot.value) return; editingShot.value.characterArchetypes = editingShot.value.characterArchetypes.filter(a => a !== arch) }
function onAddArchetype(arch: string) { if (!editingShot.value) return; if (!editingShot.value.characterArchetypes.includes(arch as never)) editingShot.value.characterArchetypes.push(arch as never) }

const themeAccent = computed(() => STUDIO_THEMES.find(x => x.id === themeId.value)?.accent ?? '#f59e0b')
</script>

<template>
  <div class="pe-root" :style="{ '--studio-accent': themeAccent }">
    <!-- ===== Header ===== -->
    <header class="pe-header">
      <div class="pe-header-left">
        <div class="pe-header-icon">📝</div>
        <div class="pe-header-info">
          <input
            v-model="project.name"
            class="pe-title-input"
            placeholder="项目名称"
          />
          <div class="pe-header-meta">
            <span class="pe-badge" :class="`pe-badge--${project.status}`">{{ project.status }}</span>
            <span class="pe-meta-dot">·</span>
            <span>{{ stats.total }} 个分镜</span>
            <span class="pe-meta-dot">·</span>
            <span>总时长 {{ stats.totalDuration.toFixed(1) }}s</span>
          </div>
        </div>
      </div>
      <div class="pe-header-right">
        <select v-model="themeId" class="pe-theme-select">
          <option v-for="t in STUDIO_THEMES" :key="t.id" :value="t.id">{{ t.icon }} {{ t.label }}</option>
        </select>
        <button class="pe-btn pe-btn--primary" @click="onAddShot">
          + 新分镜
        </button>
      </div>
    </header>

    <!-- ===== Stats Bar ===== -->
    <div class="pe-stats">
      <span
        v-for="(count, key) in stats.byStatus"
        :key="key"
        class="pe-stat-item"
        :style="{ '--s-color': statusConfig[key as ShotStatus]?.color }"
      >
        <span class="pe-stat-dot"></span>
        {{ statusConfig[key as ShotStatus]?.label ?? key }}
        <strong>{{ count }}</strong>
      </span>
    </div>

    <!-- ===== Body ===== -->
    <div class="pe-body">
      <!-- 🆕 空状态 -->
      <div v-if="!hasShots" class="pe-empty">
        <div class="pe-empty-icon">📝</div>
        <h2 class="pe-empty-title">项目还没有分镜</h2>
        <p class="pe-empty-desc">点击上方「+ 新分镜」创建第一个分镜，或用工作流批量生成</p>
        <div class="pe-empty-actions">
          <button class="pe-btn pe-btn--primary" @click="onAddShot">+ 创建第一个分镜</button>
          <router-link to="/workflow" class="pe-btn pe-btn--ghost">🔀 去工作流生成</router-link>
        </div>
      </div>

      <!-- Shot Stream -->
      <div v-else class="pe-content">
        <div class="pe-shots">
          <ShotStream
            :shots="project.shots"
            :selected-ids="selectedIds"
            default-layout="grid"
            @select="onSelect"
            @edit="onEdit"
            @delete="onDelete"
            @duplicate="onDuplicate"
            @lock="onLock"
            @reorder="onReorder"
          />
        </div>

        <!-- Editor Sidebar -->
        <aside v-if="editingShot" class="pe-editor">
          <div class="pe-editor-head">
            <h3 class="pe-editor-title">
              <span class="pe-editor-no">#{{ editingShot.index }}</span>
              分镜编辑
            </h3>
            <button class="pe-editor-close" @click="editingId = null">✕</button>
          </div>

          <div class="pe-editor-body">
            <label class="pe-field">
              <span class="pe-field-label">标题</span>
              <input :value="editingShot.title" class="pe-input" @input="(e) => onUpdateShot({ title: (e.target as HTMLInputElement).value })" />
            </label>

            <label class="pe-field">
              <span class="pe-field-label">画面描述（AI 提示词）</span>
              <textarea :value="editingShot.description" rows="3" class="pe-input pe-textarea" @input="(e) => onUpdateShot({ description: (e.target as HTMLTextAreaElement).value })"></textarea>
            </label>

            <div class="pe-field-row">
              <label class="pe-field pe-field--sm">
                <span class="pe-field-label">景别</span>
                <select :value="editingShot.shotType" class="pe-input pe-select" @change="(e) => onUpdateShot({ shotType: (e.target as HTMLSelectElement).value as Shot['shotType'] })">
                  <option v-for="(_, k) in { 'extreme-wide': '1', wide: '2', medium: '3', 'close-up': '4', 'extreme-close': '5', 'over-shoulder': '6', pov: '7' }" :key="k" :value="k">{{ k }}</option>
                </select>
              </label>
              <label class="pe-field pe-field--sm">
                <span class="pe-field-label">视角</span>
                <select :value="editingShot.cameraAngle" class="pe-input pe-select" @change="(e) => onUpdateShot({ cameraAngle: (e.target as HTMLSelectElement).value as Shot['cameraAngle'] })">
                  <option v-for="(_, k) in { eye: '1', high: '2', low: '3', 'birds-eye': '4', 'worms-eye': '5', dutch: '6' }" :key="k" :value="k">{{ k }}</option>
                </select>
              </label>
              <label class="pe-field pe-field--sm">
                <span class="pe-field-label">运镜</span>
                <select :value="editingShot.cameraMove" class="pe-input pe-select" @change="(e) => onUpdateShot({ cameraMove: (e.target as HTMLSelectElement).value as Shot['cameraMove'] })">
                  <option v-for="(_, k) in { static: '1', push: '2', pull: '3', pan: '4', tilt: '5', track: '6', zoom: '7' }" :key="k" :value="k">{{ k }}</option>
                </select>
              </label>
            </div>

            <label class="pe-field">
              <span class="pe-field-label">场景模板</span>
              <select :value="editingShot.sceneTemplate" class="pe-input pe-select" @change="(e) => onUpdateShot({ sceneTemplate: (e.target as HTMLSelectElement).value as Shot['sceneTemplate'] })">
                <option v-for="t in SCENE_TEMPLATES" :key="t" :value="t">{{ getSceneTemplateMeta(t).icon }} {{ getSceneTemplateMeta(t).label }}</option>
              </select>
            </label>

            <div class="pe-field">
              <span class="pe-field-label">角色 archetype</span>
              <div class="pe-archetypes">
                <button
                  v-for="a in CHARACTER_ARCHETYPES_V2"
                  :key="a.id"
                  type="button"
                  class="pe-archetype-chip"
                  :class="{ 'pe-archetype-chip--on': editingShot.characterArchetypes.includes(a.id) }"
                  @click="editingShot.characterArchetypes.includes(a.id) ? onRemoveArchetype(a.id) : onAddArchetype(a.id)"
                >{{ a.icon }} {{ a.label }}</button>
              </div>
            </div>

            <label class="pe-field">
              <span class="pe-field-label">对白</span>
              <textarea :value="editingShot.dialogue" rows="2" class="pe-input pe-textarea" @input="(e) => onUpdateShot({ dialogue: (e.target as HTMLTextAreaElement).value })"></textarea>
            </label>

            <label class="pe-field">
              <span class="pe-field-label">旁白</span>
              <textarea :value="editingShot.narration" rows="2" class="pe-input pe-textarea" @input="(e) => onUpdateShot({ narration: (e.target as HTMLTextAreaElement).value })"></textarea>
            </label>

            <div class="pe-field-row">
              <label class="pe-field pe-field--sm">
                <span class="pe-field-label">时长（秒）</span>
                <input type="number" step="0.5" min="0.5" :value="editingShot.duration" class="pe-input" @input="(e) => onUpdateShot({ duration: Number((e.target as HTMLInputElement).value) })" />
              </label>
              <label class="pe-field pe-field--sm">
                <span class="pe-field-label">状态</span>
                <select :value="editingShot.status" class="pe-input pe-select" @change="(e) => onUpdateShot({ status: (e.target as HTMLSelectElement).value as ShotStatus })">
                  <option v-for="s in statusList" :key="s" :value="s">{{ s }}</option>
                </select>
              </label>
            </div>

            <label class="pe-field">
              <span class="pe-field-label">备注</span>
              <textarea :value="editingShot.note" rows="2" class="pe-input pe-textarea" @input="(e) => onUpdateShot({ note: (e.target as HTMLTextAreaElement).value })"></textarea>
            </label>
          </div>
        </aside>

        <!-- Tips Panel -->
        <aside v-else class="pe-tips">
          <h3 class="pe-tips-title">💡 使用提示</h3>
          <ul class="pe-tips-list">
            <li>点击分镜卡片进行编辑</li>
            <li>按住 Shift / Ctrl 批量选择</li>
            <li>拖拽卡片可调整顺序</li>
            <li>双击快速进入编辑模式</li>
          </ul>
          <h3 class="pe-tips-title">🎬 镜头语言</h3>
          <div class="pe-tips-grid">
            <div><strong>景别</strong> 远/全/中/近/特</div>
            <div><strong>视角</strong> 平/俯/仰/鸟瞰</div>
            <div><strong>运镜</strong> 固定/推/拉/摇</div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pe-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--bg-primary, #0a0e1a);
  color: var(--text-primary, #e4e4e7);
}

/* ===== Header ===== */
.pe-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  gap: 16px;
}

.pe-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pe-header-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.pe-header-info { display: flex; flex-direction: column; gap: 4px; }

.pe-title-input {
  font-size: 18px;
  font-weight: 700;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-primary, #e4e4e7);
  padding: 2px 8px;
  width: 280px;
}

.pe-title-input:hover { border-color: var(--border, #1f2937); }
.pe-title-input:focus { border-color: var(--accent, #818cf8); outline: none; }

.pe-header-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}

.pe-meta-dot { opacity: 0.4; }

.pe-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 10px;
  text-transform: uppercase;
}

.pe-badge--in-progress { background: rgba(96,165,250,0.12); color: #60a5fa; }
.pe-badge--planning { background: rgba(251,191,36,0.12); color: #fbbf24; }
.pe-badge--completed { background: rgba(52,211,153,0.12); color: #34d399; }
.pe-badge--review, .pe-badge--archived { background: rgba(156,163,175,0.12); color: #9ca3af; }

.pe-header-right { display: flex; align-items: center; gap: 8px; }

.pe-theme-select {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1f2937);
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
  cursor: pointer;
}

/* ===== Buttons ===== */
.pe-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1f2937);
  color: var(--text-secondary, #94a3b8);
  font-size: 13px;
  cursor: pointer;
  transition: all 200ms;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.pe-btn:hover { border-color: var(--accent, #818cf8); color: var(--text-primary, #e4e4e7); }

.pe-btn--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  font-weight: 600;
}

.pe-btn--primary:hover { box-shadow: 0 4px 16px rgba(102,126,234,0.3); transform: translateY(-1px); }

.pe-btn--ghost { background: transparent; border: 1px dashed var(--border, #1f2937); }

/* ===== Stats ===== */
.pe-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 24px;
  border-bottom: 1px solid var(--border, #1f2937);
  background: rgba(17,24,39,0.5);
}

.pe-stat-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}

.pe-stat-item strong { color: var(--text-primary, #e4e4e7); font-size: 12px; }

.pe-stat-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--s-color, #9ca3af);
}

/* ===== Body ===== */
.pe-body { flex: 1; overflow: hidden; }

/* ===== Empty ===== */
.pe-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
}

.pe-empty-icon { font-size: 48px; opacity: 0.4; }
.pe-empty-title { font-size: 18px; font-weight: 700; margin: 0; }
.pe-empty-desc { font-size: 13px; color: var(--text-secondary, #94a3b8); }
.pe-empty-actions { display: flex; gap: 10px; margin-top: 4px; }

/* ===== Content ===== */
.pe-content { display: flex; height: 100%; overflow: hidden; }
.pe-shots { flex: 1; overflow: hidden; min-width: 0; }

/* ===== Editor Sidebar ===== */
.pe-editor {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pe-editor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border, #1f2937);
}

.pe-editor-title {
  font-size: 13px;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pe-editor-no {
  background: var(--accent, #818cf8);
  color: white;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.pe-editor-close {
  border: none;
  background: transparent;
  color: var(--text-secondary, #94a3b8);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
}

.pe-editor-close:hover { color: #ef4444; }

.pe-editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ===== Fields ===== */
.pe-field { display: flex; flex-direction: column; gap: 4px; }
.pe-field--sm { flex: 1; min-width: 0; }

.pe-field-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary, #94a3b8);
}

.pe-field-row { display: flex; gap: 8px; }

.pe-input {
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1f2937);
  color: var(--text-primary, #e4e4e7);
  font-size: 12px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 200ms;
}

.pe-input:focus { border-color: var(--accent, #818cf8); outline: none; }

.pe-textarea { resize: vertical; font-family: inherit; }

.pe-select { cursor: pointer; }

/* ===== Archetypes ===== */
.pe-archetypes { display: flex; flex-wrap: wrap; gap: 4px; }

.pe-archetype-chip {
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid var(--border, #1f2937);
  background: transparent;
  color: var(--text-secondary, #94a3b8);
  font-size: 10px;
  cursor: pointer;
  transition: all 150ms;
}

.pe-archetype-chip:hover { border-color: var(--accent, #818cf8); }
.pe-archetype-chip--on { background: rgba(129,140,248,0.12); border-color: var(--accent, #818cf8); color: var(--accent, #818cf8); }

/* ===== Tips Panel ===== */
.pe-tips {
  width: 220px;
  flex-shrink: 0;
  border-left: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  padding: 16px;
  overflow-y: auto;
}

.pe-tips-title {
  font-size: 12px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--text-primary, #e4e4e7);
}

.pe-tips-list {
  list-style: none;
  padding: 0;
  margin: 0 0 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pe-tips-list li {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
  padding-left: 8px;
}

.pe-tips-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pe-tips-grid div {
  font-size: 10px;
  color: var(--text-secondary, #94a3b8);
}

.pe-tips-grid strong { color: var(--text-primary, #e4e4e7); margin-right: 4px; }
</style>
