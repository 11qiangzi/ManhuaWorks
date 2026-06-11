<script setup lang="ts">
/**
 * TeamView · 团队协作
 * ManhuaWorks · L3.L 用户后台深耕
 *
 * 成员列表：头像 / 姓名 / 角色 / 最后活跃 / 操作
 * 邀请新成员 + 角色管理
 * 调 apiClient.team.members + invite (失败回退 mock)
 */

import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getApi } from '@/api-bridge'

const api = getApi()

/* ------------------------------------------------------------------ */
/*                          类型                                       */
/* ------------------------------------------------------------------ */

type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer'

interface Member {
  id: string
  name: string
  email: string
  avatar: string
  role: TeamRole
  joinedAt: string
  lastActiveAt: string
  status: 'active' | 'invited' | 'suspended'
}

interface InviteReq {
  email: string
  role: TeamRole
}

/* ------------------------------------------------------------------ */
/*                          状态                                       */
/* ------------------------------------------------------------------ */

const members = ref<Member[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const showInvite = ref(false)
const inviteEmail = ref('')
const inviteRole = ref<TeamRole>('editor')
const inviteSending = ref(false)
const inviteMsg = ref<string | null>(null)

const editingRole = ref<string | null>(null)
const roleFilter = ref<TeamRole | 'all'>('all')
const searchKeyword = ref('')

/* ------------------------------------------------------------------ */
/*                          Mock 回退                                  */
/* ------------------------------------------------------------------ */

const ROLE_META: Record<TeamRole, { label: string; color: string }> = {
  owner: { label: '所有者', color: '#a8302b' },
  admin: { label: '管理员', color: '#6366f1' },
  editor: { label: '编辑', color: '#10b981' },
  viewer: { label: '观察者', color: '#6b7280' }
}

const MOCK_MEMBERS: Member[] = [
  { id: 'm1', name: '我（创作者）', email: 'me@manhuaworks.com', avatar: '🧑', role: 'owner', joinedAt: '2026-01-15T00:00:00Z', lastActiveAt: new Date(Date.now() - 60_000).toISOString(), status: 'active' },
  { id: 'm2', name: '林染', email: 'linran@manhuaworks.com', avatar: '👩', role: 'admin', joinedAt: '2026-02-10T00:00:00Z', lastActiveAt: new Date(Date.now() - 3 * 3600_000).toISOString(), status: 'active' },
  { id: 'm3', name: '老魏', email: 'laowei@manhuaworks.com', avatar: '👨', role: 'editor', joinedAt: '2026-03-05T00:00:00Z', lastActiveAt: new Date(Date.now() - 86_400_000).toISOString(), status: 'active' },
  { id: 'm4', name: '小林', email: 'xiaolin@manhuaworks.com', avatar: '🧒', role: 'editor', joinedAt: '2026-04-20T00:00:00Z', lastActiveAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), status: 'active' },
  { id: 'm5', name: '小赵', email: 'xiaozhao@manhuaworks.com', avatar: '🧓', role: 'viewer', joinedAt: '2026-05-15T00:00:00Z', lastActiveAt: new Date(Date.now() - 5 * 86_400_000).toISOString(), status: 'active' },
  { id: 'm6', name: '设计师 阿丽', email: 'alice@manhuaworks.com', avatar: '👧', role: 'editor', joinedAt: '2026-06-01T00:00:00Z', lastActiveAt: new Date(Date.now() - 30 * 60_000).toISOString(), status: 'invited' },
  { id: 'm7', name: '前成员 鲍勃', email: 'bob@manhuaworks.com', avatar: '🧔', role: 'editor', joinedAt: '2026-02-01T00:00:00Z', lastActiveAt: new Date(Date.now() - 30 * 86_400_000).toISOString(), status: 'suspended' }
]

/* ------------------------------------------------------------------ */
/*                          加载                                       */
/* ------------------------------------------------------------------ */

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const res = await api.http.request<{ data: { list: Member[] } }>({
      method: 'GET',
      path: '/v1/team/members'
    })
    if (res?.data?.list && res.data.list.length > 0) {
      members.value = res.data.list
    } else {
      members.value = MOCK_MEMBERS
    }
  } catch {
    members.value = MOCK_MEMBERS
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ------------------------------------------------------------------ */
/*                          衍生                                       */
/* ------------------------------------------------------------------ */

const visibleMembers = computed(() => {
  let list = members.value.slice()
  if (roleFilter.value !== 'all') list = list.filter((m) => m.role === roleFilter.value)
  if (searchKeyword.value.trim()) {
    const k = searchKeyword.value.trim()
    list = list.filter((m) => m.name.includes(k) || m.email.includes(k))
  }
  return list
})

const counts = computed(() => {
  const c: Record<TeamRole | 'all', number> = { all: 0, owner: 0, admin: 0, editor: 0, viewer: 0 }
  for (const m of members.value) {
    c.all += 1
    c[m.role] += 1
  }
  return c
})

function formatTime(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return '刚刚活跃'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86_400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 30 * 86_400) return `${Math.floor(diff / 86_400)} 天前`
  return d.toISOString().slice(0, 10) + ' 后未活跃'
}

/* ------------------------------------------------------------------ */
/*                          邀请                                       */
/* ------------------------------------------------------------------ */

function openInvite(): void {
  inviteEmail.value = ''
  inviteRole.value = 'editor'
  inviteMsg.value = null
  showInvite.value = true
}

async function submitInvite(): Promise<void> {
  if (!inviteEmail.value.trim() || !inviteEmail.value.includes('@')) {
    inviteMsg.value = '请输入有效的邮箱地址'
    return
  }
  inviteSending.value = true
  inviteMsg.value = null
  const req: InviteReq = { email: inviteEmail.value.trim(), role: inviteRole.value }
  try {
    await api.http.request({ method: 'POST', path: '/v1/team/invite', body: req })
    inviteMsg.value = '✅ 邀请已发送'
  } catch {
    inviteMsg.value = '✅ 邀请已发送（本地模拟）'
  }
  // 模拟新增成员
  members.value.unshift({
    id: 'm-' + Date.now(),
    name: inviteEmail.value.split('@')[0],
    email: inviteEmail.value.trim(),
    avatar: '✉️',
    role: inviteRole.value,
    joinedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    status: 'invited'
  })
  inviteSending.value = false
  setTimeout(() => {
    showInvite.value = false
  }, 800)
}

/* ------------------------------------------------------------------ */
/*                          角色变更 / 移除                            */
/* ------------------------------------------------------------------ */

async function changeRole(m: Member, newRole: TeamRole): Promise<void> {
  if (m.role === 'owner' && newRole !== 'owner') {
    alert('不能直接修改所有者的角色，请先转让所有权')
    return
  }
  const old = m.role
  m.role = newRole
  try {
    await api.http.request({ method: 'PATCH', path: `/v1/team/members/${m.id}`, body: { role: newRole } })
  } catch {
    /* mock */
  }
  editingRole.value = null
  void old
}

async function removeMember(m: Member): Promise<void> {
  if (m.role === 'owner') {
    alert('所有者不能被移除')
    return
  }
  if (!confirm(`确定移除「${m.name}」？`)) return
  try {
    await api.http.request({ method: 'DELETE', path: `/v1/team/members/${m.id}` })
  } catch {
    /* mock */
  }
  members.value = members.value.filter((x) => x.id !== m.id)
}
</script>

<template>
  <main class="tv">
    <header class="tv__nav">
      <div class="tv__brand">
        <span class="tv__logo">M</span>
        <span class="tv__brand-name">团队协作</span>
      </div>
      <nav class="tv__nav-links">
        <RouterLink to="/dashboard" class="tv__nav-link">首页</RouterLink>
        <RouterLink to="/projects" class="tv__nav-link">项目</RouterLink>
        <RouterLink to="/works" class="tv__nav-link">作品</RouterLink>
        <RouterLink to="/assets" class="tv__nav-link">素材</RouterLink>
        <RouterLink to="/team" class="tv__nav-link tv__nav-link--active">团队</RouterLink>
        <RouterLink to="/account" class="tv__nav-link">账户</RouterLink>
      </nav>
    </header>

    <div class="tv__content">
      <section class="tv__bar">
        <div>
          <h1 class="tv__title">🤝 团队协作 <span class="tv__count">({{ members.length }})</span></h1>
          <p class="tv__sub">共 {{ counts.owner }} 位所有者 · {{ counts.admin }} 位管理员 · {{ counts.editor }} 位编辑 · {{ counts.viewer }} 位观察者</p>
        </div>
        <button type="button" class="tv__btn tv__btn--primary" @click="openInvite">✉ 邀请新成员</button>
      </section>

      <section class="tv__filters">
        <input
          v-model="searchKeyword"
          type="search"
          class="tv__search"
          placeholder="搜索姓名 / 邮箱…"
        />
        <div class="tv__chips">
          <button
            type="button"
            class="tv__chip"
            :class="{ 'tv__chip--active': roleFilter === 'all' }"
            @click="roleFilter = 'all'"
          >全部 ({{ counts.all }})</button>
          <button
            v-for="r in (['owner', 'admin', 'editor', 'viewer'] as TeamRole[])"
            :key="r"
            type="button"
            class="tv__chip"
            :class="{ 'tv__chip--active': roleFilter === r }"
            :style="roleFilter === r ? { background: ROLE_META[r].color, color: 'white', borderColor: ROLE_META[r].color } : {}"
            @click="roleFilter = r"
          >{{ ROLE_META[r].label }} ({{ counts[r] }})</button>
        </div>
      </section>

      <section v-if="loading" class="tv__loading">加载中…</section>
      <section v-else-if="visibleMembers.length === 0" class="tv__empty">📭 没有匹配的成员</section>
      <section v-else class="tv__list">
        <article
          v-for="m in visibleMembers"
          :key="m.id"
          class="mb"
          :class="{ 'mb--suspended': m.status === 'suspended' }"
        >
          <div class="mb__avatar">{{ m.avatar }}</div>
          <div class="mb__info">
            <p class="mb__name">
              {{ m.name }}
              <span v-if="m.status === 'invited'" class="mb__tag mb__tag--invited">邀请中</span>
              <span v-else-if="m.status === 'suspended'" class="mb__tag mb__tag--suspended">已停用</span>
            </p>
            <p class="mb__email">{{ m.email }}</p>
            <p class="mb__time">{{ formatTime(m.lastActiveAt) }} · 加入于 {{ new Date(m.joinedAt).toISOString().slice(0, 10) }}</p>
          </div>
          <div class="mb__role">
            <select
              v-if="editingRole === m.id"
              :value="m.role"
              class="mb__role-select"
              @change="(e) => changeRole(m, (e.target as HTMLSelectElement).value as TeamRole)"
              @blur="editingRole = null"
            >
              <option v-for="r in (['owner', 'admin', 'editor', 'viewer'] as TeamRole[])" :key="r" :value="r">
                {{ ROLE_META[r].label }}
              </option>
            </select>
            <button
              v-else
              type="button"
              class="mb__role-badge"
              :style="{ background: ROLE_META[m.role].color + '22', color: ROLE_META[m.role].color }"
              @click="editingRole = m.id"
            >{{ ROLE_META[m.role].label }} ✎</button>
          </div>
          <div class="mb__ops">
            <button
              v-if="m.role !== 'owner' && m.status !== 'suspended'"
              type="button"
              class="mb__op mb__op--danger"
              @click="removeMember(m)"
            >移除</button>
            <button
              v-else-if="m.role !== 'owner'"
              type="button"
              class="mb__op"
              disabled
            >{{ m.status === 'suspended' ? '已停用' : '所有者' }}</button>
          </div>
        </article>
      </section>
    </div>

    <!-- 邀请弹窗 -->
    <div v-if="showInvite" class="tv__modal-mask" @click.self="showInvite = false">
      <div class="tv__modal">
        <h3 class="tv__modal-title">✉ 邀请新成员</h3>
        <label class="tv__field">
          <span>邮箱地址 *</span>
          <input v-model="inviteEmail" type="email" placeholder="name@manhuaworks.com" />
        </label>
        <label class="tv__field">
          <span>角色</span>
          <select v-model="inviteRole">
            <option value="admin">管理员</option>
            <option value="editor">编辑</option>
            <option value="viewer">观察者</option>
          </select>
        </label>
        <p v-if="inviteMsg" class="tv__msg">{{ inviteMsg }}</p>
        <div class="tv__modal-actions">
          <button type="button" class="tv__btn" @click="showInvite = false">取消</button>
          <button type="button" class="tv__btn tv__btn--primary" :disabled="inviteSending" @click="submitInvite">
            {{ inviteSending ? '发送中…' : '发送邀请' }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.tv { min-height: 100vh; background: var(--bg-primary); color: var(--text-primary); }
.tv__nav {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; gap: 24px;
  padding: 14px 28px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
}
.tv__brand { display: flex; align-items: center; gap: 10px; font-weight: 700; }
.tv__logo {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px;
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: white; font-weight: 800;
}
.tv__nav-links { display: flex; gap: 4px; flex: 1; margin-left: 20px; }
.tv__nav-link {
  padding: 6px 14px; font-size: 13px; color: var(--text-secondary);
  border-radius: 6px; text-decoration: none; transition: all 180ms;
}
.tv__nav-link:hover { color: var(--text-primary); background: var(--bg-secondary); }
.tv__nav-link--active { color: white; background: linear-gradient(135deg, #10b981 0%, #34d399 100%); }

.tv__content { max-width: 1200px; margin: 0 auto; padding: 32px 28px 60px; display: flex; flex-direction: column; gap: 20px; }
.tv__bar { display: flex; align-items: flex-end; gap: 16px; }
.tv__title { font-size: 22px; font-weight: 800; margin: 0; }
.tv__count { font-size: 14px; color: var(--text-secondary); font-weight: 600; }
.tv__sub { font-size: 12px; color: var(--text-secondary); margin: 4px 0 0; }
.tv__btn { margin-left: auto; height: 36px; padding: 0 16px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; font-size: 13px; font-weight: 600; }
.tv__btn--primary { background: linear-gradient(135deg, #10b981 0%, #34d399 100%); color: white; border: none; }
.tv__btn:disabled { opacity: 0.5; cursor: not-allowed; }

.tv__filters { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.tv__search {
  height: 36px; padding: 0 12px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);
  font-size: 13px; width: 220px;
}
.tv__chips { display: flex; gap: 6px; flex-wrap: wrap; }
.tv__chip {
  height: 30px; padding: 0 12px; border: 1px solid var(--border);
  background: var(--bg-secondary); color: var(--text-secondary);
  border-radius: 99px; cursor: pointer; font-size: 12px; font-weight: 600;
}
.tv__chip--active { background: var(--text-primary); color: var(--bg-primary); border-color: var(--text-primary); }

.tv__loading, .tv__empty { padding: 60px 20px; text-align: center; color: var(--text-secondary); }
.tv__list { display: flex; flex-direction: column; gap: 8px; }
.mb {
  display: grid; grid-template-columns: 48px 1fr auto auto; gap: 16px; align-items: center;
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 10px; padding: 14px 16px; transition: all 180ms;
}
.mb:hover { border-color: #10b981; }
.mb--suspended { opacity: 0.6; }
.mb__avatar {
  width: 48px; height: 48px; border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; color: white;
}
.mb__name { font-size: 14px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 6px; }
.mb__tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
.mb__tag--invited { background: #f59e0b; color: white; }
.mb__tag--suspended { background: #6b7280; color: white; }
.mb__email { font-size: 12px; color: var(--text-secondary); margin: 2px 0; }
.mb__time { font-size: 11px; color: var(--text-secondary); margin: 0; }

.mb__role-badge {
  border: none; padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 700; cursor: pointer;
}
.mb__role-select {
  height: 30px; padding: 0 8px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);
}

.mb__ops { display: flex; gap: 4px; }
.mb__op { height: 28px; padding: 0 10px; border: 1px solid var(--border); background: transparent; color: var(--text-primary); border-radius: 4px; cursor: pointer; font-size: 12px; }
.mb__op:disabled { opacity: 0.4; cursor: not-allowed; }
.mb__op--danger:hover { color: #ef4444; border-color: #ef4444; }

.tv__modal-mask {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center;
}
.tv__modal { background: var(--bg-primary); border-radius: 12px; padding: 24px; width: 90%; max-width: 480px; }
.tv__modal-title { font-size: 18px; font-weight: 700; margin: 0 0 16px; }
.tv__field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.tv__field span { font-size: 12px; color: var(--text-secondary); }
.tv__field input, .tv__field select {
  padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg-secondary); color: var(--text-primary); font-size: 13px;
}
.tv__msg { font-size: 12px; color: var(--text-secondary); margin: 8px 0 0; }
.tv__modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
</style>
