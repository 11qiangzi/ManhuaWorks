<script setup lang="ts">
/**
 * StudioHomeView · 创作者工作台首页
 * ManhuaWorks · W2
 *
 * 功能：
 * 1. 项目列表（卡片网格 + 状态过滤）
 * 2. 创建项目按钮（弹窗：填标题/描述/风格/故事类型）
 * 3. 快捷入口：模型选择 / BYOK 设置 / 工具
 * 4. 顶部信息条：欢迎 + 当前主题
 */

import { ref, onMounted, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import FailoverIndicator from '@/components/studio/FailoverIndicator.vue'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()
const { currentMeta } = useTheme()

interface UserInfo { id: string; nickname: string; role: number }
interface Project {
  id: string
  title: string
  description?: string | null
  art_style?: string | null
  story_type?: string | null
  cover_url?: string | null
  status: number
  created_at: string
  updated_at?: string
}
interface ProjectListResp {
  list: Project[]
  page: number
  page_size: number
  total: number
}

const user = ref<UserInfo | null>(null)
const projects = ref<Project[]>([])
const loading = ref(true)
const filter = ref<'all' | '0' | '1' | '2' | '3'>('all')

/** 创建项目弹窗 */
const showCreate = ref(false)
const submitting = ref(false)
const form = reactive({
  title: '',
  description: '',
  art_style: '',
  story_type: ''
})

/** 状态文案/颜色映射 */
const STATUS_MAP: Record<number, { label: string; tone: string }> = {
  0: { label: '草稿', tone: 'draft' },
  1: { label: '生成中', tone: 'active' },
  2: { label: '已完成', tone: 'done' },
  3: { label: '失败', tone: 'fail' }
}

/** 过滤后的项目 */
const filteredProjects = computed(() => {
  if (filter.value === 'all') return projects.value
  return projects.value.filter((p) => String(p.status) === filter.value)
})

/** 4 个统计卡 */
const stats = computed(() => {
  const total = projects.value.length
  const generating = projects.value.filter((p) => p.status === 1).length
  const done = projects.value.filter((p) => p.status === 2).length
  const failed = projects.value.filter((p) => p.status === 3).length
  return [
    { label: '全部项目', value: total, icon: '📁', tone: 'accent' },
    { label: '生成中', value: generating, icon: '⚡', tone: 'warning' },
    { label: '已完成', value: done, icon: '✓', tone: 'success' },
    { label: '失败', value: failed, icon: '✗', tone: 'danger' }
  ]
})

/** 拉取项目（用户未登录时用占位数据） */
async function loadProjects() {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    if (token) {
      const res = await fetch('/v1/projects?page=1&page_size=50', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const body = await res.json() as { data?: ProjectListResp }
        projects.value = body?.data?.list ?? []
        return
      }
    }
    // 未登录 / 接口不通 → 占位数据
    projects.value = MOCK_PROJECTS
  } catch {
    projects.value = MOCK_PROJECTS
  } finally {
    loading.value = false
  }
}

/** 占位项目（演示用，登录态自动换成真实数据） */
const MOCK_PROJECTS: Project[] = [
  { id: 'm1', title: '《灰星》第 1 章', description: '男主林启误入文明废墟，分镜 12 个', art_style: '3D_guofeng_cyber', story_type: 'Scifi_post_apocalypse', status: 1, created_at: '2026-06-01' },
  { id: 'm2', title: '《墨燃江南》预告片', description: '江南水乡 + 浪漫剧情', art_style: '2D_chinese_guofeng', story_type: 'Sweet_romance_novel', status: 2, created_at: '2026-05-28' },
  { id: 'm3', title: '《霓虹街头》分镜集', description: '赛博朋克 + 短篇', art_style: '3D_anime_render', story_type: 'Hot_blooded_action', status: 0, created_at: '2026-05-25' },
  { id: 'm4', title: '《北境的雪》第 3 章', description: '末世冬日场景', art_style: '2D_flat_design', story_type: 'Scifi_post_apocalypse', status: 0, created_at: '2026-05-20' },
  { id: 'm5', title: '《汉武大帝》试做', description: '历史正剧 · 战争场面', art_style: 'realpeople_ancient_chinese', story_type: 'Historical_epic', status: 3, created_at: '2026-05-15' },
  { id: 'm6', title: '《都市迷局》前 5 集', description: '都市悬疑', art_style: 'realpeople_urban_modern', story_type: 'Mystery_thriller', status: 2, created_at: '2026-05-10' }
]

/** 创建项目 */
async function onCreate() {
  if (!form.title.trim()) return
  submitting.value = true
  try {
    const token = localStorage.getItem('token')
    if (token) {
      const res = await fetch('/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          art_style: form.art_style || undefined,
          story_type: form.story_type || undefined
        })
      })
      if (res.ok) {
        const body = await res.json() as { data?: { list?: Project[] } | Project }
        // 兼容后端 returning 行为
        const newProject: Project = 'list' in (body.data ?? {}) ? (body.data as { list: Project[] }).list[0]! : body.data as Project
        projects.value.unshift(newProject)
      } else {
        // 失败也用本地占位，让用户能继续
        projects.value.unshift({
          id: `local-${Date.now()}`,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          art_style: form.art_style || undefined,
          story_type: form.story_type || undefined,
          status: 0,
          created_at: new Date().toISOString().slice(0, 10)
        })
      }
    } else {
      projects.value.unshift({
        id: `local-${Date.now()}`,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        art_style: form.art_style || undefined,
        story_type: form.story_type || undefined,
        status: 0,
        created_at: new Date().toISOString().slice(0, 10)
      })
    }
    // 重置表单
    form.title = ''
    form.description = ''
    form.art_style = ''
    form.story_type = ''
    showCreate.value = false
  } catch (err) {
    console.error('[StudioHome] 创建失败', err)
  } finally {
    submitting.value = false
  }
}

/** 跳转项目编辑器 */
function openProject(p: Project) {
  router.push({ name: 'project-editor', params: { id: p.id } })
}

function logout() {
  try {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  } catch { /* noop */ }
  router.push('/login')
}

onMounted(() => {
  try {
    const raw = localStorage.getItem('user')
    if (raw) user.value = JSON.parse(raw)
  } catch {
    user.value = null
  }
  loadProjects()
})

const STORY_TYPES = [
  { v: 'Xianxia_fantasy', label: '仙侠玄幻' },
  { v: 'Scifi_post_apocalypse', label: '科幻末世' },
  { v: 'Historical_epic', label: '历史正剧' },
  { v: 'Sweet_romance_novel', label: '甜宠言情' },
  { v: 'Hot_blooded_action', label: '热血动作' },
  { v: 'Mystery_thriller', label: '悬疑推理' },
  { v: 'Urban_workplace_drama', label: '都市职场' },
  { v: 'Family_warmth', label: '家庭温馨' },
  { v: 'Psychological_drama', label: '心理剧' },
  { v: 'Horror_supernatural', label: '恐怖灵异' },
  { v: 'Coming_of_age', label: '成长' },
  { v: 'Comedy_humor', label: '喜剧' }
]
const ART_STYLES = [
  { v: '2D_chinese_guofeng', label: '2D 国风' },
  { v: '2D_90s_japanese_anime', label: '2D 日式 90s' },
  { v: '2D_flat_design', label: '2D 扁平' },
  { v: '3D_anime_render', label: '3D 日式渲染' },
  { v: '3D_chinese_traditional', label: '3D 国风传统' },
  { v: '3D_guofeng_cyber', label: '3D 国风赛博' },
  { v: 'realpeople_ancient_chinese', label: '真人·古风' },
  { v: 'realpeople_urban_modern', label: '真人·现代都市' }
]
</script>

<template>
  <main class="studio-home">
    <!-- 顶栏 -->
    <header class="studio-home__nav">
      <div class="studio-home__brand">
        <button class="studio-home__back" @click="router.push('/dashboard')" title="返回主面板">
          ←
        </button>
        <span class="studio-home__logo">M</span>
        <span class="studio-home__brand-name">创作者工作台</span>
      </div>
      <div class="studio-home__nav-right">
        <ThemeSwitcher mode="compact" />
        <span v-if="user" class="studio-home__user">👤 {{ user.nickname }}</span>
        <button class="studio-home__logout" @click="logout">退出</button>
      </div>
    </header>

    <div class="studio-home__content">
      <!-- 欢迎 + 快捷入口 -->
      <section class="studio-home__hero">
        <div>
          <h1>
            欢迎回来，<span class="studio-home__highlight">{{ user?.nickname ?? '创作者' }}</span>
          </h1>
          <p>当前主题：<strong>{{ currentMeta.label }}</strong> · 从这里开始创作你的下一个漫改作品</p>
        </div>
        <div class="studio-home__quick">
          <button class="qh-btn qh-btn--primary" @click="showCreate = true">
            ＋ 新建项目
          </button>
          <button class="qh-btn" @click="router.push('/studio/models')">
            🤖 模型选择
          </button>
          <button class="qh-btn" @click="router.push('/studio/byok')">
            🔑 BYOK 设置
          </button>
        </div>
      </section>

      <!-- 故障转移状态（紧凑） -->
      <FailoverIndicator compact />

      <!-- 4 统计卡 -->
      <section class="studio-home__stats">
        <div
          v-for="s in stats"
          :key="s.label"
          class="stat-card"
          :class="`stat-card--${s.tone}`"
        >
          <span class="stat-card__icon">{{ s.icon }}</span>
          <div>
            <p class="stat-card__value">{{ s.value }}</p>
            <p class="stat-card__label">{{ s.label }}</p>
          </div>
        </div>
      </section>

      <!-- 过滤 + 项目列表 -->
      <section class="studio-home__projects">
        <div class="studio-home__section-head">
          <h2>项目列表</h2>
          <div class="studio-home__filters">
            <button
              v-for="f in [['all', '全部'], ['0', '草稿'], ['1', '生成中'], ['2', '已完成'], ['3', '失败']] as const"
              :key="f[0]"
              type="button"
              class="filter-chip"
              :class="{ 'filter-chip--on': filter === f[0] }"
              @click="filter = f[0] as typeof filter"
            >
              {{ f[1] }}
            </button>
          </div>
        </div>

        <!-- 加载 -->
        <div v-if="loading" class="studio-home__loading">
          <div class="studio-home__spinner" />
          <span>加载项目中...</span>
        </div>

        <!-- 空 -->
        <div v-else-if="filteredProjects.length === 0" class="studio-home__empty">
          <span class="studio-home__empty-icon">📁</span>
          <p>暂无项目</p>
          <button class="qh-btn qh-btn--primary" @click="showCreate = true">＋ 创建第一个项目</button>
        </div>

        <!-- 卡片网格 -->
        <div v-else class="studio-home__grid">
          <article
            v-for="p in filteredProjects"
            :key="p.id"
            class="project-card"
            :class="`project-card--${STATUS_MAP[p.status]?.tone ?? 'draft'}`"
            @click="openProject(p)"
          >
            <div class="project-card__cover">
              <span class="project-card__cover-text">
                {{ p.title.slice(0, 1) }}
              </span>
              <span class="project-card__status" :class="`status--${STATUS_MAP[p.status]?.tone}`">
                {{ STATUS_MAP[p.status]?.label ?? '未知' }}
              </span>
            </div>
            <div class="project-card__body">
              <h3>{{ p.title }}</h3>
              <p v-if="p.description" class="project-card__desc">{{ p.description }}</p>
              <div class="project-card__meta">
                <code v-if="p.art_style">{{ p.art_style }}</code>
                <code v-if="p.story_type">{{ p.story_type }}</code>
              </div>
              <p class="project-card__date">创建于 {{ p.created_at }}</p>
            </div>
            <span class="project-card__arrow">→</span>
          </article>
        </div>
      </section>
    </div>

    <!-- 创建项目弹窗 -->
    <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
      <div class="modal">
        <header class="modal__head">
          <h2>新建项目</h2>
          <button class="modal__close" @click="showCreate = false">×</button>
        </header>
        <form class="modal__form" @submit.prevent="onCreate">
          <label class="form-field">
            <span>项目标题 <em>*</em></span>
            <input
              v-model="form.title"
              type="text"
              maxlength="200"
              required
              placeholder="例如：《灰星》第 4 章"
              class="form-input"
            />
          </label>
          <label class="form-field">
            <span>简介（选填）</span>
            <textarea
              v-model="form.description"
              rows="3"
              maxlength="2000"
              placeholder="用一句话描述这个项目..."
              class="form-input"
            />
          </label>
          <div class="form-row">
            <label class="form-field">
              <span>画风</span>
              <select v-model="form.art_style" class="form-input">
                <option value="">不指定</option>
                <option v-for="s in ART_STYLES" :key="s.v" :value="s.v">{{ s.label }}</option>
              </select>
            </label>
            <label class="form-field">
              <span>题材</span>
              <select v-model="form.story_type" class="form-input">
                <option value="">不指定</option>
                <option v-for="s in STORY_TYPES" :key="s.v" :value="s.v">{{ s.label }}</option>
              </select>
            </label>
          </div>
          <footer class="modal__foot">
            <button type="button" class="qh-btn" @click="showCreate = false">取消</button>
            <button type="submit" class="qh-btn qh-btn--primary" :disabled="submitting || !form.title.trim()">
              {{ submitting ? '创建中...' : '创建' }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  </main>
</template>

<style scoped>
.studio-home {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

/* ===== 顶栏 ===== */
.studio-home__nav {
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

.studio-home__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
}

.studio-home__back {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  transition: all 200ms;
}

.studio-home__back:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.studio-home__logo {
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

.studio-home__brand-name {
  font-size: 15px;
  font-weight: 600;
}

.studio-home__nav-right {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13px;
}

.studio-home__user {
  color: var(--text-secondary);
}

.studio-home__logout {
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

.studio-home__logout:hover {
  border-color: var(--danger);
  color: var(--danger);
}

/* ===== 内容容器 ===== */
.studio-home__content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 28px 28px 60px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* ===== Hero ===== */
.studio-home__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.studio-home__hero h1 {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.studio-home__highlight {
  background: var(--gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.studio-home__hero p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.studio-home__hero strong {
  color: var(--accent);
  font-weight: 600;
}

.studio-home__quick {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* 按钮 */
.qh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
}

.qh-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.qh-btn--primary {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}

.qh-btn--primary:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: var(--glow);
}

.qh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* ===== 统计卡 ===== */
.studio-home__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  border-left: 3px solid var(--border-strong);
  transition: all 250ms;
}

.stat-card--accent { border-left-color: var(--accent); }
.stat-card--success { border-left-color: var(--success); }
.stat-card--warning { border-left-color: var(--warning); }
.stat-card--danger { border-left-color: var(--danger); }

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.stat-card__icon {
  font-size: 26px;
  line-height: 1;
}

.stat-card__value {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 2px;
  color: var(--text-primary);
}

.stat-card__label {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

/* ===== 项目列表 ===== */
.studio-home__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.studio-home__section-head h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.studio-home__filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-chip {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 200ms;
}

.filter-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.filter-chip--on {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}

.studio-home__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--text-secondary);
}

.studio-home__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.studio-home__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  text-align: center;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-strong);
  border-radius: 12px;
  color: var(--text-secondary);
}

.studio-home__empty-icon {
  font-size: 48px;
  opacity: 0.6;
}

.studio-home__empty p {
  margin: 0;
  font-size: 14px;
}

.studio-home__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

/* 项目卡片 */
.project-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 250ms;
  overflow: hidden;
  position: relative;
}

.project-card:hover {
  transform: translateY(-3px);
  border-color: var(--accent);
  box-shadow: var(--shadow), var(--glow);
}

.project-card--active {
  border-left: 3px solid var(--warning);
}

.project-card--done {
  border-left: 3px solid var(--success);
}

.project-card--fail {
  border-left: 3px solid var(--danger);
}

.project-card__cover {
  position: relative;
  height: 80px;
  background: var(--gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--bg-primary);
}

.project-card__cover-text {
  font-size: 36px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.project-card__status {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.status--active { background: var(--warning); color: var(--bg-primary); }
.status--done { background: var(--success); color: var(--bg-primary); }
.status--fail { background: var(--danger); color: var(--bg-primary); }
.status--draft { background: color-mix(in srgb, var(--text-secondary) 30%, transparent); color: var(--text-primary); }

.project-card__body {
  padding: 0 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.project-card__body h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card__desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.project-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
}

.project-card__meta code {
  font-size: 10px;
  padding: 2px 6px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  border-radius: 3px;
}

.project-card__date {
  margin: 0;
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
}

.project-card__arrow {
  position: absolute;
  bottom: 14px;
  right: 16px;
  font-size: 18px;
  color: var(--text-secondary);
  transition: transform 200ms, color 200ms;
}

.project-card:hover .project-card__arrow {
  color: var(--accent);
  transform: translateX(4px);
}

/* ===== 弹窗 ===== */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
  animation: fadeIn 200ms ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  width: 100%;
  max-width: 540px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  animation: slideUp 240ms cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}

.modal__head h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.modal__close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  border-radius: 6px;
  font-family: inherit;
}

.modal__close:hover {
  background: var(--bg-secondary);
  color: var(--danger);
}

.modal__form {
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field > span {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-field em {
  color: var(--danger);
  font-style: normal;
}

.form-input {
  padding: 9px 12px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: inherit;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 200ms;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--glow);
}

textarea.form-input {
  resize: vertical;
  min-height: 60px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.modal__foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  margin-top: 8px;
  padding: 14px 0 0;
}

@media (max-width: 640px) {
  .studio-home__nav { padding: 12px 16px; }
  .studio-home__content { padding: 20px 16px 40px; }
  .studio-home__hero h1 { font-size: 22px; }
  .form-row { grid-template-columns: 1fr; }
  .studio-home__grid { grid-template-columns: 1fr; }
}
</style>
