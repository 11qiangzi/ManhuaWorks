<script setup lang="ts">
/**
 * ComplianceView —合规与审计 ·3 大模块
 * 千机工坊 · M1-W3 L3.K
 *
 *1) API Key审计 —所有用户的 BYOK key + 最近变更 +异常登录
 *2) 数据合规 —用户导出/删除 + GDPR/CCPA状态
 *3) 系统审计 —管理员操作日志 +登录失败 +权限变更
 */
import { onMounted } from 'vue'
import { useCompliance } from '@/composables/ops'

const cmp = useCompliance()
onMounted(() => cmp.load())

function relTime(iso: string): string {
 const diff = Date.now() - new Date(iso).getTime()
 const m = Math.floor(diff /60000)
 if (m <1) return '刚刚'
 if (m <60) return `${m} 分钟前`
 const h = Math.floor(m /60)
 if (h <24) return `${h} 小时前`
 return `${Math.floor(h /24)} 天前`
}

const keyStatusClass: Record<string, string> = {
 active: 'cmp-badge ok',
 rotated: 'cmp-badge info',
 revoked: 'cmp-badge mute',
 suspicious: 'cmp-badge err',
}
const dataStatusClass: Record<string, string> = {
 pending: 'cmp-badge warn',
 in_progress: 'cmp-badge info',
 completed: 'cmp-badge ok',
 failed: 'cmp-badge err',
}
const sysLevelClass: Record<string, string> = {
 info: 'cmp-dot info',
 warn: 'cmp-dot warn',
 error: 'cmp-dot err',
}
</script>

<template>
 <div class="cmp">
 <div v-if="cmp.loading.value && !cmp.snapshot.value" class="cmp-loading">合规数据加载中…</div>

 <!-- 总览 KPI -->
 <section class="cmp-kpi-row">
 <div class="cmp-kpi">
 <div class="cmp-kpi-num">{{ cmp.totals.value.byokCount }}</div>
 <div class="cmp-kpi-label">BYOK Keys</div>
 </div>
 <div class="cmp-kpi">
 <div class="cmp-kpi-num warn">{{ cmp.totals.value.exportRequests }}</div>
 <div class="cmp-kpi-label">导出请求</div>
 </div>
 <div class="cmp-kpi">
 <div class="cmp-kpi-num err">{{ cmp.totals.value.deleteRequests }}</div>
 <div class="cmp-kpi-label">删除请求</div>
 </div>
 <div class="cmp-kpi">
 <div class="cmp-kpi-num warn">{{ cmp.totals.value.gdprPending }}</div>
 <div class="cmp-kpi-label">GDPR 待处理</div>
 </div>
 <div class="cmp-kpi">
 <div class="cmp-kpi-num warn">{{ cmp.totals.value.ccpaPending }}</div>
 <div class="cmp-kpi-label">CCPA 待处理</div>
 </div>
 <div class="cmp-kpi">
 <div class="cmp-kpi-num err">{{ cmp.totals.value.loginFailures24h }}</div>
 <div class="cmp-kpi-label">登录失败(24h)</div>
 </div>
 <div class="cmp-kpi">
 <div class="cmp-kpi-num">{{ cmp.totals.value.permissionChanges }}</div>
 <div class="cmp-kpi-label">权限变更</div>
 </div>
 </section>

 <!-- 模块1：API Key审计 -->
 <section class="cmp-module">
 <header class="cmp-module-head">
 <span class="cmp-module-icon">🔑</span>
 <h2 class="cmp-module-title">API Key审计</h2>
 <span class="cmp-module-tag">所有用户 BYOK Key +变更 +异常</span>
 </header>
 <table class="cmp-table">
 <thead>
 <tr>
 <th>用户</th><th>Provider</th><th>状态</th><th>最近变更</th><th>IP</th><th>异常</th>
 </tr>
 </thead>
 <tbody>
 <tr v-for="k in cmp.apiKeys.value.slice(0,15)" :key="k.id">
 <td>
 <div class="cmp-user">
 <div class="cmp-user-name">{{ k.userName }}</div>
 <div class="cmp-user-id">{{ k.userId }}</div>
 </div>
 </td>
 <td><span class="cmp-provider">{{ k.provider }}</span></td>
 <td><span :class="keyStatusClass[k.status]">{{ k.status }}</span></td>
 <td>{{ relTime(k.lastChangedAt) }}</td>
 <td class="cmp-mono">{{ k.ip }}</td>
 <td>
 <span v-if="k.suspicious" class="cmp-badge err">⚠️异常</span>
 <span v-else class="cmp-badge mute">—</span>
 </td>
 </tr>
 </tbody>
 </table>
 </section>

 <!-- 模块2：数据合规 -->
 <section class="cmp-module">
 <header class="cmp-module-head">
 <span class="cmp-module-icon">🛡️</span>
 <h2 class="cmp-module-title">数据合规</h2>
 <span class="cmp-module-tag">用户数据请求 + GDPR/CCPA/PIPL/LGPD</span>
 </header>
 <table class="cmp-table">
 <thead>
 <tr>
 <th>用户</th><th>类型</th><th>框架</th><th>状态</th><th>提交时间</th>
 </tr>
 </thead>
 <tbody>
 <tr v-for="d in cmp.dataRequests.value.slice(0,15)" :key="d.id">
 <td>
 <div class="cmp-user">
 <div class="cmp-user-name">{{ d.userName }}</div>
 <div class="cmp-user-id">{{ d.userId }}</div>
 </div>
 </td>
 <td><span class="cmp-type">{{ d.type }}</span></td>
 <td><span class="cmp-framework">{{ d.framework }}</span></td>
 <td><span :class="dataStatusClass[d.status]">{{ d.status }}</span></td>
 <td>{{ relTime(d.requestedAt) }}</td>
 </tr>
 </tbody>
 </table>
 </section>

 <!-- 模块3：系统审计 -->
 <section class="cmp-module">
 <header class="cmp-module-head">
 <span class="cmp-module-icon">📜</span>
 <h2 class="cmp-module-title">系统审计</h2>
 <span class="cmp-module-tag">管理员操作 +登录失败 +权限变更</span>
 </header>
 <table class="cmp-table">
 <thead>
 <tr>
 <th>级别</th><th>操作</th><th>执行人</th><th>目标</th><th>IP</th><th>时间</th>
 </tr>
 </thead>
 <tbody>
 <tr v-for="s in cmp.systemAudits.value.slice(0,15)" :key="s.id">
 <td><span :class="sysLevelClass[s.level]">●</span> {{ s.level }}</td>
 <td><span class="cmp-action">{{ s.action }}</span></td>
 <td>{{ s.actor }}</td>
 <td class="cmp-mono">{{ s.target }}</td>
 <td class="cmp-mono">{{ s.ip }}</td>
 <td>{{ relTime(s.ts) }}</td>
 </tr>
 </tbody>
 </table>
 </section>

 <div v-if="cmp.error.value" class="cmp-error">⚠️ {{ cmp.error.value }}</div>
 </div>
</template>

<style scoped>
.cmp { display: flex; flex-direction: column; gap:20px; }
.cmp-loading { padding:40px; text-align: center; opacity:0.6; }
.cmp-error {
 padding:10px14px; border-radius:8px;
 background: rgba(245,158,11,0.1);
 border:1px solid var(--warning); color: var(--warning);
 font-size:13px;
}

/* KPI row */
.cmp-kpi-row {
 display: grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr));
 gap:12px;
}
.cmp-kpi {
 background: var(--bg-secondary);
 border:1px solid var(--border);
 border-radius:10px;
 padding:14px16px;
 display: flex; flex-direction: column; gap:4px;
}
.cmp-kpi-num { font-size:24px; font-weight:700; }
.cmp-kpi-num.warn { color: #f59e0b; }
.cmp-kpi-num.err { color: #ef4444; }
.cmp-kpi-label { font-size:12px; color: var(--text-secondary); }

/* module */
.cmp-module {
 display: flex; flex-direction: column; gap:12px;
 background: var(--bg-secondary);
 border:1px solid var(--border);
 border-radius:14px;
 padding:18px20px;
 background-image: linear-gradient(135deg, rgba(16,185,129,0.04)0%, rgba(59,130,246,0.04)100%);
}
.cmp-module-head { display: flex; align-items: center; gap:10px; }
.cmp-module-icon { font-size:20px; }
.cmp-module-title { font-size:16px; font-weight:600; margin:0; flex:1; }
.cmp-module-tag {
 font-size:11px; padding:3px10px; border-radius:999px;
 background: var(--bg-primary); border:1px solid var(--border); color: var(--text-secondary);
}

/* table */
.cmp-table { width:100%; border-collapse: collapse; font-size:13px; }
.cmp-table th, .cmp-table td {
 padding:10px12px; text-align: left;
 border-bottom:1px solid var(--border);
}
.cmp-table th { color: var(--text-secondary); font-weight:500; font-size:12px; }
.cmp-table tr:hover td { background: var(--bg-primary); }

.cmp-user { display: flex; flex-direction: column; gap:2px; }
.cmp-user-name { font-weight:500; }
.cmp-user-id { font-size:11px; color: var(--text-secondary); font-family: ui-monospace, monospace; }
.cmp-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; }
.cmp-provider, .cmp-type, .cmp-action, .cmp-framework {
 font-size:12px; padding:2px8px; border-radius:4px;
 background: var(--bg-primary); border:1px solid var(--border);
 font-family: ui-monospace, monospace;
}

/* badge */
.cmp-badge {
 font-size:11px; padding:3px8px; border-radius:999px;
 font-weight:500;
}
.cmp-badge.ok { background: rgba(16,185,129,0.15); color: #10b981; }
.cmp-badge.warn { background: rgba(245,158,11,0.15); color: #f59e0b; }
.cmp-badge.err { background: rgba(239,68,68,0.15); color: #ef4444; }
.cmp-badge.info { background: rgba(59,130,246,0.15); color: #3b82f6; }
.cmp-badge.mute { background: var(--bg-primary); color: var(--text-secondary); }

.cmp-dot { font-size:14px; margin-right:4px; }
.cmp-dot.info { color: #3b82f6; }
.cmp-dot.warn { color: #f59e0b; }
.cmp-dot.err { color: #ef4444; }
</style>
