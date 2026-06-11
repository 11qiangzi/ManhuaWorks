<script setup lang="ts">
/**
 * DashboardView · 我的工作台首页
 * ManhuaWorks · L3.L 用户后台深耕
 *
 * 四大模块：
 * 1. 欢迎条 + 上线提示
 * 2. 今日推荐（热门模板/作品/活动）
 * 3. 最近活动（项目/作品/协作 时间线）
 * 4. 快速入口（5 大区 + 创作者工作台）
 *
 * 数据策略：
 * - 调 apiClient.http 拉取 /v1/dashboard/* （开发期 mock）
 * - 失败回退到本地 mock 数据
 */

import { computed, onMounted, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { getApi } from '@/api-bridge'
import { useUser } from '@/composables/useUser'

const router = useRouter()
const api = getApi()
const { profile, nickname, load: loadUser } = useUser()

/* ------------------------------------------------------------------ */
/*                          状态                                       */
/* ------------------------------------------------------------------ */

interface RecommendItem {
  id: string
  title: string
  cover: string
  tag: string
  cta: string
  route: string
}

interface ActivityItem {
  id: string
  type: 'project' | 'work' | 'asset' | 'collab' | 'system'
  title: string
  meta: string
  at: string
  route?: string
}

interface DashboardSummary {
  todayRecommend: RecommendItem[]
  recentActivities: ActivityItem[]
  onlineDays: number
  lastLoginAt: string | null
}

const loading = ref(true)
const summary = ref<DashboardSummary>({
  todayRecommend: [],
  recentActivities: [],
  onlineDays: 0,
  lastLoginAt: null
})

/* ------------------------------------------------------------------ */
/*                          Mock 回退                                 */
/* ------------------------------------------------------------------ */

const MOCK_RECOMMEND: RecommendItem[] = [
  { id: 'r1', title: '古风宫廷漫改模板', cover: '🏯', tag: '热门模板', cta: '立即体验', route: '/projects' },
  { id: 'r2', title: '校园青春系列合集', cover: '🎒', tag: '本周推荐', cta: '去看作品', route: '/works' },
  { id: 'r3', title: '新角色 · 苏锦年', cover: '👘', tag: '素材上新', cta: '加入素材库', route: '/assets' },
  { id: 'r4', title: '团队协作 2.0 教程', cover: '🤝', tag: '能力更新', cta: '查看团队', route: '/team' }
]

const MOCK_ACTIVITIES: ActivityItem[] = [
  { id: 'a1', type: 'project', title: '编辑了项目「长安月下」', meta: '更新了第 8 章分镜', at: '12 分钟前', route: '/projects' },
  { id: 'a2', type: 'collab', title: '林染 加入了「星火」团队', meta: '角色：编辑', at: '1 小时前', route: '/team' },
  { id: 'a3', type: 'work', title: '作品「春风渡」观看数 +128', meta: '累计 1.2 万', at: '3 小时前', route: '/works' },
  { id: 'a4', type: 'asset', title: '上传了 6 张场景素材', meta: '类别：古代街市', at: '昨天 21:08', route: '/assets' },
  { id: 'a5', type: 'system', title: '订阅已升级为 Pro 创作者', meta: '解锁 BYOK 全部能力', at: '3 天前' }
]

function applyMock(): void {
  summary.value = {
    todayRecommend: MOCK_RECOMMEND,
    recentActivities: MOCK_ACTIVITIES,
    onlineDays: 17,
    lastLoginAt: new Date(Date.now() - 86_400_000).toISOString()
  }
}

/* ------------------------------------------------------------------ */
/*                          加载                                       */
/* ------------------------------------------------------------------ */

async function loadSummary(): Promise<void> {
  loading.value = true
  try {
    // 尝试从后端拉取（开发期后端未必就绪）
    const res = await api.http.request<{ data: DashboardSummary }>({
      method: 'GET',
      path: '/v1/dashboard/summary'
    })
    if (res?.data) {
      summary.value = { ...summary.value, ...res.data }
    } else {
      applyMock()
    }
  } catch {
    applyMock()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadUser(), loadSummary()])
})

/* ------------------------------------------------------------------ */
/*                          衍生                                       */
/* ------------------------------------------------------------------ */

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早安'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const absentHint = computed(() => {
  if (!summary.value.lastLoginAt) return null
  const last = new Date(summary.value.lastLoginAt).getTime()
  const days = Math.max(0, Math.floor((Date.now() - last) / 86_400_000))
  if (days <= 0) return null
  return `您已经 ${days} 天没上线了，灵感都等不及啦 ✨`
})

const quickEntries = [
  { id: 'projects', label: '我的项目', icon: '📁', route: '/projects', color: '#6366f1', desc: '管理所有漫改项目' },
  { id: 'works', label: '我的作品', icon: '🎞', route: '/works', color: '#a855f7', desc: '已发布的视频/漫画' },
  { id: 'assets', label: '素材库', icon: '🗃', route: '/assets', color: '#2563eb', desc: '图片/视频/音频/角色/场景' },
  { id: 'team', label: '团队', icon: '🤝', route: '/team', color: '#10b981', desc: '成员协作 / 邀请' },
  { id: 'account', label: '账户', icon: '⚙', route: '/account', color: '#f59e0b', desc: '安全 / 订阅 / BYOK' }
]

function jump(route: string): void {
  router.push(route)
}

function activityIcon(t: ActivityItem['type']): string {
  switch (t) {
    case 'project': return '📁'
    case 'work': return '🎞'
    case 'asset': return '🖼'
    case 'collab': return '🤝'
    case 'system': return '📣'
    default: return '·'
  }
}
</script>

<template>
  <main class="dash">
    <!-- 顶栏 -->
    <header class="dash__nav">
      <div class="dash__brand">
        <span class="dash__logo">M</span>
        <span class="dash__brand-name">我的工作台</span>
      </div>
      <nav class="dash__nav-links">
        <RouterLink to="/dashboard" class="dash__nav-link dash__nav-link--active">首页</RouterLink>
        <RouterLink to="/projects" class="dash__nav-link">项目</RouterLink>
        <RouterLink to="/works" class="dash__nav-link">作品</RouterLink>
        <RouterLink to="/assets" class="dash__nav-link">素材</RouterLink>
        <RouterLink to="/team" class="dash__nav-link">团队</RouterLink>
        <RouterLink to="/account" class="dash__nav-link">账户</RouterLink>
      </nav>
    </header>

    <div class="dash__content">
      <!-- ===== 1. 欢迎条 ===== -->
      <section class="dash__welcome">
        <div class="dash__welcome-main">
          <p class="dash__greet">{{ greeting }}, <span class="dash__nick">{{ nickname || '创作者' }}</span> 👋</p>
          <h1 class="dash__title">今天继续<span class="dash__title-accent">漫改创作</span></h1>
          <p v-if="absentHint" class="dash__absent">⏰ {{ absentHint }}</p>
          <p v-else class="dash__sub">已连续在线 <strong>{{ summary.onlineDays }}</strong> 天 · 加油！</p>
        </div>
        <div class="dash__welcome-side">
          <div class="dash__plan">
            <span class="dash__plan-label">当前套餐</span>
            <span class="dash__plan-name">{{ profile?.plan || 'Pro 创作者' }}</span>
          </div>
          <button type="button" class="dash__btn dash__btn--primary" @click="jump('/projects')">+ 新建项目</button>
        </div>
      </section>

      <!-- ===== 2. 今日推荐 ===== -->
      <section class="dash__section">
        <div class="dash__section-header">
          <h2>🌟 今日推荐</h2>
          <span class="dash__hint">每天 8:00 更新</span>
        </div>
        <div v-if="loading" class="dash__loading">加载中...</div>
        <div v-else class="dash__recommend">
          <article
            v-for="r in summary.todayRecommend"
            :key="r.id"
            class="rec-card"
            tabindex="0"
            role="button"
            @click="jump(r.route)"
            @keyup.enter="jump(r.route)"
          >
            <div class="rec-card__cover">{{ r.cover }}</div>
            <span class="rec-card__tag">{{ r.tag }}</span>
            <h3 class="rec-card__title">{{ r.title }}</h3>
            <span class="rec-card__cta">{{ r.cta }} →</span>
          </article>
        </div>
      </section>

      <!-- ===== 3. 最近活动 + 4. 快速入口 并排 ===== -->
      <section class="dash__grid">
        <div class="dash__panel">
          <h2>🕒 最近活动</h2>
          <ul v-if="summary.recentActivities.length" class="dash__activities">
            <li
              v-for="a in summary.recentActivities"
              :key="a.id"
              class="act-item"
              :class="{ 'act-item--link': !!a.route }"
              @click="a.route && jump(a.route)"
            >
              <span class="act-item__icon">{{ activityIcon(a.type) }}</span>
              <div class="act-item__body">
                <p class="act-item__title">{{ a.title }}</p>
                <p class="act-item__meta">{{ a.meta }}</p>
              </div>
              <span class="act-item__at">{{ a.at }}</span>
            </li>
          </ul>
          <p v-else class="dash__empty">暂无活动</p>
        </div>

        <div class="dash__panel">
          <h2>🚀 快速入口</h2>
          <div class="dash__entries">
            <button
              v-for="e in quickEntries"
              :key="e.id"
              type="button"
              class="entry"
              :style="{ '--e-color': e.color }"
              @click="jump(e.route)"
            >
              <span class="entry__icon">{{ e.icon }}</span>
              <span class="entry__label">{{ e.label }}</span>
              <span class="entry__desc">{{ e.desc }}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.dash {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  --dash-grad: linear-gradient(135deg, #6366f1 0%, #a855f7 60%, #ec4899 100%);
}
.dash__nav {
  position: sticky; top: 0; z-index: 100;
  display: flex; align-items: center; gap: 24px;
  padding: 0 24px; height: 56px;
  background: rgba(10,14,26,.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}
.dash__brand { display: flex; align-items: center; gap: 10px; font-weight: 700; }
.dash__logo {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px;
  background: var(--dash-grad); color: white; font-weight: 800;
}
.dash__nav-links { display: flex; gap: 4px; flex: 1; margin-left: 20px; }
.dash__nav-link {
  padding: 6px 14px; font-size: 13px; color: var(--text-secondary);
  border-radius: 6px; text-decoration: none; transition: all 180ms;
}
.dash__nav-link:hover { color: var(--text-primary); background: var(--bg-secondary); }
.dash__nav-link--active { color: white; background: var(--dash-grad); }

.dash__content { max-width: 1200px; margin: 0 auto; padding: 32px 28px 60px; display: flex; flex-direction: column; gap: 32px; }

/* 欢迎 */
.dash__welcome {
  display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: center;
  padding: 32px; border-radius: 16px;
  background: var(--dash-grad);
  color: white; position: relative; overflow: hidden;
}
.dash__welcome::after {
  content: ''; position: absolute; right: -60px; top: -60px;
  width: 200px; height: 200px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}
.dash__greet { font-size: 14px; opacity: 0.92; }
.dash__nick { font-weight: 700; }
.dash__title { font-size: 28px; font-weight: 800; margin: 6px 0 8px; }
.dash__title-accent { background: rgba(255, 255, 255, 0.25); padding: 0 8px; border-radius: 6px; }
.dash__sub, .dash__absent { font-size: 13px; opacity: 0.88; }
.dash__absent { background: rgba(255, 255, 255, 0.18); padding: 6px 12px; border-radius: 6px; display: inline-block; }
.dash__welcome-side { display: flex; flex-direction: column; gap: 12px; align-items: flex-end; position: relative; z-index: 1; }
.dash__plan { display: flex; flex-direction: column; align-items: flex-end; }
.dash__plan-label { font-size: 12px; opacity: 0.8; }
.dash__plan-name { font-size: 18px; font-weight: 800; }
.dash__btn {
  border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px;
}
.dash__btn--primary { background: white; color: #6d28d9; }

/* Section */
.dash__section-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px; }
.dash__section-header h2 { font-size: 18px; font-weight: 700; margin: 0; }
.dash__hint { font-size: 12px; color: var(--text-secondary); }
.dash__loading { padding: 32px; text-align: center; color: var(--text-secondary); }

/* 推荐 */
.dash__recommend {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
}
.rec-card {
  display: flex; flex-direction: column; gap: 8px; padding: 18px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); cursor: pointer; transition: all 200ms;
}
.rec-card:hover { transform: translateY(-2px); border-color: var(--accent); box-shadow: 0 8px 24px rgba(99, 102, 241, 0.15); }
.rec-card__cover {
  width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;
  background: var(--dash-grad); color: white; font-size: 30px; border-radius: 12px;
}
.rec-card__tag {
  align-self: flex-start; font-size: 11px; padding: 2px 8px; border-radius: 99px;
  background: var(--dash-grad); color: white; font-weight: 600;
}
.rec-card__title { font-size: 14px; font-weight: 700; margin: 0; }
.rec-card__cta { font-size: 12px; color: #6366f1; font-weight: 600; }

/* 双栏 */
.dash__grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px; }
.dash__panel { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
.dash__panel h2 { font-size: 16px; font-weight: 700; margin: 0 0 16px; }
.dash__empty { color: var(--text-secondary); font-size: 13px; padding: 24px 0; text-align: center; }

/* 活动列表 */
.dash__activities { display: flex; flex-direction: column; gap: 4px; list-style: none; margin: 0; padding: 0; }
.act-item {
  display: grid; grid-template-columns: 32px 1fr auto; gap: 12px; align-items: center;
  padding: 10px 8px; border-radius: 8px; cursor: default; transition: background 150ms;
}
.act-item--link { cursor: pointer; }
.act-item--link:hover { background: var(--bg-primary); }
.act-item__icon {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--dash-grad); color: white;
  display: flex; align-items: center; justify-content: center; font-size: 16px;
}
.act-item__title { font-size: 13px; font-weight: 600; margin: 0; }
.act-item__meta { font-size: 12px; color: var(--text-secondary); margin: 2px 0 0; }
.act-item__at { font-size: 11px; color: var(--text-secondary); white-space: nowrap; }

/* 快速入口 */
.dash__entries { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.entry {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 12px; background: var(--bg-primary);
  border: 1px solid var(--border); border-radius: 8px; cursor: pointer; text-align: left;
  transition: all 180ms;
}
.entry:hover { border-color: var(--e-color, var(--accent)); transform: translateY(-1px); }
.entry__icon {
  width: 32px; height: 32px; border-radius: 8px;
  background: color-mix(in srgb, var(--e-color) 12%, transparent);
  color: var(--e-color); display: flex; align-items: center; justify-content: center; font-size: 16px;
}
.entry__label { font-size: 13px; font-weight: 700; }
.entry__desc { font-size: 11px; color: var(--text-secondary); }

@media (max-width: 960px) {
  .dash__welcome { grid-template-columns: 1fr; }
  .dash__recommend { grid-template-columns: repeat(2, 1fr); }
  .dash__grid { grid-template-columns: 1fr; }
}
</style>
