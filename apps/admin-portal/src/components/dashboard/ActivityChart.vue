<script setup lang="ts">
/**
 * ActivityChart — 7 日活跃曲线（柱状 + 折线）
 */
import { computed } from 'vue'

const props = defineProps<{
  data: { date: string; value: number }[]
}>()

const W = 600
const H = 180
const PAD = 24

const max = computed(() => Math.max(1, ...props.data.map((d) => d.value)))

const bars = computed(() => {
  const stepX = (W - PAD * 2) / props.data.length
  return props.data.map((d, i) => {
    const x = PAD + i * stepX + stepX * 0.15
    const w = stepX * 0.7
    const h = (d.value / max.value) * (H - PAD * 2)
    const y = H - PAD - h
    return { x, y, w, h, ...d }
  })
})

const pathLine = computed(() => {
  const stepX = (W - PAD * 2) / props.data.length
  return props.data
    .map((d, i) => {
      const x = PAD + i * stepX + stepX * 0.5
      const y = H - PAD - (d.value / max.value) * (H - PAD * 2)
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
})
</script>

<template>
  <div class="act-chart">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="act-svg">
      <g class="act-grid">
        <line v-for="i in 3" :key="i" :x1="PAD" :x2="W - PAD"
          :y1="PAD + ((H - PAD * 2) / 3) * (i - 1)" :y2="PAD + ((H - PAD * 2) / 3) * (i - 1)" />
      </g>
      <g>
        <rect v-for="b in bars" :key="b.date" :x="b.x" :y="b.y" :width="b.w" :height="b.h"
          fill="var(--accent)" fill-opacity="0.35" rx="3" />
      </g>
      <path :d="pathLine" fill="none" stroke="var(--accent)" stroke-width="2" />
      <g>
        <circle v-for="(d, i) in data" :key="`p-${d.date}`"
          :cx="PAD + i * ((W - PAD * 2) / data.length) + ((W - PAD * 2) / data.length) * 0.5"
          :cy="H - PAD - (d.value / max) * (H - PAD * 2)"
          r="3" fill="var(--accent)" />
      </g>
      <g class="act-labels">
        <text v-for="(d, i) in data" :key="`xl-${d.date}`"
          :x="PAD + i * ((W - PAD * 2) / data.length) + ((W - PAD * 2) / data.length) * 0.5"
          :y="H - 6" text-anchor="middle">
          {{ d.date }}
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.act-chart { width: 100%; }
.act-svg { width: 100%; height: 180px; display: block; }
.act-grid line { stroke: var(--border); stroke-width: 1; stroke-dasharray: 3 3; }
.act-labels text { fill: var(--text-secondary); font-size: 10px; }
</style>
