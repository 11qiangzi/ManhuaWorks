<script setup lang="ts">
/**
 * WorksView · 作品库
 * v3.0: 移除 DashboardShell 双重布局，使用 MainLayout 统一导航
 */
import { ref, onMounted, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import LoginModal from '@/components/LoginModal.vue'

const router = useRouter()

interface Work {
  id: string
  name?: string
  title?: string
  description?: string | null
  cover_url?: string | null
  status?: number
  created_at?: string
  updated_at?: string
}

const works = ref<Work[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const isAuthError = ref(false)
const showLogin = ref(false)

function getAuthHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('mhw.access_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

async function loadWorks(): Promise<void> {
  loading.value = true
  error.value = null
  isAuthError.value = false
  try {
    const r = await fetch('/api/v1/projects', { headers: getAuthHeaders() })
    if (r.status === 401) { error.value = '请先登录后再查看作品'; isAuthError.value = true; return }
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const raw = await r.json()
    const all = raw?.data?.items ?? raw?.data?.list ?? []
    works.value = all.filter((p: Work) => p.status === 2)
  } catch (e) {
    error.value = (e as Error).message
    works.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadWorks)

function openWork(w: Work): void {
  router.push(`/projects/${w.id}`)
}

function fmt(t?: string): string {
  if (!t) return '—'
  const d = new Date(t)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return d.toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="wv-root">
    <header class="wv-header">
      <h1>🏆 作品库 <span class="wv-count">({{ works.length }})</span></h1>
      <p>已发布的作品集中展示</p>
    </header>

    <!-- Auth Error -->
    <div v-if="isAuthError" class="wv-auth-prompt">
      <span class="wv-auth-icon">🔒</span>
      <h2>请先登录</h2>
      <p>登录后即可查看你的作品库</p>
      <button class="wv-auth-btn" @click="showLogin = true">登录账号</button>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="wv-error">
      <span>⚠️ 加载失败：{{ error }}</span>
      <button type="button" class="wv-retry" @click="loadWorks">重试</button>
    </div>

    <!-- Loading -->
    <section v-if="loading" class="wv-skeleton-grid">
      <div v-for="i in 4" :key="i" class="wv-skeleton-card">
        <div class="skeleton wv-skeleton-cover" />
        <div class="wv-skeleton-body">
          <div class="skeleton wv-skeleton-title" />
          <div class="skeleton wv-skeleton-desc" />
          <div class="skeleton wv-skeleton-meta" />
        </div>
      </div>
    </section>

    <!-- Empty (STA-1 enhanced) -->
    <section v-else-if="!error && works.length === 0" class="wv-empty">
      <div class="wv-empty-icon-wrap">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M17 8H7"/><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/></svg>
      </div>
      <h2>还没有完成的作品</h2>
      <p>完成一个项目并发布，作品会自动出现在这里</p>
      <div class="wv-empty-actions">
        <RouterLink to="/dashboard" class="wv-empty-cta">🚀 去创作</RouterLink>
        <RouterLink to="/projects" class="wv-empty-secondary">📁 查看项目</RouterLink>
      </div>
    </section>

    <!-- Grid -->
    <section v-else class="wv-grid">
      <button
        v-for="w in works"
        :key="w.id"
        class="wv-card"
        @click="openWork(w)"
      >
        <div class="wv-card-cover">{{ w.cover_url ? '🖼' : '🎬' }}</div>
        <div class="wv-card-body">
          <h3>{{ w.title || w.name || '未命名作品' }}</h3>
          <p v-if="w.description">{{ w.description }}</p>
          <p class="wv-card-meta">🚀 已发布 · {{ fmt(w.created_at) }}</p>
        </div>
        <span class="wv-card-arrow">→</span>
      </button>
    </section>
    <LoginModal v-model="showLogin" />
  </div>
</template>

<style scoped>
.wv-root { padding: 24px 0; }

.wv-header h1 {
  font-size: 24px; font-weight: 700; margin: 0 0 6px;
  color: var(--text-primary);
}
.wv-count { font-size: 14px; color: var(--text-secondary); font-weight: 600; }
.wv-header p { font-size: 14px; color: var(--text-secondary); margin: 0 0 24px; }

/* Skeleton */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, #1A1C21 25%, #23262E 50%, #1A1C21 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}
.wv-skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.wv-skeleton-card { display: flex; gap: 12px; background: var(--bg-secondary); border-radius: 12px; padding: 16px; }
.wv-skeleton-cover { width: 64px; height: 48px; border-radius: 8px; flex-shrink: 0; }
.wv-skeleton-body { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.wv-skeleton-title { height: 14px; width: 60%; }
.wv-skeleton-desc { height: 10px; width: 40%; }
.wv-skeleton-meta { height: 10px; width: 30%; }

/* Empty */
.wv-empty { text-align: center; padding: 64px 24px; }
.wv-empty-icon-wrap {
  width: 80px; height: 80px; border-radius: 20px;
  background: linear-gradient(135deg, rgba(0, 191, 165, 0.12), rgba(124, 58, 237, 0.12));
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 20px;
  color: var(--text-muted);
}
.wv-empty h2 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
.wv-empty p { color: var(--text-secondary); margin: 0 0 24px; }
.wv-empty-actions { display: flex; gap: 8px; justify-content: center; }
.wv-empty-cta {
  display: inline-flex; align-items: center;
  padding: 10px 24px;
  background: linear-gradient(135deg, var(--accent), #7C3AED);
  color: white; border-radius: 8px; font-weight: 600; text-decoration: none;
}
.wv-empty-secondary {
  display: inline-flex; align-items: center;
  padding: 10px 20px;
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 8px; color: var(--text-secondary); font-size: 13px; font-weight: 500;
  text-decoration: none; transition: all 150ms ease;
}
.wv-empty-secondary:hover { border-color: var(--accent); color: var(--accent); }

/* Grid */
.wv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.wv-card {
  display: flex; align-items: center; gap: 14px;
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 12px; padding: 16px;
  cursor: pointer; text-align: left; font-family: inherit; color: inherit;
  transition: border-color 200ms, transform 200ms;
}
.wv-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.wv-card-cover { font-size: 32px; flex-shrink: 0; }
.wv-card-body { flex: 1; min-width: 0; }
.wv-card-body h3 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
.wv-card-body p { font-size: 12px; color: var(--text-secondary); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wv-card-meta { color: var(--text-muted) !important; margin-top: 4px !important; }
.wv-card-arrow { font-size: 18px; color: var(--text-muted); flex-shrink: 0; }

/* Error */
.wv-error {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
  border-radius: 8px; margin-bottom: 16px;
  font-size: 13px; color: #fca5a5;
}
.wv-retry { background: none; border: none; color: var(--accent); cursor: pointer; font-size: 13px; font-weight: 600; }

/* Auth Prompt */
.wv-auth-prompt {
  text-align: center;
  padding: 64px 24px;
  margin-bottom: 16px;
}
.wv-auth-icon { font-size: 48px; display: block; margin-bottom: 16px; }
.wv-auth-prompt h2 { font-size: 22px; font-weight: 700; margin: 0 0 8px; color: var(--text-primary); }
.wv-auth-prompt p { font-size: 14px; color: var(--text-secondary); margin: 0 0 24px; }
.wv-auth-btn {
  display: inline-flex; align-items: center;
  padding: 10px 28px;
  background: linear-gradient(135deg, var(--accent), #7C3AED);
  color: white; border: none; border-radius: 8px;
  font-size: 14px; font-weight: 600; cursor: pointer;
  transition: opacity 150ms;
}
.wv-auth-btn:hover { opacity: 0.9; }

</style>
