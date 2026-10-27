<script setup lang="ts">
/**
 * MonitoringView · 监控大屏
 * 千机工坊 · M1-W4 · L4-B
 *
 * 模块:
 *   1. 服务健康状态 (5 服务)
 *   2. CPU/内存/磁盘 资源占用
 *   3. 请求 QPS / 延迟
 *   4. 告警列表
 *
 * 数据源: /api/v1/ops/health + /api/v1/ops/metrics/live + /api/v1/ops/alerts
 */
import { ref, computed, onMounted } from 'vue'
import { fetchHealth, fetchLiveMetrics, fetchAlerts } from '@/api/ops-api'
import type { HealthEntry, SystemMetrics, Alert } from '@/api/ops-api'

const loading = ref(true)
const error = ref('')

const healthEntries = ref<HealthEntry[]>([])
const metrics = ref<SystemMetrics>({})
const alerts = ref<Alert[]>([])

/* 资源卡片计算 */
const resources = computed(() => {
  const m = metrics.value
  return [
    {
      label: 'CPU',
      percent: m.cpu?.percent ?? 0,
      detail: `${m.cpu?.used ?? 0}/${m.cpu?.total ?? 0} ${m.cpu?.unit ?? '核'}`,
      cssClass: 'resource-fill--cpu',
    },
    {
      label: '内存',
      percent: m.memory?.percent ?? 0,
      detail: `${m.memory?.used ?? 0}/${m.memory?.total ?? 0} ${m.memory?.unit ?? 'GB'}`,
      cssClass: 'resource-fill--mem',
    },
    {
      label: '磁盘',
      percent: m.disk?.percent ?? 0,
      detail: `${m.disk?.used ?? 0}/${m.disk?.total ?? 0} ${m.disk?.unit ?? 'GB'}`,
      cssClass: 'resource-fill--disk',
    },
  ]
})

function healthCardClass(h: HealthEntry): string {
  if (h.status === 'ok' || h.status === 'healthy') return 'health-card health-card--ok'
  if (h.status === 'warn' || h.status === 'degraded' || h.depsDown) return 'health-card health-card--warn'
  return 'health-card health-card--error'
}

function healthDot(h: HealthEntry): string {
  if (h.status === 'ok' || h.status === 'healthy') return '🟢'
  if (h.status === 'warn' || h.status === 'degraded' || h.depsDown) return '🟡'
  return '🔴'
}

function healthMeta(h: HealthEntry): string {
  const parts: string[] = []
  if (h.port) parts.push(`:${h.port}`)
  if (h.latencyMs !== undefined) parts.push(`${h.latencyMs}ms`)
  if (h.depsDown) parts.push('deps down')
  if (h.message) parts.push(h.message)
  return parts.join(' · ') || 'unknown'
}

function fmtChange(val: number | undefined): string {
  if (val === undefined || val === null) return ''
  const arrow = val >= 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(val)}% vs 1h ago`
}

onMounted(async () => {
  try {
    const [hlth, mtrcs, alrts] = await Promise.all([
      fetchHealth().catch(() => [] as HealthEntry[]),
      fetchLiveMetrics().catch(() => ({} as SystemMetrics)),
      fetchAlerts(10).catch(() => [] as Alert[]),
    ])
    healthEntries.value = hlth
    metrics.value = mtrcs
    alerts.value = alrts
  } catch (e: any) {
    error.value = e?.message ?? '监控数据加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="monitoring">
    <div class="monitoring-header">
      <h1 class="monitoring-title">📡 系统监控</h1>
      <span class="monitoring-tag">实时</span>
    </div>

    <!-- 骨架屏 -->
    <div v-if="loading" class="skeleton-grid">
      <div class="skeleton-card">
        <div class="skeleton-bar skeleton-bar--title" />
        <div class="skeleton-bar skeleton-bar--value" />
        <div class="skeleton-bar skeleton-bar--desc" />
      </div>
      <div class="skeleton-card">
        <div class="skeleton-bar skeleton-bar--title" />
        <div class="skeleton-bar skeleton-bar--value" />
        <div class="skeleton-bar skeleton-bar--desc" />
      </div>
      <div class="skeleton-card">
        <div class="skeleton-bar skeleton-bar--title" />
        <div class="skeleton-bar skeleton-bar--value" />
        <div class="skeleton-bar skeleton-bar--desc" />
      </div>
      <div class="skeleton-card">
        <div class="skeleton-bar skeleton-bar--title" />
        <div class="skeleton-bar skeleton-bar--value" />
        <div class="skeleton-bar skeleton-bar--desc" />
      </div>
      <div class="skeleton-card">
        <div class="skeleton-bar skeleton-bar--title" />
        <div class="skeleton-bar skeleton-bar--value" />
        <div class="skeleton-bar skeleton-bar--desc" />
      </div>
      <div class="skeleton-card skeleton-card--wide">
        <div class="skeleton-bar skeleton-bar--title" />
        <div class="skeleton-chart" />
      </div>
      <div class="skeleton-card skeleton-card--wide">
        <div class="skeleton-bar skeleton-bar--title" />
        <div class="skeleton-chart" />
      </div>
    </div>

    <!-- 真实内容 -->
    <div v-else>
      <p v-if="error" class="monitoring-error">⚠️ {{ error }}</p>

      <!-- 服务健康 -->
      <section class="monitoring-section">
        <h2 class="monitoring-h2">服务健康</h2>
        <div class="health-grid">
          <div v-for="h in healthEntries" :key="h.name" :class="healthCardClass(h)">
            <span class="health-dot">{{ healthDot(h) }}</span>
            <strong>{{ h.name }}</strong>
            <span class="health-meta">{{ healthMeta(h) }}</span>
          </div>
          <div v-if="healthEntries.length === 0" class="empty-state">
            <p>暂无健康检查数据</p>
          </div>
        </div>
      </section>

      <!-- 资源占用 -->
      <section class="monitoring-section">
        <h2 class="monitoring-h2">资源占用</h2>
        <div class="resource-grid">
          <div v-for="r in resources" :key="r.label" class="resource-card">
            <div class="resource-head">
              <span>{{ r.label }}</span>
              <span class="resource-value">{{ r.percent }}%</span>
            </div>
            <div class="resource-bar">
              <div :class="['resource-fill', r.cssClass]" :style="{ width: r.percent + '%' }" />
            </div>
            <span class="resource-meta">{{ r.detail }}</span>
          </div>
        </div>
      </section>

      <!-- 请求指标 -->
      <section class="monitoring-section">
        <h2 class="monitoring-h2">请求指标</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <strong>QPS</strong>
            <span class="metric-value">{{ metrics.qps ?? 0 }}</span>
            <span class="metric-meta">{{ fmtChange(metrics.qpsChange) }}</span>
          </div>
          <div class="metric-card">
            <strong>P50 延迟</strong>
            <span class="metric-value">{{ metrics.p50Latency ?? 0 }}ms</span>
            <span class="metric-meta">{{ fmtChange(metrics.p50Change) }}</span>
          </div>
          <div class="metric-card">
            <strong>P99 延迟</strong>
            <span class="metric-value">{{ metrics.p99Latency ?? 0 }}ms</span>
            <span class="metric-meta">{{ fmtChange(metrics.p99Change) }}</span>
          </div>
        </div>
      </section>

      <!-- 告警列表 -->
      <section v-if="alerts.length > 0" class="monitoring-section">
        <h2 class="monitoring-h2">最近告警</h2>
        <div class="alerts-list">
          <div v-for="a in alerts" :key="a.id" class="alert-card" :class="`alert-card--${a.severity ?? 'info'}`">
            <span class="alert-severity">{{ a.severity ?? 'INFO' }}</span>
            <span class="alert-msg">{{ a.message }}</span>
            <span class="alert-time">{{ a.createdAt ? new Date(a.createdAt).toLocaleString('zh-CN') : '' }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.monitoring {
  padding: 24px;
  color: var(--text-primary);
}

.monitoring-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.monitoring-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.monitoring-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  font-weight: 600;
}

/* ===== 骨架屏 ===== */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.skeleton-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-card--wide {
  grid-column: span 2;
}

.skeleton-bar {
  height: 14px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--bg-primary) 0%, var(--border) 50%, var(--bg-primary) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-bar--title {
  width: 40%;
  height: 12px;
}

.skeleton-bar--value {
  width: 65%;
  height: 20px;
}

.skeleton-bar--desc {
  width: 80%;
  height: 10px;
}

.skeleton-chart {
  height: 120px;
  border-radius: 8px;
  background: linear-gradient(90deg, var(--bg-primary) 0%, var(--border) 50%, var(--bg-primary) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ===== 真实内容 ===== */
.monitoring-error {
  color: #fbbf24;
  background: #3b2415;
  border: 1px solid #f59e0b;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  margin: 0 0 16px;
}

.monitoring-section {
  margin-bottom: 28px;
}

.monitoring-h2 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 12px;
}

/* 健康状态 */
.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.health-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  font-size: 13px;
}

.health-dot {
  font-size: 12px;
}

.health-meta {
  color: var(--text-secondary);
  font-size: 12px;
  margin-left: auto;
}

.health-card--ok { border-color: color-mix(in srgb, #10b981 40%, transparent); }
.health-card--warn { border-color: color-mix(in srgb, #f59e0b 40%, transparent); }
.health-card--error { border-color: color-mix(in srgb, #ef4444 40%, transparent); }

/* 告警 */
.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  font-size: 13px;
}

.alert-severity {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  flex-shrink: 0;
}

.alert-card--critical .alert-severity,
.alert-card--error .alert-severity {
  background: color-mix(in srgb, #ef4444 15%, transparent);
  color: #ef4444;
}

.alert-card--warn .alert-severity {
  background: color-mix(in srgb, #f59e0b 15%, transparent);
  color: #f59e0b;
}

.alert-msg { flex: 1; }

.alert-time {
  color: var(--text-secondary);
  font-size: 11px;
  flex-shrink: 0;
}

/* 资源 */
.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.resource-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.resource-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.resource-value {
  font-weight: 700;
}

.resource-bar {
  height: 8px;
  border-radius: 4px;
  background: var(--bg-primary);
  overflow: hidden;
}

.resource-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 600ms ease;
}

.resource-fill--cpu { background: var(--accent); }
.resource-fill--mem { background: #f59e0b; }
.resource-fill--disk { background: #8b5cf6; }

.resource-meta {
  font-size: 11px;
  color: var(--text-secondary);
}

/* 指标 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.metric-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-card strong {
  font-size: 12px;
  color: var(--text-secondary);
}

.metric-value {
  font-size: 28px;
  font-weight: 800;
  color: var(--accent);
}

.metric-meta {
  font-size: 11px;
  color: var(--text-secondary);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-secondary);
  margin-top: 16px;
}

.empty-icon {
  font-size: 40px;
  display: block;
  margin-bottom: 12px;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.6;
}
</style>
