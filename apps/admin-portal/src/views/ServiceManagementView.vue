<script setup lang="ts">
/**
 * ServiceManagementView — 服务管理
 * 对接 /ops/health + /ops/status 真实后端
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getApi } from '../api-bridge'

const http = () => getApi().http

interface ServiceEntry {
  name: string
  displayName: string
  port: number
  status: 'running' | 'degraded' | 'down'
  uptime: string
  cpu: number
  memory: number
  version: string
}

const loading = ref(true)
const services = ref<ServiceEntry[]>([])
const refreshTimer = ref<ReturnType<typeof setInterval> | null>(null)

const DISPLAY_NAMES: Record<string, string> = {
  'user-service': '用户服务',
  'project-service': '项目服务',
  'collab-service': '协作服务',
  'billing-service': '计费服务',
  'ai-orchestrator': 'AI 编排服务',
  'api-gateway': 'API 网关',
  'auth-service': '认证服务',
  'storage-service': '存储服务',
  'notification-service': '通知服务',
  'search-service': '搜索服务',
  'music-generation-service': '音乐生成服务',
  'analytics-service': '数据分析服务',
}

const PORTS: Record<string, number> = {
  'user-service': 8088,
  'project-service': 8089,
  'collab-service': 8091,
  'billing-service': 8090,
  'ai-orchestrator': 8087,
}

async function loadServices() {
  try {
    const [health, status, metrics] = await Promise.allSettled([
      http().get('/ops/health') as Promise<any>,
      http().get('/ops/status') as Promise<any>,
      http().get('/ops/metrics') as Promise<any>,
    ])

    const healthData = health.status === 'fulfilled' ? health.value : {}
    const statusData = status.status === 'fulfilled' ? status.value : {}
    const metricsData = metrics.status === 'fulfilled' ? metrics.value : {}

    const healthServices = healthData?.services || []
    const statusServices = statusData?.services || []

    // Merge data from all sources
    const serviceMap = new Map<string, ServiceEntry>()

    for (const s of healthServices) {
      const name = s.service || s.name || ''
      serviceMap.set(name, {
        name,
        displayName: DISPLAY_NAMES[name] || name,
        port: PORTS[name] || 0,
        status: s.up ? 'running' : 'down',
        uptime: '—',
        cpu: 0,
        memory: 0,
        version: '—',
      })
    }

    for (const s of statusServices) {
      const name = s.service || s.name || ''
      const existing = serviceMap.get(name)
      if (existing) {
        existing.status = s.up ? 'running' : 'down'
      } else {
        serviceMap.set(name, {
          name,
          displayName: DISPLAY_NAMES[name] || name,
          port: PORTS[name] || 0,
          status: s.up ? 'running' : 'down',
          uptime: '—',
          cpu: 0,
          memory: 0,
          version: '—',
        })
      }
    }

    // Add metrics if available
    if (metricsData && typeof metricsData === 'object') {
      for (const [name, m] of Object.entries(metricsData)) {
        const entry = serviceMap.get(name)
        if (entry && m && typeof m === 'object') {
          const mm = m as any
          entry.cpu = mm.cpu_percent || mm.cpu || 0
          entry.memory = mm.memory_percent || mm.memory || 0
        }
      }
    }

    services.value = Array.from(serviceMap.values())
  } catch {
    services.value = []
  }
  loading.value = false
}

onMounted(() => {
  loadServices()
  refreshTimer.value = setInterval(() => { loadServices() }, 15000)
})

onUnmounted(() => {
  if (refreshTimer.value) clearInterval(refreshTimer.value)
})

const statusMap = {
  running: { label: '运行中', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  degraded: { label: '性能降级', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  down: { label: '已停止', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
}

const runningCount = computed(() => services.value.filter(s => s.status === 'running').length)
const degradedCount = computed(() => services.value.filter(s => s.status === 'degraded').length)
const downCount = computed(() => services.value.filter(s => s.status === 'down').length)

function cpuColor(v: number): string {
  if (v > 80) return '#ef4444'
  if (v > 60) return '#f59e0b'
  return '#10b981'
}

function memColor(v: number): string {
  if (v > 80) return '#ef4444'
  if (v > 60) return '#f59e0b'
  return '#3b82f6'
}
</script>

<template>
  <div class="svc">
    <!-- 概览 KPI -->
    <div class="svc-summary">
      <div class="svc-kpi">
        <div class="svc-kpi-num">{{ services.length }}</div>
        <div class="svc-kpi-label">服务总数</div>
      </div>
      <div class="svc-kpi">
        <div class="svc-kpi-num success">{{ runningCount }}</div>
        <div class="svc-kpi-label">运行中</div>
      </div>
      <div class="svc-kpi">
        <div class="svc-kpi-num warn">{{ degradedCount }}</div>
        <div class="svc-kpi-label">性能降级</div>
      </div>
      <div class="svc-kpi">
        <div class="svc-kpi-num danger">{{ downCount }}</div>
        <div class="svc-kpi-label">已停止</div>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="svc-loading">服务状态加载中...</div>

    <!-- 服务列表 -->
    <div v-else class="svc-grid">
      <div v-for="s in services" :key="s.name" class="svc-card" :class="{ 'svc-card--down': s.status === 'down' }">
        <div class="svc-card-head">
          <div class="svc-card-name">{{ s.displayName }}</div>
          <span class="svc-badge" :style="{ color: statusMap[s.status].color, background: statusMap[s.status].bg }">
            {{ statusMap[s.status].label }}
          </span>
        </div>
        <div class="svc-card-meta">
          <span class="svc-meta-item">{{ s.name }}</span>
          <span class="svc-meta-item">:{{ s.port }}</span>
          <span class="svc-meta-item">v{{ s.version }}</span>
        </div>

        <div class="svc-card-stats">
          <div class="svc-stat">
            <span class="svc-stat-label">运行时间</span>
            <span class="svc-stat-val">{{ s.uptime }}</span>
          </div>
          <div class="svc-stat">
            <span class="svc-stat-label">CPU</span>
            <div class="svc-bar-wrap">
              <div class="svc-bar" :style="{ width: s.cpu + '%', background: cpuColor(s.cpu) }" />
            </div>
            <span class="svc-stat-pct" :style="{ color: cpuColor(s.cpu) }">{{ s.cpu.toFixed(1) }}%</span>
          </div>
          <div class="svc-stat">
            <span class="svc-stat-label">内存</span>
            <div class="svc-bar-wrap">
              <div class="svc-bar" :style="{ width: s.memory + '%', background: memColor(s.memory) }" />
            </div>
            <span class="svc-stat-pct" :style="{ color: memColor(s.memory) }">{{ s.memory.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.svc { display: flex; flex-direction: column; gap: 20px; }

/* Summary KPIs */
.svc-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.svc-kpi {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.svc-kpi-num { font-size: 28px; font-weight: 700; }
.svc-kpi-num.success { color: #10b981; }
.svc-kpi-num.warn { color: #f59e0b; }
.svc-kpi-num.danger { color: #ef4444; }
.svc-kpi-label { font-size: 12px; color: var(--text-secondary); }

/* Loading */
.svc-loading { padding: 40px; text-align: center; opacity: 0.6; }

/* Grid */
.svc-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
@media (max-width: 1100px) { .svc-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .svc-grid { grid-template-columns: 1fr; } .svc-summary { grid-template-columns: repeat(2, 1fr); } }

/* Card */
.svc-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 200ms;
}
.svc-card:hover { border-color: var(--accent); }
.svc-card--down { border-color: rgba(239, 68, 68, 0.3); opacity: 0.85; }

.svc-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.svc-card-name { font-size: 15px; font-weight: 600; }

.svc-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
}

.svc-card-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.svc-meta-item {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--bg-primary);
  padding: 2px 8px;
  border-radius: 4px;
}

/* Stats */
.svc-card-stats { display: flex; flex-direction: column; gap: 8px; }
.svc-stat {
  display: grid;
  grid-template-columns: 56px 1fr 48px;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.svc-stat-label { color: var(--text-secondary); font-size: 12px; }
.svc-stat-val { font-weight: 500; grid-column: 2 / -1; }

.svc-bar-wrap {
  height: 6px;
  background: var(--bg-primary);
  border-radius: 3px;
  overflow: hidden;
}
.svc-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 500ms ease;
}
.svc-stat-pct {
  font-size: 12px;
  font-weight: 600;
  text-align: right;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
