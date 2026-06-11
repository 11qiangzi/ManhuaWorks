<script setup lang="ts">
/**
 * MonitoringView · 监控大屏
 * ManhuaWorks · M1-W4 · L4-B
 *
 * 模块:
 *   1. 服务健康状态 (5 服务)
 *   2. CPU/内存/磁盘 资源占用
 *   3. 请求 QPS / 延迟
 *   4. 告警列表
 */
import { ref, onMounted } from 'vue'

const loading = ref(true)

onMounted(async () => {
  // API 数据待接 — 目前展示骨架屏
  await new Promise(r => setTimeout(r, 1200))
  loading.value = false
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
      <!-- 服务健康 -->
      <section class="monitoring-section">
        <h2 class="monitoring-h2">服务健康</h2>
        <div class="health-grid">
          <div class="health-card health-card--ok">
            <span class="health-dot">🟢</span>
            <strong>user-service</strong>
            <span class="health-meta">:8088 · 45ms</span>
          </div>
          <div class="health-card health-card--ok">
            <span class="health-dot">🟢</span>
            <strong>project-service</strong>
            <span class="health-meta">:8089 · 32ms</span>
          </div>
          <div class="health-card health-card--ok">
            <span class="health-dot">🟢</span>
            <strong>billing-service</strong>
            <span class="health-meta">:8090 · 28ms</span>
          </div>
          <div class="health-card health-card--warn">
            <span class="health-dot">🟡</span>
            <strong>ai-orchestrator</strong>
            <span class="health-meta">:8087 · deps down</span>
          </div>
          <div class="health-card health-card--ok">
            <span class="health-dot">🟢</span>
            <strong>collab-service</strong>
            <span class="health-meta">:8091 · 18ms</span>
          </div>
        </div>
      </section>

      <!-- 资源占用 -->
      <section class="monitoring-section">
        <h2 class="monitoring-h2">资源占用</h2>
        <div class="resource-grid">
          <div class="resource-card">
            <div class="resource-head">
              <span>CPU</span>
              <span class="resource-value">34%</span>
            </div>
            <div class="resource-bar">
              <div class="resource-fill resource-fill--cpu" :style="{ width: '34%' }" />
            </div>
            <span class="resource-meta">4/12 核</span>
          </div>
          <div class="resource-card">
            <div class="resource-head">
              <span>内存</span>
              <span class="resource-value">62%</span>
            </div>
            <div class="resource-bar">
              <div class="resource-fill resource-fill--mem" :style="{ width: '62%' }" />
            </div>
            <span class="resource-meta">9.9/16 GB</span>
          </div>
          <div class="resource-card">
            <div class="resource-head">
              <span>磁盘</span>
              <span class="resource-value">45%</span>
            </div>
            <div class="resource-bar">
              <div class="resource-fill resource-fill--disk" :style="{ width: '45%' }" />
            </div>
            <span class="resource-meta">112/250 GB</span>
          </div>
        </div>
      </section>

      <!-- 请求指标 -->
      <section class="monitoring-section">
        <h2 class="monitoring-h2">请求指标</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <strong>QPS</strong>
            <span class="metric-value">847</span>
            <span class="metric-meta">↑ 12% vs 1h ago</span>
          </div>
          <div class="metric-card">
            <strong>P50 延迟</strong>
            <span class="metric-value">42ms</span>
            <span class="metric-meta">↓ 5% vs 1h ago</span>
          </div>
          <div class="metric-card">
            <strong>P99 延迟</strong>
            <span class="metric-value">230ms</span>
            <span class="metric-meta">↓ 8% vs 1h ago</span>
          </div>
        </div>
      </section>

      <!-- 空状态 — 等接真 API -->
      <div class="empty-state">
        <span class="empty-icon">📊</span>
        <p>监控数据待接入 API</p>
        <p class="empty-hint">监控端点就绪后自动填充实时数据</p>
      </div>
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
