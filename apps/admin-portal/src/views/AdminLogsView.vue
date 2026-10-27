<script setup lang="ts">
/**
 * AdminLogsView.vue — 系统日志
 */
import { ref, onMounted } from 'vue'
import { getApi } from '../api-bridge'

const http = () => getApi().http

const searchQuery = ref('')
const levelFilter = ref('全部级别')
const logs = ref<Array<{ time: string; level: string; msg: string; color: string }>>([])
const logStats = ref({ today: 0, warn: 0, error: 0 })

function mapLogItem(l: any) {
  const level = (l.level || 'INFO').toUpperCase()
  return {
    time: l.created_at ? new Date(l.created_at).toLocaleTimeString('zh-CN', { hour12: false }) : '',
    level,
    msg: `[${l.service || ''}] ${l.message || l.detail || ''}`,
    color: level === 'ERROR' ? '#fca5a5' : level === 'WARN' ? '#fbbf24' : '#60a5fa',
  }
}

async function loadLogs() {
  try {
    const res = await http().get('/admin/logs', { limit: 100 }) as any
    const items = res?.items || (Array.isArray(res) ? res : [])
    logs.value = items.map(mapLogItem)
    logStats.value = {
      today: res?.total || items.length,
      warn: items.filter((l: any) => (l.level || '').toUpperCase() === 'WARN').length,
      error: items.filter((l: any) => (l.level || '').toUpperCase() === 'ERROR').length,
    }
  } catch { /* keep empty */ }
}

onMounted(() => { loadLogs() })

const refreshing = ref(false); const refreshError = ref('')
async function refresh() {
  refreshing.value = true; refreshError.value = ''
  try { await loadLogs() }
  catch (err: any) { refreshError.value = err.message || '刷新失败' }
  finally { refreshing.value = false }
}
</script>

<template>
  <div class="admin-logs">
    <div class="al-header">
      <div><span class="page-title">📋 系统日志</span><span class="al-sub">最近 100 条 · 自动刷新</span></div>
      <div class="al-toolbar">
        <div class="search-box"><input class="input" v-model="searchQuery" placeholder="搜索日志…" style="width:200px;font-size:12px;padding:6px 10px"></div>
        <select class="input" v-model="levelFilter" style="width:100px;font-size:12px;padding:6px 10px"><option>全部级别</option><option>INFO</option><option>WARN</option><option>ERROR</option></select>
        <button class="btn btn-xs btn-secondary" @click="refresh">🔄 刷新</button>
      </div>
    </div>
    <div class="al-stats">
      <div class="stat-card"><div class="stat-icon">📄</div><div class="stat-value">{{ logStats.today.toLocaleString() }}</div><div class="stat-label">今日日志</div></div>
      <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-value" style="color:#fbbf24">{{ logStats.warn }}</div><div class="stat-label">WARN</div></div>
      <div class="stat-card"><div class="stat-icon">❌</div><div class="stat-value" style="color:#ef4444">{{ logStats.error }}</div><div class="stat-label">ERROR</div></div>
    </div>
    <div class="al-log-list">
      <div v-for="(log, i) in logs" :key="i" class="log-entry">
        <span class="log-time">{{ log.time }}</span>
        <span class="log-level" :class="`log-level--${log.level.toLowerCase()}`">{{ log.level }}</span>
        <span class="log-msg">{{ log.msg }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-logs { flex: 1; padding: 20px 28px; overflow-y: auto; }
.al-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.al-sub { font-size: 12px; color: var(--text-muted, #64748b); margin-left: 8px; }
.al-toolbar { display: flex; gap: 8px; }
.al-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 16px; }
.stat-card { display: flex; flex-direction: column; gap: 4px; background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); padding: 18px 20px; }
.stat-icon { font-size: 24px; }
.stat-value { font-size: 28px; font-weight: 800; letter-spacing: -.02em; color: var(--text-primary, #e2e8f0); }
.stat-label { font-size: 12px; color: var(--text-secondary, #94a3b8); }
.al-log-list { background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); padding: 12px 16px; }
.log-entry { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border, #1e293b); font-family: var(--font-mono, monospace); font-size: 11px; align-items: flex-start; }
.log-entry:last-child { border-bottom: none; }
.log-time { color: var(--text-muted, #64748b); flex-shrink: 0; width: 70px; }
.log-level { width: 44px; flex-shrink: 0; font-weight: 600; }
.log-level--info { color: #60a5fa; }
.log-level--warn { color: #fbbf24; }
.log-level--error { color: #fca5a5; }
.log-msg { flex: 1; color: var(--text-secondary, #94a3b8); white-space: pre-wrap; word-break: break-word; }
.page-title { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--text-primary, #e2e8f0); }
.search-box { position: relative; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all .2s; }
.btn-xs { padding: 4px 8px; font-size: 11px; }
.btn-secondary { background: var(--bg-tertiary, #1a2332); color: var(--text-primary, #e2e8f0); border: 1px solid var(--border, #1e293b); }
.input { padding: 10px 14px; border-radius: 8px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 14px; outline: none; font-family: var(--font-sans); width: 100%; transition: border .2s; }
.input:focus { border-color: var(--accent, #818cf8); }
</style>
