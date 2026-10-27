<script setup lang="ts">
/**
 * OpsLogsView.vue — 运维日志
 * 数据源: /api/v1/ops/logs
 */
import { ref, computed, onMounted } from 'vue'
import { fetchLogs } from '@/api/ops-api'

const searchQuery = ref('')
const levelFilter = ref('全部级别')
const logs = ref<{ time: string; level: string; msg: string; color: string }[]>([])
const loading = ref(true)
const error = ref('')

/* 动态统计 */
const todayCount = ref(0)
const warnCount = ref(0)
const errorCount = ref(0)

/* 客户端过滤 */
const filteredLogs = computed(() => {
  return logs.value.filter(l => {
    if (levelFilter.value !== '全部级别' && l.level !== levelFilter.value) return false
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      if (!l.msg.toLowerCase().includes(q) && !l.level.toLowerCase().includes(q)) return false
    }
    return true
  })
})

const refreshing = ref(false); const refreshError = ref('')

async function loadLogs() {
  refreshing.value = true; refreshError.value = ''
  try {
    const data = await fetchLogs(200, 0)
    if (data.items && data.items.length > 0) {
      logs.value = data.items.map((l: any) => ({
        time: l.time ?? new Date(l.created_at ?? l.createdAt).toLocaleTimeString('zh-CN', { hour12: false }),
        level: l.level || 'INFO',
        msg: l.msg ?? l.message ?? '',
        color: (l.level === 'ERROR') ? '#fca5a5' : (l.level === 'WARN') ? '#fbbf24' : '#60a5fa',
      }))
    }
    todayCount.value = data.todayCount ?? logs.value.length
    warnCount.value = data.warnCount ?? logs.value.filter(l => l.level === 'WARN').length
    errorCount.value = data.errorCount ?? logs.value.filter(l => l.level === 'ERROR').length
  } catch (err: any) {
    refreshError.value = err.message || '加载失败'
  } finally {
    refreshing.value = false
    loading.value = false
  }
}

async function refresh() {
  loading.value = true
  await loadLogs()
}

onMounted(async () => {
  await loadLogs()
})
</script>

<template>
  <div class="ops-logs">
    <div class="ol-header">
      <div><span class="page-title">📋 运维日志</span><span class="ol-sub">实时日志 · 数据源: API</span></div>
      <div class="ol-toolbar">
        <div class="search-box"><input class="input" v-model="searchQuery" placeholder="搜索日志…" style="width:220px;font-size:12px;padding:6px 10px"></div>
        <select class="input" v-model="levelFilter" style="width:100px;font-size:12px;padding:6px 10px"><option>全部级别</option><option>INFO</option><option>WARN</option><option>ERROR</option></select>
        <button class="btn btn-xs btn-secondary" @click="refresh">🔄 刷新</button>
      </div>
    </div>

    <p v-if="refreshError" class="ol-error">⚠️ {{ refreshError }}</p>

    <div class="ol-stats">
      <div class="stat-card"><div class="stat-icon">📄</div><div class="stat-value">{{ todayCount.toLocaleString() }}</div><div class="stat-label">今日日志</div></div>
      <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-value" style="color:#fbbf24">{{ warnCount }}</div><div class="stat-label">WARN</div></div>
      <div class="stat-card"><div class="stat-icon">❌</div><div class="stat-value" style="color:#ef4444">{{ errorCount }}</div><div class="stat-label">ERROR</div></div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading && logs.length === 0" class="ol-log-list">
      <div v-for="i in 7" :key="i" class="log-entry" style="opacity:0.4">
        <span class="log-time">--:--:--</span>
        <span class="log-level">…</span>
        <span class="log-msg">加载中…</span>
      </div>
    </div>

    <!-- 日志列表 -->
    <div v-else class="ol-log-list">
      <template v-for="(log, i) in filteredLogs" :key="i">
        <div class="log-entry">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-level" :class="`log-level--${log.level.toLowerCase()}`">{{ log.level }}</span>
          <span class="log-msg" v-html="highlightCode(log.msg)"></span>
        </div>
      </template>
      <p v-if="filteredLogs.length === 0" style="color:#6b7280;text-align:center;padding:24px;font-size:12px;">无匹配日志</p>
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
.ol-error { color: #fbbf24; background: #3b2415; border: 1px solid #f59e0b; padding: 8px 12px; border-radius: 6px; font-size: 12px; margin: 0 0 12px; }
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
