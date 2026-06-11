<script setup lang="ts">
/**
 * FailoverIndicator · 故障转移指示器
 * 展示：主 provider + 备用 provider 列表 + 健康状态 + 24h 切换次数
 *
 * 状态：健康（绿）/ 异常（红）/ 降级（黄）
 */

import { ref, onMounted, onUnmounted, computed } from 'vue'
import { getFailoverStatus, PROVIDERS, type FailoverStatus } from '@/api/ai-router'

interface Props {
  /** 轮询间隔 ms（默认 30s） */
  pollIntervalMs?: number
  /** 紧凑模式（仅一行） */
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), { pollIntervalMs: 30_000, compact: false })

const status = ref<FailoverStatus | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

let timer: number | null = null

async function fetchStatus() {
  try {
    status.value = await getFailoverStatus()
    error.value = null
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchStatus()
  timer = window.setInterval(fetchStatus, props.pollIntervalMs)
})

onUnmounted(() => {
  if (timer !== null) window.clearInterval(timer)
})

const primaryMeta = computed(() =>
  status.value ? PROVIDERS.find((p) => p.id === status.value!.primary) : null
)

const overallHealth = computed<'ok' | 'degraded' | 'down'>(() => {
  if (!status.value) return 'ok'
  if (!status.value.primaryHealthy) return 'down'
  if (status.value.primaryErrorRate > 0.1) return 'degraded'
  return 'ok'
})

const healthLabel = computed(() => {
  switch (overallHealth.value) {
    case 'ok': return '运行正常'
    case 'degraded': return '轻微降级'
    case 'down': return '主 Provider 故障'
  }
})

const healthColor = computed(() => {
  switch (overallHealth.value) {
    case 'ok': return 'var(--success)'
    case 'degraded': return 'var(--warning)'
    case 'down': return 'var(--danger)'
  }
})
</script>

<template>
  <div class="failover" :class="{ 'failover--compact': compact }">
    <header class="failover__head">
      <div class="failover__title">
        <h3>🔁 故障转移</h3>
        <p v-if="!compact">主备 Provider 健康状态</p>
      </div>
      <div v-if="status" class="failover__overall" :style="{ color: healthColor }">
        <span class="failover__dot" :style="{ background: healthColor }" />
        <strong>{{ healthLabel }}</strong>
      </div>
    </header>

    <div v-if="loading && !status" class="failover__loading">
      <div class="failover__spinner" />
      <span>加载中...</span>
    </div>

    <div v-else-if="error" class="failover__error">
      ⚠ {{ error }}
      <button type="button" @click="fetchStatus">重试</button>
    </div>

    <div v-else-if="status" class="failover__list">
      <!-- 主 provider -->
      <div class="failover__primary">
        <div class="failover__row">
          <div class="failover__provider">
            <span class="failover__logo">{{ primaryMeta?.logo }}</span>
            <div>
              <strong>{{ primaryMeta?.name }}</strong>
              <span class="failover__role">主</span>
            </div>
          </div>
          <div class="failover__metrics">
            <div class="failover__metric">
              <span>错误率</span>
              <strong>{{ (status.primaryErrorRate * 100).toFixed(1) }}%</strong>
            </div>
            <div class="failover__metric">
              <span>24h 切换</span>
              <strong>{{ status.failoverCount24h }}次</strong>
            </div>
            <span
              class="failover__status"
              :class="status.primaryHealthy ? 'failover__status--ok' : 'failover__status--down'"
            >
              {{ status.primaryHealthy ? '● 健康' : '● 故障' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 备用 provider 列表 -->
      <div v-if="!compact" class="failover__fallbacks">
        <h4>备用 Provider</h4>
        <div
          v-for="fb in status.fallbacks"
          :key="fb.provider"
          class="failover__fb-row"
        >
          <div class="failover__provider failover__provider--sm">
            <span class="failover__logo failover__logo--sm">
              {{ PROVIDERS.find((p) => p.id === fb.provider)?.logo }}
            </span>
            <strong>{{ PROVIDERS.find((p) => p.id === fb.provider)?.name }}</strong>
          </div>
          <span class="failover__latency">{{ fb.latencyMs }}ms</span>
          <span
            class="failover__status"
            :class="fb.healthy ? 'failover__status--ok' : 'failover__status--down'"
          >
            {{ fb.healthy ? '● 就绪' : '● 离线' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.failover {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.failover--compact {
  padding: 12px 14px;
  gap: 8px;
}

.failover__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.failover__title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.failover__title p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.failover__overall {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
}

.failover__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.failover__loading,
.failover__error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  color: var(--text-secondary);
  font-size: 13px;
}

.failover__error button {
  padding: 4px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
}

.failover__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.failover__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.failover__primary {
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
}

.failover__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.failover__provider {
  display: flex;
  align-items: center;
  gap: 10px;
}

.failover__provider--sm {
  gap: 8px;
}

.failover__provider strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
}

.failover__logo {
  font-size: 22px;
  line-height: 1;
}

.failover__logo--sm {
  font-size: 18px;
}

.failover__role {
  display: inline-block;
  margin-top: 2px;
  padding: 1px 6px;
  font-size: 10px;
  background: var(--accent);
  color: var(--bg-primary);
  border-radius: 3px;
  font-weight: 600;
  letter-spacing: 0.05em;
}

.failover__metrics {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.failover__metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 70px;
}

.failover__metric > span {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.failover__metric > strong {
  font-size: 13px;
  font-weight: 600;
  font-family: monospace;
}

.failover__status {
  font-size: 12px;
  font-weight: 500;
}

.failover__status--ok { color: var(--success); }
.failover__status--down { color: var(--danger); }

.failover__fallbacks h4 {
  margin: 0 0 8px;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.failover__fb-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 4px;
}

.failover__latency {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
