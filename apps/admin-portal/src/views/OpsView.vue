<script setup lang="ts">
/**
 * OpsView —业务运营 ·4 大模块12 数据点
 * ManhuaWorks · M1-W3 L3.K
 *
 *顶部时间范围 +4 模块卡片（响应式3/2/1列）+10s 自动刷新
 */
import { onMounted, computed, ref } from 'vue'
import { useOps } from '@/composables/ops'
import type { TimeRange } from '@/api/ops'

const ops = useOps()

const ranges: { key: TimeRange; label: string }[] = [
 { key: '7d', label: '7 天' },
 { key: '30d', label: '30 天' },
 { key: '90d', label: '90 天' },
 { key: 'all', label: '全部' },
]

const lastUpdated = ref<string>('—')
const autoRefreshOn = ref(true)

onMounted(async () => {
 await ops.load('30d')
 lastUpdated.value = formatNow()
 ops.startAutoRefresh(10000)
})

function formatNow(): string {
 const d = new Date()
 return d.toLocaleTimeString('zh-CN', { hour12: false })
}

async function pickRange(r: TimeRange): Promise<void> {
 await ops.load(r)
 lastUpdated.value = formatNow()
}

function toggleAuto(): void {
 autoRefreshOn.value = !autoRefreshOn.value
 if (autoRefreshOn.value) ops.startAutoRefresh(10000)
 else ops.stopAutoRefresh()
}

function maxVal(arr: { value: number }[]): number {
 return arr.reduce((m, p) => Math.max(m, p.value),1)
}

function fmtMoney(n: number): string {
 return n >=10000 ? `¥${(n /10000).toFixed(1)}万` : `¥${n.toLocaleString()}`
}

function fmtPct(n: number): string { return `${n.toFixed(1)}%` }
function relTime(iso: string): string {
 const diff = Date.now() - new Date(iso).getTime()
 const m = Math.floor(diff /60000)
 if (m <1) return '刚刚'
 if (m <60) return `${m} 分钟前`
 const h = Math.floor(m /60)
 if (h <24) return `${h} 小时前`
 return `${Math.floor(h /24)} 天前`
}

const subTotal = computed(() => ops.subscriptions.value.reduce((s, x) => s + x.count,0))
function subPct(count: number): string {
 const t = subTotal.value ||1
 return `${((count / t) *100).toFixed(1)}%`
}

const pieColors: Record<string, string> = {
 Free: '#6b7280',
 Pro: '#3b82f6',
 Studio: '#8b5cf6',
 Enterprise: '#f59e0b',
}
function pieColor(plan: string): string {
 return pieColors[plan] ?? '#10b981'
}
</script>

<template>
 <div class="ops">
 <!--顶栏 -->
 <div class="ops-toolbar">
 <div class="ops-range">
 <span class="ops-toolbar-label">时间范围：</span>
 <button
 v-for="r in ranges"
 :key="r.key"
 class="ops-range-btn"
 :class="{ active: ops.range.value === r.key }"
 @click="pickRange(r.key)"
 >
 {{ r.label }}
 </button>
 </div>
 <div class="ops-toolbar-right">
 <span class="ops-ts">最近更新：{{ lastUpdated }}</span>
 <button class="ops-refresh-btn" :class="{ on: autoRefreshOn }" @click="toggleAuto">
 {{ autoRefreshOn ? '🟢 自动刷新' : '⏸ 已暂停' }}
 </button>
 <button class="ops-refresh-btn" @click="ops.refresh().then(() => lastUpdated = formatNow())">
 🔄立即刷新
 </button>
 </div>
 </div>

 <!--加载中 -->
 <div v-if="ops.loading.value && !ops.snapshot.value" class="ops-loading">
 数据加载中…
 </div>

 <!-- 模块1：用户运营 -->
 <section class="ops-module">
 <header class="ops-module-head">
 <span class="ops-module-icon">👥</span>
 <h2 class="ops-module-title">用户运营</h2>
 <span class="ops-module-tag">3 数据点 +活跃列表</span>
 </header>
 <div class="ops-module-body">
 <div class="ops-card">
 <h3 class="ops-h3">DAU折线</h3>
 <div class="ops-chart">
 <div
 v-for="(p, i) in ops.dau.value.slice(-14)"
 :key="i"
 class="ops-bar"
 :style="{ height: ((p.value / maxVal(ops.dau.value)) *100) + '%' }"
 :title="p.date + ' · ' + p.value"
 />
 </div>
 <div class="ops-chart-foot">最新：{{ ops.dau.value.at(-1)?.value ??0 }} DAU</div>
 </div>
 <div class="ops-card">
 <h3 class="ops-h3">MAU折线</h3>
 <div class="ops-chart">
 <div
 v-for="(p, i) in ops.mau.value.slice(-14)"
 :key="i"
 class="ops-bar mau"
 :style="{ height: ((p.value / maxVal(ops.mau.value)) *100) + '%' }"
 :title="p.date + ' · ' + p.value"
 />
 </div>
 <div class="ops-chart-foot">最新：{{ ops.mau.value.at(-1)?.value ??0 }} MAU</div>
 </div>
 <div class="ops-card">
 <h3 class="ops-h3">新增 vs流失</h3>
 <div class="ops-stack">
 <div class="ops-stack-row">
 <span class="ops-stack-label">📈 新增</span>
 <span class="ops-stack-val up">{{ ops.newUsers.value.reduce((s, x) => s + x.value,0) }}</span>
 </div>
 <div class="ops-stack-row">
 <span class="ops-stack-label">📉流失</span>
 <span class="ops-stack-val down">{{ ops.churn.value.reduce((s, x) => s + x.value,0) }}</span>
 </div>
 </div>
 </div>
 </div>
 <div class="ops-card ops-card-wide">
 <h3 class="ops-h3">活跃用户列表（最近登录）</h3>
 <table class="ops-table">
 <thead><tr><th>用户</th><th>邮箱</th><th>最后登录</th></tr></thead>
 <tbody>
 <tr v-for="u in ops.activeUsers.value.slice(0,8)" :key="u.id">
 <td>{{ u.name }}</td><td class="ops-mono">{{ u.email }}</td>
 <td>{{ relTime(u.lastLogin) }}</td>
 </tr>
 </tbody>
 </table>
 </div>
 </section>

 <!-- 模块2：项目运营 -->
 <section class="ops-module">
 <header class="ops-module-head">
 <span class="ops-module-icon">📦</span>
 <h2 class="ops-module-title">项目运营</h2>
 <span class="ops-module-tag">4 数据点</span>
 </header>
 <div class="ops-module-body">
 <div class="ops-kpi">
 <div class="ops-kpi-num">{{ ops.projectsTotal.value.toLocaleString() }}</div>
 <div class="ops-kpi-label">项目总数</div>
 </div>
 <div class="ops-kpi">
 <div class="ops-kpi-num accent">{{ ops.projectsActive.value.toLocaleString() }}</div>
 <div class="ops-kpi-label">活跃项目</div>
 </div>
 <div class="ops-kpi">
 <div class="ops-kpi-num success">{{ fmtPct(ops.conversionRate.value) }}</div>
 <div class="ops-kpi-label">付费转化率</div>
 </div>
 <div class="ops-card ops-card-list ops-card-wide">
 <h3 class="ops-h3">头部项目 TOP10</h3>
 <ol class="ops-top">
 <li v-for="(p, i) in ops.topProjects.value" :key="p.id">
 <span class="ops-top-rank">{{ i +1 }}</span>
 <span class="ops-top-name">{{ p.name }}</span>
 <span class="ops-top-shots">{{ p.shots }} shots</span>
 <span class="ops-top-rev">{{ fmtMoney(p.revenue) }}</span>
 </li>
 </ol>
 </div>
 </div>
 </section>

 <!-- 模块3：收入运营 -->
 <section class="ops-module">
 <header class="ops-module-head">
 <span class="ops-module-icon">💰</span>
 <h2 class="ops-module-title">收入运营</h2>
 <span class="ops-module-tag">4 数据点</span>
 </header>
 <div class="ops-module-body">
 <div class="ops-card ops-card-wide">
 <h3 class="ops-h3">GMV折线</h3>
 <div class="ops-chart tall">
 <div
 v-for="(p, i) in ops.gmv.value.slice(-21)"
 :key="i"
 class="ops-bar rev"
 :style="{ height: ((p.value / maxVal(ops.gmv.value)) *100) + '%' }"
 :title="p.date + ' · ' + fmtMoney(p.value)"
 />
 </div>
 <div class="ops-chart-foot">最近：{{ fmtMoney(ops.gmv.value.at(-1)?.value ??0) }}</div>
 </div>
 <div class="ops-card">
 <h3 class="ops-h3">订阅分饼</h3>
 <div class="ops-pie">
 <div v-for="s in ops.subscriptions.value" :key="s.plan" class="ops-pie-row">
 <span class="ops-pie-dot" :style="{ background: pieColor(s.plan) }" />
 <span class="ops-pie-plan">{{ s.plan }}</span>
 <span class="ops-pie-count">{{ s.count }}</span>
 <span class="ops-pie-pct">{{ subPct(s.count) }}</span>
 </div>
 </div>
 </div>
 <div class="ops-card">
 <h3 class="ops-h3">ARPU</h3>
 <div class="ops-kpi-num accent big">¥{{ ops.arpu.value.toFixed(1) }}</div>
 <div class="ops-kpi-label">每用户平均收入</div>
 </div>
 <div class="ops-card">
 <h3 class="ops-h3">退款率</h3>
 <div class="ops-kpi-num warn big">{{ fmtPct(ops.refundRate.value) }}</div>
 <div class="ops-kpi-label">7 天滚动</div>
 </div>
 </div>
 </section>

 <!-- 模块4：工单运营 -->
 <section class="ops-module">
 <header class="ops-module-head">
 <span class="ops-module-icon">🎫</span>
 <h2 class="ops-module-title">工单运营</h2>
 <span class="ops-module-tag">4 数据点</span>
 </header>
 <div class="ops-module-body">
 <div class="ops-kpi">
 <div class="ops-kpi-num warn">{{ ops.ticketsPending.value }}</div>
 <div class="ops-kpi-label">未处理工单</div>
 </div>
 <div class="ops-kpi">
 <div class="ops-kpi-num accent">{{ ops.avgResponseMin.value.toFixed(1) }}m</div>
 <div class="ops-kpi-label">平均响应时间</div>
 </div>
 <div class="ops-kpi">
 <div class="ops-kpi-num success">{{ fmtPct(ops.satisfaction.value) }}</div>
 <div class="ops-kpi-label">满意度</div>
 </div>
 <div class="ops-card ops-card-wide">
 <h3 class="ops-h3">紧急工单</h3>
 <table class="ops-table">
 <thead><tr><th>P</th><th>标题</th><th>用户</th><th>提交</th></tr></thead>
 <tbody>
 <tr v-for="t in ops.urgentTickets.value" :key="t.id">
 <td><span class="ops-pri" :class="'p-' + t.priority.toLowerCase()">{{ t.priority }}</span></td>
 <td>{{ t.title }}</td><td>{{ t.user }}</td>
 <td>{{ relTime(t.createdAt) }}</td>
 </tr>
 </tbody>
 </table>
 </div>
 </div>
 </section>

 <div v-if="ops.error.value" class="ops-error">⚠️ {{ ops.error.value }}（已回退 mock）</div>
 </div>
</template>

<style scoped>
.ops { display: flex; flex-direction: column; gap:24px; }

/* toolbar */
.ops-toolbar {
 display: flex; align-items: center; justify-content: space-between;
 gap:12px; padding:12px16px;
 background: var(--bg-secondary);
 border:1px solid var(--border);
 border-radius:10px;
}
.ops-range { display: flex; align-items: center; gap:6px; flex-wrap: wrap; }
.ops-toolbar-label { font-size:13px; color: var(--text-secondary); margin-right:4px; }
.ops-range-btn {
 padding:6px12px; border-radius:6px;
 background: var(--bg-primary);
 border:1px solid var(--border);
 color: var(--text-secondary); font-size:13px; cursor: pointer;
 transition: all150ms;
}
.ops-range-btn:hover { color: var(--text-primary); border-color: var(--accent); }
.ops-range-btn.active {
 background: linear-gradient(135deg, #3b82f60%, #8b5cf6100%);
 color: #fff; border-color: transparent;
}
.ops-toolbar-right { display: flex; align-items: center; gap:8px; }
.ops-ts { font-size:12px; color: var(--text-secondary); }
.ops-refresh-btn {
 padding:6px10px; border-radius:6px;
 background: var(--bg-primary);
 border:1px solid var(--border);
 color: var(--text-secondary); font-size:12px; cursor: pointer;
}
.ops-refresh-btn.on { color: #10b981; border-color: #10b981; }
.ops-refresh-btn:hover { color: var(--text-primary); }

.ops-loading { padding:40px; text-align: center; opacity:0.6; }
.ops-error {
 padding:10px14px; border-radius:8px;
 background: rgba(245,158,11,0.1);
 border:1px solid var(--warning); color: var(--warning);
 font-size:13px;
}

/* module */
.ops-module {
 display: flex; flex-direction: column; gap:12px;
 background: var(--bg-secondary);
 border:1px solid var(--border);
 border-radius:14px;
 padding:18px20px;
 background-image: linear-gradient(135deg, rgba(59,130,246,0.04)0%, rgba(139,92,246,0.04)100%);
}
.ops-module-head { display: flex; align-items: center; gap:10px; }
.ops-module-icon { font-size:20px; }
.ops-module-title { font-size:16px; font-weight:600; margin:0; flex:1; }
.ops-module-tag {
 font-size:11px; padding:3px10px; border-radius:999px;
 background: var(--bg-primary); border:1px solid var(--border); color: var(--text-secondary);
}

.ops-module-body {
 display: grid; gap:14px;
 grid-template-columns: repeat(3, minmax(0,1fr));
}
@media (max-width:900px) { .ops-module-body { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width:560px) { .ops-module-body { grid-template-columns:1fr; } }

.ops-card {
 background: var(--bg-primary);
 border:1px solid var(--border);
 border-radius:10px;
 padding:14px16px;
 display: flex; flex-direction: column; gap:10px;
 min-height:140px;
}
.ops-card-wide { grid-column:1 / -1; }

.ops-h3 { font-size:13px; font-weight:600; color: var(--text-secondary); margin:0; text-transform: uppercase; letter-spacing:0.4px; }

/* KPI */
.ops-kpi {
 background: var(--bg-primary);
 border:1px solid var(--border);
 border-radius:10px;
 padding:16px18px;
 display: flex; flex-direction: column; gap:4px;
}
.ops-kpi-num { font-size:26px; font-weight:700; }
.ops-kpi-num.accent { background: linear-gradient(135deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; background-clip: text; color: transparent; }
.ops-kpi-num.success { color: #10b981; }
.ops-kpi-num.warn { color: #f59e0b; }
.ops-kpi-num.big { font-size:32px; }
.ops-kpi-label { font-size:12px; color: var(--text-secondary); }

/* chart */
.ops-chart {
 flex:1;
 display: flex; align-items: flex-end; gap:4px;
 height:80px;
 padding:6px0;
}
.ops-chart.tall { height:110px; }
.ops-bar {
 flex:1; min-width:6px; min-height:4px;
 background: linear-gradient(180deg, #3b82f6, #8b5cf6);
 border-radius:3px3px00;
 transition: opacity150ms;
}
.ops-bar:hover { opacity:0.7; }
.ops-bar.mau { background: linear-gradient(180deg, #06b6d4, #3b82f6); }
.ops-bar.rev { background: linear-gradient(180deg, #10b981, #06b6d4); }
.ops-chart-foot { font-size:11px; color: var(--text-secondary); }

/* stack */
.ops-stack { display: flex; flex-direction: column; gap:10px; padding:6px0; }
.ops-stack-row { display: flex; align-items: center; justify-content: space-between; }
.ops-stack-label { font-size:13px; color: var(--text-secondary); }
.ops-stack-val { font-size:20px; font-weight:700; }
.ops-stack-val.up { color: #10b981; }
.ops-stack-val.down { color: #ef4444; }

/* table */
.ops-table { width:100%; border-collapse: collapse; font-size:13px; }
.ops-table th, .ops-table td {
 padding:8px10px; text-align: left;
 border-bottom:1px solid var(--border);
}
.ops-table th { color: var(--text-secondary); font-weight:500; font-size:12px; }
.ops-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; }

/* top list */
.ops-top { list-style: none; margin:0; padding:0; display: flex; flex-direction: column; gap:4px; }
.ops-top li {
 display: grid;
 grid-template-columns:24px1fr100px110px;
 align-items: center; gap:10px;
 padding:8px6px; border-radius:6px;
 font-size:13px;
}
.ops-top li:hover { background: var(--bg-secondary); }
.ops-top-rank {
 width:22px; height:22px; border-radius:50%;
 background: var(--bg-secondary); color: var(--text-secondary);
 display: grid; place-items: center; font-size:11px; font-weight:600;
}
.ops-top li:nth-child(1) .ops-top-rank { background: linear-gradient(135deg, #f59e0b, #ef4444); color: #fff; }
.ops-top-name { font-weight:500; }
.ops-top-shots { font-size:12px; color: var(--text-secondary); text-align: right; }
.ops-top-rev { font-weight:600; color: var(--accent); text-align: right; }

/* pie */
.ops-pie { display: flex; flex-direction: column; gap:8px; }
.ops-pie-row {
 display: grid; grid-template-columns:12px1fr auto auto;
 align-items: center; gap:8px;
 font-size:13px; padding:4px0;
}
.ops-pie-dot { width:10px; height:10px; border-radius:50%; }
.ops-pie-plan { font-weight:500; }
.ops-pie-count { color: var(--text-secondary); }
.ops-pie-pct { font-weight:600; color: var(--accent); }

/* priority badge */
.ops-pri {
 font-size:10px; padding:2px6px; border-radius:4px; font-weight:600;
}
.ops-pri.p-p0 { background: rgba(239,68,68,0.2); color: #ef4444; }
.ops-pri.p-p1 { background: rgba(245,158,11,0.2); color: #f59e0b; }
.ops-pri.p-p2 { background: rgba(59,130,246,0.2); color: #3b82f6; }
</style>
