<script setup lang="ts">
/**
 * CharacterVectorDebug · 角色向量调试
 * 千机工坊 · W5 任务 5
 *
 * cosine 矩阵可视化 + 阈值调节
 */
import { ref, computed, watch } from 'vue'
import type { CharacterArchetype } from '../../types/character'
import { CHARACTER_ARCHETYPES, DEFAULT_CONSISTENCY_THRESHOLD } from '../../types/character'
import { CHARACTER_VECTOR_LIBRARY, CHARACTER_STYLE_IDS, CHARACTER_STYLE_META, type CharacterStyleId } from '../../data/character-vectors'
import { cosineSimilarity } from '../../api/vectors'
import { useCharacterConsistency } from '../../composables/useCharacterConsistency'

const props = defineProps<{
  /** 风格 ID（默认 minimal-light） */
  styleId?: CharacterStyleId
  /** 显示 5 主题切换 */
  showStyleSwitch?: boolean
  /** 单元格大小（px，默认 48） */
  cellSize?: number
}>()

const consistency = useCharacterConsistency({ threshold: 0.85 })

const localStyle = ref<CharacterStyleId>((props.styleId ?? 'minimal-light') as CharacterStyleId)
const localThreshold = ref<number>(consistency.threshold.value)
const hoveredCell = ref<{ i: number; j: number } | null>(null)
const selectedArchetypes = ref<Set<CharacterArchetype>>(new Set(['youth', 'maiden', 'villain']))

watch(() => props.styleId, (s) => {
  if (s) localStyle.value = s
})

watch(localThreshold, (v) => {
  consistency.setThreshold(v)
})

/** 6 archetype 标签 */
const archLabels: Record<CharacterArchetype, string> = {
  youth: '少年', maiden: '少女', villain: '反派',
  mentor: '导师', child: '儿童', elder: '老者',
}

const archIcons: Record<CharacterArchetype, string> = {
  youth: '🧑‍🎓', maiden: '👧', villain: '🧑‍🦲',
  mentor: '🧙', child: '🧒', elder: '🧓',
}

/** 6×6 cosine 矩阵 */
const matrix = computed(() => {
  const out: number[][] = []
  const style = localStyle.value
  for (let i = 0; i < CHARACTER_ARCHETYPES.length; i++) {
    const row: number[] = []
    for (let j = 0; j < CHARACTER_ARCHETYPES.length; j++) {
      const ai = CHARACTER_ARCHETYPES[i]!
      const aj = CHARACTER_ARCHETYPES[j]!
      const vi = CHARACTER_VECTOR_LIBRARY[ai][style]
      const vj = CHARACTER_VECTOR_LIBRARY[aj][style]
      row.push(cosineSimilarity(vi, vj))
    }
    out.push(row)
  }
  return out
})

/** 单元格颜色（cosine → 颜色） */
function cellColor(sim: number): string {
  // -1 ~ 1 → 红 → 灰 → 绿
  if (sim >= 1 - 1e-6) return 'rgb(34, 197, 94)' // 绿（自身）
  if (sim >= 0.85) return 'rgb(74, 222, 128)' // 浅绿
  if (sim >= 0.7) return 'rgb(253, 224, 71)' // 黄
  if (sim >= 0.5) return 'rgb(251, 146, 60)' // 橙
  return 'rgb(248, 113, 113)' // 红
}

function textColor(sim: number): string {
  return sim >= 0.5 ? '#000' : '#fff'
}

function onCellHover(i: number, j: number) {
  hoveredCell.value = { i, j }
}

function onCellLeave() {
  hoveredCell.value = null
}

function toggleArchetype(a: CharacterArchetype) {
  if (selectedArchetypes.value.has(a)) {
    selectedArchetypes.value.delete(a)
  } else {
    selectedArchetypes.value.add(a)
  }
}

function onThresholdChange(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  localThreshold.value = v
}

/** 矩阵上方：hovered 单元格详情 */
const hoveredDetail = computed(() => {
  if (!hoveredCell.value) return null
  const { i, j } = hoveredCell.value
  const ai = CHARACTER_ARCHETYPES[i]!
  const aj = CHARACTER_ARCHETYPES[j]!
  const sim = matrix.value[i]![j]!
  const passed = sim >= localThreshold.value
  return { ai, aj, sim, passed, i, j }
})

/** 阈值参考线颜色（用于判断） */
function isAboveThreshold(sim: number): boolean {
  return sim >= localThreshold.value
}

const cellSizePx = computed(() => `${props.cellSize ?? 48}px`)

/** 当前风格元数据（避免模板中自动解包后的 any 索引） */
const currentStyleMeta = computed(() => CHARACTER_STYLE_META[localStyle.value])
</script>

<template>
  <div class="cv-debug">
    <header class="cv-debug__head">
      <h3>角色向量调试 · Cosine 矩阵</h3>
      <div class="cv-debug__ctrl">
        <div class="cv-debug__threshold">
          <label>阈值：</label>
          <input
            type="range"
            min="0.5"
            max="0.99"
            step="0.01"
            :value="localThreshold"
            @input="onThresholdChange"
          />
          <span class="cv-debug__threshold-val">{{ localThreshold.toFixed(2) }}</span>
        </div>
        <div v-if="props.showStyleSwitch !== false" class="cv-debug__style">
          <label>风格：</label>
          <select v-model="localStyle">
            <option v-for="s in CHARACTER_STYLE_IDS" :key="s" :value="s">
              {{ CHARACTER_STYLE_META[s].label }}
            </option>
          </select>
        </div>
      </div>
    </header>

    <!-- archetype 快速选择 -->
    <div class="cv-debug__archs">
      <span class="cv-debug__archs-label">过滤 archetype：</span>
      <button
        v-for="a in CHARACTER_ARCHETYPES"
        :key="a"
        type="button"
        class="cv-debug__arch-btn"
        :class="{ 'cv-debug__arch-btn--on': selectedArchetypes.has(a) }"
        @click="toggleArchetype(a)"
      >
        {{ archIcons[a] }} {{ archLabels[a] }}
      </button>
    </div>

    <!-- 矩阵 -->
    <div class="cv-debug__matrix-wrap">
      <table class="cv-debug__matrix">
        <thead>
          <tr>
            <th class="cv-debug__corner"></th>
            <th
              v-for="(a, j) in CHARACTER_ARCHETYPES"
              :key="a"
              class="cv-debug__col-head"
              :title="`列: ${a}`"
            >
              <span class="cv-debug__col-icon">{{ archIcons[a] }}</span>
              <small>{{ archLabels[a] }}</small>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(a, i) in CHARACTER_ARCHETYPES" :key="a">
            <th class="cv-debug__row-head" :title="`行: ${a}`">
              <span class="cv-debug__row-icon">{{ archIcons[a] }}</span>
              <small>{{ archLabels[a] }}</small>
            </th>
            <td
              v-for="(b, j) in CHARACTER_ARCHETYPES"
              :key="`${i}-${j}`"
              class="cv-debug__cell"
              :class="{
                'cv-debug__cell--diag': i === j,
                'cv-debug__cell--below': !isAboveThreshold(matrix[i]?.[j] ?? 0),
                'cv-debug__cell--above': isAboveThreshold(matrix[i]?.[j] ?? 0) && i !== j,
              }"
              :style="{
                background: cellColor(matrix[i]?.[j] ?? 0),
                color: textColor(matrix[i]?.[j] ?? 0),
                width: cellSizePx,
                height: cellSizePx,
              }"
              :title="`${archLabels[a]} ↔ ${archLabels[b]}: ${(matrix[i]?.[j] ?? 0).toFixed(4)}`"
              @mouseenter="onCellHover(i, j)"
              @mouseleave="onCellLeave"
            >
              {{ (matrix[i]?.[j] ?? 0).toFixed(2) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 单元格详情 -->
    <div v-if="hoveredDetail" class="cv-debug__detail" :class="{ 'cv-debug__detail--pass': hoveredDetail.passed, 'cv-debug__detail--fail': !hoveredDetail.passed }">
      <strong>{{ archIcons[hoveredDetail.ai] }} {{ archLabels[hoveredDetail.ai] }}</strong>
      ↔
      <strong>{{ archIcons[hoveredDetail.aj] }} {{ archLabels[hoveredDetail.aj] }}</strong>
      <span class="cv-debug__detail-sim">cos = {{ hoveredDetail.sim.toFixed(4) }}</span>
      <span v-if="hoveredDetail.passed" class="cv-debug__badge cv-debug__badge--ok">✓ 通过</span>
      <span v-else class="cv-debug__badge cv-debug__badge--err">✗ 低于阈值 {{ localThreshold.toFixed(2) }}</span>
    </div>

    <!-- 图例 -->
    <div class="cv-debug__legend">
      <span class="cv-debug__legend-title">颜色映射：</span>
      <span class="cv-debug__legend-item" :style="{ background: 'rgb(34, 197, 94)' }">≥ 0.99（自身）</span>
      <span class="cv-debug__legend-item" :style="{ background: 'rgb(74, 222, 128)' }">≥ 0.85（通过）</span>
      <span class="cv-debug__legend-item" :style="{ background: 'rgb(253, 224, 71)' }">≥ 0.70</span>
      <span class="cv-debug__legend-item" :style="{ background: 'rgb(251, 146, 60)' }">≥ 0.50</span>
      <span class="cv-debug__legend-item" :style="{ background: 'rgb(248, 113, 113)' }">&lt; 0.50</span>
    </div>

    <!-- 当前风格信息 -->
    <div class="cv-debug__info">
      <small>
        风格：<strong>{{ currentStyleMeta.label }}</strong> ·
        提示词：<code>{{ currentStyleMeta.promptHint }}</code> ·
        阈值：<strong>{{ localThreshold.toFixed(2) }}</strong>
      </small>
    </div>
  </div>
</template>

<style scoped>
.cv-debug {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: inherit;
}

.cv-debug__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.cv-debug__head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.cv-debug__ctrl {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.cv-debug__threshold,
.cv-debug__style {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cv-debug__threshold input {
  width: 100px;
}

.cv-debug__threshold-val {
  font-family: monospace;
  color: var(--accent);
  font-weight: 600;
  min-width: 32px;
  text-align: right;
}

.cv-debug__style select {
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 11px;
}

/* archetype 切换 */
.cv-debug__archs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 11px;
}

.cv-debug__archs-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.cv-debug__arch-btn {
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: all 150ms;
}

.cv-debug__arch-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.cv-debug__arch-btn--on {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

/* 矩阵 */
.cv-debug__matrix-wrap {
  overflow-x: auto;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
}

.cv-debug__matrix {
  border-collapse: separate;
  border-spacing: 2px;
  font-family: monospace;
}

.cv-debug__corner {
  background: transparent;
}

.cv-debug__col-head,
.cv-debug__row-head {
  font-weight: 500;
  font-size: 10px;
  color: var(--text-secondary);
  padding: 4px 6px;
  background: var(--bg-secondary);
  border-radius: 3px;
  text-align: center;
  min-width: 56px;
}

.cv-debug__col-icon,
.cv-debug__row-icon {
  display: block;
  font-size: 18px;
  margin-bottom: 2px;
}

.cv-debug__col-head small,
.cv-debug__row-head small {
  display: block;
  font-size: 9px;
  color: var(--text-secondary);
}

.cv-debug__cell {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  border-radius: 3px;
  cursor: pointer;
  transition: all 100ms;
  user-select: none;
}

.cv-debug__cell--diag {
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.5);
}

.cv-debug__cell:hover {
  outline: 2px solid var(--text-primary);
  outline-offset: 1px;
  transform: scale(1.05);
}

/* 详情 */
.cv-debug__detail {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  font-size: 12px;
}

.cv-debug__detail--pass {
  border-color: var(--success);
  background: color-mix(in srgb, var(--success) 5%, var(--bg-primary));
}

.cv-debug__detail--fail {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 5%, var(--bg-primary));
}

.cv-debug__detail strong {
  color: var(--text-primary);
}

.cv-debug__detail-sim {
  font-family: monospace;
  color: var(--accent);
  font-weight: 600;
}

.cv-debug__badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 700;
}

.cv-debug__badge--ok {
  background: var(--success);
  color: white;
}

.cv-debug__badge--err {
  background: var(--danger);
  color: white;
}

/* 图例 */
.cv-debug__legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 10px;
  color: var(--text-secondary);
}

.cv-debug__legend-title {
  font-weight: 500;
}

.cv-debug__legend-item {
  padding: 2px 6px;
  border-radius: 3px;
  color: #000;
  font-family: monospace;
  font-size: 9px;
}

/* info */
.cv-debug__info {
  text-align: right;
  font-size: 10px;
  color: var(--text-secondary);
}

.cv-debug__info code {
  background: var(--bg-primary);
  padding: 1px 4px;
  border-radius: 2px;
  color: var(--accent);
  font-family: monospace;
}

.cv-debug__info strong {
  color: var(--text-primary);
}
</style>
