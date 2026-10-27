<script setup lang="ts">
/**
 * StoryboardGridView.vue — 镜头宫格视图 (1:1 复刻 studio-storyboard-grid.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@manhuaworks/ui'
import ImagePreview from '../components/ImagePreview.vue'
import { useProjectStore } from '../stores/project'

interface GridShot {
  num: string
  id: string
  title: string
  scene: string
  duration: string
  cams: number
  cam: string
  status: string
  color: string
  image_url: string | null
}

const router = useRouter()
const route = useRoute()
const toast = useToast()
const store = useProjectStore()
const projectName = ref('未命名项目')
const loading = ref(true)
const viewMode = ref<'grid' | 'list'>('grid')
const statusFilter = ref('全部')

const FALLBACK_COLORS = [
  'rgba(102,126,234,.2)', 'rgba(245,158,11,.2)', 'rgba(16,185,129,.2)', 'rgba(239,68,68,.2)',
  'rgba(251,191,36,.2)', 'rgba(59,130,246,.2)', 'rgba(139,92,246,.2)', 'rgba(248,113,113,.2)',
]

/** Hardcoded mock data — used only when the store fails to load. */
const MOCK_SHOTS: GridShot[] = [
  { num: '01', id: 'mock-1', title: '长安夜·开场', scene: '🏯 宫殿', duration: '24s', cams: 4, cam: '中景', status: 'done', color: FALLBACK_COLORS[0], image_url: null },
  { num: '02', id: 'mock-2', title: '书房对白', scene: '🏠 室内', duration: '18s', cams: 3, cam: '特写', status: 'wip', color: FALLBACK_COLORS[1], image_url: null },
  { num: '03', id: 'mock-3', title: '后山练剑', scene: '🌳 室外', duration: '30s', cams: 2, cam: '远景', status: 'review', color: FALLBACK_COLORS[2], image_url: null },
  { num: '04', id: 'mock-4', title: '初遇暗影尊', scene: '⚔️ 战斗', duration: '36s', cams: 1, cam: '中景', status: 'draft', color: FALLBACK_COLORS[3], image_url: null },
  { num: '05', id: 'mock-5', title: '长安集市', scene: '🏙️ 都市', duration: '20s', cams: 3, cam: '俯拍', status: 'done', color: FALLBACK_COLORS[4], image_url: null },
  { num: '06', id: 'mock-6', title: '偶遇苏婉', scene: '🏙️ 都市', duration: '22s', cams: 2, cam: '特写', status: 'done', color: FALLBACK_COLORS[5], image_url: null },
  { num: '07', id: 'mock-7', title: '朝堂风云', scene: '🏯 宫殿', duration: '40s', cams: 0, cam: '远景', status: 'draft', color: FALLBACK_COLORS[6], image_url: null },
  { num: '08', id: 'mock-8', title: '夜袭', scene: '⚔️ 战斗', duration: '28s', cams: 2, cam: '中景', status: 'review', color: FALLBACK_COLORS[7], image_url: null },
]

const CAMERA_LABELS = ['远景', '中景', '近景', '特写', '俯拍', '全景'] as const

/** Derive a camera label from shot description keywords, or rotate by order_index. */
function deriveCam(description: string | undefined, orderIndex: number): string {
  if (description) {
    for (const label of CAMERA_LABELS) {
      if (description.includes(label)) return label
    }
  }
  return CAMERA_LABELS[orderIndex % CAMERA_LABELS.length]!
}

/** Derive camera count from duration — longer shots tend to use more angles. */
function deriveCams(durationMs: number | undefined): number {
  if (!durationMs) return 2
  return Math.max(1, Math.min(6, Math.round(durationMs / 8000)))
}

const useFallback = ref(false)

/** Map store ShotDTO[] → display-friendly GridShot[]. Falls back to mock data only when useFallback is true. */
const gridShots = computed<GridShot[]>(() => {
  if (useFallback.value) {
    return MOCK_SHOTS
  }
  return store.shots.map((s) => ({
    num: String(s.order_index + 1).padStart(2, '0'),
    id: String(s.id),
    title: s.name,
    scene: s.description || '未描述场景',
    duration: s.duration_ms ? `${Math.round(s.duration_ms / 1000)}s` : '0s',
    cams: deriveCams(s.duration_ms),
    cam: deriveCam(s.description, s.order_index),
    status: s.status,
    color: FALLBACK_COLORS[s.order_index % FALLBACK_COLORS.length],
    image_url: s.thumbnail_url ?? null,
  }))
})

const statusBadge = (s: string) => {
  switch (s) {
    case 'done': return ['✓ 完成', 'badge-green']
    case 'wip': return ['制作中', 'badge-amber']
    case 'review': return ['待审核', 'badge-blue']
    case 'archived': return ['已归档', 'badge-amber']
    default: return ['草稿', 'badge-amber']
  }
}

const filteredShots = computed(() =>
  statusFilter.value === '全部'
    ? gridShots.value
    : gridShots.value.filter(s => s.status === statusFilter.value),
)

const filterChips = [
  { label: '全部', value: '全部' },
  { label: '草稿', value: 'draft' },
  { label: '制作中', value: 'wip' },
  { label: '待审核', value: 'review' },
  { label: '已完成', value: 'done' },
]

onMounted(async () => {
  loading.value = true
  const projectId = String(route.params.id || '1')
  try {
    await store.loadOne(projectId)
    if (store.current?.name) projectName.value = store.current.name
    await store.loadShots(projectId)
  } catch {
    useFallback.value = true
    projectName.value = '示例项目'
    toast.error('加载镜头失败，已使用示例数据')
  } finally {
    loading.value = false
  }
})

function openShot(shot: GridShot) {
  const projectId = route.params.id || '1'
  router.push(`/project/${projectId}/shots/${shot.id}`)
}

async function onNewShot() {
  const projectId = String(route.params.id || '1')
  const nextIndex = store.shots.length
  const nextNum = String(nextIndex + 1).padStart(2, '0')
  try {
    const created = await store.createShot(projectId, {
      name: `新镜头 ${nextNum}`,
      description: '🏠 室内',
      order_index: nextIndex,
    })
    toast.success(`已创建镜头 ${nextNum}`)
    router.push(`/project/${projectId}/shots/${created.id}`)
  } catch {
    toast.error('创建镜头失败')
  }
}
</script>

<template>
  <div class="storyboard-grid">
    <div class="gg-toolbar">
      <span class="gg-title">🎞️ {{ projectName }} · 镜头宫格</span>
      <span class="gg-count">{{ gridShots.length }} 镜 · {{ viewMode === 'grid' ? '3×3 宫格' : '列表视图' }}</span>
      <div class="gg-filters">
        <span v-for="f in filterChips" :key="f.value" class="chip" :class="{ active: statusFilter === f.value }" @click="statusFilter = f.value">{{ f.label }}</span>
      </div>
      <div class="gg-view-toggle">
        <button class="btn btn-xs" :class="viewMode === 'grid' ? 'btn-secondary' : 'btn-ghost'" @click="viewMode = 'grid'">⬜ 3×3</button>
        <button class="btn btn-xs" :class="viewMode === 'list' ? 'btn-secondary' : 'btn-ghost'" @click="viewMode = 'list'">📋 列表</button>
        <button class="btn btn-primary btn-xs gg-new-shot" @click="onNewShot">+ 新建镜头</button>
      </div>
    </div>
    <!-- Loading skeleton -->
    <div v-if="loading" class="gg-grid" :class="{ 'gg-grid--list': viewMode === 'list' }">
      <div v-for="i in 9" :key="'skel-' + i" class="gg-cell gg-cell--skeleton">
        <div class="gg-skeleton-preview"></div>
        <div class="gg-skeleton-body">
          <div class="gg-skeleton-line gg-skeleton-line--title"></div>
          <div class="gg-skeleton-line gg-skeleton-line--meta"></div>
        </div>
      </div>
    </div>
    <!-- Empty state: API succeeded but returned 0 shots -->
    <div v-else-if="gridShots.length === 0 && !useFallback" class="flex flex-col items-center justify-center py-16 text-gray-400" style="flex:1;">
      <span class="text-4xl mb-2">🎬</span>
      <p class="text-sm">暂无镜头，点击下方「+ 新建镜头」开始</p>
    </div>
    <!-- Loaded content -->
    <div v-else class="gg-grid" :class="{ 'gg-grid--list': viewMode === 'list' }">
      <div v-for="shot in filteredShots" :key="shot.id" class="gg-cell" @click="openShot(shot)">
        <div class="gg-cell-preview" :style="{ background: `linear-gradient(135deg,${shot.color},rgba(0,0,0,.05))` }">
          <ImagePreview :src="shot.image_url" :fallback="shot.scene.split(' ')[0]" aspect="16:9" rounded="0" size="md" class="gg-cell-img" />
          <div class="gg-cell-num">{{ shot.num }}</div>
          <div class="gg-cell-cam">{{ shot.cam }}</div>
        </div>
        <div class="gg-cell-body">
          <div class="gg-cell-title">{{ shot.title }} <span :class="['badge', statusBadge(shot.status)[1]]">{{ statusBadge(shot.status)[0] }}</span></div>
          <div class="gg-cell-meta"><span>{{ shot.scene }}</span><span>{{ shot.duration }}</span><span>{{ shot.cams }} 机位</span></div>
        </div>
      </div>
      <div class="gg-cell gg-cell--new" @click="onNewShot">
        <span class="gg-new-icon">➕</span>
        <span class="gg-new-text">新建镜头</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.storyboard-grid { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.gg-toolbar { display: flex; align-items: center; gap: 12px; padding: 10px 20px; background: var(--bg-secondary, #111827); border-bottom: 1px solid var(--border, #1e293b); }
.gg-title { font-size: 15px; font-weight: 700; color: var(--text-primary, #e2e8f0); }
.gg-count { font-size: 12px; color: var(--text-muted, #64748b); }
.gg-filters { display: flex; gap: 8px; margin-left: 12px; }
.chip { padding: 4px 10px; border-radius: 12px; font-size: 11px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-secondary, #94a3b8); cursor: pointer; }
.chip.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.08); color: var(--accent, #818cf8); }
.gg-view-toggle { display: flex; gap: 4px; margin-left: auto; }
.gg-new-shot { margin-left: 8px; }
.gg-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; padding: 20px; overflow-y: auto; flex: 1; }
.gg-grid--list { grid-template-columns: 1fr; }
.gg-cell { background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); overflow: hidden; cursor: pointer; }
.gg-cell:hover { border-color: var(--accent, #818cf8); }
.gg-cell--new { border-style: dashed; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; min-height: 200px; }
.gg-cell-preview { aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center; position: relative; }
.gg-cell-img { position: absolute; inset: 0; width: 100%; height: 100%; }
.gg-cell-num { position: absolute; top: 8px; left: 10px; padding: 2px 8px; border-radius: 4px; background: rgba(0,0,0,.6); color: #fff; font-size: 12px; font-weight: 700; }
.gg-cell-cam { position: absolute; bottom: 8px; right: 10px; padding: 2px 8px; border-radius: 4px; background: rgba(0,0,0,.6); color: #fff; font-size: 10px; }
.gg-cell-body { padding: 12px; }
.gg-cell-title { font-size: 13px; font-weight: 700; color: var(--text-primary, #e2e8f0); }
.gg-cell-meta { font-size: 11px; color: var(--text-muted, #64748b); display: flex; gap: 8px; margin-top: 2px; }
.gg-new-icon { font-size: 32px; }
.gg-new-text { font-size: 13px; color: var(--text-muted, #64748b); }
.gg-cell--skeleton { pointer-events: none; }
.gg-skeleton-preview { aspect-ratio: 16/9; background: var(--bg-tertiary, #1a2332); animation: gg-pulse 1.5s ease-in-out infinite; }
.gg-skeleton-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.gg-skeleton-line { height: 12px; border-radius: 4px; background: var(--bg-tertiary, #1a2332); animation: gg-pulse 1.5s ease-in-out infinite; }
.gg-skeleton-line--title { width: 70%; }
.gg-skeleton-line--meta { width: 50%; }
@keyframes gg-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
</style>
