<script setup lang="ts">
/**
 * HomeView · 用户后台首页
 * 千机工坊 · W4 用户后台
 *
 * 区块：
 * 1. 顶部欢迎条 + 主题切换 + 用户卡片
 * 2. 4 统计卡（项目数 / 作品数 / 素材数 / 积分）
 * 3. 我的项目（最近 6 个）
 * 4. 快捷入口（工作室 / 角色库 / 场景库 / 导出 / 资产 / 设置）
 * 5. 平台动态 / 公告
 */

import { computed, onMounted, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import UserCard from '@/components/UserCard.vue'
import ProjectCard from '@/components/ProjectCard.vue'
import PlanBadge from '@/components/PlanBadge.vue'
import { useUser } from '@/composables/useUser'
import { useProjects } from '@/composables/useProjects'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()
const { profile, creditsUsed, creditsTotal, creditsPercent, logout, load: loadUser } = useUser()
const { projects, total, counts, archive, remove, load: loadProjects } = useProjects()
const { currentMeta } = useTheme()

/* ===== 16-tag mood system for BGM ===== */
const MOOD_TAGS = [
  { id: 'suspense',  label: '悬疑', color: '#6366f1' },
  { id: 'battle',    label: '战斗', color: '#ef4444' },
  { id: 'warm',      label: '温情', color: '#f59e0b' },
  { id: 'scifi',     label: '科幻', color: '#06b6d4' },
  { id: 'epic',      label: '史诗', color: '#8b5cf6' },
  { id: 'daily',     label: '日常', color: '#10b981' },
  { id: 'dark',      label: '黑暗', color: '#374151' },
  { id: 'healing',   label: '治愈', color: '#34d399' },
  { id: 'romantic',  label: '浪漫', color: '#ec4899' },
  { id: 'tense',     label: '紧张', color: '#f97316' },
  { id: 'mystery',   label: '神秘', color: '#7c3aed' },
  { id: 'comedy',    label: '搞笑', color: '#fbbf24' },
  { id: 'sadness',   label: '悲伤', color: '#3b82f6' },
  { id: 'adventure', label: '冒险', color: '#14b8a6' },
  { id: 'horror',    label: '恐怖', color: '#991b1b' },
  { id: 'fantasy',   label: '奇幻', color: '#a855f7' }
] as const

function moodLabel(id: string) {
  return MOOD_TAGS.find(t => t.id === id)
}

/* ===== Mock BGM data ===== */
const hotBgmList = ref([
  {
    id: 'bgm-001',
    title: '暗夜追踪',
    moods: ['suspense', 'tense', 'dark'],
    duration: '02:34',
    plays: 12580,
    collects: 3420,
    playing: false,
    collected: false
  },
  {
    id: 'bgm-002',
    title: '星际远征',
    moods: ['scifi', 'epic', 'adventure'],
    duration: '03:12',
    plays: 9843,
    collects: 2891,
    playing: false,
    collected: false
  },
  {
    id: 'bgm-003',
    title: '樱花午后',
    moods: ['warm', 'daily', 'healing'],
    duration: '01:58',
    plays: 15672,
    collects: 5104,
    playing: false,
    collected: false
  },
  {
    id: 'bgm-004',
    title: '破晓之战',
    moods: ['battle', 'epic', 'fantasy'],
    duration: '04:05',
    plays: 8217,
    collects: 2456,
    playing: false,
    collected: false
  }
])

const bgmLoading = ref(true)

const loading = ref(true)

onMounted(async () => {
  await Promise.all([loadUser(), loadProjects()])
  loading.value = false
  // BGM mock data finishes loading alongside main data
  setTimeout(() => { bgmLoading.value = false }, 400)
})

function toggleBgmPlay(bgm: typeof hotBgmList.value[0]) {
  hotBgmList.value.forEach(b => { if (b.id !== bgm.id) b.playing = false })
  bgm.playing = !bgm.playing
}

function toggleBgmCollect(bgm: typeof hotBgmList.value[0]) {
  bgm.collected = !bgm.collected
  bgm.collects += bgm.collected ? 1 : -1
}

function formatPlays(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/** 最近 6 个项目（按 updatedAt 倒序） */
const recentProjects = computed(() => projects.value.slice(0, 6))

/** 4 统计 */
const stats = computed(() => [
  { label: '进行中项目', value: counts.value.active ?? 0, icon: '🔥', color: 'var(--accent)' },
  { label: '已发布作品', value: '12', icon: '✨', color: 'var(--success)' },
  { label: '素材库', value: '248', icon: '🗃', color: '#2563eb' },
  { label: '本月积分', value: `${creditsUsed.value}/${creditsTotal.value}`, icon: '⚡', color: '#a8302b' }
])

const STUDIO_HOST = `http://${window.location.hostname}:5175`

/** 快捷入口 */
const shortcuts = [
  { id: 'studio', label: '创作者工作台', icon: '🎬', route: `${STUDIO_HOST}/workflow`, desc: '分镜 / 角色 / 场景 / 导出', color: 'var(--accent)', external: true },
  { id: 'projects', label: '我的项目', icon: '📁', route: '/projects', desc: '管理所有漫改项目', color: '#ff4d6d' },
  { id: 'works', label: '我的作品', icon: '🎞', route: '/works', desc: '已发布的视频/漫画', color: '#10b981' },
  { id: 'assets', label: '素材库', icon: '🖼', route: '/assets', desc: '图片 / 视频 / 音频 / 角色 / 场景', color: '#2563eb' },
  { id: 'byok', label: 'BYOK 设置', icon: '🔑', route: `${STUDIO_HOST}/byok`, desc: '管理你的 AI Key', color: '#9333ea', external: true },
  { id: 'settings', label: '账号设置', icon: '⚙', route: '/settings', desc: '订阅 / 通知 / 安全', color: '#fbbf24' }
]

/** 平台公告 */
const announcements = [
  { id: 'a1', title: '🎉 W4 升级：素材库支持角色 / 场景管理', date: '2026-06-05', tag: '新功能' },
  { id: 'a2', title: '📢 创作橙主题上线：灵感迸发的视觉体验', date: '2026-05-28', tag: '主题' },
  { id: 'a3', title: '🚀 BYOK 全面支持：4 家供应商 + 自动测活', date: '2026-05-20', tag: '能力' }
]

function go(r: { route: string; external?: boolean }) {
  if (r.external) {
    window.open(r.route, '_blank')
  } else {
    router.push(r.route)
  }
}

function onLogout() {
  logout()
  router.push('/login')
}

</script>

<template>
  <main class="home">
    <!-- 顶栏 -->
    <header class="home__nav">
      <div class="home__brand">
        <span class="home__logo">M</span>
        <span class="home__brand-name">用户后台</span>
      </div>
      <nav class="home__nav-links">
        <RouterLink to="/dashboard" class="home__nav-link home__nav-link--active">首页</RouterLink>
        <RouterLink to="/projects" class="home__nav-link">项目</RouterLink>
        <RouterLink to="/works" class="home__nav-link">作品</RouterLink>
        <RouterLink to="/assets" class="home__nav-link">素材</RouterLink>
        <RouterLink to="/settings" class="home__nav-link">设置</RouterLink>
      </nav>
      <div class="home__nav-right">
        <ThemeSwitcher mode="compact" />
        <UserCard :user="profile" compact />
      </div>
    </header>

    <div class="home__content">
      <!-- ===== 1. 欢迎条 ===== -->
      <section class="home__welcome">
        <div class="home__welcome-text">
          <p class="home__greeting">👋 欢迎回来，<span class="home__nickname">{{ profile?.nickname ?? '创作者' }}</span></p>
          <h1 class="home__title">今天继续<span class="home__title-accent">漫改创作</span></h1>
          <p class="home__sub">当前主题：<strong>{{ currentMeta.label }}</strong> · {{ currentMeta.desc }}</p>
        </div>
        <div class="home__welcome-card">
          <UserCard :user="profile" @logout="onLogout" @settings="router.push('/settings')" />
          <div v-if="profile?.plan" class="home__credits">
            <div class="home__credits-head">
              <span>本月积分</span>
              <span>{{ creditsUsed }} / {{ creditsTotal }}</span>
            </div>
            <div class="home__credits-bar">
              <div class="home__credits-fill" :style="{ width: creditsPercent + '%' }"></div>
            </div>
            <div class="home__credits-foot">
              <PlanBadge :plan="profile.plan" size="sm" />
              <button type="button" class="home__upgrade">升级 →</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== 2. 4 统计卡 ===== -->
      <section class="home__stats">
        <div v-for="s in stats" :key="s.label" class="stat-card">
          <span class="stat-card__icon" :style="{ background: `color-mix(in srgb, ${s.color} 15%, transparent)`, color: s.color }">
            {{ s.icon }}
          </span>
          <div>
            <p class="stat-card__value">{{ s.value }}</p>
            <p class="stat-card__label">{{ s.label }}</p>
          </div>
        </div>
      </section>

      <!-- ===== 3. 最近项目 ===== -->
      <section class="home__section">
        <div class="home__section-header">
          <h2>📁 最近项目 <span class="home__count">({{ total }})</span></h2>
          <RouterLink to="/projects" class="home__more">查看全部 →</RouterLink>
        </div>

        <div v-if="loading" class="home__loading">
          <div class="home__spinner"></div>
          <span>加载中...</span>
        </div>
        <div v-else-if="recentProjects.length === 0" class="home__empty">
          <p>📭 还没有项目</p>
          <RouterLink to="/projects" class="home__btn">+ 创建第一个项目</RouterLink>
        </div>
        <div v-else class="home__projects-grid">
          <ProjectCard
            v-for="p in recentProjects"
            :key="p.id"
            :project="p"
            @open="router.push(`/projects/${p.id}`)"
            @edit="router.push(`/projects/${p.id}?edit=1`)"
            @archive="archive"
            @remove="remove"
          />
        </div>
      </section>

      <!-- ===== 4. 快捷入口 ===== -->
      <section class="home__section">
        <div class="home__section-header">
          <h2>🚀 快捷入口</h2>
        </div>
        <div class="home__shortcuts">
          <button
            v-for="s in shortcuts"
            :key="s.id"
            type="button"
            class="shortcut"
            :style="{ '--sc-color': s.color }"
            @click="go(s)"
          >
            <span class="shortcut__icon">{{ s.icon }}</span>
            <span class="shortcut__label">{{ s.label }}</span>
            <span class="shortcut__desc">{{ s.desc }}</span>
          </button>
        </div>
      </section>

      <!-- ===== 5. 热门配乐推荐 ===== -->
      <section class="home__section">
        <div class="home__section-header">
          <h2>🎵 热门配乐推荐</h2>
          <a href="#" class="home__more">浏览全部配乐 →</a>
        </div>

        <div v-if="bgmLoading" class="home__loading">
          <div class="home__spinner"></div>
          <span>加载配乐中...</span>
        </div>
        <div v-else class="bgm-grid">
          <div v-for="bgm in hotBgmList" :key="bgm.id" class="bgm-card">
            <!-- Waveform placeholder -->
            <div class="bgm-card__wave">
              <div class="bgm-card__wave-bars">
                <span v-for="i in 24" :key="i" class="bgm-card__wave-bar"
                  :class="{ 'bgm-card__wave-bar--active': bgm.playing }"
                  :style="{ height: (20 + Math.sin(i * 0.7) * 18 + Math.random() * 12) + '%', animationDelay: (i * 60) + 'ms' }"
                ></span>
              </div>
              <button type="button" class="bgm-card__play-btn" @click="toggleBgmPlay(bgm)">
                {{ bgm.playing ? '⏸' : '▶' }}
              </button>
            </div>

            <div class="bgm-card__body">
              <div class="bgm-card__head">
                <h3 class="bgm-card__title">{{ bgm.title }}</h3>
                <span class="bgm-card__duration">{{ bgm.duration }}</span>
              </div>

              <div class="bgm-card__moods">
                <span v-for="mid in bgm.moods" :key="mid" class="bgm-card__mood">
                  <span class="bgm-card__mood-dot" :style="{ background: moodLabel(mid)?.color ?? '#888' }"></span>
                  {{ moodLabel(mid)?.label ?? mid }}
                </span>
              </div>

              <div class="bgm-card__meta">
                <span class="bgm-card__stat">▶ {{ formatPlays(bgm.plays) }}</span>
                <span class="bgm-card__stat">❤ {{ formatPlays(bgm.collects) }}</span>
              </div>

              <div class="bgm-card__actions">
                <button type="button" class="bgm-card__btn" @click="toggleBgmPlay(bgm)">
                  {{ bgm.playing ? '⏸ 暂停' : '▶ 播放' }}
                </button>
                <button
                  type="button"
                  class="bgm-card__btn"
                  :class="{ 'bgm-card__btn--collected': bgm.collected }"
                  @click="toggleBgmCollect(bgm)"
                >
                  {{ bgm.collected ? '★ 已收藏' : '☆ 收藏' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== 6. 平台动态 ===== -->
      <section class="home__section">
        <div class="home__section-header">
          <h2>📣 平台动态</h2>
        </div>
        <div class="home__news">
          <div v-for="a in announcements" :key="a.id" class="news-item">
            <span class="news-item__tag">{{ a.tag }}</span>
            <span class="news-item__title">{{ a.title }}</span>
            <span class="news-item__date">{{ a.date }}</span>
          </div>
        </div>
      </section>
    </div>

    <footer class="home__footer">
      <p>&copy; 2026 千机工坊 Qianji Workshop</p>
    </footer>
  </main>
</template>

<style scoped>
.home {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

/* ===== 顶栏 ===== */
.home__nav {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 14px 28px;
  background: color-mix(in srgb, var(--bg-primary) 90%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.home__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 700;
  flex-shrink: 0;
}

.home__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--gradient);
  color: white;
  font-weight: 800;
  font-size: 14px;
}

.home__nav-links {
  display: flex;
  gap: 4px;
  flex: 1;
  margin-left: 20px;
}

.home__nav-link {
  padding: 6px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: 6px;
  text-decoration: none;
  transition: all 180ms;
}

.home__nav-link:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.home__nav-link--active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.home__nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ===== 内容 ===== */
.home__content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 28px 60px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* ===== 1. 欢迎 ===== */
.home__welcome {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 24px;
  align-items: stretch;
}

.home__greeting {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.home__nickname {
  color: var(--accent);
  font-weight: 600;
}

.home__title {
  margin: 0 0 6px;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.home__title-accent {
  background: var(--gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.home__sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.home__sub strong {
  color: var(--accent);
}

.home__welcome-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.home__credits {
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.home__credits-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.home__credits-bar {
  height: 6px;
  background: var(--bg-primary);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}

.home__credits-fill {
  height: 100%;
  background: var(--gradient);
  border-radius: 3px;
  transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
}

.home__credits-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.home__upgrade {
  padding: 3px 10px;
  font-size: 11px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
  transition: all 200ms;
}

.home__upgrade:hover {
  background: var(--accent-deep);
}

/* ===== 2. 统计 ===== */
.home__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: all 250ms;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.stat-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  font-size: 22px;
}

.stat-card__value {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

.stat-card__label {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

/* ===== section 通用 ===== */
.home__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.home__section-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.home__count {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 400;
}

.home__more {
  font-size: 13px;
  color: var(--accent);
  text-decoration: none;
}

.home__more:hover {
  text-decoration: underline;
}

/* ===== Loading / Empty ===== */
.home__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  color: var(--text-secondary);
  font-size: 13px;
}

.home__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.home__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 20px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-strong);
  border-radius: 14px;
  color: var(--text-secondary);
  font-size: 14px;
}

.home__btn {
  padding: 8px 18px;
  background: var(--accent);
  color: white;
  border-radius: 8px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: all 200ms;
}

.home__btn:hover {
  background: var(--accent-deep);
}

/* ===== 3. 项目网格 ===== */
.home__projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

/* ===== 4. 快捷入口 ===== */
.home__shortcuts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.shortcut {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  color: var(--text-primary);
  transition: all 200ms;
  position: relative;
  overflow: hidden;
}

.shortcut::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: var(--sc-color, var(--accent));
  opacity: 0.7;
  transition: opacity 200ms;
}

.shortcut:hover {
  transform: translateY(-2px);
  border-color: var(--sc-color, var(--accent));
  box-shadow: var(--shadow);
}

.shortcut:hover::before {
  opacity: 1;
  width: 4px;
}

.shortcut__icon {
  font-size: 24px;
  line-height: 1;
  margin-bottom: 4px;
}

.shortcut__label {
  font-size: 14px;
  font-weight: 600;
}

.shortcut__desc {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* ===== 5. 平台动态 ===== */
.home__news {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.news-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: all 200ms;
  cursor: pointer;
}

.news-item:hover {
  border-color: var(--accent);
  transform: translateX(4px);
}

.news-item__tag {
  padding: 2px 8px;
  font-size: 10px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border-radius: 4px;
  font-weight: 500;
  flex-shrink: 0;
}

.news-item__title {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
}

.news-item__date {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
}

/* ===== Footer ===== */
.home__footer {
  padding: 32px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  border-top: 1px solid var(--border);
}

.home__footer p {
  margin: 0;
}

/* ===== 5. 热门配乐推荐 ===== */
.bgm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.bgm-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  transition: all 250ms;
}

.bgm-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.bgm-card__wave {
  position: relative;
  height: 72px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--bg-primary)), var(--bg-tertiary, var(--bg-primary)));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.bgm-card__wave-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 100%;
  padding: 8px 12px;
  width: 100%;
}

.bgm-card__wave-bar {
  flex: 1;
  min-height: 3px;
  background: color-mix(in srgb, var(--accent) 35%, transparent);
  border-radius: 2px 2px 0 0;
  transition: background 200ms;
}

.bgm-card__wave-bar--active {
  background: var(--accent);
  animation: wave-bounce 600ms ease-in-out infinite alternate;
}

@keyframes wave-bounce {
  0% { transform: scaleY(0.5); }
  100% { transform: scaleY(1); }
}

.bgm-card__play-btn {
  position: absolute;
  right: 10px;
  bottom: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 85%, transparent);
  color: white;
  border: none;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0.85);
  transition: all 200ms;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
}

.bgm-card:hover .bgm-card__play-btn {
  opacity: 1;
  transform: scale(1);
}

.bgm-card__play-btn:hover {
  background: var(--accent);
  transform: scale(1.1) !important;
}

.bgm-card__body {
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bgm-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bgm-card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.bgm-card__duration {
  font-size: 11px;
  font-family: monospace;
  color: var(--text-secondary);
  padding: 1px 6px;
  background: var(--bg-primary);
  border-radius: 4px;
}

.bgm-card__moods {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.bgm-card__mood {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  padding: 2px 8px;
  background: var(--bg-primary);
  border-radius: 999px;
}

.bgm-card__mood-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bgm-card__meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
}

.bgm-card__actions {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.bgm-card__btn {
  flex: 1;
  padding: 6px 8px;
  font-size: 11px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: all 180ms;
}

.bgm-card__btn:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}

.bgm-card__btn--collected {
  color: var(--accent);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

/* ===== 6. 平台动态 ===== */

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .home__nav {
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 16px;
  }

  .home__nav-links {
    order: 3;
    width: 100%;
    margin-left: 0;
    overflow-x: auto;
  }

  .home__welcome {
    grid-template-columns: 1fr;
  }

  .home__content {
    padding: 20px 16px 40px;
  }

  .home__title {
    font-size: 24px;
  }
}
</style>