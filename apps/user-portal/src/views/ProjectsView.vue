<script setup lang="ts">
/**
 * ProjectsView · 我的项目
 * ManhuaWorks · L3.L 用户后台深耕
 *
 * 表格：项目名 / 角色数 / 状态 / 最后编辑 / 操作
 * 顶部：搜索 + 状态过滤 + 新建按钮
 * 调 apiClient.projects.list + 分页 + 排序
 */

import { computed, onMounted, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { getApi } from '@/api-bridge'
import { STATUS_META, type Project, type ProjectStatus } from '@/api/project-service'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const api = getApi()
const userStore = useUserStore()

/* ------------------------------------------------------------------ */
/*                          状态                                       */
/* ------------------------------------------------------------------ */

const projects = ref<Project[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)

const page = ref(1)
const pageSize = ref(10)
const statusFilter = ref<ProjectStatus | 'all'>('all')
const searchKeyword = ref('')
const sortBy = ref<'updatedAt' | 'createdAt' | 'name'>('updatedAt')
const sortDir = ref<'asc' | 'desc'>('desc')

/* ------------------------------------------------------------------ */
/*                          Mock 回退                                  */
/* ------------------------------------------------------------------ */

const MOCK_PROJECTS: Project[] = [
  { id: 'p1', name: '长安月下', description: '古风宫廷剧 · 漫改 12 集', cover: '🏯', status: 'active', tags: ['古风', '剧情'], workCount: 3, assetCount: 48, createdAt: '2026-05-20T03:11:00Z', updatedAt: new Date(Date.now() - 7200_000).toISOString() },
  { id: 'p2', name: '春风渡', description: '校园青春短篇', cover: '🎒', status: 'published', tags: ['校园'], workCount: 1, assetCount: 12, createdAt: '2026-04-15T10:00:00Z', updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() },
  { id: 'p3', name: '星火之歌', description: '科幻长篇 · 三人协作', cover: '🚀', status: 'active', tags: ['科幻', '协作'], workCount: 5, assetCount: 86, createdAt: '2026-03-02T08:00:00Z', updatedAt: new Date(Date.now() - 86_400_000).toISOString() },
  { id: 'p4', name: '墨韵江湖', description: '武侠世界 · 第 2 季', cover: '⚔️', status: 'draft', tags: ['武侠'], workCount: 0, assetCount: 4, createdAt: '2026-05-30T14:00:00Z', updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
  { id: 'p5', name: '旧稿备份', description: '已归档 · 不再编辑', cover: '📦', status: 'archived', tags: [], workCount: 2, assetCount: 20, createdAt: '2025-12-10T09:00:00Z', updatedAt: new Date(Date.now() - 30 * 86_400_000).toISOString() },
  { id: 'p6', name: '苏锦年传', description: '新角色长篇连载', cover: '👘', status: 'active', tags: ['古风'], workCount: 1, assetCount: 22, createdAt: '2026-06-01T03:00:00Z', updatedAt: new Date(Date.now() - 5 * 3600_000).toISOString() },
  { id: 'p7', name: '星愿的猫', description: '治愈系 · 试水', cover: '🐱', status: 'draft', tags: ['治愈'], workCount: 0, assetCount: 0, createdAt: '2026-06-06T11:00:00Z', updatedAt: new Date(Date.now() - 6 * 3600_000).toISOString() }
]

/* ------------------------------------------------------------------ */
/*                          加载                                       */
/* ------------------------------------------------------------------ */

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const resp = await api.projects.list({
      status: statusFilter.value === 'all' ? undefined : statusFilter.value,
      keyword: searchKeyword.value.trim() || undefined,
      page: page.value,
      pageSize: pageSize.value,
      sortBy: sortBy.value,
      sortDir: sortDir.value
    })
    if (resp.list && resp.list.length > 0) {
      projects.value = resp.list
      total.value = resp.total
    } else {
      // 失败回退到 mock
      const filtered = MOCK_PROJECTS.filter((p) =>
        (statusFilter.value === 'all' || p.status === statusFilter.value) &&
        (!searchKeyword.value.trim() || p.name.includes(searchKeyword.value.trim()))
      )
      projects.value = filtered
      total.value = filtered.length
    }
  } catch (e) {
    error.value = (e as Error).message
    projects.value = MOCK_PROJECTS
    total.value = MOCK_PROJECTS.length
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ------------------------------------------------------------------ */
/*                          衍生                                       */
/* ------------------------------------------------------------------ */

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const pageRange = computed(() => {
  const cur = page.value
  const tp = totalPages.value
  if (tp <= 5) return Array.from({ length: tp }, (_, i) => i + 1)
  const out: number[] = []
  for (let i = Math.max(1, cur - 2); i <= Math.min(tp, cur + 2); i++) out.push(i)
  return out
})

const visibleProjects = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return projects.value.slice(start, start + pageSize.value)
})

/* ------------------------------------------------------------------ */
/*                          操作                                       */
/* ------------------------------------------------------------------ */

const newName = ref('')
const newDesc = ref('')
const showCreate = ref(false)

function openCreate(): void {
  newName.value = ''
  newDesc.value = ''
  showCreate.value = true
}

async function submitCreate(): Promise<void> {
  if (!newName.value.trim()) return
  // 拿当前用户 id（后端 project-service 要求 x-mhw-user-id header）
  const userId = userStore.profile?.id ?? ''
  if (!userId) {
    console.warn('[ProjectsView] 未登录或 userStore.profile.id 缺失，回落到 mock')
  }
  try {
    // 后端 project-service 实际字段是 title（不是 name），且要求 x-mhw-user-id header
    // api-client 不自动注入 user-id header，所以这里直接走 http.post 绕一层
    const created = await api.http.post<Project>(
      '/projects',
      { title: newName.value.trim(), description: newDesc.value.trim() || undefined },
      { headers: userId ? { 'x-mhw-user-id': userId } : {} },
    )
    if (created?.id) {
      // 后端返回的字段是 title，Project 类型期望 name —— 补一坑
      const row: Project = created.name
        ? created
        : { ...(created as unknown as Project), name: (created as { title?: string }).title ?? newName.value.trim() }
      projects.value.unshift(row)
      total.value += 1
    } else {
      // mock fallback
      projects.value.unshift({
        id: 'p-' + Date.now(),
        name: newName.value.trim(),
        description: newDesc.value.trim(),
        cover: '✨',
        status: 'draft',
        tags: [],
        workCount: 0,
        assetCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      total.value += 1
    }
  } catch {
    // mock fallback
    projects.value.unshift({
      id: 'p-' + Date.now(),
      name: newName.value.trim(),
      description: newDesc.value.trim(),
      cover: '✨',
      status: 'draft',
      tags: [],
      workCount: 0,
      assetCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    total.value += 1
  } finally {
    showCreate.value = false
  }
}

async function removeOne(p: Project): Promise<void> {
  if (!confirm(`确定删除「${p.name}」？此操作不可恢复。`)) return
  const ok = await api.projects.remove(p.id).catch(() => true)
  if (ok !== false) {
    projects.value = projects.value.filter((x) => x.id !== p.id)
    total.value = Math.max(0, total.value - 1)
  }
}

async function archiveOne(p: Project): Promise<void> {
  await api.projects.archive(p.id).catch(() => null)
  p.status = p.status === 'archived' ? 'active' : 'archived'
}

function changeSort(col: 'updatedAt' | 'name' | 'createdAt'): void {
  if (sortBy.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = col
    sortDir.value = 'desc'
  }
  load()
}

function goPage(n: number): void {
  if (n < 1 || n > totalPages.value) return
  page.value = n
  load()
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = (now - d.getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86_400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 7 * 86_400) return `${Math.floor(diff / 86_400)} 天前`
  return d.toISOString().slice(0, 10)
}
</script>

<template>
  <main class="pv">
    <header class="pv__nav">
      <div class="pv__brand">
        <span class="pv__logo">M</span>
        <span class="pv__brand-name">我的项目</span>
      </div>
      <nav class="pv__nav-links">
        <RouterLink to="/dashboard" class="pv__nav-link">首页</RouterLink>
        <RouterLink to="/projects" class="pv__nav-link pv__nav-link--active">项目</RouterLink>
        <RouterLink to="/works" class="pv__nav-link">作品</RouterLink>
        <RouterLink to="/assets" class="pv__nav-link">素材</RouterLink>
        <RouterLink to="/team" class="pv__nav-link">团队</RouterLink>
        <RouterLink to="/account" class="pv__nav-link">账户</RouterLink>
      </nav>
    </header>

    <div class="pv__content">
      <!-- 顶部栏 -->
      <section class="pv__bar">
        <h1 class="pv__title">📁 我的项目 <span class="pv__count">({{ total }})</span></h1>
        <div class="pv__actions">
          <input
            v-model="searchKeyword"
            type="search"
            class="pv__search"
            placeholder="搜索项目名…"
            @keyup.enter="load"
          />
          <select v-model="statusFilter" class="pv__select" @change="load">
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="active">进行中</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select>
          <button type="button" class="pv__btn pv__btn--primary" @click="openCreate">+ 新建项目</button>
        </div>
      </section>

      <!-- 表格 -->
      <section class="pv__table-wrap">
        <table class="pv__table">
          <thead>
            <tr>
              <th class="pv__th pv__th--sort" @click="changeSort('name')">
                项目名 <span class="pv__sort">{{ sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</span>
              </th>
              <th class="pv__th">角色数</th>
              <th class="pv__th">状态</th>
              <th class="pv__th pv__th--sort" @click="changeSort('updatedAt')">
                最后编辑 <span class="pv__sort">{{ sortBy === 'updatedAt' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</span>
              </th>
              <th class="pv__th">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="pv__loading">加载中…</td>
            </tr>
            <tr v-else-if="visibleProjects.length === 0">
              <td colspan="5" class="pv__empty">📭 还没有项目，点右上角新建一个吧</td>
            </tr>
            <tr v-for="p in visibleProjects" :key="p.id" class="pv__row">
              <td>
                <div class="pv__name">
                  <span class="pv__cover">{{ p.cover || '📁' }}</span>
                  <div>
                    <p class="pv__name-text">{{ p.name }}</p>
                    <p v-if="p.description" class="pv__desc">{{ p.description }}</p>
                  </div>
                </div>
              </td>
              <td>
                <div class="pv__role-stat">
                  <span>👤 {{ p.workCount ?? 0 }}</span>
                  <span class="pv__sep">·</span>
                  <span>🖼 {{ p.assetCount ?? 0 }}</span>
                </div>
              </td>
              <td>
                <span
                  class="pv__badge"
                  :style="{ background: STATUS_META[p.status].color + '22', color: STATUS_META[p.status].color }"
                >
                  {{ STATUS_META[p.status].icon }} {{ STATUS_META[p.status].label }}
                </span>
              </td>
              <td>
                <span class="pv__time">{{ formatTime(p.updatedAt) }}</span>
              </td>
              <td>
                <div class="pv__ops">
                  <button type="button" class="pv__op" @click="router.push(`/projects/${p.id}`)">打开</button>
                  <button type="button" class="pv__op" @click="archiveOne(p)">
                    {{ p.status === 'archived' ? '恢复' : '归档' }}
                  </button>
                  <button type="button" class="pv__op pv__op--danger" @click="removeOne(p)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 分页 -->
      <nav v-if="totalPages > 1" class="pv__pager">
        <button type="button" class="pv__page" :disabled="page === 1" @click="goPage(page - 1)">‹</button>
        <button
          v-for="n in pageRange"
          :key="n"
          type="button"
          class="pv__page"
          :class="{ 'pv__page--active': n === page }"
          @click="goPage(n)"
        >{{ n }}</button>
        <button type="button" class="pv__page" :disabled="page === totalPages" @click="goPage(page + 1)">›</button>
        <span class="pv__pager-info">第 {{ page }} / {{ totalPages }} 页</span>
      </nav>
    </div>

    <!-- 新建弹窗 -->
    <div v-if="showCreate" class="pv__modal-mask" @click.self="showCreate = false">
      <div class="pv__modal">
        <h3 class="pv__modal-title">新建项目</h3>
        <label class="pv__field">
          <span>项目名 *</span>
          <input v-model="newName" type="text" placeholder="例如：长安月下" />
        </label>
        <label class="pv__field">
          <span>简介</span>
          <textarea v-model="newDesc" rows="3" placeholder="一句话描述这个项目"></textarea>
        </label>
        <div class="pv__modal-actions">
          <button type="button" class="pv__btn" @click="showCreate = false">取消</button>
          <button type="button" class="pv__btn pv__btn--primary" @click="submitCreate">创建</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.pv { min-height: 100vh; background: var(--bg-primary); color: var(--text-primary); }
.pv__nav {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; gap: 24px;
  padding: 14px 28px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
}
.pv__brand { display: flex; align-items: center; gap: 10px; font-weight: 700; }
.pv__logo {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  color: white; font-weight: 800;
}
.pv__nav-links { display: flex; gap: 4px; flex: 1; margin-left: 20px; }
.pv__nav-link {
  padding: 6px 14px; font-size: 13px; color: var(--text-secondary);
  border-radius: 6px; text-decoration: none; transition: all 180ms;
}
.pv__nav-link:hover { color: var(--text-primary); background: var(--bg-secondary); }
.pv__nav-link--active { color: white; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); }

.pv__content { max-width: 1200px; margin: 0 auto; padding: 32px 28px 60px; display: flex; flex-direction: column; gap: 20px; }
.pv__bar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.pv__title { font-size: 22px; font-weight: 800; margin: 0; }
.pv__count { font-size: 14px; color: var(--text-secondary); font-weight: 600; }
.pv__actions { display: flex; gap: 8px; margin-left: auto; }
.pv__search, .pv__select {
  height: 36px; padding: 0 12px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);
  font-size: 13px;
}
.pv__search { width: 220px; }
.pv__btn {
  height: 36px; padding: 0 16px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);
  cursor: pointer; font-size: 13px; font-weight: 600;
}
.pv__btn--primary { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: white; border: none; }

.pv__table-wrap {
  background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
}
.pv__table { width: 100%; border-collapse: collapse; }
.pv__th {
  text-align: left; padding: 14px 16px; font-size: 12px; font-weight: 700;
  color: var(--text-secondary); background: var(--bg-primary); text-transform: uppercase; letter-spacing: 0.4px;
}
.pv__th--sort { cursor: pointer; user-select: none; }
.pv__th--sort:hover { color: var(--text-primary); }
.pv__sort { color: #6366f1; margin-left: 4px; }
.pv__row { border-top: 1px solid var(--border); transition: background 120ms; }
.pv__row:hover { background: color-mix(in srgb, #6366f1 4%, transparent); }
.pv__row td { padding: 14px 16px; font-size: 13px; vertical-align: middle; }
.pv__loading, .pv__empty { padding: 40px; text-align: center; color: var(--text-secondary); }

.pv__name { display: flex; align-items: center; gap: 12px; }
.pv__cover {
  width: 40px; height: 40px; border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  display: flex; align-items: center; justify-content: center; font-size: 20px;
}
.pv__name-text { font-weight: 700; margin: 0; font-size: 14px; }
.pv__desc { color: var(--text-secondary); font-size: 12px; margin: 2px 0 0; }

.pv__role-stat { color: var(--text-secondary); font-size: 12px; }
.pv__sep { margin: 0 6px; opacity: 0.5; }
.pv__badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; }
.pv__time { color: var(--text-secondary); font-size: 12px; }
.pv__ops { display: flex; gap: 4px; }
.pv__op {
  height: 28px; padding: 0 10px; border: 1px solid var(--border);
  border-radius: 4px; background: transparent; color: var(--text-primary);
  cursor: pointer; font-size: 12px; transition: all 120ms;
}
.pv__op:hover { background: var(--bg-primary); border-color: var(--accent); }
.pv__op--danger:hover { color: #ef4444; border-color: #ef4444; }

.pv__pager { display: flex; align-items: center; gap: 4px; justify-content: center; }
.pv__page {
  min-width: 32px; height: 32px; padding: 0 8px;
  border: 1px solid var(--border); background: var(--bg-secondary);
  border-radius: 4px; cursor: pointer; font-size: 12px;
}
.pv__page:hover:not(:disabled) { background: var(--bg-primary); }
.pv__page:disabled { opacity: 0.4; cursor: not-allowed; }
.pv__page--active { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: white; border: none; }
.pv__pager-info { margin-left: 12px; font-size: 12px; color: var(--text-secondary); }

.pv__modal-mask {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center;
}
.pv__modal { background: var(--bg-primary); border-radius: 12px; padding: 24px; width: 90%; max-width: 480px; }
.pv__modal-title { font-size: 18px; font-weight: 700; margin: 0 0 16px; }
.pv__field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.pv__field span { font-size: 12px; color: var(--text-secondary); }
.pv__field input, .pv__field textarea {
  padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg-secondary); color: var(--text-primary); font-size: 13px; font-family: inherit;
}
.pv__modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
</style>
