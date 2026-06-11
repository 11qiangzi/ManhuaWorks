<script setup lang="ts">
/**
 * DashboardView · 业务总大盘
 * ManhuaWorks · M1-W4 · L4-B
 *
 * 5 大模块:
 *   1. 5 KPI 卡片
 *   2. 7 日收入趋势 (SVG 折线)
 *   3. 5 provider 占用 (SVG 水平柱)
 *   4. 6 项目状态 (SVG 柱状)
 *   5. 最近 10 条操作日志
 */
import { computed } from 'vue'
import {
  dashboardKpi,
  revenueSeries,
  providerUsage,
  projectStatus,
  recentOps
} from '@/api/mock-data'

const ACTION_LABELS: Record<string, string> = {
  GRANT_CREDITS: '发放积分',
  ROTATE_API_KEY: '轮换密钥',
  COST_ALERT: '费用告警',
  BAN_USER: '封禁用户',
  UNBAN_USER: '解封用户',
  BACKUP_OK: '备份完成',
  REFUND: '退款处理',
  DEPLOY: '服务部署',
  CREATE_COUPON: '创建优惠券',
  SUSPEND: '暂停服务'
}

/* ---------- 1. KPI ---------- */
const kpis = [
  { label: '总用户', value: dashboardKpi.totalUsers, hint: '累计注册' },
  { label: '7 日活跃', value: dashboardKpi.active7d, hint: '日活/月活 43%' },
  { label: '总项目', value: dashboardKpi.totalProjects, hint: '含已归档' },
  { label: '总作品', value: dashboardKpi.totalWorks, hint: '已发布 + 草稿' },
  { label: '今日新增', value: dashboardKpi.newToday, hint: '用户 + 项目' }
]

/* ---------- 2. 收入折线 ---------- */
const revenuePath = computed(() => {
  const max = Math.max(...revenueSeries.map(p => p.value))
  const min = Math.min(...revenueSeries.map(p => p.value))
  const range = max - min || 1
  const w = 600
  const h = 160
  const step = w / (revenueSeries.length - 1)
  return revenueSeries.map((p, i) => {
    const x = i * step
    const y = h - ((p.value - min) / range) * h
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
})
const revenueDots = computed(() => {
  const max = Math.max(...revenueSeries.map(p => p.value))
  const min = Math.min(...revenueSeries.map(p => p.value))
  const range = max - min || 1
  const w = 600
  const h = 160
  const step = w / (revenueSeries.length - 1)
  return revenueSeries.map((p, i) => {
    const x = i * step
    const y = h - ((p.value - min) / range) * h
    return { x, y, value: p.value, date: p.date }
  })
})

/* ---------- 3. provider 占用 ---------- */
const providerMax = computed(() => Math.max(...providerUsage.map(p => p.used)))

/* ---------- 4. 项目状态 ---------- */
const projectMax = computed(() => Math.max(...projectStatus.map(p => p.count)))
const projectBarWidth = 360

function statusColor(s: string): string {
  return {
    draft: '#6b7280',
    running: '#3b82f6',
    reviewing: '#eab308',
    published: '#22c55e',
    archived: '#a855f7',
    failed: '#ef4444'
  }[s] ?? '#6b7280'
}

/* ---------- 5. 日志时间格式化 ---------- */
function fmtAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}
</script>

<template>
  <div class="dash">
    <h1 class="dash__title">📊 业务总大盘</h1>
    <p class="dash__sub">运营总览 · 实时更新 · 数据源: Mock</p>

    <!-- 1. KPI -->
    <section class="dash__kpis">
      <article v-for="k in kpis" :key="k.label" class="dash__kpi">
        <p class="dash__kpi-label">{{ k.label }}</p>
        <p class="dash__kpi-value">{{ k.value.toLocaleString() }}</p>
        <p class="dash__kpi-hint">{{ k.hint }}</p>
      </article>
    </section>

    <!-- 2. 收入折线 -->
    <section class="dash__panel">
      <h2 class="dash__panel-title">💰 7 日收入趋势 (¥)</h2>
      <svg class="dash__chart" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid meet">
        <line v-for="i in 4" :key="`g${i}`" :x1="0" :y1="i * 40" :x2="600" :y2="i * 40" stroke="#2a2f3a" stroke-dasharray="2 4" />
        <path :d="revenuePath" stroke="#6366f1" stroke-width="2" fill="none" data-testid="revenue-line" />
        <circle v-for="(d, i) in revenueDots" :key="i" :cx="d.x" :cy="d.y" r="3" fill="#6366f1" />
        <text v-for="(d, i) in revenueDots" :key="`t${i}`" :x="d.x" :y="190" fill="#6b7280" font-size="10" text-anchor="middle">{{ d.date }}</text>
      </svg>
    </section>

    <!-- 3. provider 占用 -->
    <section class="dash__panel">
      <h2 class="dash__panel-title">🤖 5 Provider 占用分布</h2>
      <ul class="dash__bars">
        <li v-for="p in providerUsage" :key="p.provider" class="dash__bar">
          <div class="dash__bar-head">
            <span :style="{ color: p.color }">{{ p.provider }}</span>
            <span class="dash__bar-num">{{ p.used }}</span>
          </div>
          <div class="dash__bar-track">
            <div class="dash__bar-fill" :style="{ width: ((p.used / providerMax) * 100) + '%', background: p.color }" />
          </div>
        </li>
      </ul>
    </section>

    <!-- 4. 项目状态 -->
    <section class="dash__panel">
      <h2 class="dash__panel-title">📂 项目状态分布</h2>
      <svg class="dash__chart" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid meet">
        <g v-for="(s, i) in projectStatus" :key="s.status" :transform="`translate(${i * 100 + 20}, 0)`">
          <rect
            :x="0"
            :y="180 - (s.count / projectMax) * 150"
            :width="60"
            :height="(s.count / projectMax) * 150"
            :fill="statusColor(s.status)"
            rx="4"
          />
          <text :x="30" :y="195" fill="#a0a6b0" font-size="10" text-anchor="middle">{{ s.status }}</text>
          <text :x="30" :y="170 - (s.count / projectMax) * 150" fill="#e6e8eb" font-size="11" text-anchor="middle" font-weight="700">{{ s.count }}</text>
        </g>
      </svg>
    </section>

    <!-- 5. 操作日志 -->
    <section class="dash__panel">
      <h2 class="dash__panel-title">📜 最近 10 条操作日志</h2>
      <table class="dash__log" data-testid="ops-log">
        <thead>
          <tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>详情</th></tr>
        </thead>
        <tbody>
          <tr v-for="(o, i) in recentOps" :key="i">
            <td>{{ fmtAgo(o.ts) }}</td>
            <td>{{ o.who }}</td>
            <td><code>{{ ACTION_LABELS[o.action] ?? o.action }}</code></td>
            <td>{{ o.target }}</td>
            <td>{{ o.detail }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.dash { display: flex; flex-direction: column; gap: 20px; }
.dash__title { font-size: 22px; font-weight: 700; margin: 0; }
.dash__sub { color: var(--text-muted); margin: 0; font-size: 13px; }
.dash__kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.dash__kpi {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 18px 20px;
}
.dash__kpi-label { color: var(--text-muted); font-size: 12px; margin: 0 0 6px; }
.dash__kpi-value { font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -0.02em; }
.dash__kpi-hint { color: var(--text-muted); font-size: 11px; margin: 4px 0 0; }
.dash__panel {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 18px 20px;
}
.dash__panel-title { font-size: 14px; font-weight: 700; margin: 0 0 14px; color: var(--text-primary); }
.dash__chart { width: 100%; height: 200px; display: block; }
.dash__bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.dash__bar-head { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
.dash__bar-num { color: #a0a6b0; }
.dash__bar-track { background: #2a2f3a; height: 8px; border-radius: 4px; overflow: hidden; }
.dash__bar-fill { height: 100%; transition: width 0.3s; }
.dash__log { width: 100%; border-collapse: collapse; font-size: 12px; }
.dash__log th, .dash__log td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #2a2f3a; }
.dash__log th { color: #6b7280; font-weight: 600; }
.dash__log code { background: #2a2f3a; padding: 1px 6px; border-radius: 3px; font-size: 11px; }
</style>
