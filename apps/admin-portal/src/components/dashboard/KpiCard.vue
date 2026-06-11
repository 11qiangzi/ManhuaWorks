<script setup lang="ts">
/**
 * KpiCard — 单个 KPI 卡片
 * 接受：label / value / unit / delta / trend / loading
 */
defineProps<{
  label: string
  value: string | number
  unit?: string
  delta?: number
  loading?: boolean
  icon?: string
}>()
</script>

<template>
  <div class="kpi-card" :class="{ loading }">
    <div class="kpi-head">
      <span class="kpi-icon">{{ icon || '📈' }}</span>
      <span class="kpi-label">{{ label }}</span>
    </div>
    <div v-if="loading" class="kpi-skel" />
    <div v-else class="kpi-value">
      {{ value }}<span v-if="unit" class="kpi-unit">{{ unit }}</span>
    </div>
    <div v-if="delta !== undefined" class="kpi-delta" :class="delta >= 0 ? 'up' : 'down'">
      <span>{{ delta >= 0 ? '↑' : '↓' }}</span>
      <span>{{ Math.abs(delta).toFixed(1) }}%</span>
      <span class="kpi-delta-sub">较上周</span>
    </div>
  </div>
</template>

<style scoped>
.kpi-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 150ms, box-shadow 150ms;
}
.kpi-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
.kpi-head { display: flex; align-items: center; gap: 8px; }
.kpi-icon { font-size: 18px; }
.kpi-label { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.kpi-value { font-size: 28px; font-weight: 700; line-height: 1.1; }
.kpi-unit { font-size: 14px; font-weight: 400; margin-left: 4px; opacity: 0.7; }
.kpi-delta { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.kpi-delta.up { color: var(--success); }
.kpi-delta.down { color: var(--danger); }
.kpi-delta-sub { color: var(--text-secondary); margin-left: 4px; }
.kpi-skel {
  height: 36px;
  background: linear-gradient(90deg, var(--bg-primary), var(--border), var(--bg-primary));
  background-size: 200% 100%;
  border-radius: 6px;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
</style>
