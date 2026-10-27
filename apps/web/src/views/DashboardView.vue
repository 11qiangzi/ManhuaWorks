<script setup lang="ts">
/**
 * DashboardView · 用户工作台首页
 * ManhuaWorks · 接真 API · 项目卡可点击
 *
 * 4 统计接 user-service / project-service / asset-service
 * 项目卡跨 app 跳 user-portal (:5180)
 * 快速开始区域：点击 6 个生成器卡片 → router.push 跳转到对应创作页面
 */

import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { MODULE_NAMES } from '@/config/naming'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()
const { currentMeta } = useTheme()
const hostname = window.location.hostname

interface UserInfo {
  id: string
  phone?: string
  email?: string
  nickname: string
}

const user = ref<UserInfo | null>(null)
const loading = ref(true)
const error = ref('')
const statsLoading = ref(true)

const STATUS_META: Record<string, { label: string }> = {
  active: { label: '进行中' },
  published: { label: '已发布' },
  archived: { label: '已归档' },
  draft: { label: '草稿' },
  deleted: { label: '已删除' },
}

/** 4 统计 — 初始 "—"，API 返回后更新 */
const stats = ref([
  { label: '进行中项目', value: '—', icon: '📁' },
  { label: '已发布作品', value: '—', icon: '🎬' },
  { label: '素材库', value: '—', icon: '🗃' },
  { label: '团队成员', value: '—', icon: '👥' },
])

const recentProjects = ref<any[]>([])

/** 4 个主题变量实时显示 */
const themeTokens = computed(() => [
  { key: '--bg-primary', label: '主背景', value: getCssVar('--bg-primary') },
  { key: '--bg-secondary', label: '次背景', value: getCssVar('--bg-secondary') },
  { key: '--text-primary', label: '主文字', value: getCssVar('--text-primary') },
  { key: '--accent', label: '强调色', value: getCssVar('--accent') },
])

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/* ------------------------------------------------------------------ */
/*  Quick Start — 6 大生成器快捷入口                                   */
/* ------------------------------------------------------------------ */

const GENERATORS = [
  { key: 'manga',   name: MODULE_NAMES.manga.name,   icon: '🎬', route: 'animation' },
  { key: 'novel',   name: MODULE_NAMES.novel.name,   icon: '📖', route: 'novel' },
  { key: 'promo',   name: MODULE_NAMES.promo.name, icon: '📽', route: 'promo' },
  { key: 'adShort', name: MODULE_NAMES.adShort.name,   icon: '📹', route: 'ad-video' },
  { key: 'adImage', name: MODULE_NAMES.adImage.name, icon: '🎨', route: 'ad-image' },
  { key: 'music',   name: MODULE_NAMES.music.name,   icon: '🎵', route: 'music' },
] as const

function openGenerator(route: string) {
  router.push(`/create/${route}`)
}

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function getAuthHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

async function safeGet(path: string): Promise<any> {
  const r = await fetch(path, { headers: getAuthHeaders() })
  if (!r.ok) throw new Error(`HTTP ${r.status} GET ${path}`)
  const raw = await r.json()
  return raw?.data ?? raw
}

/* ------------------------------------------------------------------ */
/*  lifecycle                                                          */
/* ------------------------------------------------------------------ */

onMounted(async () => {
  try {
    const raw = localStorage.getItem('user')
    if (raw) user.value = JSON.parse(raw)
  } catch {
    user.value = null
  }
  loading.value = false

  try {
    const [projData, activeData, pubData, assetData, userData] = await Promise.all([
      safeGet('/api/v1/projects?limit=3'),
      safeGet('/api/v1/projects?status=active&limit=1'),
      safeGet('/api/v1/projects?status=published&limit=1'),
      safeGet('/api/v1/assets?limit=1').catch(() => null),
      safeGet('/api/v1/users?limit=1').catch(() => null),
    ])

    recentProjects.value = projData?.items ?? projData?.list ?? []
    stats.value[0].value = String(activeData?.total ?? activeData?.items?.length ?? 0)
    stats.value[1].value = String(pubData?.total ?? pubData?.items?.length ?? 0)
    stats.value[2].value = assetData ? String(assetData.total ?? assetData?.items?.length ?? assetData?.length ?? '—') : '—'
    stats.value[3].value = userData ? String(userData.total ?? userData?.items?.length ?? userData?.length ?? '—') : '—'
  } catch (err: any) {
    console.warn('dashboard 拉数据失败', err)
    error.value = err?.message || '数据加载失败，请检查网络连接'
  } finally {
    statsLoading.value = false
  }
})

function retry() {
  error.value = ''
  loading.value = true
  location.reload()
}
</script>

<template>
  <div class="dashboard">

      <!-- 加载中 -->
      <div v-if="loading" class="dashboard__loading">
        <div class="dashboard__spinner" />
        <p>正在加载工作台...</p>
      </div>

      <!-- 加载错误 -->
      <div v-else-if="error" class="dashboard__error">
        <p>⚠️ {{ error }}</p>
        <button class="dashboard__retry-btn" @click="retry">重试</button>
      </div>

      <!-- 正常内容 -->
      <div v-else class="dashboard__content">

        <!-- 欢迎条 -->
        <section class="dashboard__welcome">
          <h1>
            欢迎回来，<span class="dashboard__highlight">{{ user?.nickname ?? '创作者' }}</span>
          </h1>
          <p>当前主题：<strong>{{ currentMeta.label }}</strong> · 切换主题在右上角</p>
        </section>

        <!-- 4 统计卡 -->
        <section class="dashboard__stats">
          <div v-for="s in stats" :key="s.label" class="stat-card">
            <span class="stat-card__icon">{{ s.icon }}</span>
            <div>
              <p class="stat-card__value">{{ s.value }}</p>
              <p class="stat-card__label">{{ s.label }}</p>
            </div>
          </div>
        </section>

        <!-- 快速开始 — 6 大生成器 -->
        <section class="dashboard__quick">
          <div class="dashboard__section-header">
            <h2>快速开始</h2>
            <p>选择一个工坊，开始创作</p>
          </div>
          <div class="quick-cards">
            <div
              v-for="g in GENERATORS"
              :key="g.key"
              class="quick-card"
              @click="openGenerator(g.route)"
            >
              <span class="quick-card__icon">{{ g.icon }}</span>
              <span class="quick-card__name">{{ g.name }}</span>
            </div>
          </div>
        </section>

        <!-- 4 主题变量展示 -->
        <section class="dashboard__tokens">
          <div class="dashboard__section-header">
            <h2>当前主题 CSS 变量</h2>
            <p>实时读取自 :root · 切主题时自动更新</p>
          </div>
          <div class="tokens-grid">
            <div
              v-for="t in themeTokens"
              :key="t.key"
              class="token-card"
              :style="{ '--token-color': t.value }"
            >
              <div class="token-card__swatch" :style="{ background: t.value }" />
              <div class="token-card__info">
                <code class="token-card__key">{{ t.key }}</code>
                <span class="token-card__label">{{ t.label }}</span>
                <code class="token-card__value">{{ t.value }}</code>
              </div>
            </div>
          </div>
        </section>

        <!-- 最近项目 -->
        <section class="dashboard__projects">
          <div class="dashboard__section-header">
            <h2>最近项目</h2>
            <p v-if="statsLoading">正在加载项目...</p>
            <p v-else-if="recentProjects.length === 0">暂无项目，去创作工作台创建一个吧</p>
            <p v-else>最近更新的 {{ recentProjects.length }} 个项目</p>
          </div>
          <div class="projects-list">
            <a
              v-for="p in recentProjects"
              :key="p.id"
              :href="`http://${hostname}:5180/projects/${p.id}`"
              target="_blank"
              class="project-card"
            >
              <div class="project-card__cover">{{ p.cover_url ? '🖼' : '📁' }}</div>
              <div class="project-card__body">
                <h3>{{ p.name }}</h3>
                <p class="project-card__meta">
                  <span :class="['status', `status--${p.status}`]">
                    {{ STATUS_META[p.status]?.label ?? p.status }}
                  </span>
                  <span>· {{ formatTime(p.updated_at) }}</span>
                </p>
              </div>
              <span class="project-card__arrow">→</span>
            </a>
          </div>
        </section>

        <!-- W2 预告 -->
        <section class="dashboard__roadmap">
          <h3>W2 即将上线</h3>
          <ul>
            <li>📁 完整项目列表（卡片 / 表格切换）</li>
            <li>🤖 AI 续写 / 改稿 / 一键起稿</li>
            <li>🗃 素材库：角色 / 场景 / 道具 / 分镜</li>
            <li>👥 团队协作：权限分配 / 邀请成员</li>
          </ul>
        </section>
      </div>
  </div>
</template>

<style scoped>
/* ===== Root ===== */
.dashboard {
  flex: 1;
  min-height: 0;
  background: var(--bg-primary, #0E0F12);
  color: var(--text-primary, #E8EAED);
}

/* ===== Content ===== */
.dashboard__content {
  padding: 28px 32px 60px;
}

/* ===== Loading / Error ===== */
.dashboard__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
  color: var(--text-secondary, #9CA3AF);
}

.dashboard__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border, #2E3139);
  border-top-color: var(--accent, #00BFA5);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.dashboard__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 16px;
  color: var(--text-secondary, #9CA3AF);
}

.dashboard__retry-btn {
  padding: 8px 20px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
  background: var(--bg-secondary, #1A1C21);
  color: var(--text-primary, #E8EAED);
  cursor: pointer;
  transition: all .2s;
  font-family: inherit;
}

.dashboard__retry-btn:hover {
  border-color: var(--accent, #00BFA5);
}

/* ===== Welcome ===== */
.dashboard__welcome {
  margin-bottom: 32px;
}

.dashboard__welcome h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}

.dashboard__highlight {
  background: var(--gradient, linear-gradient(135deg, #00BFA5 0%, #7C3AED 100%));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.dashboard__welcome p {
  color: var(--text-secondary, #9CA3AF);
  font-size: 14px;
  margin: 0;
}

.dashboard__welcome strong {
  color: var(--accent, #00BFA5);
  font-weight: 600;
}

/* ===== Stats ===== */
.dashboard__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 40px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 20px;
  background: var(--bg-card, #141A2E);
  border: 1px solid var(--border, #2E3139);
  border-radius: var(--radius, 12px);
  transition: all 250ms;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent, #00BFA5);
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.3));
}

.stat-card__icon {
  font-size: 28px;
  line-height: 1;
}

.stat-card__value {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 2px;
  color: var(--text-primary, #E8EAED);
}

.stat-card__label {
  font-size: 12px;
  color: var(--text-secondary, #9CA3AF);
  margin: 0;
}

/* ===== Section header ===== */
.dashboard__section-header {
  margin-bottom: 20px;
}

.dashboard__section-header h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 4px;
}

.dashboard__section-header p {
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
  margin: 0;
}

/* ===== Quick Start — 6 generators ===== */
.dashboard__quick {
  margin-bottom: 40px;
}

.quick-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.quick-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
  cursor: pointer;
  transition: all 200ms;
  user-select: none;
}

.quick-card:hover {
  border-color: var(--accent, #00BFA5);
  background: var(--bg-card, #141A2E);
}

.quick-card__icon {
  font-size: 20px;
  flex-shrink: 0;
  line-height: 1;
}

.quick-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
}

/* ===== Theme tokens ===== */
.dashboard__tokens {
  margin-bottom: 40px;
}

.tokens-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.token-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #2E3139);
  border-left: 3px solid var(--token-color);
  border-radius: 10px;
}

.token-card__swatch {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
  border: 1px solid var(--border, #2E3139);
}

.token-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.token-card__key {
  font-size: 11px;
  color: var(--accent, #00BFA5);
  font-family: var(--font-mono, monospace);
}

.token-card__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #E8EAED);
}

.token-card__value {
  font-size: 11px;
  color: var(--text-secondary, #9CA3AF);
  font-family: var(--font-mono, monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== Projects ===== */
.dashboard__projects {
  margin-bottom: 40px;
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.project-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: all 200ms;
}

.project-card:hover {
  border-color: var(--accent, #00BFA5);
  transform: translateX(4px);
}

.project-card__cover {
  font-size: 32px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent, #00BFA5) 10%, transparent);
  border-radius: 10px;
  flex-shrink: 0;
}

.project-card__body {
  flex: 1;
  min-width: 0;
}

.project-card__body h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 4px;
}

.project-card__meta {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary, #9CA3AF);
  display: flex;
  align-items: center;
  gap: 6px;
}

.status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.status--active,
.status--published {
  background: color-mix(in srgb, var(--accent, #00BFA5) 15%, transparent);
  color: var(--accent, #00BFA5);
}

.status--archived,
.status--deleted {
  background: color-mix(in srgb, var(--text-secondary, #9CA3AF) 12%, transparent);
  color: var(--text-secondary, #9CA3AF);
}

.status--draft {
  background: color-mix(in srgb, var(--warning, #F59E0B) 15%, transparent);
  color: var(--warning, #F59E0B);
}

.project-card__arrow {
  font-size: 18px;
  color: var(--text-secondary, #9CA3AF);
  transition: transform 200ms, color 200ms;
}

.project-card:hover .project-card__arrow {
  color: var(--accent, #00BFA5);
  transform: translateX(4px);
}

/* ===== Roadmap ===== */
.dashboard__roadmap {
  padding: 24px;
  background: color-mix(in srgb, var(--accent, #00BFA5) 5%, transparent);
  border: 1px dashed var(--border-strong, #3A3E46);
  border-radius: 12px;
}

.dashboard__roadmap h3 {
  margin: 0 0 12px;
  font-size: 15px;
  color: var(--accent, #00BFA5);
}

.dashboard__roadmap ul {
  margin: 0;
  padding-left: 20px;
  color: var(--text-secondary, #9CA3AF);
  font-size: 13px;
  line-height: 1.8;
}

/* ===== Responsive ===== */
@media (max-width: 1024px) {
  .quick-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
