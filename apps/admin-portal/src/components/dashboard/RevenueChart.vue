<script setup lang="ts">
/**
 * RevenueChart — 7 日收入曲线（纯 SVG，无外部库）
 */
import { computed } from 'vue'

const props = defineProps<{
  data: { date: string; value: number }[]
  height?: number
}>()

const W = 600
const H = computed(() => props.height ?? 220)
const PAD = 32

const max = computed(() => Math.max(1, ...props.data.map((d) => d.value)))
const min = computed(() => Math.min(...props.data.map((d) => d.value)))
const range = computed(() => max.value - min.value || 1)

const points = computed(() => {
  const stepX = (W - PAD * 2) / Math.max(1, props.data.length - 1)
  return props.data.map((d, i) => {
    const x = PAD + i * stepX
    const y = H.value - PAD - ((d.value - min.value) / range.value) * (H.value - PAD * 2)
    return { x, y, ...d }
  })
})

const pathLine = computed(() => {
  if (!points.value.length) return ''
  return points.value
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(' ')
})

const pathArea = computed(() => {
  if (!points.value.length) return ''
  const first = points.value[0]
  const last = points.value[points.value.length - 1]
  const baseY = H.value - PAD
  return `${pathLine.value} L${last.x},${baseY} L${first.x},${baseY} Z`
})

function fmt(v: number) {
  return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v)
}
</script>

<template>
  <div class="rev-chart">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="rev-svg">
      <defs>
        <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.4" />
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <!-- 网格 -->
      <g class="rev-grid">
        <line v-for="i in 4" :key="i" :x1="PAD" :x2="W - PAD"
          :y1="PAD + ((H - PAD * 2) / 4) * (i - 1)" :y2="PAD + ((H - PAD * 2) / 4) * (i - 1)" />
      </g>
      <!-- 面积 -->
      <path :d="pathArea" fill="url(#revAreaGrad)" />
      <!-- 折线 -->
      <path :d="pathLine" fill="none" stroke="var(--accent)" stroke-width="2" />
      <!-- 节点 -->
      <g>
        <circle v-for="p in points" :key="p.date" :cx="p.x" :cy="p.y" r="4" fill="var(--accent)" />
      </g>
      <!-- X 标签 -->
      <g class="rev-labels">
        <text v-for="p in points" :key="`xl-${p.date}`" :x="p.x" :y="H - 8" text-anchor="middle">
          {{ p.date }}
        </text>
      </g>
    </svg>
    <div class="rev-legend">
      <span class="rev-legend-label">7 日收入 · 共 {{ fmt(data.reduce((s, d) => s + d.value, 0)) }} CNY</span>
    </div>
  </div>
</template>

<style scoped>
.rev-chart { width: 100%; }
.rev-svg { width: 100%; height: 220px; display: block; }
.rev-grid line { stroke: var(--border); stroke-width: 1; stroke-dasharray: 3 3; }
.rev-labels text { fill: var(--text-secondary); font-size: 11px; }
.rev-legend { display: flex; justify-content: space-between; margin-top: 6px; }
.rev-legend-label { font-size: 12px; color: var(--text-secondary); }
</style>
