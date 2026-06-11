<script setup lang="ts">
/**
 * CharacterPickerV2 · 角色选择器 v2
 * ManhuaWorks · W5 任务 5
 *
 * 6 类 archetype + 预览 + 相似度提示
 */
import { ref, computed } from 'vue'
import type { CharacterArchetype, CharacterV2, ConsistencyCheckResult } from '../../types/character'
import { CHARACTER_ARCHETYPES_V2, getArchetypeMeta } from '../../data/character-archetypes-v2'
import { useCharacterConsistency } from '../../composables/useCharacterConsistency'

const props = defineProps<{
  /** 已选角色 ID（可空） */
  modelValue?: string | null
  /** 风格 ID（5 主题之一） */
  styleId?: string
  /** 候选角色列表（可选；若不传则只展示 6 archetype 卡片） */
  candidates?: CharacterV2[]
  /** 显示相似度提示 */
  showSimilarity?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', id: string | null): void
  (e: 'select', id: string): void
  (e: 'pickArchetype', archetype: CharacterArchetype): void
  (e: 'preview', id: string): void
}>()

const consistency = useCharacterConsistency({ threshold: 0.85 })

/** 当前 active archetype */
const activeArchetype = ref<CharacterArchetype | null>(null)

/** 当前 archetype 详情 */
const activeMeta = computed(() => activeArchetype.value ? getArchetypeMeta(activeArchetype.value) : null)

/** 6 archetype 卡片 */
const archetypeList = computed(() => CHARACTER_ARCHETYPES_V2.map(a => ({
  ...a,
  count: props.candidates?.filter(c => c.archetype === a.id).length ?? 0,
})))

/** 当前 archetype 下的候选 */
const filteredCandidates = computed(() => {
  if (!activeArchetype.value) return []
  return (props.candidates ?? []).filter(c => c.archetype === activeArchetype.value)
})

/** 6 archetype 之间的相似度矩阵（调试用） */
const similarityMatrix = computed(() => {
  const archs: CharacterArchetype[] = ['youth', 'maiden', 'villain', 'mentor', 'child', 'elder']
  const m: Array<{ a: string; b: string; sim: number }> = []
  for (let i = 0; i < archs.length; i++) {
    for (let j = i + 1; j < archs.length; j++) {
      const ai = archs[i]!
      const aj = archs[j]!
      const vi = (window as any).__charVec?.[ai] ?? []
      const vj = (window as any).__charVec?.[aj] ?? []
      if (vi.length === 0 || vj.length === 0) continue
      const dot = vi.reduce((s: number, x: number, k: number) => s + x * vj[k], 0)
      const ni = Math.sqrt(vi.reduce((s: number, x: number) => s + x * x, 0))
      const nj = Math.sqrt(vj.reduce((s: number, x: number) => s + x * x, 0))
      const sim = ni && nj ? dot / (ni * nj) : 0
      m.push({ a: ai, b: aj, sim })
    }
  }
  return m
})

function onPickArchetype(arch: CharacterArchetype) {
  activeArchetype.value = arch
  emit('pickArchetype', arch)
}

function onSelect(id: string) {
  emit('update:modelValue', id)
  emit('select', id)
  // 一致性检查（如果有）
  const cand = (props.candidates ?? []).find(c => c.id === id)
  if (cand) {
    consistency.check(cand).then((r: ConsistencyCheckResult) => {
      if (!r.passed) {
        // eslint-disable-next-line no-console
        console.warn(`[CharacterPickerV2] ${cand.name} 一致性不通过: ${r.reason}`)
      }
    })
  }
}

function onPreview(id: string) {
  emit('preview', id)
}

function colorClass(token: string) {
  return `text-${token}-500`
}

function bgClass(token: string) {
  return `bg-${token}-500/10 border-${token}-500/30`
}
</script>

<template>
  <div class="char-picker-v2">
    <header class="char-picker-v2__head">
      <h3>选择角色 archetype</h3>
      <div class="char-picker-v2__threshold">
        <label>相似度阈值</label>
        <input
          type="range"
          min="0.5"
          max="0.99"
          step="0.01"
          :value="consistency.threshold.value"
          @input="(e) => consistency.setThreshold(Number((e.target as HTMLInputElement).value))"
        />
        <span class="char-picker-v2__threshold-val">{{ consistency.threshold.value.toFixed(2) }}</span>
      </div>
    </header>

    <!-- 6 类 archetype 卡片 -->
    <div class="char-picker-v2__arch-list">
      <button
        v-for="arch in archetypeList"
        :key="arch.id"
        type="button"
        class="char-picker-v2__arch"
        :class="[bgClass(arch.color), { 'char-picker-v2__arch--active': activeArchetype === arch.id }]"
        :title="arch.tagline"
        @click="onPickArchetype(arch.id)"
      >
        <span class="char-picker-v2__arch-icon">{{ arch.icon }}</span>
        <span class="char-picker-v2__arch-label">{{ arch.label }}</span>
        <span v-if="arch.count > 0" class="char-picker-v2__arch-count">{{ arch.count }}</span>
      </button>
    </div>

    <!-- archetype 详情 -->
    <div v-if="activeMeta" class="char-picker-v2__detail">
      <h4 :class="colorClass(activeMeta.colorAccent)">
        {{ activeMeta.icon }} {{ activeMeta.label }}
        <small>({{ activeMeta.ageRange.min }}-{{ activeMeta.ageRange.max }} 岁)</small>
      </h4>
      <p class="char-picker-v2__tagline">{{ activeMeta.tagline }}</p>
      <p class="char-picker-v2__desc">{{ activeMeta.description }}</p>
      <div class="char-picker-v2__attrs">
        <div><strong>体型：</strong>{{ activeMeta.bodyShape }}</div>
        <div><strong>服装：</strong>{{ activeMeta.clothingTone }}</div>
        <div><strong>风格：</strong>{{ activeMeta.styleId }}</div>
      </div>
      <div class="char-picker-v2__traits">
        <span v-for="t in activeMeta.traits" :key="t" class="char-picker-v2__trait">{{ t }}</span>
      </div>
    </div>

    <!-- 候选角色 -->
    <div v-if="filteredCandidates.length > 0" class="char-picker-v2__cands">
      <h5>已存在角色（{{ filteredCandidates.length }}）</h5>
      <ul class="char-picker-v2__cand-list">
        <li
          v-for="c in filteredCandidates"
          :key="c.id"
          class="char-picker-v2__cand"
          :class="{ 'char-picker-v2__cand--selected': props.modelValue === c.id }"
        >
          <button type="button" class="char-picker-v2__cand-main" @click="onSelect(c.id)">
            <span class="char-picker-v2__cand-name">{{ c.name }}</span>
            <span v-if="props.showSimilarity !== false" class="char-picker-v2__cand-score" :title="`一致性 ${c.consistencyScore}`">
              ✓ {{ c.consistencyScore }}
            </span>
            <span v-if="c.locked" class="char-picker-v2__cand-lock" title="已锁定">🔒</span>
          </button>
          <button type="button" class="char-picker-v2__cand-preview" @click="onPreview(c.id)" title="预览">👁</button>
        </li>
      </ul>
    </div>

    <!-- archetype 间相似度提示（调试） -->
    <details v-if="similarityMatrix.length > 0" class="char-picker-v2__matrix">
      <summary>archetype 相似度矩阵（{{ similarityMatrix.length }} 对）</summary>
      <ul>
        <li v-for="(row, idx) in similarityMatrix" :key="idx">
          {{ row.a }} ↔ {{ row.b }}: <strong>{{ row.sim.toFixed(3) }}</strong>
        </li>
      </ul>
    </details>
  </div>
</template>

<style scoped>
.char-picker-v2 {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.char-picker-v2__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.char-picker-v2__head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.char-picker-v2__threshold {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}

.char-picker-v2__threshold input {
  width: 100px;
}

.char-picker-v2__threshold-val {
  font-family: monospace;
  color: var(--accent);
  font-weight: 600;
  min-width: 32px;
  text-align: right;
}

/* archetype 列表 */
.char-picker-v2__arch-list {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

@media (max-width: 640px) {
  .char-picker-v2__arch-list {
    grid-template-columns: repeat(3, 1fr);
  }
}

.char-picker-v2__arch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  border: 1.5px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 150ms;
  position: relative;
}

.char-picker-v2__arch:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.char-picker-v2__arch--active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
}

.char-picker-v2__arch-icon {
  font-size: 24px;
}

.char-picker-v2__arch-label {
  font-weight: 600;
  color: var(--text-primary);
}

.char-picker-v2__arch-count {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--accent);
  color: white;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 8px;
  font-weight: 700;
}

/* 详情 */
.char-picker-v2__detail {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.char-picker-v2__detail h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.char-picker-v2__detail h4 small {
  font-weight: 400;
  color: var(--text-secondary);
  font-size: 11px;
}

.char-picker-v2__tagline {
  margin: 0;
  font-size: 11px;
  color: var(--text-secondary);
  font-style: italic;
}

.char-picker-v2__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
}

.char-picker-v2__attrs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: var(--text-primary);
}

.char-picker-v2__attrs strong {
  color: var(--accent);
}

.char-picker-v2__traits {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.char-picker-v2__trait {
  font-size: 10px;
  padding: 1px 6px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  border-radius: 3px;
}

/* 候选 */
.char-picker-v2__cands h5 {
  margin: 0 0 4px 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.char-picker-v2__cand-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.char-picker-v2__cand {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  overflow: hidden;
}

.char-picker-v2__cand--selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--accent) 25%, transparent);
}

.char-picker-v2__cand-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.char-picker-v2__cand-main:hover {
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}

.char-picker-v2__cand-name {
  flex: 1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.char-picker-v2__cand-score {
  font-family: monospace;
  font-size: 10px;
  color: var(--success);
  font-weight: 600;
}

.char-picker-v2__cand-lock {
  font-size: 11px;
}

.char-picker-v2__cand-preview {
  border: none;
  border-left: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  padding: 0 8px;
}

.char-picker-v2__cand-preview:hover {
  background: var(--accent);
  color: white;
}

/* 相似度矩阵 */
.char-picker-v2__matrix {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px dashed var(--border);
  border-radius: 4px;
  padding: 4px 8px;
}

.char-picker-v2__matrix summary {
  cursor: pointer;
  font-weight: 500;
  user-select: none;
}

.char-picker-v2__matrix ul {
  margin: 6px 0 0 0;
  padding: 0 0 0 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px 12px;
  font-family: monospace;
  font-size: 10px;
}

.char-picker-v2__matrix li {
  display: flex;
  justify-content: space-between;
}

.char-picker-v2__matrix strong {
  color: var(--accent);
}
</style>
