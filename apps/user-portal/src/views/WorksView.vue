<script setup lang="ts">
/**
 * WorksView · 我的作品
 * ManhuaWorks · L3.L 用户后台深耕
 *
 * 卡片网格：作品封面 / 标题 / 类型 / 观看数 / 创建时间
 * 顶部：类型过滤 + 排序
 * 调 apiClient.works.list
 * 卡片悬浮显示统计
 */

import { computed, onMounted, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { getApi } from '@/api-bridge'

const router = useRouter()
const api = getApi()

/* ------------------------------------------------------------------ */
/*                          类型                                       */
/* ------------------------------------------------------------------ */

type WorkType = 'video' | 'comic' | 'short' | 'image' | 'all'

interface Work {
  id: string
  title: string
  cover: string
  type: Exclude<WorkType, 'all'>
  views: number
  likes: number
  comments: number
  durationSec?: number
  chapters?: number
  createdAt: string
  updatedAt: string
}

interface WorkListResp {
  list: Work[]
  total: number
  page: number
  pageSize: number
}

/* ------------------------------------------------------------------ */
/*                          状态                                       */
/* ------------------------------------------------------------------ */

const works = ref<Work[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)

const typeFilter = ref<WorkType>('all')
const sortBy = ref<'views' | 'createdAt' | 'likes'>('createdAt')
const sortDir = ref<'asc' | 'desc'>('desc')

/* ------------------------------------------------------------------ */
/*                          Mock 回退                                  */
/* ------------------------------------------------------------------ */

const MOCK_WORKS: Work[] = [
  { id: 'w1', title: '长安月下 · 第 1 集', cover: '🏯', type: 'video', views: 12_840, likes: 932, comments: 87, durationSec: 540, createdAt: '2026-06-01T10:00:00Z', updatedAt: '2026-06-07T03:00:00Z' },
  { id: 'w2', title: '春风渡 · 全篇', cover: '🎒', type: 'comic', views: 8_621, likes: 612, comments: 41, chapters: 12, createdAt: '2026-04-15T03:00:00Z', updatedAt: '2026-05-20T08:00:00Z' },
  { id: 'w3', title: '星火预告 30s', cover: '🚀', type: 'short', views: 24_120, likes: 1_980, comments: 210, durationSec: 30, createdAt: '2026-05-28T11:00:00Z', updatedAt: '2026-06-05T11:00:00Z' },
  { id: 'w4', title: '苏锦年 · 角色立绘', cover: '👘', type: 'image', views: 5_302, likes: 482, comments: 28, createdAt: '2026-06-03T07:00:00Z', updatedAt: '2026-06-06T07:00:00Z' },
  { id: 'w5', title: '星火之歌 · 第 3 集', cover: '✨', type: 'video', views: 18_230, likes: 1_321, comments: 165, durationSec: 720, createdAt: '2026-05-10T03:00:00Z', updatedAt: '2026-05-22T03:00:00Z' },
  { id: 'w6', title: '星愿的猫 · 试水', cover: '🐱', type: 'comic', views: 1_240, likes: 102, comments: 8, chapters: 1, createdAt: '2026-06-06T11:00:00Z', updatedAt: '2026-06-06T11:00:00Z' },
  { id: 'w7', title: '墨韵江湖 · 片头', cover: '⚔️', type: 'short', views: 6_410, likes: 502, comments: 36, durationSec: 25, createdAt: '2026-05-31T09:00:00Z', updatedAt: '2026-05-31T09:00:00Z' }
]

/* ------------------------------------------------------------------ */
/*                          加载                                       */
/* ------------------------------------------------------------------ */

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    // apiClient 没有 works 模块，http 直拉
    const res = await api.http.request<{ data: WorkListResp }>({
      method: 'GET',
      path: '/v1/works',
      query: {
        type: typeFilter.value === 'all' ? undefined : typeFilter.value,
        sortBy: sortBy.value,
        sortDir: sortDir.value
      }
    })
    if (res?.data?.list && res.data.list.length > 0) {
      works.value = res.data.list
      total.value = res.data.total
    } else {
      applyMock()
    }
  } catch {
    applyMock()
  } finally {
    loading.value = false
  }
}

function applyMock(): void {
  let list = MOCK_WORKS.slice()
  if (typeFilter.value !== 'all') list = list.filter((w) => w.type === typeFilter.value)
  list.sort((a, b) => {
    const av = a[sortBy.value]
    const bv = b[sortBy.value]
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir.value === 'asc' ? cmp : -cmp
  })
  works.value = list
  total.value = list.length
}

onMounted(load)

/* ------------------------------------------------------------------ */
/*                          衍生                                       */
/* ------------------------------------------------------------------ */

const TYPE_META: Record<Exclude<WorkType, 'all'>, { label: string; color: string; icon: string }> = {
  video: { label: '视频', color: '#ef4444', icon: '🎬' },
  comic: { label: '漫画', color: '#a855f7', icon: '📖' },
  short: { label: '短视频', color: '#f59e0b', icon: '📱' },
  image: { label: '图片', color: '#10b981', icon: '🖼' }
}

function formatNumber(n: number): string {
  if (n >= 10_000) return (n / 10_000).toFixed(1) + 'w'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function formatDuration(sec?: number): string {
  if (!sec) return ''
  if (sec >= 60) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }
  return `${sec}s`
}

function formatTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

const counts = computed(() => {
  const c: Record<WorkType, number> = { all: works.value.length, video: 0, comic: 0, short: 0, image: 0 }
  for (const w of works.value) c[w.type] += 1
  return c
})

function openWork(w: Work): void {
  router.push(`/works/${w.id}`)
}

function setSort(col: typeof sortBy.value): void {
  if (sortBy.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = col
    sortDir.value = 'desc'
  }
  load()
}
</script>

<template>
  <main class="wv">
    <header class="wv__nav">
      <div class="wv__brand">
        <span class="wv__logo">M</span>
        <span class="wv__brand-name">我的作品</span>
      </div>
      <nav class="wv__nav-links">
        <RouterLink to="/dashboard" class="wv__nav-link">首页</RouterLink>
        <RouterLink to="/projects" class="wv__nav-link">项目</RouterLink>
        <RouterLink to="/works" class="wv__nav-link wv__nav-link--active">作品</RouterLink>
        <RouterLink to="/assets" class="wv__nav-link">素材</RouterLink>
        <RouterLink to="/team" class="wv__nav-link">团队</RouterLink>
        <RouterLink to="/account" class="wv__nav-link">账户</RouterLink>
      </nav>
    </header>

    <div class="wv__content">
      <section class="wv__bar">
        <h1 class="wv__title">🎞 我的作品 <span class="wv__count">({{ total }})</span></h1>
        <div class="wv__actions">
          <select v-model="typeFilter" class="wv__select" @change="load">
            <option value="all">全部 ({{ counts.all }})</option>
            <option value="video">视频 ({{ counts.video }})</option>
            <option value="comic">漫画 ({{ counts.comic }})</option>
            <option value="short">短视频 ({{ counts.short }})</option>
            <option value="image">图片 ({{ counts.image }})</option>
          </select>
          <div class="wv__sort-group">
            <button
              type="button"
              class="wv__sort"
              :class="{ 'wv__sort--active': sortBy === 'createdAt' }"
              @click="setSort('createdAt')"
            >最新 {{ sortBy === 'createdAt' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</button>
            <button
              type="button"
              class="wv__sort"
              :class="{ 'wv__sort--active': sortBy === 'views' }"
              @click="setSort('views')"
            >观看 {{ sortBy === 'views' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</button>
            <button
              type="button"
              class="wv__sort"
              :class="{ 'wv__sort--active': sortBy === 'likes' }"
              @click="setSort('likes')"
            >点赞 {{ sortBy === 'likes' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</button>
          </div>
        </div>
      </section>

      <section v-if="loading" class="wv__loading">加载中…</section>
      <section v-else-if="works.length === 0" class="wv__empty">
        <p>📭 还没有作品</p>
        <p class="wv__empty-hint">完成一个项目后即可发布作品</p>
      </section>
      <section v-else class="wv__grid">
        <article
          v-for="w in works"
          :key="w.id"
          class="wk-card"
          tabindex="0"
          @click="openWork(w)"
          @keyup.enter="openWork(w)"
        >
          <div class="wk-card__cover" :style="{ background: `linear-gradient(135deg, ${TYPE_META[w.type].color} 0%, #6366f1 100%)` }">
            <span class="wk-card__emoji">{{ w.cover }}</span>
            <span class="wk-card__type" :style="{ color: TYPE_META[w.type].color }">
              {{ TYPE_META[w.type].icon }} {{ TYPE_META[w.type].label }}
            </span>
            <span v-if="w.durationSec" class="wk-card__duration">{{ formatDuration(w.durationSec) }}</span>
            <span v-else-if="w.chapters" class="wk-card__duration">{{ w.chapters }} 章</span>
          </div>
          <div class="wk-card__body">
            <h3 class="wk-card__title">{{ w.title }}</h3>
            <p class="wk-card__date">{{ formatTime(w.createdAt) }}</p>
            <div class="wk-card__stats">
              <span title="观看">👁 {{ formatNumber(w.views) }}</span>
              <span title="点赞">❤️ {{ formatNumber(w.likes) }}</span>
              <span title="评论">💬 {{ formatNumber(w.comments) }}</span>
            </div>
            <!-- 悬浮统计覆盖 -->
            <div class="wk-card__hover">
              <p class="wk-card__hover-title">📊 详细数据</p>
              <div class="wk-card__hover-row"><span>总观看</span><strong>{{ w.views.toLocaleString() }}</strong></div>
              <div class="wk-card__hover-row"><span>点赞</span><strong>{{ w.likes.toLocaleString() }}</strong></div>
              <div class="wk-card__hover-row"><span>评论</span><strong>{{ w.comments.toLocaleString() }}</strong></div>
              <div class="wk-card__hover-row"><span>更新</span><strong>{{ formatTime(w.updatedAt) }}</strong></div>
            </div>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>

<style scoped>
.wv { min-height: 100vh; background: var(--bg-primary); color: var(--text-primary); }
.wv__nav {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; gap: 24px;
  padding: 14px 28px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
}
.wv__brand { display: flex; align-items: center; gap: 10px; font-weight: 700; }
.wv__logo {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px;
  background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
  color: white; font-weight: 800;
}
.wv__nav-links { display: flex; gap: 4px; flex: 1; margin-left: 20px; }
.wv__nav-link {
  padding: 6px 14px; font-size: 13px; color: var(--text-secondary);
  border-radius: 6px; text-decoration: none; transition: all 180ms;
}
.wv__nav-link:hover { color: var(--text-primary); background: var(--bg-secondary); }
.wv__nav-link--active { color: white; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); }

.wv__content { max-width: 1200px; margin: 0 auto; padding: 32px 28px 60px; display: flex; flex-direction: column; gap: 20px; }
.wv__bar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.wv__title { font-size: 22px; font-weight: 800; margin: 0; }
.wv__count { font-size: 14px; color: var(--text-secondary); font-weight: 600; }
.wv__actions { display: flex; gap: 12px; margin-left: auto; align-items: center; }
.wv__select {
  height: 36px; padding: 0 12px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);
  font-size: 13px;
}
.wv__sort-group { display: flex; gap: 4px; }
.wv__sort {
  height: 36px; padding: 0 12px; border: 1px solid var(--border);
  background: var(--bg-secondary); color: var(--text-secondary);
  border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;
}
.wv__sort--active { color: white; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); border: none; }

.wv__loading, .wv__empty { padding: 60px 20px; text-align: center; color: var(--text-secondary); }
.wv__empty-hint { font-size: 12px; opacity: 0.7; margin-top: 4px; }

.wv__grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;
}
@media (max-width: 960px) { .wv__grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .wv__grid { grid-template-columns: 1fr; } }

.wk-card {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 12px; overflow: hidden; cursor: pointer;
  position: relative; transition: all 220ms;
}
.wk-card:hover { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(168, 85, 247, 0.15); border-color: #a855f7; }
.wk-card__cover {
  aspect-ratio: 16 / 9; position: relative;
  display: flex; align-items: center; justify-content: center;
  font-size: 64px; color: white;
}
.wk-card__emoji { filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2)); }
.wk-card__type {
  position: absolute; top: 10px; left: 10px;
  background: rgba(255, 255, 255, 0.95); padding: 3px 8px;
  border-radius: 99px; font-size: 11px; font-weight: 700;
}
.wk-card__duration {
  position: absolute; bottom: 10px; right: 10px;
  background: rgba(0, 0, 0, 0.7); color: white;
  padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;
}
.wk-card__body { padding: 12px 14px; position: relative; }
.wk-card__title { font-size: 14px; font-weight: 700; margin: 0 0 4px; line-height: 1.4; }
.wk-card__date { font-size: 11px; color: var(--text-secondary); margin: 0 0 8px; }
.wk-card__stats { display: flex; gap: 10px; font-size: 12px; color: var(--text-secondary); }

.wk-card__hover {
  position: absolute; left: 14px; right: 14px; bottom: 12px;
  background: var(--bg-primary); border: 1px solid var(--border);
  border-radius: 8px; padding: 10px 12px;
  opacity: 0; transform: translateY(8px); transition: all 200ms;
  pointer-events: none;
  z-index: 2;
}
.wk-card:hover .wk-card__hover { opacity: 1; transform: translateY(0); }
.wk-card__hover-title { font-size: 12px; font-weight: 700; margin: 0 0 6px; }
.wk-card__hover-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; }
.wk-card__hover-row span { color: var(--text-secondary); }
</style>
