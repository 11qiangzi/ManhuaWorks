<script setup lang="ts">
/**
 * StoryboardGridView.vue — 分镜宫格视图 (1:1 复刻 studio-storyboard-grid.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const projectName = ref('长安月下')
const viewMode = ref<'grid' | 'list'>('grid')
const statusFilter = ref('全部')

const shots = ref([
  { num: '01', title: '长安夜·开场', scene: '🏯 宫殿', duration: '24s', cams: 4, cam: '中景', status: 'done', color: 'rgba(102,126,234,.2)' },
  { num: '02', title: '书房对白', scene: '🏠 室内', duration: '18s', cams: 3, cam: '特写', status: 'generating', color: 'rgba(245,158,11,.2)' },
  { num: '03', title: '后山练剑', scene: '🌳 室外', duration: '30s', cams: 2, cam: '远景', status: 'script_done', color: 'rgba(16,185,129,.2)' },
  { num: '04', title: '初遇暗影尊', scene: '⚔️ 战斗', duration: '36s', cams: 1, cam: '中景', status: 'draft', color: 'rgba(239,68,68,.2)' },
  { num: '05', title: '长安集市', scene: '🏙️ 都市', duration: '20s', cams: 3, cam: '俯拍', status: 'done', color: 'rgba(251,191,36,.2)' },
  { num: '06', title: '偶遇苏婉', scene: '🏙️ 都市', duration: '22s', cams: 2, cam: '特写', status: 'done', color: 'rgba(59,130,246,.2)' },
  { num: '07', title: '朝堂风云', scene: '🏯 宫殿', duration: '40s', cams: 0, cam: '远景', status: 'draft', color: 'rgba(139,92,246,.2)' },
  { num: '08', title: '夜袭', scene: '⚔️ 战斗', duration: '28s', cams: 2, cam: '中景', status: 'script_done', color: 'rgba(248,113,113,.2)' },
])

const statusBadge = (s: string) => {
  switch(s) { case 'done': return ['✓', 'badge-green']; case 'generating': return ['生成中', 'badge-amber']; case 'script_done': return ['脚本完成', 'badge-blue']; default: return ['草稿', 'badge-amber'] }
}
const filteredShots = computed(() => statusFilter.value === '全部' ? shots.value : shots.value.filter(s => s.status === statusFilter.value))
function openShot(num: string) { router.push(`/project/1/shots/${parseInt(num)}`) }
</script>

<template>
  <div class="storyboard-grid">
    <div class="gg-toolbar">
      <span class="gg-title">🎞️ {{ projectName }} · 分镜宫格</span>
      <span class="gg-count">{{ shots.length }} 镜 · 3×3 宫格</span>
      <div class="gg-filters">
        <span v-for="f in ['全部','草稿','脚本完成','已完成']" :key="f" class="chip" :class="{ active: statusFilter === f }" @click="statusFilter = f">{{ f }}</span>
      </div>
      <div class="gg-view-toggle">
        <button class="btn btn-xs btn-secondary" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'">⬜ 3×3</button>
        <button class="btn btn-xs btn-ghost" @click="viewMode = 'list'">📋 列表</button>
        <button class="btn btn-primary btn-xs gg-new-shot">+ 新建分镜</button>
      </div>
    </div>
    <div class="gg-grid" :class="{ 'gg-grid--list': viewMode === 'list' }">
      <div v-for="shot in filteredShots" :key="shot.num" class="gg-cell" @click="openShot(shot.num)">
        <div class="gg-cell-preview" :style="{ background: `linear-gradient(135deg,${shot.color},rgba(0,0,0,.05))` }">
          <span class="gg-cell-icon">{{ shot.scene.split(' ')[0] }}</span>
          <div class="gg-cell-num">{{ shot.num }}</div>
          <div class="gg-cell-cam">{{ shot.cam }}</div>
        </div>
        <div class="gg-cell-body">
          <div class="gg-cell-title">{{ shot.title }} <span :class="['badge', statusBadge(shot.status)[1]]">{{ statusBadge(shot.status)[0] }}</span></div>
          <div class="gg-cell-meta"><span>{{ shot.scene }}</span><span>{{ shot.duration }}</span><span>{{ shot.cams }} 机位</span></div>
        </div>
      </div>
      <div class="gg-cell gg-cell--new" @click="openShot('09')">
        <span class="gg-new-icon">➕</span>
        <span class="gg-new-text">新建分镜</span>
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
.gg-cell-icon { font-size: 48px; }
.gg-cell-num { position: absolute; top: 8px; left: 10px; padding: 2px 8px; border-radius: 4px; background: rgba(0,0,0,.6); color: #fff; font-size: 12px; font-weight: 700; }
.gg-cell-cam { position: absolute; bottom: 8px; right: 10px; padding: 2px 8px; border-radius: 4px; background: rgba(0,0,0,.6); color: #fff; font-size: 10px; }
.gg-cell-body { padding: 12px; }
.gg-cell-title { font-size: 13px; font-weight: 700; color: var(--text-primary, #e2e8f0); }
.gg-cell-meta { font-size: 11px; color: var(--text-muted, #64748b); display: flex; gap: 8px; margin-top: 2px; }
.gg-new-icon { font-size: 32px; }
.gg-new-text { font-size: 13px; color: var(--text-muted, #64748b); }
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-green { background: rgba(16,185,129,.15); color: #34d399; }
.badge-amber { background: rgba(245,158,11,.15); color: #fbbf24; }
.badge-blue { background: rgba(59,130,246,.15); color: #60a5fa; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; text-decoration: none; transition: all .2s; }
.btn-primary { background: var(--accent, #818cf8); color: #fff; }
.btn-xs { padding: 4px 8px; font-size: 11px; }
.btn-secondary { background: var(--bg-tertiary, #1a2332); color: var(--text-primary, #e2e8f0); border: 1px solid var(--border, #1e293b); }
.btn-ghost { background: transparent; color: var(--text-secondary, #94a3b8); }
</style>
