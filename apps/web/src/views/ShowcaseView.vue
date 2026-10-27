<script setup lang="ts">
/**
 * ShowcaseView · 作品展示
 * 公开页面 · 不需要登录
 * 展示千机六大模块的创作作品
 *
 * 模块分类：
 * - 千机·漫 (漫改动画)
 * - 千机·书 (小说)
 * - 千机·曲 (音乐)
 * - 千机·片 (宣传视频)
 * - 千机·图 (广告图片)
 * - 千机·影 (广告视频)
 */

import { ref, computed, onMounted, onErrorCaptured } from 'vue'
import { getClient } from '@manhuaworks/api-client'
import { MODULE_NAMES } from '@/config/naming'
import LoginModal from '@/components/LoginModal.vue'

const showLogin = ref(false)

// Error boundary
const pageError = ref<string | null>(null)
onErrorCaptured((err) => {
  pageError.value = err instanceof Error ? err.message : String(err)
  return false
})

type CategoryKey = 'all' | 'manhua' | 'novel' | 'music' | 'promo-video' | 'ad-image' | 'ad-video'

interface CategoryTab {
  key: CategoryKey
  label: string
  icon: string
  desc: string
}

interface ShowcaseItem {
  id: string
  title: string
  subtitle: string
  desc: string
  category: CategoryKey
  coverEmoji: string
  coverColor: string
  status: '草稿' | '进行中' | '已发布'
  highlight: string
  featured: boolean
  /** 视频/音频类作品的媒体类型 */
  mediaType?: 'video' | 'audio'
  /** 媒体时长 */
  duration?: string
  /** 镜头/页数/曲目数 */
  unitLabel?: string
  unitCount?: number
}

const categories: CategoryTab[] = [
  { key: 'all', label: '全部作品', icon: '✨', desc: '所有创作模块' },
  { key: 'manhua', label: MODULE_NAMES.manga.name, icon: '🎬', desc: '漫改动画' },
  { key: 'novel', label: MODULE_NAMES.novel.name, icon: '📖', desc: '小说创作' },
  { key: 'music', label: MODULE_NAMES.music.name, icon: '🎵', desc: '原创音乐' },
  { key: 'promo-video', label: MODULE_NAMES.promo.name, icon: '🎬', desc: '宣传视频' },
  { key: 'ad-image', label: MODULE_NAMES.adImage.name, icon: '🖼', desc: '广告图片' },
  { key: 'ad-video', label: MODULE_NAMES.adShort.name, icon: '📹', desc: '广告视频' },
]

const activeCategory = ref<CategoryKey>('all')

/** 作品类型到分类的映射 */
const PROJECT_TYPE_MAP: Record<string, CategoryKey> = {
  manhua: 'manhua', manga: 'manhua', comic: 'manhua',
  novel: 'novel', book: 'novel',
  music: 'music', audio: 'music',
  promo: 'promo-video', video: 'promo-video',
  'ad-image': 'ad-image', ad: 'ad-image', image: 'ad-image',
  'ad-short': 'ad-video', 'ad-video': 'ad-video', adshort: 'ad-video',
}

/** 默认渐变色池 */
const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
  'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
  'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
]

const EMOJIS: Record<CategoryKey, string> = {
  all: '✨', manhua: '🎬', novel: '📖', music: '🎵',
  'promo-video': '🎥', 'ad-image': '🎨', 'ad-video': '📱',
}

const loading = ref(true)
const showcases = ref<ShowcaseItem[]>([])

/** 从 API 加载项目并映射为 ShowcaseItem */
onMounted(async () => {
  loading.value = true
  try {
    const client = getClient()
    const res = await client.http.get('/projects', { limit: 50 })
    const items: any[] = res?.items || res?.data?.items || (Array.isArray(res) ? res : [])
    if (items.length > 0) {
      showcases.value = items.map((p: any, i: number) => {
        const typeKey = p.story_type || p.storyType || p.type || 'manhua'
        const cat = PROJECT_TYPE_MAP[typeKey] || 'manhua'
        const status = p.status === 2 ? '已发布' : p.status === 1 ? '进行中' : '草稿'
        const coverUrl = p.cover_url || p.coverUrl
        return {
          id: String(p.id),
          title: p.title || '未命名作品',
          subtitle: p.art_style || p.artStyle || typeKey,
          desc: p.description || '',
          category: cat,
          coverEmoji: EMOJIS[cat] || '🎬',
          coverColor: coverUrl ? `url(${coverUrl}) center/cover` : GRADIENTS[i % GRADIENTS.length],
          status,
          highlight: p.description ? p.description.slice(0, 30) + '…' : 'AI 创作作品',
          featured: i < 3,
          unitLabel: cat === 'music' ? '首' : cat === 'novel' ? '章' : '话',
          unitCount: p.shot_count || p.page_count || 1,
        } as ShowcaseItem
      })
    }
  } catch {
    // API 不可用时保持空列表，显示空状态引导
    showcases.value = []
  } finally {
    loading.value = false
  }
})

const statusColor: Record<ShowcaseItem['status'], string> = {
  草稿: '#f59e0b',
  进行中: '#6366f1',
  已发布: '#10b981',
}

/** 当前筛选后的作品列表 */
const filteredShowcases = computed(() => {
  if (activeCategory.value === 'all') return showcases.value
  return showcases.value.filter(s => s.category === activeCategory.value)
})

/** 精选推荐作品（最多 3 个） */
const featuredWorks = computed(() => showcases.value.filter(s => s.featured).slice(0, 3))

/** 各分类的作品数量 */
function categoryCount(key: CategoryKey): number {
  if (key === 'all') return showcases.value.length
  return showcases.value.filter(s => s.category === key).length
}

/** 当前是否有可播放媒体 */
function hasMedia(item: ShowcaseItem): boolean {
  return item.mediaType === 'video' || item.mediaType === 'audio'
}

/** 模拟播放状态 */
const playingId = ref<string | null>(null)

function togglePlay(item: ShowcaseItem) {
  if (!hasMedia(item)) return
  playingId.value = playingId.value === item.id ? null : item.id
}
</script>

<template>
  <main v-if="pageError" class="showcase showcase--error">
    <header class="showcase__nav">
      <RouterLink to="/" class="showcase__back">&larr; 返回首页</RouterLink>
      <span class="showcase__brand">千机工坊</span>
    </header>
    <div class="showcase__error-card">
      <div class="showcase__error-icon">⚠️</div>
      <h2>页面加载出错</h2>
      <p class="showcase__error-msg">{{ pageError }}</p>
      <button class="btn-primary" @click="pageError = null">重试</button>
    </div>
  </main>

  <main v-else class="showcase">
    <header class="showcase__nav">
      <RouterLink to="/" class="showcase__back">&larr; 返回首页</RouterLink>
      <div class="showcase__nav-center">
        <RouterLink to="/pricing" class="showcase__nav-link">定价</RouterLink>
      </div>
      <span class="showcase__brand">千机工坊</span>
    </header>

    <!-- Hero -->
    <section class="showcase__hero">
      <p class="showcase__eyebrow">六大创作模块 · 全链路覆盖</p>
      <h1 class="showcase__title">
        千机创作<span class="showcase__title-accent">作品展示</span>
      </h1>
      <p class="showcase__subtitle">
        从漫改动画到广告视频，千机六大模块覆盖内容创作全流程
      </p>
    </section>

    <!-- Loading -->
    <section v-if="loading" class="showcase__loading">
      <div class="showcase__loading-spinner" />
      <p>加载作品中…</p>
    </section>

    <template v-else>
    <!-- 精选推荐 -->
    <section v-if="featuredWorks.length" class="showcase__featured">
      <div class="showcase__section-header">
        <h2>精选推荐</h2>
        <p>来自不同创作模块的代表作品</p>
      </div>
      <div class="showcase__featured-grid">
        <article
          v-for="item in featuredWorks"
          :key="item.id"
          class="featured-card"
          :style="{ '--card-gradient': item.coverColor }"
        >
          <div class="featured-card__cover">
            <span class="featured-card__emoji">{{ item.coverEmoji }}</span>
            <button
              v-if="hasMedia(item)"
              class="featured-card__play"
              :class="{ 'is-playing': playingId === item.id }"
              @click.stop="togglePlay(item)"
              :aria-label="playingId === item.id ? '暂停' : '播放预览'"
            >
              {{ playingId === item.id ? '⏸' : '▶' }}
            </button>
          </div>
          <div class="featured-card__body">
            <span class="featured-card__category">
              {{ categories.find(c => c.key === item.category)?.icon }}
              {{ categories.find(c => c.key === item.category)?.label }}
            </span>
            <h3 class="featured-card__title">{{ item.title }}</h3>
            <p class="featured-card__desc">{{ item.desc }}</p>
            <div class="featured-card__highlight">
              <span class="featured-card__highlight-badge">亮点</span>
              <span>{{ item.highlight }}</span>
            </div>
          </div>
          <!-- 播放条 -->
          <div v-if="playingId === item.id && hasMedia(item)" class="featured-card__player">
            <div class="player-bar">
              <span class="player-bar__icon">{{ item.mediaType === 'audio' ? '🎵' : '🎬' }}</span>
              <div class="player-bar__track">
                <div class="player-bar__progress" :style="{ width: '35%' }" />
              </div>
              <span class="player-bar__time">{{ item.duration }}</span>
            </div>
            <p class="player-bar__hint">正在预览{{ item.mediaType === 'audio' ? '音频' : '视频' }}片段（演示模式）</p>
          </div>
        </article>
      </div>
    </section>

    <!-- 分类筛选 -->
    <section class="showcase__filter">
      <div class="showcase__section-header">
        <h2>全部作品</h2>
        <p>按创作模块筛选查看</p>
      </div>
      <div class="showcase__tabs" role="tablist">
        <button
          v-for="cat in categories"
          :key="cat.key"
          type="button"
          role="tab"
          :aria-selected="activeCategory === cat.key"
          :class="['showcase__tab', { 'showcase__tab--active': activeCategory === cat.key }]"
          @click="activeCategory = cat.key"
        >
          <span class="showcase__tab-icon">{{ cat.icon }}</span>
          <span class="showcase__tab-label">{{ cat.label }}</span>
          <span class="showcase__tab-count">{{ categoryCount(cat.key) }}</span>
        </button>
      </div>
    </section>

    <!-- 作品列表 -->
    <section class="showcase__grid">
      <TransitionGroup name="card-fade">
        <article v-for="item in filteredShowcases" :key="item.id" class="showcase__card">
          <div class="showcase__cover" :style="{ background: item.coverColor }">
            <span class="showcase__cover-emoji">{{ item.coverEmoji }}</span>
            <span
              class="showcase__cover-status"
              :style="{ color: statusColor[item.status] }"
            >
              ● {{ item.status }}
            </span>
            <!-- 播放按钮（仅视频/音频） -->
            <button
              v-if="hasMedia(item)"
              class="showcase__cover-play"
              :class="{ 'is-playing': playingId === item.id }"
              @click.stop="togglePlay(item)"
              :aria-label="playingId === item.id ? '暂停' : '播放预览'"
            >
              {{ playingId === item.id ? '⏸' : '▶' }}
            </button>
            <!-- 媒体类型标签 -->
            <span v-if="item.mediaType" class="showcase__cover-media">
              {{ item.mediaType === 'video' ? '视频' : '音频' }}
            </span>
          </div>
          <div class="showcase__body">
            <span class="showcase__card-category">
              {{ categories.find(c => c.key === item.category)?.icon }}
              {{ categories.find(c => c.key === item.category)?.label }}
            </span>
            <h2 class="showcase__card-title">{{ item.title }}</h2>
            <p class="showcase__card-subtitle">{{ item.subtitle }}</p>
            <p class="showcase__card-desc">{{ item.desc }}</p>
            <div class="showcase__meta">
              <span v-if="item.unitCount" class="showcase__meta-item">
                📊 {{ item.unitCount }} {{ item.unitLabel }}
              </span>
              <span v-if="item.duration" class="showcase__meta-item">
                ⏱ {{ item.duration }}
              </span>
            </div>
            <div class="showcase__highlight">
              <span class="showcase__highlight-label">亮点</span>
              <span class="showcase__highlight-text">{{ item.highlight }}</span>
            </div>
          </div>
          <!-- 内嵌播放器 -->
          <div v-if="playingId === item.id && hasMedia(item)" class="showcase__player">
            <div class="player-bar">
              <span class="player-bar__icon">{{ item.mediaType === 'audio' ? '🎵' : '🎬' }}</span>
              <div class="player-bar__track">
                <div class="player-bar__progress" :style="{ width: '35%' }" />
              </div>
              <span class="player-bar__time">{{ item.duration }}</span>
            </div>
            <p class="player-bar__hint">正在预览{{ item.mediaType === 'audio' ? '音频' : '视频' }}片段（演示模式）</p>
          </div>
        </article>
      </TransitionGroup>
    </section>

    <!-- 空状态 -->
    <section v-if="filteredShowcases.length === 0" class="showcase__empty">
      <div class="showcase__empty-icon">📭</div>
      <h3>该分类暂无作品</h3>
      <p>{{ categories.find(c => c.key === activeCategory)?.desc }}模块还没有作品，成为第一个创作者吧！</p>
      <div class="showcase__empty-actions">
        <button type="button" class="btn-primary" @click="showLogin = true">立即开始创作</button>
        <button
          type="button"
          class="btn-secondary"
          @click="activeCategory = 'all'"
        >
          查看全部作品
        </button>
      </div>
    </section>
    </template>

    <!-- CTA -->
    <section class="showcase__cta">
      <h2>你也想做一部？</h2>
      <p>注册即可创建你的第一个项目，注册即送 100 算力 + 专业版 7 天体验</p>
      <div class="showcase__cta-buttons">
        <button type="button" class="btn-primary" @click="showLogin = true">立即开始</button>
        <RouterLink to="/pricing" class="btn-secondary">查看定价</RouterLink>
      </div>
    </section>

    <footer class="showcase__footer">
      <p>&copy; 2026 千机工坊 · AI 动画创作平台</p>
    </footer>

    <!-- Login Modal -->
    <LoginModal v-model="showLogin" />
  </main>
</template>

<style scoped>
/* ===== Error state ===== */
.showcase--error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
}

.showcase__error-card {
  text-align: center;
  max-width: 400px;
  background: #1a1c21;
  border: 1px solid #2a2d35;
  border-radius: 16px;
  padding: 40px 32px;
}

.showcase__error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.showcase__error-msg {
  font-size: 13px;
  color: #ef4444;
  line-height: 1.6;
  margin: 8px 0 24px;
  word-break: break-word;
}

/* ===== Main layout ===== */
.showcase {
  min-height: 100vh;
  position: relative;
  z-index: 1;
}

.showcase__nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: rgba(10, 14, 26, 0.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}

.showcase__back {
  color: var(--text-primary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 200ms;
}

.showcase__back:hover {
  color: var(--accent);
}

.showcase__nav-center {
  display: flex;
  gap: 16px;
}

.showcase__nav-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 200ms;
}

.showcase__nav-link:hover {
  color: var(--accent);
}

.showcase__brand {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

/* ===== Hero ===== */
.showcase__hero {
  padding: 80px 32px 48px;
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
}

.showcase__eyebrow {
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--accent);
  margin: 0 0 16px;
  font-weight: 600;
}

.showcase__title {
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 800;
  line-height: 1.1;
  margin: 0 0 20px;
  letter-spacing: -0.02em;
}

.showcase__title-accent {
  background: var(--gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.showcase__subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

/* ===== Section Header ===== */
.showcase__section-header {
  text-align: center;
  margin-bottom: 32px;
}

.showcase__section-header h2 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}

.showcase__section-header p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

/* ===== Featured ===== */
.showcase__featured {
  padding: 0 32px 60px;
  max-width: 1200px;
  margin: 0 auto;
}

.showcase__featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 20px;
}

.featured-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 16px);
  overflow: hidden;
  transition: all 300ms;
}

.featured-card:hover {
  transform: translateY(-4px);
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.featured-card__cover {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--card-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
}

.featured-card__emoji {
  font-size: 72px;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
}

.featured-card__play,
.showcase__cover-play {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  transition: all 200ms;
}

.featured-card__play:hover,
.showcase__cover-play:hover {
  background: var(--accent);
  transform: scale(1.1);
}

.featured-card__play.is-playing,
.showcase__cover-play.is-playing {
  background: var(--accent);
}

.featured-card__body {
  padding: 20px 24px;
}

.featured-card__category,
.showcase__card-category {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

.featured-card__title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 8px;
}

.featured-card__desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 0 0 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.featured-card__highlight {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
}

.featured-card__highlight-badge {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

/* ===== Filter Tabs ===== */
.showcase__filter {
  padding: 0 32px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.showcase__tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.showcase__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
}

.showcase__tab:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.showcase__tab--active {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}

.showcase__tab-icon {
  font-size: 14px;
}

.showcase__tab-count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  font-weight: 600;
}

.showcase__tab--active .showcase__tab-count {
  background: rgba(255, 255, 255, 0.25);
}

/* ===== Grid ===== */
.showcase__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  padding: 0 32px 60px;
  max-width: 1200px;
  margin: 0 auto;
}

.showcase__card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 16px);
  overflow: hidden;
  transition: all 300ms;
}

.showcase__card:hover {
  transform: translateY(-4px);
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.showcase__cover {
  position: relative;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.showcase__cover-emoji {
  font-size: 72px;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
}

.showcase__cover-status {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(4px);
}

.showcase__cover-media {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 3px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  backdrop-filter: blur(4px);
}

.showcase__body {
  padding: 20px 24px;
}

.showcase__card-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 4px;
}

.showcase__card-subtitle {
  font-size: 12px;
  color: var(--accent);
  margin: 0 0 10px;
  font-weight: 500;
  letter-spacing: 0.05em;
}

.showcase__card-desc {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin: 0 0 14px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.showcase__meta {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}

.showcase__meta-item {
  font-size: 12px;
  color: var(--text-secondary);
}

.showcase__highlight {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.showcase__highlight-label {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--accent);
  color: var(--bg-primary);
  letter-spacing: 0.05em;
}

.showcase__highlight-text {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
}

/* ===== Player ===== */
.showcase__player,
.featured-card__player {
  padding: 12px 24px 16px;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}

.player-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.player-bar__icon {
  font-size: 16px;
}

.player-bar__track {
  flex: 1;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.player-bar__progress {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 300ms;
}

.player-bar__time {
  font-size: 11px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.player-bar__hint {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
}

/* ===== Empty State ===== */
.showcase__empty {
  padding: 80px 32px;
  text-align: center;
  max-width: 500px;
  margin: 0 auto;
}

.showcase__empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.showcase__empty h3 {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px;
}

.showcase__empty p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 24px;
  line-height: 1.6;
}

.showcase__empty-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

/* ===== CTA ===== */
.showcase__cta {
  padding: 60px 32px;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.showcase__cta h2 {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 12px;
}

.showcase__cta p {
  color: var(--text-secondary);
  margin: 0 0 28px;
  line-height: 1.6;
}

.showcase__cta-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

/* ===== Buttons ===== */
.btn-primary {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 8px;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 300ms;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow), var(--glow);
}

.btn-secondary {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 8px;
  border: 1.5px solid var(--border-strong, var(--border));
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: all 300ms;
}

.btn-secondary:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ===== Footer ===== */
.showcase__footer {
  padding: 32px;
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  border-top: 1px solid var(--border);
}

/* ===== Transition ===== */
.showcase__loading {
  padding: 80px 32px;
  text-align: center;
  color: var(--text-secondary);
}

.showcase__loading-spinner {
  width: 32px;
  height: 32px;
  margin: 0 auto 16px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.card-fade-enter-active {
  transition: all 300ms ease;
}

.card-fade-leave-active {
  transition: all 200ms ease;
}

.card-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.card-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.card-fade-move {
  transition: transform 300ms ease;
}
</style>
