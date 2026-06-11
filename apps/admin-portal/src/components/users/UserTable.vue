<script setup lang="ts">
/**
 * UserTable — 用户管理表格
 */
import type { User } from '@/api/admin'

defineProps<{
  users: User[]
  loading?: boolean
}>()
const emit = defineEmits<{
  (e: 'select', user: User): void
  (e: 'toggle', user: User): void
}>()

const PLAN_LABELS: Record<string, string> = { free: '免费版', pro: '专业版', studio: '工作室版' }
const STATUS_LABELS: Record<string, string> = { active: '正常', disabled: '禁用', pending: '待审核' }

function planTag(p: string) {
  return p === 'studio' ? 'studio' : p === 'pro' ? 'pro' : 'free'
}
function statusTag(s: string) {
  return s === 'active' ? 'st-active' : s === 'disabled' ? 'st-disabled' : 'st-pending'
}
</script>

<template>
  <div class="ut-wrap">
    <div v-if="loading" class="ut-loading">加载中…</div>
    <table v-else class="ut-table">
      <thead>
        <tr>
          <th>用户</th>
          <th>邮箱</th>
          <th>套餐</th>
          <th>状态</th>
          <th class="num">积分</th>
          <th class="num">消费</th>
          <th>最近登录</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id" @click="emit('select', u)">
          <td>
            <div class="ut-name">
              <span class="ut-avatar">{{ u.name.charAt(0) }}</span>
              <span>{{ u.name }}</span>
              <span class="ut-id">{{ u.id }}</span>
            </div>
          </td>
          <td class="email">{{ u.email }}</td>
          <td><span class="ut-pill" :class="planTag(u.plan)">{{ PLAN_LABELS[u.plan] ?? u.plan }}</span></td>
          <td><span class="ut-pill" :class="statusTag(u.status)">{{ STATUS_LABELS[u.status] ?? u.status }}</span></td>
          <td class="num">{{ u.credits.toLocaleString() }}</td>
          <td class="num">¥{{ u.totalSpent }}</td>
          <td class="dim">{{ new Date(u.lastLogin).toLocaleDateString() }}</td>
          <td @click.stop>
            <button class="ut-btn" @click="emit('toggle', u)">
              {{ u.status === 'active' ? '禁用' : '启用' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.ut-wrap { overflow-x: auto; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px; }
.ut-loading { padding: 40px; text-align: center; opacity: 0.6; }
.ut-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ut-table th { text-align: left; padding: 12px 14px; background: var(--bg-primary); font-weight: 500; color: var(--text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); }
.ut-table td { padding: 12px 14px; border-bottom: 1px solid var(--border); }
.ut-table tr:last-child td { border-bottom: none; }
.ut-table tbody tr { cursor: pointer; transition: background 120ms; }
.ut-table tbody tr:hover { background: var(--bg-primary); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.dim { color: var(--text-secondary); font-size: 12px; }
.email { color: var(--text-secondary); font-size: 12px; }

.ut-name { display: flex; align-items: center; gap: 8px; }
.ut-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: white; display: grid; place-items: center; font-size: 12px; font-weight: 600; }
.ut-id { color: var(--text-secondary); font-size: 11px; font-family: monospace; }

.ut-pill { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; background: var(--bg-primary); border: 1px solid var(--border); text-transform: uppercase; }
.ut-pill.studio { color: var(--accent); border-color: var(--accent); }
.ut-pill.pro { color: var(--info); border-color: var(--info); }
.ut-pill.free { color: var(--text-secondary); }
.ut-pill.st-active { color: var(--success); border-color: var(--success); }
.ut-pill.st-disabled { color: var(--danger); border-color: var(--danger); }
.ut-pill.st-pending { color: var(--warning); border-color: var(--warning); }

.ut-btn { padding: 4px 10px; border-radius: 6px; background: var(--bg-primary); border: 1px solid var(--border); color: var(--text-primary); font-size: 12px; cursor: pointer; }
.ut-btn:hover { border-color: var(--accent); color: var(--accent); }
</style>
