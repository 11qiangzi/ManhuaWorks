<script setup lang="ts">
/**
 * StoryboardEditorView · 分镜编辑器
 * ManhuaWorks · W3 工坊流程精修
 *
 * 流程：
 * 1. 列出全部分镜（按 order 排序）
 * 2. 拖拽排序
 * 3. 调整每个镜头的时长
 * 4. 编辑镜头描述
 * 5. 实时统计总时长
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import DragDropList, { type DragItem } from '@/components/studio/DragDropList.vue'
import type { StoryboardShot } from '@/components/studio/StoryboardCard.vue'
import ProgressTimeline from '@/components/studio/ProgressTimeline.vue'

const router = useRouter()

const loading = ref(true)
const shots = ref<StoryboardShot[]>([])

/** 拖拽列表用 */
const dragItems = computed<DragItem[]>(() =>
  shots.value.map((s) => ({
    id: s.id,
    title: `#${s.order} · ${s.description.slice(0, 24) || '未命名镜头'}`,
    subtitle: `${s.duration}s · ${s.camera ?? '未分类'}`,
    data: { order: s.order, duration: s.duration }
  }))
)

const totalDuration = computed(() => shots.value.reduce((sum, s) => sum + s.duration, 0))
const doneCount = computed(() => shots.value.filter((s) => s.status === 'done').length)

const CAMERA_LABELS: Record<string, string> = { medium: '中景', close_up: '特写', wide: '远景', tracking: '跟拍', default: '未分类' }
const STATUS_LABELS: Record<string, string> = { done: '已完成', generating: '生成中', draft: '草稿', failed: '失败' }

const timelineSteps = computed(() => [
  { id: 'draft', label: '分镜草稿', status: doneCount.value > 0 ? 'done' as const : 'active' as const },
  { id: 'shot-list', label: '镜头列表', status: doneCount.value > 3 ? 'done' as const : 'pending' as const },
  { id: 'preview', label: '预览审片', status: 'pending' as const },
  { id: 'export', label: '导出成片', status: 'pending' as const }
])

async function loadShots() {
  loading.value = true
  try {
    // 实际：从后端拉；这里给占位演示
    await new Promise((r) => setTimeout(r, 200))
    shots.value = [
      { id: 's1', order: 1, description: '男主推开咖啡馆的门，夕阳从玻璃门洒进来', duration: 3, camera: 'medium', characters: ['林墨'], scene: '咖啡馆', status: 'done' },
      { id: 's2', order: 2, description: '特写男主侧脸，眼神带着犹豫', duration: 2, camera: 'close_up', characters: ['林墨'], status: 'done' },
      { id: 's3', order: 3, description: '女主从吧台回头，看向门口', duration: 2, camera: 'medium', characters: ['苏晚'], status: 'done' },
      { id: 's4', order: 4, description: '两人对视，远景拉远', duration: 4, camera: 'wide', status: 'generating' },
      { id: 's5', order: 5, description: '男主走向吧台', duration: 3, camera: 'tracking', status: 'draft' },
      { id: 's6', order: 6, description: '女主微笑，特写眼睛反光', duration: 2, camera: 'close_up', status: 'draft' }
    ]
  } finally {
    loading.value = false
  }
}

function onReorder(_from: number, _to: number, newList: DragItem[]) {
  // 同步到 shots
  const map = new Map(shots.value.map((s) => [s.id, s]))
  shots.value = newList
    .map((it, idx) => {
      const s = map.get(it.id)
      if (!s) return null
      return { ...s, order: idx + 1 }
    })
    .filter((s): s is StoryboardShot => s !== null)
}

function onAdjustDuration(shotId: string, delta: number) {
  const shot = shots.value.find((s) => s.id === shotId)
  if (!shot) return
  const next = Math.max(1, shot.duration + delta)
  shot.duration = next
}

function onEdit(shotId: string) {
  console.log('[分镜] 编辑', shotId)
}

function onRemove(shotId: string) {
  shots.value = shots.value.filter((s) => s.id !== shotId)
}

function onAddShot() {
  const next: StoryboardShot = {
    id: `s-${Date.now()}`,
    order: shots.value.length + 1,
    description: '新镜头',
    duration: 3,
    camera: 'medium',
    status: 'draft'
  }
  shots.value.push(next)
}

function onGenerateAll() {
  console.log('[分镜] 批量生成')
}

onMounted(() => {
  loadShots()
})
</script>

<template>
  <main class="sb">
    <!-- 顶栏 -->
    <header class="sb__nav">
      <div class="sb__brand">
        <button class="sb__back" @click="router.push('/studio')" title="返回">←</button>
        <span class="sb__logo">M</span>
        <span class="sb__brand-name">分镜编辑器</span>
      </div>
      <div class="sb__nav-right">
        <ThemeSwitcher mode="compact" />
      </div>
    </header>

    <div class="sb__content">
      <!-- 标题区 -->
      <section class="sb__header">
        <div>
          <h1>🎬 分镜编辑器 · 01 · 初遇</h1>
          <p>拖拽排序 · 调整时长 · 一键生成全部镜头</p>
        </div>
        <div class="sb__header-actions">
          <button type="button" class="qh-btn" @click="onAddShot">＋ 新增镜头</button>
          <button type="button" class="qh-btn qh-btn--primary" @click="onGenerateAll">⚡ 批量生成</button>
        </div>
      </section>

      <!-- 进度条 -->
      <ProgressTimeline :steps="timelineSteps" />

      <!-- 统计 -->
      <section class="sb__stats">
        <div class="sb__stat">
          <span class="sb__stat-label">镜头数</span>
          <strong>{{ shots.length }}</strong>
        </div>
        <div class="sb__stat">
          <span class="sb__stat-label">总时长</span>
          <strong>{{ totalDuration }}s</strong>
        </div>
        <div class="sb__stat">
          <span class="sb__stat-label">已完成</span>
          <strong>{{ doneCount }} / {{ shots.length }}</strong>
        </div>
        <div class="sb__stat sb__stat--bar">
          <div class="sb__bar">
            <div class="sb__bar-fill" :style="{ width: `${(doneCount / Math.max(shots.length, 1)) * 100}%` }" />
          </div>
        </div>
      </section>

      <!-- 加载 -->
      <div v-if="loading" class="sb__loading">
        <div class="sb__spinner" />
        <span>加载分镜...</span>
      </div>

      <!-- 主体：左侧拖拽列表 + 右侧详情卡 -->
      <div v-else class="sb__main">
        <aside class="sb__list-pane">
          <h3 class="sb__pane-title">📋 镜头序列</h3>
          <DragDropList
            :items="dragItems"
            show-order
            empty-text="还没有镜头，点击「新增镜头」开始"
            @reorder="onReorder"
            @select="onEdit"
            @remove="onRemove"
          />
        </aside>

        <section class="sb__detail-pane">
          <h3 class="sb__pane-title">🎞 镜头详情</h3>
          <div v-if="shots.length === 0" class="sb__empty">暂无镜头</div>
          <div v-else class="sb__cards">
            <article v-for="shot in shots" :key="shot.id" class="sb__shot">
              <div class="sb__shot-head">
                <span class="sb__shot-order">#{{ shot.order }}</span>
                <span class="sb__shot-camera">{{ CAMERA_LABELS[shot.camera ?? ''] ?? '未分类' }}</span>
                <span class="sb__shot-status" :class="`sb__shot-status--${shot.status}`">
                  {{ STATUS_LABELS[shot.status] ?? shot.status }}
                </span>
              </div>
              <p class="sb__shot-desc">{{ shot.description }}</p>
              <div class="sb__shot-foot">
                <div class="sb__duration">
                  <button type="button" class="qh-btn qh-btn--sm" @click="onAdjustDuration(shot.id, -1)">−</button>
                  <span class="sb__duration-val">{{ shot.duration }}s</span>
                  <button type="button" class="qh-btn qh-btn--sm" @click="onAdjustDuration(shot.id, 1)">＋</button>
                </div>
                <div class="sb__shot-actions">
                  <button type="button" class="qh-btn qh-btn--sm" @click="onEdit(shot.id)">✏ 编辑</button>
                  <button type="button" class="qh-btn qh-btn--sm qh-btn--danger" @click="onRemove(shot.id)">🗑</button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.sb {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

.sb__nav {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  background: color-mix(in srgb, var(--bg-primary) 90%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.sb__brand { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 600; }
.sb__back {
  width: 30px; height: 30px; border-radius: 7px;
  background: var(--bg-secondary); border: 1px solid var(--border);
  color: var(--text-primary); font-size: 16px; cursor: pointer; font-family: inherit;
  display: inline-flex; align-items: center; justify-content: center;
}
.sb__back:hover { background: var(--bg-tertiary); }
.sb__logo {
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff; display: inline-flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 16px;
}

.sb__content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sb__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 16px;
}
.sb__header h1 { font-size: 24px; margin: 0 0 4px; }
.sb__header p { color: var(--text-secondary); margin: 0; font-size: 14px; }
.sb__header-actions { display: flex; gap: 8px; }

.sb__stats {
  display: grid;
  grid-template-columns: repeat(3, 140px) 1fr;
  gap: 12px;
  padding: 16px 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  align-items: center;
}
.sb__stat { display: flex; flex-direction: column; gap: 4px; }
.sb__stat-label { font-size: 12px; color: var(--text-secondary); }
.sb__stat strong { font-size: 20px; }
.sb__bar { width: 100%; height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden; }
.sb__bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); transition: width .3s; }

.sb__loading {
  display: flex; align-items: center; gap: 12px;
  padding: 40px; justify-content: center;
  color: var(--text-secondary);
}
.sb__spinner {
  width: 20px; height: 20px; border-radius: 50%;
  border: 2px solid var(--border); border-top-color: var(--accent);
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.sb__main {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
}

.sb__list-pane, .sb__detail-pane {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
}
.sb__pane-title { font-size: 14px; margin: 0 0 12px; color: var(--text-secondary); }
.sb__empty { padding: 40px; text-align: center; color: var(--text-secondary); }

.sb__cards { display: flex; flex-direction: column; gap: 12px; }
.sb__shot {
  padding: 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: border-color .2s;
}
.sb__shot:hover { border-color: var(--accent); }
.sb__shot-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sb__shot-order { font-weight: 700; color: var(--accent); font-size: 14px; }
.sb__shot-camera { font-size: 11px; padding: 2px 8px; background: var(--bg-tertiary); border-radius: 4px; color: var(--text-secondary); }
.sb__shot-status { font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-left: auto; }
.sb__shot-status--done { background: color-mix(in srgb, var(--success) 20%, transparent); color: var(--success); }
.sb__shot-status--generating { background: color-mix(in srgb, var(--warning) 20%, transparent); color: var(--warning); }
.sb__shot-status--draft { background: var(--bg-tertiary); color: var(--text-secondary); }
.sb__shot-status--failed { background: color-mix(in srgb, var(--error) 20%, transparent); color: var(--error); }
.sb__shot-desc { margin: 0 0 10px; font-size: 14px; line-height: 1.6; }
.sb__shot-foot { display: flex; justify-content: space-between; align-items: center; }
.sb__duration { display: flex; align-items: center; gap: 6px; }
.sb__duration-val { min-width: 40px; text-align: center; font-weight: 600; }
.sb__shot-actions { display: flex; gap: 8px; align-items: center; }

@media (max-width: 900px) {
  .sb__main { grid-template-columns: 1fr; }
  .sb__stats { grid-template-columns: 1fr 1fr; }
}
</style>
