<script setup lang="ts">
/**
 * DashboardView · 用户工作台首页
 * ManhuaWorks · 接真 API · 项目卡可点击
 *
 * 4 统计接 user-service / project-service / asset-service
 * 项目卡跨 app 跳 user-portal (:5180)
 * 跨 app 跳转用 window.location.hostname（LAN 友好）
 */

import { ref, onMounted, computed } from 'vue'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import { useTheme } from '@/composables/useTheme'

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
/*  helpers                                                           */
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
  // api-gateway 可能包一层 { data: ... }
  return raw?.data ?? raw
}

/* ------------------------------------------------------------------ */
/*  lifecycle                                                         */
/* ------------------------------------------------------------------ */

onMounted(async () => {
  // 用户
  try {
    const raw = localStorage.getItem('user')
    if (raw) user.value = JSON.parse(raw)
  } catch {
    user.value = null
  }
  loading.value = false

  // 仪表盘
  try {
    const [projData, activeData, pubData, assetData, userData] = await Promise.all([
      safeGet('/api/v1/projects?limit=3'),
      safeGet('/api/v1/projects?status=active&limit=1'),
      safeGet('/api/v1/projects?status=published&limit=1'),
      safeGet('/api/v1/assets?limit=1').catch(() => null),
      safeGet('/api/v1/users?limit=1').catch(() => null),
    ])

    // Express returns { items: [...], total: N }
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

function goToProjects() {
  window.location.href = `http://${hostname}:5180/projects`
}

function goToMaterials() {
  window.location.href = `http://${hostname}:5175/materials`
}

function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('mhw.access_token')
  localStorage.removeItem('mhw.user')
  window.location.href = '/login'
}
</script>

<template>
  <main class="dashboard">
    <!-- 顶栏 -->
    <header class="dashboard__nav">
      <div class="dashboard__brand">
        <span class="dashboard__logo">M</span>
        <span class="dashboard__brand-name">ManhuaWorks</span>
      </div>
      <nav class="dashboard__nav-links">
        <a href="#" class="dashboard__nav-link active">工作台</a>
        <a href="#" class="dashboard__nav-link">项目</a>
        <a href="#" class="dashboard__nav-link">素材</a>
        <a href="#" class="dashboard__nav-link">设置</a>
      </nav>
      <div class="dashboard__nav-right">
        <ThemeSwitcher mode="compact" />
        <span class="dashboard__avatar" v-if="user">{{ (user.nickname || '创')[0] }}</span>
        <button class="dashboard__logout" @click="logout">退出</button>
      </div>
    </header>

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

    <!-- 主体: sidebar + content -->
    <div v-else class="dashboard__body">
    <!-- 侧边栏 -->
    <aside class="dashboard__sidebar">
      <a href="#" class="dashboard__sidebar-item active">📊 工作台</a>
      <a href="#" class="dashboard__sidebar-item">📁 我的项目</a>
      <a href="#" class="dashboard__sidebar-item">🎬 作品</a>
      <a href="#" class="dashboard__sidebar-item">🗃 素材库</a>
      <a href="#" class="dashboard__sidebar-item">👥 团队</a>
      <a href="#" class="dashboard__sidebar-item">⚙ 设置</a>
    </aside>

    <!-- 内容 -->
    <div class="dashboard__content">
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
          <p v-else-if="recentProjects.length === 0">暂无项目，去 <a href="/studio">创作工作台</a> 创建一个吧</p>
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
    </div><!-- /dashboard__body -->
  </main>
</template>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

/* ===== 顶栏 ===== */
.dashboard__nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: rgba(10,14,26,.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}

.dashboard__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
}

.dashboard__brand-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -.01em;
}

.dashboard__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--gradient);
  color: white;
  font-size: 14px;
  font-weight: 800;
}

.dashboard__nav-links {
  display: flex;
  gap: 4px;
}

.dashboard__nav-link {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all .2s;
}

.dashboard__nav-link:hover,
.dashboard__nav-link.active {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.dashboard__nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.dashboard__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
}

.dashboard__user {
  color: var(--text-secondary);
}

.dashboard__logout {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 200ms;
}

.dashboard__logout:hover {
  border-color: var(--danger);
  color: var(--danger);
}

/* ===== 加载 ===== */
.dashboard__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
  color: var(--text-secondary);
}

.dashboard__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== 错误状态 ===== */
.dashboard__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 16px;
  color: var(--text-secondary);
}

.dashboard__retry-btn {
  padding: 8px 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  transition: all .2s;
}

.dashboard__retry-btn:hover {
  border-color: var(--accent);
}

/* ===== 主体 layout ===== */
.dashboard__body {
  display: flex;
  height: calc(100vh - 56px);
}

.dashboard__sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dashboard__sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all .15s;
}

.dashboard__sidebar-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.dashboard__sidebar-item.active {
  background: rgba(99,102,241,.12);
  color: var(--accent);
  font-weight: 600;
}

/* ===== 内容 ===== */
.dashboard__content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px 60px;
}

/* 欢迎 */
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
  background: var(--gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.dashboard__welcome p {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0;
}

.dashboard__welcome strong {
  color: var(--accent);
  font-weight: 600;
}

/* 统计卡 */
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
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: all 250ms;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.stat-card__icon {
  font-size: 28px;
  line-height: 1;
}

.stat-card__value {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 2px;
  color: var(--text-primary);
}

.stat-card__label {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

/* section header */
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
  color: var(--text-secondary);
  margin: 0;
}

/* 4 主题变量 */
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
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-left: 3px solid var(--token-color);
  border-radius: 10px;
}

.token-card__swatch {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
  border: 1px solid var(--border);
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
  color: var(--accent);
  font-family: monospace;
}

.token-card__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.token-card__value {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 项目 */
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
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: all 200ms;
}

.project-card:hover {
  border-color: var(--accent);
  transform: translateX(4px);
}

.project-card__cover {
  font-size: 32px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
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
  color: var(--text-secondary);
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
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
}

.status--archived,
.status--deleted {
  background: color-mix(in srgb, var(--text-secondary) 12%, transparent);
  color: var(--text-secondary);
}

.status--draft {
  background: color-mix(in srgb, var(--warning, #f59e0b) 15%, transparent);
  color: var(--warning, #f59e0b);
}

.project-card__arrow {
  font-size: 18px;
  color: var(--text-secondary);
  transition: transform 200ms, color 200ms;
}

.project-card:hover .project-card__arrow {
  color: var(--accent);
  transform: translateX(4px);
}

/* 路线图 */
.dashboard__roadmap {
  padding: 24px;
  background: color-mix(in srgb, var(--accent) 5%, transparent);
  border: 1px dashed var(--border-strong);
  border-radius: 12px;
}

.dashboard__roadmap h3 {
  margin: 0 0 12px;
  font-size: 15px;
  color: var(--accent);
}

.dashboard__roadmap ul {
  margin: 0;
  padding-left: 20px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.8;
}
</style>
