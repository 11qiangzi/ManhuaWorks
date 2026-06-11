<script setup lang="ts">
/**
 * UsersView · 用户列表
 * ManhuaWorks · M1-W4 · L4-B
 *
 * 4 大模块:
 *   1. 4 KPI (总/7 日新增/付费/试用)
 *   2. 搜索 + provider 筛选 + 状态筛选
 *   3. 表格 (10/页) + 分页
 *   4. 详情弹窗
 */
import { computed, ref } from 'vue'
import { userList, type UserMock } from '@/api/mock-data'

const STATUS_LABELS: Record<string, string> = { active: '正常', trial: '试用', paused: '暂停', revoked: '已撤销' }

/* ---------- KPI ---------- */
const totalUsers = userList.length
const new7d = userList.filter(u => u.createdAt > Date.now() - 7 * 86400_000).length
const paying = userList.filter(u => u.credits >= 1000).length
const trial = userList.filter(u => u.status === 'trial').length
const kpis = [
  { label: '总用户', value: totalUsers },
  { label: '7 日新增', value: new7d },
  { label: '付费用户', value: paying },
  { label: '试用用户', value: trial }
]

/* ---------- 筛选 + 分页 ---------- */
const search = ref('')
const providerFilter = ref<string>('all')
const statusFilter = ref<string>('all')
const page = ref(1)
const pageSize = 10
const selected = ref<UserMock | null>(null)

const filtered = computed(() => userList.filter(u => {
  if (providerFilter.value !== 'all' && u.provider !== providerFilter.value) return false
  if (statusFilter.value !== 'all' && u.status !== statusFilter.value) return false
  if (search.value.trim()) {
    const s = search.value.trim().toLowerCase()
    if (!u.email.toLowerCase().includes(s) && !u.username.toLowerCase().includes(s)) return false
  }
  return true
}))
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const providers = ['all', 'openai', 'anthropic', 'google', 'deepseek', 'minimax']
const statuses = ['all', 'active', 'trial', 'paused', 'revoked']

function fmtDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}
function statusColor(s: UserMock['status']): string {
  return { active: '#22c55e', trial: '#3b82f6', paused: '#eab308', revoked: '#ef4444' }[s]
}
function prevPage(): void { if (page.value > 1) page.value-- }
function nextPage(): void { if (page.value < totalPages.value) page.value++ }
function showDetail(u: UserMock): void { selected.value = u }
function closeDetail(): void { selected.value = null }
</script>

<template>
  <div class="uv">
    <h1 class="uv__title">👥 用户管理</h1>

    <!-- KPI -->
    <section class="uv__kpis">
      <article v-for="k in kpis" :key="k.label" class="uv__kpi">
        <p class="uv__kpi-label">{{ k.label }}</p>
        <p class="uv__kpi-value">{{ k.value }}</p>
      </article>
    </section>

    <!-- 筛选 -->
    <section class="uv__filters">
      <input v-model="search" type="text" placeholder="🔍 邮箱 / 用户名" class="uv__input" data-testid="uv-search" />
      <select v-model="providerFilter" class="uv__select" data-testid="uv-provider">
        <option v-for="p in providers" :key="p" :value="p">{{ p === 'all' ? '全部 provider' : p }}</option>
      </select>
      <select v-model="statusFilter" class="uv__select" data-testid="uv-status">
        <option v-for="s in statuses" :key="s" :value="s">{{ s === 'all' ? '全部状态' : s }}</option>
      </select>
    </section>

    <!-- 表格 -->
    <section class="uv__panel">
      <table class="uv__table" data-testid="uv-table">
        <thead>
          <tr>
            <th>邮箱</th><th>用户名</th><th>供应商</th><th>状态</th><th>积分</th><th>注册</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in paged" :key="u.id">
            <td>{{ u.email }}</td>
            <td>{{ u.username }}</td>
            <td>{{ u.provider }}</td>
            <td>
              <span class="uv__badge" :style="{ background: statusColor(u.status) + '22', color: statusColor(u.status) }">
                {{ STATUS_LABELS[u.status] ?? u.status }}
              </span>
            </td>
            <td>{{ u.credits.toLocaleString() }}</td>
            <td>{{ fmtDate(u.createdAt) }}</td>
            <td>
              <button class="uv__btn" @click="showDetail(u)">查看</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="paged.length === 0" class="uv__empty">无匹配用户</p>
    </section>

    <!-- 分页 -->
    <section class="uv__pager">
      <button class="uv__btn" :disabled="page === 1" @click="prevPage">上一页</button>
      <span class="uv__pager-info">第 {{ page }} / {{ totalPages }} 页 · 共 {{ filtered.length }} 条</span>
      <button class="uv__btn" :disabled="page === totalPages" @click="nextPage">下一页</button>
    </section>

    <!-- 详情弹窗 -->
    <div v-if="selected" class="uv__mask" @click.self="closeDetail">
      <div class="uv__modal" data-testid="uv-modal">
        <header class="uv__modal-head">
          <h3>用户详情</h3>
          <button class="uv__modal-close" @click="closeDetail">×</button>
        </header>
        <dl class="uv__detail">
          <dt>ID</dt><dd>{{ selected.id }}</dd>
          <dt>邮箱</dt><dd>{{ selected.email }}</dd>
          <dt>用户名</dt><dd>{{ selected.username }}</dd>
          <dt>供应商</dt><dd>{{ selected.provider }}</dd>
          <dt>状态</dt><dd>{{ STATUS_LABELS[selected.status] ?? selected.status }}</dd>
          <dt>积分</dt><dd>{{ selected.credits.toLocaleString() }}</dd>
          <dt>注册时间</dt><dd>{{ fmtDate(selected.createdAt) }}</dd>
        </dl>
      </div>
    </div>
  </div>
</template>

<style scoped>
.uv { display: flex; flex-direction: column; gap: 16px; }
.uv__title { font-size: 22px; font-weight: 700; margin: 0; }
.uv__kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.uv__kpi { background: #181b22; border: 1px solid #2a2f3a; border-radius: 10px; padding: 14px 16px; }
.uv__kpi-label { color: #6b7280; font-size: 12px; margin: 0 0 6px; }
.uv__kpi-value { font-size: 22px; font-weight: 800; margin: 0; }
.uv__filters { display: flex; gap: 10px; }
.uv__input, .uv__select {
  background: #181b22; border: 1px solid #2a2f3a; color: #e6e8eb;
  padding: 8px 12px; border-radius: 6px; font-size: 13px;
}
.uv__input { flex: 1; }
.uv__panel { background: #181b22; border: 1px solid #2a2f3a; border-radius: 10px; padding: 4px; overflow-x: auto; }
.uv__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.uv__table th, .uv__table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #2a2f3a; }
.uv__table th { color: #6b7280; font-weight: 600; font-size: 12px; }
.uv__badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.uv__btn {
  background: #232834; color: #e6e8eb; border: 1px solid #2a2f3a;
  padding: 4px 12px; border-radius: 5px; font-size: 12px; cursor: pointer;
}
.uv__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.uv__btn:hover:not(:disabled) { background: #2a3050; }
.uv__empty { color: #6b7280; text-align: center; padding: 24px; }
.uv__pager { display: flex; align-items: center; gap: 12px; justify-content: center; }
.uv__pager-info { color: #a0a6b0; font-size: 13px; }
.uv__mask { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 50; }
.uv__modal { background: #181b22; border: 1px solid #2a2f3a; border-radius: 12px; min-width: 420px; max-width: 90vw; padding: 0; }
.uv__modal-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #2a2f3a; }
.uv__modal-head h3 { margin: 0; font-size: 15px; }
.uv__modal-close { background: none; border: none; color: #a0a6b0; font-size: 22px; cursor: pointer; }
.uv__detail { margin: 0; padding: 16px 18px; display: grid; grid-template-columns: 80px 1fr; gap: 8px 14px; font-size: 13px; }
.uv__detail dt { color: #6b7280; }
.uv__detail dd { margin: 0; color: #e6e8eb; }
</style>
