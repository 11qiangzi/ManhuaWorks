<script setup lang="ts">
/**
 * OpsLogsView.vue — 运维日志 (1:1 复刻 ops-logs.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref } from 'vue'

const searchQuery = ref('')
const levelFilter = ref('全部级别')
const logs = ref([
  { time: '13:02:45', level: 'INFO', msg: '[k8s] Pod user-service-7d8f9 ready — 3/3 replicas healthy', color: '#60a5fa' },
  { time: '13:02:30', level: 'INFO', msg: '[monitor] CPU usage spike on worker-02 — 82% avg (threshold 80%)', color: '#60a5fa' },
  { time: '13:02:15', level: 'WARN', msg: '[redis] Connection pool exhausted — 128/128 connections active', color: '#fbbf24' },
  { time: '13:01:50', level: 'INFO', msg: '[cron] Daily backup completed — 1.2GB, took 8s', color: '#60a5fa' },
  { time: '13:01:20', level: 'ERROR', msg: '[image-gen] GPU node gpu-worker-03 OOM — restarted process', color: '#fca5a5' },
  { time: '13:00:45', level: 'INFO', msg: '[nginx] Rate limit trigger on ip=203.0.113.5 — 156 req/s', color: '#60a5fa' },
  { time: '12:59:00', level: 'INFO', msg: '[docker] Container user-service healthy — uptime 2h 14m', color: '#60a5fa' },
])

const refreshing = ref(false); const refreshError = ref('')
async function refresh() {
  refreshing.value = true; refreshError.value = ''
  try {
    const token = localStorage.getItem('mhw.access_token') || ''
    const r = await fetch('/api/v1/ops/logs', { headers: { Authorization: 'Bearer ' + token } })
    if (r.ok) { const d = await r.json(); if (d.data?.items) { logs.value = d.data.items.map((l: any) => ({ time: new Date(l.created_at).toLocaleTimeString('zh-CN',{hour12:false}), level: l.level || 'INFO', msg: l.message || '', color: l.level === 'ERROR' ? '#fca5a5' : l.level === 'WARN' ? '#fbbf24' : '#60a5fa' })) } }
  } catch (err: any) { refreshError.value = err.message || '刷新失败' }
  finally { refreshing.value = false }
}
</script>

<template>
  <div class="ops-logs">
    <div class="ol-header">
      <div><span class="page-title">📋 运维日志</span><span class="ol-sub">实时日志 · 最近 200 条</span></div>
      <div class="ol-toolbar">
        <div class="search-box"><input class="input" v-model="searchQuery" placeholder="搜索日志…" style="width:220px;font-size:12px;padding:6px 10px"></div>
        <select class="input" v-model="levelFilter" style="width:100px;font-size:12px;padding:6px 10px"><option>全部级别</option><option>INFO</option><option>WARN</option><option>ERROR</option></select>
        <button class="btn btn-xs btn-secondary" @click="refresh">🔄 刷新</button>
      </div>
    </div>
    <div class="ol-stats">
      <div class="stat-card"><div class="stat-icon">📄</div><div class="stat-value">8,942</div><div class="stat-label">今日日志</div></div>
      <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-value" style="color:#fbbf24">18</div><div class="stat-label">WARN</div></div>
      <div class="stat-card"><div class="stat-icon">❌</div><div class="stat-value" style="color:#ef4444">3</div><div class="stat-label">ERROR</div></div>
    </div>
    <div class="ol-log-list">
      <div v-for="(log, i) in logs" :key="i" class="log-entry">
        <span class="log-time">{{ log.time }}</span>
        <span class="log-level" :class="`log-level--${log.level.toLowerCase()}`">{{ log.level }}</span>
        <span class="log-msg" v-html="highlightCode(log.msg)"></span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
function highlightCode(msg: string): string {
  return msg.replace(/`([^`]+)`/g, '<code>$1</code>')
}
</script>

<style scoped>
.ops-logs { flex: 1; padding: 20px 28px; overflow-y: auto; }
.ol-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.ol-sub { font-size: 12px; color: var(--text-muted, #64748b); margin-left: 8px; }
.ol-toolbar { display: flex; gap: 8px; }
.ol-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 16px; }
.stat-card { display: flex; flex-direction: column; gap: 4px; background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); padding: 18px 20px; }
.stat-icon { font-size: 24px; }
.stat-value { font-size: 28px; font-weight: 800; letter-spacing: -.02em; color: var(--text-primary, #e2e8f0); }
.stat-label { font-size: 12px; color: var(--text-secondary, #94a3b8); }
.ol-log-list { background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); padding: 12px 16px; }
.log-entry { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border, #1e293b); font-family: var(--font-mono, monospace); font-size: 11px; align-items: flex-start; }
.log-entry:last-child { border-bottom: none; }
.log-time { color: var(--text-muted, #64748b); flex-shrink: 0; width: 70px; }
.log-level { width: 44px; flex-shrink: 0; font-weight: 600; }
.log-level--info { color: #60a5fa; }
.log-level--warn { color: #fbbf24; }
.log-level--error { color: #fca5a5; }
.log-msg { flex: 1; color: var(--text-secondary, #94a3b8); }
.log-msg :deep(code) { background: var(--bg-tertiary, #1a2332); padding: 1px 4px; border-radius: 3px; color: #7ee787; }
.page-title { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--text-primary, #e2e8f0); }
.search-box { position: relative; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all .2s; }
.btn-xs { padding: 4px 8px; font-size: 11px; }
.btn-secondary { background: var(--bg-tertiary, #1a2332); color: var(--text-primary, #e2e8f0); border: 1px solid var(--border, #1e293b); }
.input { padding: 10px 14px; border-radius: 8px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 14px; outline: none; font-family: var(--font-sans); width: 100%; transition: border .2s; }
.input:focus { border-color: var(--accent, #818cf8); }
</style>
