<script setup lang="ts">
/**
 * ServiceStatusView · 服务状态
 * 千机工坊 · 用户后台
 *
 * 功能：
 * 1. 所有服务状态指示（绿 / 黄 / 红）
 * 2. 运行时间、响应时间、最后检查时间
 * 3. 30 秒自动刷新
 * 4. 平台整体健康摘要
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  opsService,
  STATUS_META,
  formatUptime,
  formatResponseTime,
  formatLastCheck,
  type PlatformHealth,
  type ServiceStatus
} from '@/api/ops-service'

/* ------------------------------------------------------------------ */
/*                          状态                                       */
/* ------------------------------------------------------------------ */

const health = ref<PlatformHealth | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const lastRefresh = ref<string>('')
let refreshTimer: ReturnType<typeof setInterval> | null = null
const countdown = ref(30)
let countdownTimer: ReturnType<typeof setInterval> | null = null

/* ------------------------------------------------------------------ */
/*                          加载                                       */
/* ------------------------------------------------------------------ */

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    health.value = await opsService.getHealth()
    lastRefresh.value = new Date().toLocaleTimeString('zh-CN')
    countdown.value = 30
  } catch (e: any) {
    error.value = e?.message || '获取服务状态失败'
  } finally {
    loading.value = false
  }
}

function startAutoRefresh(): void {
  stopAutoRefresh()
  refreshTimer = setInterval(() => {
    load()
    countdown.value = 30
  }, 30000)
  countdownTimer = setInterval(() => {
    if (countdown.value > 0) countdown.value--
  }, 1000)
}

function stopAutoRefresh(): void {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
}

onMounted(() => {
  load()
  startAutoRefresh()
})

onUnmounted(stopAutoRefresh)

/* ------------------------------------------------------------------ */
/*                          衍生                                       */
/* ------------------------------------------------------------------ */

const overallStatus = computed<ServiceStatus>(() => health.value?.status ?? 'healthy')
const overallMeta = computed(() => STATUS_META[overallStatus.value])

const statusCounts = computed(() => {
  const c: Record<ServiceStatus, number> = { healthy: 0, degraded: 0, down: 0 }
  if (health.value) {
    for (const s of health.value.services) c[s.status]++
  }
  return c
})

const sortedServices = computed(() => {
  if (!health.value) return []
  const order: Record<ServiceStatus, number> = { down: 0, degraded: 1, healthy: 2 }
  return [...health.value.services].sort((a, b) => order[a.status] - order[b.status])
})

function manualRefresh(): void {
  load()
  countdown.value = 30
}
</script>

<template>
  <main class="ss">
    <!-- 头部 -->
    <section class="ss__header">
      <div>
        <h1 class="ss__title">📡 服务状态</h1>
        <p class="ss__sub">
          平台各服务实时运行状况
          <span v-if="lastRefresh" class="ss__refresh-info"> · 上次刷新 {{ lastRefresh }}</span>
        </p>
      </div>
      <div class="ss__header-actions">
        <span class="ss__countdown">{{ countdown }}s 后自动刷新</span>
        <button type="button" class="ss__btn ss__btn--ghost" :disabled="loading" @click="manualRefresh">
          {{ loading ? '刷新中…' : '🔄 立即刷新' }}
        </button>
      </div>
    </section>

    <!-- 加载中（首次） -->
    <section v-if="loading && !health" class="ss__state">
      <div class="ss__spinner"></div>
      <p>正在获取服务状态…</p>
    </section>

    <!-- 错误（无数据） -->
    <section v-else-if="error && !health" class="ss__state ss__state--error">
      <p>{{ error }}</p>
      <button type="button" class="ss__btn ss__btn--ghost" @click="load">重试</button>
    </section>

    <template v-else-if="health">
      <!-- 总体健康摘要 -->
      <section class="ss__summary" :style="{ borderColor: overallMeta.color }">
        <div class="ss__summary-indicator" :style="{ background: overallMeta.bg }">
          <span class="ss__pulse" :style="{ background: overallMeta.color }"></span>
        </div>
        <div class="ss__summary-info">
          <h2 class="ss__summary-status" :style="{ color: overallMeta.color }">
            {{ overallMeta.label }}
          </h2>
          <p class="ss__summary-msg">{{ health.message || '平台运行状态' }}</p>
        </div>
        <div class="ss__summary-stats">
          <div class="ss__stat">
            <span class="ss__stat-value" style="color: #10b981">{{ statusCounts.healthy }}</span>
            <span class="ss__stat-label">正常</span>
          </div>
          <div class="ss__stat">
            <span class="ss__stat-value" style="color: #f59e0b">{{ statusCounts.degraded }}</span>
            <span class="ss__stat-label">降级</span>
          </div>
          <div class="ss__stat">
            <span class="ss__stat-value" style="color: #ef4444">{{ statusCounts.down }}</span>
            <span class="ss__stat-label">故障</span>
          </div>
        </div>
      </section>

      <!-- 服务卡片列表 -->
      <section class="ss__grid">
        <article
          v-for="svc in sortedServices"
          :key="svc.name"
          class="ss__card"
        >
          <div class="ss__card-head">
            <div class="ss__card-status">
              <span class="ss__dot" :style="{ background: STATUS_META[svc.status].color }"></span>
              <span class="ss__card-status-label" :style="{ color: STATUS_META[svc.status].color }">
                {{ STATUS_META[svc.status].label }}
              </span>
            </div>
            <span v-if="svc.version" class="ss__card-version">v{{ svc.version }}</span>
          </div>

          <h3 class="ss__card-name">{{ svc.description || svc.name }}</h3>
          <p class="ss__card-id">{{ svc.name }}</p>

          <div class="ss__card-metrics">
            <div class="ss__metric">
              <span class="ss__metric-label">运行时间</span>
              <span class="ss__metric-value">{{ formatUptime(svc.uptime) }}</span>
            </div>
            <div class="ss__metric">
              <span class="ss__metric-label">响应时间</span>
              <span
                class="ss__metric-value"
                :class="{ 'ss__metric-value--warn': svc.responseTime > 200, 'ss__metric-value--bad': svc.responseTime > 1000 }"
              >{{ formatResponseTime(svc.responseTime) }}</span>
            </div>
            <div class="ss__metric">
              <span class="ss__metric-label">最后检查</span>
              <span class="ss__metric-value">{{ formatLastCheck(svc.lastCheck) }}</span>
            </div>
          </div>
        </article>
      </section>
    </template>
  </main>
</template>

<style scoped>
/* ============================================================
   ServiceStatusView
   ============================================================ */
.ss {
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px 28px 60px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* ===== 头部 ===== */
.ss__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.ss__title { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
.ss__sub { font-size: 13px; color: var(--text-secondary); margin: 0; }
.ss__refresh-info { color: var(--text-muted); }
.ss__header-actions { display: flex; align-items: center; gap: 12px; }
.ss__countdown { font-size: 12px; color: var(--text-muted); white-space: nowrap; }

/* ===== 按钮 ===== */
.ss__btn {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms;
  white-space: nowrap;
}
.ss__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ss__btn--ghost { background: transparent; }
.ss__btn--ghost:hover:not(:disabled) { background: var(--bg-tertiary); }

/* ===== 状态 ===== */
.ss__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 20px;
  color: var(--text-secondary);
}
.ss__state--error { color: var(--danger, #ef4444); }
.ss__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--color-brand-primary, #7C3AED);
  border-radius: 50%;
  animation: ss-spin 0.8s linear infinite;
}
@keyframes ss-spin { to { transform: rotate(360deg); } }

/* ===== 摘要 ===== */
.ss__summary {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-left: 4px solid;
  border-radius: 12px;
}
.ss__summary-indicator {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ss__pulse {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  animation: ss-pulse 2s ease-in-out infinite;
}
@keyframes ss-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}
.ss__summary-info { flex: 1; min-width: 0; }
.ss__summary-status { font-size: 18px; font-weight: 700; margin: 0 0 2px; }
.ss__summary-msg { font-size: 13px; color: var(--text-secondary); margin: 0; }
.ss__summary-stats {
  display: flex;
  gap: 20px;
  flex-shrink: 0;
}
.ss__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.ss__stat-value { font-size: 22px; font-weight: 800; }
.ss__stat-label { font-size: 11px; color: var(--text-muted); font-weight: 600; }

/* ===== 卡片网格 ===== */
.ss__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}

.ss__card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 20px;
  transition: all 150ms;
}
.ss__card:hover { border-color: var(--border-strong); }

.ss__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.ss__card-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ss__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ss__card-status-label { font-size: 12px; font-weight: 700; }
.ss__card-version {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
}

.ss__card-name { font-size: 15px; font-weight: 700; margin: 0 0 2px; }
.ss__card-id { font-size: 12px; color: var(--text-muted); margin: 0 0 14px; font-family: ui-monospace, monospace; }

.ss__card-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.ss__metric {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ss__metric-label { font-size: 12px; color: var(--text-muted); }
.ss__metric-value { font-size: 13px; font-weight: 600; }
.ss__metric-value--warn { color: #f59e0b; }
.ss__metric-value--bad { color: #ef4444; }

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .ss { padding: 16px; }
  .ss__header { flex-direction: column; align-items: flex-start; }
  .ss__summary { flex-direction: column; align-items: flex-start; gap: 12px; }
  .ss__summary-stats { align-self: stretch; justify-content: space-around; }
  .ss__grid { grid-template-columns: 1fr; }
}
</style>
