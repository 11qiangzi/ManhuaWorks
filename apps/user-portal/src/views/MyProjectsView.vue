<script setup lang="ts">
/**
 * MyProjectsView · 我的项目
 * 千机工坊 · W4 用户后台
 *
 * 功能：
 * 1. 项目列表（卡片网格 / 列表切换）
 * 2. 状态筛选（全部 / 草稿 / 进行中 / 已归档 / 已发布）
 * 3. 关键字搜索
 * 4. 创建 / 打开 / 编辑 / 归档 / 删除
 * 5. 跳转到创作者工作台深入编辑
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import ProjectCard from '@/components/ProjectCard.vue'
import UserCard from '@/components/UserCard.vue'
import { useUser } from '@/composables/useUser'
import { useProjects } from '@/composables/useProjects'
import { STATUS_META, type ProjectStatus, type CreateProjectReq } from '@/api/project-service'

const router = useRouter()
const { profile, load: loadUser, logout } = useUser()
const {
  projects, total, loading, error,
  statusFilter, searchKeyword, counts,
  create, remove, archive, unarchive, refresh
} = useProjects({ autoLoad: false })

const view = ref<'grid' | 'list'>('grid')

onMounted(async () => {
  await Promise.all([loadUser(), refresh()])
})

/* ===== 状态筛选 tabs ===== */
const STATUS_TABS: { id: ProjectStatus | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: '全部', icon: '🗂' },
  { id: 'draft', label: '草稿', icon: '📝' },
  { id: 'active', label: '进行中', icon: '🔥' },
  { id: 'published', label: '已发布', icon: '✨' },
  { id: 'archived', label: '已归档', icon: '📦' }
]

/* ===== 新建项目弹窗 ===== */
const showCreate = ref(false)
const wizardStep = ref(1)
const newName = ref('')
const newDesc = ref('')
const newTags = ref('')
const newCover = ref('🎬')
const creating = ref(false)

/* ===== Step 3: 配乐风格 ===== */
const MOOD_CATEGORIES = [
  { id: 'suspense', label: '悬疑', icon: '🔍', color: '#6366f1' },
  { id: 'battle',   label: '战斗', icon: '⚔️', color: '#ef4444' },
  { id: 'warm',     label: '温情', icon: '💕', color: '#f59e0b' },
  { id: 'scifi',    label: '科幻', icon: '🚀', color: '#06b6d4' },
  { id: 'epic',     label: '史诗', icon: '🏔️', color: '#8b5cf6' },
  { id: 'daily',    label: '日常', icon: '☀️', color: '#10b981' },
  { id: 'dark',     label: '黑暗', icon: '🌑', color: '#374151' },
  { id: 'healing',  label: '治愈', icon: '🌿', color: '#34d399' }
] as const

const selectedMoods = ref<string[]>([])
const aiRecommend = ref(false)
const previewingMood = ref<string | null>(null)

function toggleMood(id: string) {
  const idx = selectedMoods.value.indexOf(id)
  if (idx >= 0) {
    selectedMoods.value.splice(idx, 1)
  } else {
    if (selectedMoods.value.length < 3) {
      selectedMoods.value.push(id)
    }
  }
}

function previewMood(id: string) {
  previewingMood.value = previewingMood.value === id ? null : id
  // Simulate preview playback timeout
  if (previewingMood.value) {
    setTimeout(() => { previewingMood.value = null }, 3000)
  }
}

function wizardNext() {
  if (wizardStep.value < 3) wizardStep.value++
}

function wizardPrev() {
  if (wizardStep.value > 1) wizardStep.value--
}

function resetCreateForm() {
  newName.value = ''
  newDesc.value = ''
  newTags.value = ''
  newCover.value = '🎬'
  wizardStep.value = 1
  selectedMoods.value = []
  aiRecommend.value = false
  previewingMood.value = null
}

async function submitCreate() {
  if (!newName.value.trim()) return
  creating.value = true
  try {
    const req: CreateProjectReq = {
      name: newName.value.trim(),
      description: newDesc.value.trim() || undefined,
      cover: newCover.value || undefined,
      tags: newTags.value.split(/[,，\s]+/).filter(Boolean),
      musicStyle: selectedMoods.value.length ? { moods: selectedMoods.value, aiRecommend: aiRecommend.value } : undefined
    }
    const created = await create(req)
    if (created) {
      showCreate.value = false
      resetCreateForm()
      router.push(`/projects/${created.id}`)
    }
  } finally {
    creating.value = false
  }
}

/* ===== 跳转工作室 ===== */
function openInStudio(id: string) {
  // 跳 studio 工作台对应项目编辑，根据当前访问 host 生成 URL（避免 LAN 设备跳 localhost 404）
  const host = window.location.hostname
  window.open(`http://${host}:5175/project/${id}`, '_blank')
}

function onLogout() {
  logout()
  router.push('/login')
}

/* ===== 模板封面 ===== */
const TEMPLATE_COVERS = ['🎬', '🌌', '🏮', '🌃', '🌸', '⚔️', '🚀', '🌊']

const filteredProjects = computed(() => projects.value)

/* ===== 动态 host 链接（跟随当前访问 host，LAN 设备也能跳转） ===== */
const studioHref = computed(() => `http://${window.location.hostname}:5175`)
</script>

<template>
  <main class="mp">
    <!-- 顶栏 -->
    <header class="mp__nav">
      <div class="mp__nav-left">
        <button class="mp__back" @click="router.push('/dashboard')" title="返回首页">←</button>
        <span class="mp__logo">M</span>
        <span class="mp__brand-name">我的项目</span>
        <span class="mp__count">{{ total }} 个</span>
      </div>
      <nav class="mp__nav-links">
        <RouterLink to="/dashboard" class="mp__nav-link">首页</RouterLink>
        <RouterLink to="/projects" class="mp__nav-link mp__nav-link--active">项目</RouterLink>
        <RouterLink to="/works" class="mp__nav-link">作品</RouterLink>
        <RouterLink to="/assets" class="mp__nav-link">素材</RouterLink>
        <RouterLink to="/settings" class="mp__nav-link">设置</RouterLink>
      </nav>
      <div class="mp__nav-right">
        <ThemeSwitcher mode="compact" />
        <UserCard :user="profile" compact />
      </div>
    </header>

    <div class="mp__content">
      <!-- ===== 工具栏 ===== -->
      <section class="mp__toolbar">
        <div class="mp__title-block">
          <h1>📁 我的项目</h1>
          <p>创建、编辑、归档所有漫改项目 · 深度编辑请进入<a :href="studioHref" target="_blank">创作者工作台</a></p>
        </div>
        <div class="mp__toolbar-right">
          <div class="mp__view-toggle">
            <button type="button" :class="{ active: view === 'grid' }" @click="view = 'grid'" title="网格视图">▦</button>
            <button type="button" :class="{ active: view === 'list' }" @click="view = 'list'" title="列表视图">☰</button>
          </div>
          <button type="button" class="mp__btn" @click="refresh">🔄 刷新</button>
          <button type="button" class="mp__btn mp__btn--primary" @click="showCreate = true">＋ 新建项目</button>
        </div>
      </section>

      <!-- ===== 状态 tabs ===== -->
      <nav class="mp__tabs">
        <button
          v-for="t in STATUS_TABS"
          :key="t.id"
          type="button"
          class="mp__tab"
          :class="{ 'mp__tab--active': statusFilter === t.id }"
          @click="statusFilter = t.id"
        >
          <span class="mp__tab-icon">{{ t.icon }}</span>
          <span>{{ t.label }}</span>
          <span class="mp__tab-count">{{ counts[t.id] ?? 0 }}</span>
        </button>
      </nav>

      <!-- ===== 搜索 ===== -->
      <div class="mp__search-row">
        <input
          v-model="searchKeyword"
          type="search"
          placeholder="🔍 搜索项目名 / 标签 / 描述"
          class="mp__search"
        />
        <div class="mp__search-info">
          {{ (filteredProjects?.length ?? 0) }} / {{ total }}
        </div>
      </div>

      <!-- ===== 错误提示 ===== -->
      <div v-if="error" class="mp__error">⚠ {{ error }}</div>

      <!-- ===== 列表/网格 ===== -->
      <div v-if="loading && (projects?.length ?? 0) === 0" class="mp__loading">
        <div class="mp__spinner"></div>
        <span>加载中...</span>
      </div>

      <div v-else-if="(filteredProjects?.length ?? 0) === 0" class="mp__empty">
        <p class="mp__empty-icon">📭</p>
        <p class="mp__empty-title">还没有项目</p>
        <p class="mp__empty-desc">点击右上角"＋ 新建项目"，开启你的漫改创作</p>
        <button type="button" class="mp__btn mp__btn--primary" @click="showCreate = true">＋ 创建第一个项目</button>
      </div>

      <!-- 网格视图 -->
      <div v-else-if="view === 'grid'" class="mp__grid">
        <ProjectCard
          v-for="p in filteredProjects"
          :key="p.id"
          :project="p"
          @open="openInStudio"
          @edit="openInStudio"
          @archive="(id) => p.status === 'archived' ? unarchive(id) : archive(id)"
          @remove="remove"
        />
      </div>

      <!-- 列表视图 -->
      <div v-else class="mp__list">
        <table class="mp__table">
          <thead>
            <tr>
              <th>项目名</th>
              <th>状态</th>
              <th>作品/素材</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in filteredProjects" :key="p.id">
              <td>
                <div class="mp__table-name">
                  <span class="mp__table-cover">{{ p.cover ?? '📁' }}</span>
                  <div>
                    <p class="mp__table-title">{{ p.name }}</p>
                    <p v-if="p.description" class="mp__table-desc">{{ p.description }}</p>
                  </div>
                </div>
              </td>
              <td>
                <span class="mp__table-status" :style="{ color: STATUS_META[p.status].color }">
                  {{ STATUS_META[p.status].icon }} {{ STATUS_META[p.status].label }}
                </span>
              </td>
              <td class="mp__table-counts">
                {{ p.workCount ?? 0 }} / {{ p.assetCount ?? 0 }}
              </td>
              <td class="mp__table-time">{{ new Date(p.updatedAt).toLocaleDateString('zh-CN') }}</td>
              <td>
                <button type="button" class="mp__table-btn" @click="openInStudio(p.id)">打开</button>
                <button
                  type="button"
                  class="mp__table-btn"
                  @click="p.status === 'archived' ? unarchive(p.id) : archive(p.id)"
                >
                  {{ p.status === 'archived' ? '取消归档' : '归档' }}
                </button>
                <button type="button" class="mp__table-btn mp__table-btn--danger" @click="remove(p.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===== 创建项目弹窗（3 步向导） ===== -->
    <Teleport to="body">
      <div v-if="showCreate" class="mp__modal" @click.self="showCreate = false">
        <div class="mp__modal-card">
          <h2>＋ 新建项目</h2>

          <!-- 步骤指示器 -->
          <div class="mp__wizard-steps">
            <div v-for="s in 3" :key="s" class="mp__wizard-step"
              :class="{ 'mp__wizard-step--active': wizardStep === s, 'mp__wizard-step--done': wizardStep > s }">
              <span class="mp__wizard-step-num">{{ wizardStep > s ? '✓' : s }}</span>
              <span class="mp__wizard-step-label">{{ s === 1 ? '基本信息' : s === 2 ? '封面 & 标签' : '配乐风格' }}</span>
            </div>
          </div>

          <!-- Step 1: 基本信息 -->
          <div v-if="wizardStep === 1" class="mp__wizard-panel">
            <p class="mp__modal-sub">填写项目名称和描述</p>
            <label class="mp__field">
              <span>项目名 *</span>
              <input v-model="newName" type="text" placeholder="如：《灰星》第三章" maxlength="50" />
            </label>
            <label class="mp__field">
              <span>描述</span>
              <textarea v-model="newDesc" placeholder="简要描述这个项目..." maxlength="200" rows="3"></textarea>
            </label>
          </div>

          <!-- Step 2: 封面 & 标签 -->
          <div v-if="wizardStep === 2" class="mp__wizard-panel">
            <p class="mp__modal-sub">选择封面图标和项目标签</p>
            <label class="mp__field">
              <span>封面（emoji）</span>
              <div class="mp__cover-grid">
                <button
                  v-for="c in TEMPLATE_COVERS"
                  :key="c"
                  type="button"
                  class="mp__cover-opt"
                  :class="{ 'mp__cover-opt--active': newCover === c }"
                  @click="newCover = c"
                >{{ c }}</button>
              </div>
            </label>
            <label class="mp__field">
              <span>标签（逗号或空格分隔）</span>
              <input v-model="newTags" type="text" placeholder="科幻, 漫改, 短剧" />
            </label>
          </div>

          <!-- Step 3: 配乐风格 -->
          <div v-if="wizardStep === 3" class="mp__wizard-panel">
            <p class="mp__modal-sub">选择项目的配乐风格（最多 3 个），AI 将根据风格推荐配乐</p>

            <!-- AI 自动推荐开关 -->
            <label class="mp__ai-toggle">
              <input type="checkbox" v-model="aiRecommend" />
              <span class="mp__ai-track">
                <span class="mp__ai-thumb"></span>
              </span>
              <span class="mp__ai-label">
                <span class="mp__ai-icon">🤖</span>
                AI 自动推荐配乐
              </span>
            </label>

            <!-- 8 mood category buttons -->
            <div class="mp__mood-grid">
              <button
                v-for="m in MOOD_CATEGORIES"
                :key="m.id"
                type="button"
                class="mp__mood-btn"
                :class="{ 'mp__mood-btn--selected': selectedMoods.includes(m.id) }"
                :style="{ '--mood-color': m.color }"
                @click="toggleMood(m.id)"
              >
                <span class="mp__mood-icon">{{ m.icon }}</span>
                <span class="mp__mood-label">{{ m.label }}</span>
                <span v-if="selectedMoods.includes(m.id)" class="mp__mood-check">✓</span>
              </button>
            </div>

            <!-- Preview area -->
            <div class="mp__mood-preview">
              <div v-if="selectedMoods.length === 0" class="mp__mood-preview-empty">
                请选择至少一个配乐风格，点击试听样本
              </div>
              <div v-else class="mp__mood-preview-list">
                <button
                  v-for="mid in selectedMoods"
                  :key="mid"
                  type="button"
                  class="mp__mood-preview-chip"
                  :class="{ 'mp__mood-preview-chip--playing': previewingMood === mid }"
                  @click="previewMood(mid)"
                >
                  <span class="mp__mood-preview-dot"
                    :style="{ background: MOOD_CATEGORIES.find(c => c.id === mid)?.color }"
                  ></span>
                  {{ MOOD_CATEGORIES.find(c => c.id === mid)?.label }}
                  <span class="mp__mood-preview-play">{{ previewingMood === mid ? '⏸' : '🎵' }}</span>
                </button>
              </div>
              <div v-if="previewingMood" class="mp__mood-preview-bar">
                <div class="mp__mood-preview-progress"></div>
              </div>
            </div>
          </div>

          <div class="mp__modal-actions">
            <button v-if="wizardStep > 1" type="button" class="mp__btn" @click="wizardPrev">← 上一步</button>
            <button v-if="wizardStep === 1" type="button" class="mp__btn" @click="showCreate = false">取消</button>
            <button v-if="wizardStep < 3" type="button" class="mp__btn mp__btn--primary"
              :disabled="wizardStep === 1 && !newName.trim()"
              @click="wizardNext">
              下一步 →
            </button>
            <button v-if="wizardStep === 3" type="button" class="mp__btn mp__btn--primary"
              :disabled="!newName.trim() || creating"
              @click="submitCreate">
              {{ creating ? '创建中...' : '创建并进入' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.mp {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

/* ===== 顶栏 ===== */
.mp__nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  height: 56px;
  background: rgba(10,14,26,.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}

.mp__nav-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.mp__back {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mp__back:hover {
  background: var(--bg-tertiary);
}

.mp__logo {
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

.mp__brand-name {
  font-size: 15px;
  font-weight: 700;
}

.mp__count {
  padding: 2px 8px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}

.mp__nav-links {
  display: flex;
  gap: 4px;
  flex: 1;
  margin-left: 20px;
}

.mp__nav-link {
  padding: 6px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: 6px;
  text-decoration: none;
  transition: all 180ms;
}

.mp__nav-link:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.mp__nav-link--active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.mp__nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ===== 内容 ===== */
.mp__content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px;
}

/* ===== 工具栏 ===== */
.mp__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}

.mp__title-block h1 {
  font-size: 24px;
  margin: 0 0 4px;
}

.mp__title-block p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.mp__title-block a {
  color: var(--accent);
  text-decoration: none;
}

.mp__toolbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.mp__view-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.mp__view-toggle button {
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  transition: all 180ms;
}

.mp__view-toggle button:hover {
  color: var(--text-primary);
}

.mp__view-toggle button.active {
  background: var(--accent);
  color: white;
}

.mp__btn {
  padding: 7px 14px;
  font-size: 13px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  transition: all 200ms;
}

.mp__btn:hover {
  border-color: var(--accent);
}

.mp__btn--primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.mp__btn--primary:hover {
  background: var(--accent-deep);
  border-color: var(--accent-deep);
}

.mp__btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== Tabs ===== */
.mp__tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.mp__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 200ms;
}

.mp__tab:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}

.mp__tab--active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.mp__tab-icon {
  font-size: 14px;
}

.mp__tab-count {
  padding: 0 6px;
  background: color-mix(in srgb, var(--text-primary) 12%, transparent);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}

.mp__tab--active .mp__tab-count {
  background: color-mix(in srgb, white 25%, transparent);
}

/* ===== Search ===== */
.mp__search-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.mp__search {
  flex: 1;
  padding: 9px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
}

.mp__search:focus {
  outline: none;
  border-color: var(--accent);
}

.mp__search-info {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
  white-space: nowrap;
}

/* ===== Error ===== */
.mp__error {
  padding: 10px 14px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
}

/* ===== Loading / Empty ===== */
.mp__loading,
.mp__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 8px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-strong);
  border-radius: 14px;
  color: var(--text-secondary);
}

.mp__empty-icon {
  font-size: 48px;
  margin: 0;
}

.mp__empty-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.mp__empty-desc {
  font-size: 13px;
  margin: 0 0 12px;
}

.mp__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== Grid ===== */
.mp__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
}

/* ===== Table ===== */
.mp__list {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.mp__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.mp__table thead {
  background: var(--bg-tertiary);
}

.mp__table th {
  padding: 12px 14px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mp__table td {
  padding: 12px 14px;
  border-top: 1px solid var(--border);
  vertical-align: middle;
}

.mp__table tr:hover td {
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}

.mp__table-name {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mp__table-cover {
  font-size: 28px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-radius: 8px;
  flex-shrink: 0;
}

.mp__table-title {
  margin: 0;
  font-weight: 600;
  color: var(--text-primary);
}

.mp__table-desc {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mp__table-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.mp__table-counts {
  font-family: monospace;
  color: var(--text-secondary);
}

.mp__table-time {
  font-family: monospace;
  color: var(--text-secondary);
  font-size: 12px;
}

.mp__table-btn {
  padding: 4px 10px;
  margin-right: 4px;
  font-size: 11px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: all 180ms;
}

.mp__table-btn:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}

.mp__table-btn--danger:hover {
  color: var(--danger);
  border-color: var(--danger);
}

/* ===== Modal ===== */
.mp__modal {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--bg-primary) 75%, transparent);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fade-in 200ms ease;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.mp__modal-card {
  width: 90%;
  max-width: 540px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: var(--shadow);
}

/* ===== Wizard Steps ===== */
.mp__wizard-steps {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.mp__wizard-step {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-secondary);
  transition: all 200ms;
}

.mp__wizard-step--active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: var(--accent);
  color: var(--accent);
}

.mp__wizard-step--done {
  color: var(--success, #10b981);
  border-color: color-mix(in srgb, var(--success, #10b981) 40%, var(--border));
}

.mp__wizard-step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.mp__wizard-step--active .mp__wizard-step-num {
  background: var(--accent);
  color: white;
}

.mp__wizard-step--done .mp__wizard-step-num {
  background: color-mix(in srgb, var(--success, #10b981) 20%, transparent);
  color: var(--success, #10b981);
}

.mp__wizard-step-label {
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.mp__wizard-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: mp-slide-in 200ms ease;
}

@keyframes mp-slide-in {
  from { opacity: 0; transform: translateX(12px); }
  to { opacity: 1; transform: translateX(0); }
}

/* ===== AI Toggle ===== */
.mp__ai-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-primary));
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
}

.mp__ai-toggle input {
  display: none;
}

.mp__ai-track {
  width: 36px;
  height: 20px;
  background: var(--border);
  border-radius: 999px;
  position: relative;
  transition: background 200ms;
  flex-shrink: 0;
}

.mp__ai-thumb {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  top: 2px;
  left: 2px;
  transition: left 200ms;
  display: block;
}

.mp__ai-toggle input:checked + .mp__ai-track {
  background: var(--accent);
}

.mp__ai-toggle input:checked + .mp__ai-track .mp__ai-thumb {
  left: 18px;
}

.mp__ai-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.mp__ai-icon {
  font-size: 16px;
}

/* ===== Mood Grid ===== */
.mp__mood-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.mp__mood-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: var(--bg-primary);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  color: var(--text-primary);
  transition: all 200ms;
  position: relative;
}

.mp__mood-btn:hover {
  border-color: var(--mood-color, var(--accent));
  background: color-mix(in srgb, var(--mood-color, var(--accent)) 8%, var(--bg-primary));
}

.mp__mood-btn--selected {
  border-color: var(--mood-color, var(--accent));
  background: color-mix(in srgb, var(--mood-color, var(--accent)) 15%, var(--bg-primary));
  box-shadow: 0 0 0 1px var(--mood-color, var(--accent));
}

.mp__mood-icon {
  font-size: 22px;
  line-height: 1;
}

.mp__mood-label {
  font-size: 12px;
  font-weight: 500;
}

.mp__mood-check {
  position: absolute;
  top: 4px;
  right: 6px;
  font-size: 10px;
  color: var(--mood-color, var(--accent));
  font-weight: 700;
}

/* ===== Mood Preview ===== */
.mp__mood-preview {
  padding: 12px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 10px;
  min-height: 48px;
}

.mp__mood-preview-empty {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  padding: 8px 0;
}

.mp__mood-preview-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mp__mood-preview-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  transition: all 200ms;
}

.mp__mood-preview-chip:hover {
  border-color: var(--accent);
}

.mp__mood-preview-chip--playing {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-secondary));
}

.mp__mood-preview-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.mp__mood-preview-play {
  font-size: 11px;
}

.mp__mood-preview-bar {
  margin-top: 10px;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.mp__mood-preview-progress {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  animation: mp-preview-fill 3s linear forwards;
}

@keyframes mp-preview-fill {
  from { width: 0; }
  to { width: 100%; }
}

.mp__modal-card h2 {
  margin: 0;
  font-size: 18px;
}

.mp__modal-sub {
  margin: -8px 0 4px;
  color: var(--text-secondary);
  font-size: 12px;
}

.mp__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.mp__field input,
.mp__field textarea {
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  resize: vertical;
}

.mp__field input:focus,
.mp__field textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.mp__cover-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
}

.mp__cover-opt {
  aspect-ratio: 1;
  font-size: 22px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: all 180ms;
}

.mp__cover-opt:hover {
  border-color: var(--accent);
}

.mp__cover-opt--active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border-color: var(--accent);
}

.mp__modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

@media (max-width: 768px) {
  .mp__nav {
    flex-wrap: wrap;
    padding: 12px 16px;
  }
  .mp__nav-links {
    order: 3;
    width: 100%;
    margin-left: 0;
    overflow-x: auto;
  }
  .mp__content {
    padding: 16px;
  }
}
</style>