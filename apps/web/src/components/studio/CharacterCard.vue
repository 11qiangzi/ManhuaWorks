<script setup lang="ts">
/**
 * CharacterCard · 角色卡片
 * ManhuaWorks · W3 工坊流程精修
 *
 * 4 角度预览（前/侧/背/45°）+ 表情选择 + 锁脸标记
 */
import { ref, computed } from 'vue'

export interface CharacterExpression {
  id: string
  name: string
  icon: string
  imageUrl?: string | null
}

export interface Character {
  id: string
  name: string
  description?: string
  artStyle?: string
  views: {
    front: string | null
    side: string | null
    back: string | null
    threeQ: string | null // 3/4 角度
  }
  expressions?: CharacterExpression[]
  locked?: boolean
  tags?: string[]
  consistencyScore?: number
}

const props = defineProps<{
  character: Character
  selected?: boolean
  activeExpressionId?: string
}>()

const emit = defineEmits<{
  (e: 'edit', id: string): void
  (e: 'remove', id: string): void
  (e: 'select', id: string): void
  (e: 'toggleLock', id: string): void
  (e: 'selectExpression', characterId: string, expressionId: string): void
  (e: 'generateExpressions', id: string): void
}>()

const viewTabs = computed(() => [
  { key: 'front', label: '前', icon: '😐' },
  { key: 'side', label: '侧', icon: '👉' },
  { key: 'back', label: '背', icon: '🔙' },
  { key: 'threeQ', label: '3/4', icon: '↪️' }
] as const)

const activeView = ref<keyof Character['views']>('front')
const currentViewUrl = computed(() => props.character.views[activeView.value] ?? null)

function onLockToggle(e: Event) {
  e.stopPropagation()
  emit('toggleLock', props.character.id)
}
function onEdit(e: Event) {
  e.stopPropagation()
  emit('edit', props.character.id)
}
function onRemove(e: Event) {
  e.stopPropagation()
  if (confirm(`确认删除角色「${props.character.name}」？`)) {
    emit('remove', props.character.id)
  }
}
function onClick() {
  emit('select', props.character.id)
}
function onExpression(expId: string, e: Event) {
  e.stopPropagation()
  emit('selectExpression', props.character.id, expId)
}
function onGenExp(e: Event) {
  e.stopPropagation()
  emit('generateExpressions', props.character.id)
}
</script>

<template>
  <article
    class="char-card"
    :class="{ 'char-card--selected': selected, 'char-card--locked': character.locked }"
    @click="onClick"
  >
    <!-- 多角度预览 -->
    <div class="char-card__view">
      <img
        v-if="currentViewUrl"
        :src="currentViewUrl"
        :alt="`${character.name} ${activeView}`"
        class="char-card__view-img"
      />
      <div v-else class="char-card__view-placeholder">
        <span class="char-card__view-icon">👤</span>
        <span class="char-card__view-hint">点击编辑上传</span>
      </div>

      <!-- 锁脸标记 -->
      <button
        type="button"
        class="char-card__lock"
        :class="{ 'char-card__lock--on': character.locked }"
        :title="character.locked ? '已锁定（一致性保护）' : '未锁定'"
        @click="onLockToggle"
      >
        {{ character.locked ? '🔒' : '🔓' }}
      </button>

      <!-- 一致性评分 -->
      <span
        v-if="character.consistencyScore !== undefined"
        class="char-card__score"
        :class="{
          'char-card__score--high': character.consistencyScore >= 90,
          'char-card__score--mid': character.consistencyScore >= 70 && character.consistencyScore < 90,
          'char-card__score--low': character.consistencyScore < 70
        }"
        :title="`一致性评分 ${character.consistencyScore}`"
      >
        ✓ {{ character.consistencyScore }}
      </span>
    </div>

    <!-- 角度切换 tab -->
    <div class="char-card__tabs">
      <button
        v-for="t in viewTabs"
        :key="t.key"
        type="button"
        class="char-card__tab"
        :class="{ 'char-card__tab--on': activeView === t.key }"
        :title="t.label"
        @click.stop="activeView = t.key"
      >
        <span>{{ t.icon }}</span>
        <span class="char-card__tab-label">{{ t.label }}</span>
      </button>
    </div>

    <!-- 信息 -->
    <div class="char-card__body">
      <div class="char-card__head">
        <h3>{{ character.name }}</h3>
        <div class="char-card__btns">
          <button type="button" class="char-card__btn" title="编辑" @click="onEdit">✏️</button>
          <button type="button" class="char-card__btn char-card__btn--danger" title="删除" @click="onRemove">🗑️</button>
        </div>
      </div>
      <p v-if="character.description" class="char-card__desc">{{ character.description }}</p>
      <div v-if="character.tags && character.tags.length > 0" class="char-card__tags">
        <span v-for="t in character.tags.slice(0, 4)" :key="t" class="char-card__tag">{{ t }}</span>
      </div>
    </div>

    <!-- 表情选择 -->
    <div class="char-card__exps" @click.stop>
      <span class="char-card__exps-label">表情：</span>
      <div class="char-card__exps-list">
        <button
          v-for="exp in (character.expressions ?? []).slice(0, 6)"
          :key="exp.id"
          type="button"
          class="char-card__exp"
          :class="{ 'char-card__exp--on': activeExpressionId === exp.id }"
          :title="exp.name"
          @click="onExpression(exp.id, $event)"
        >
          <span class="char-card__exp-icon">{{ exp.icon }}</span>
        </button>
        <button
          v-if="(character.expressions?.length ?? 0) < 8"
          type="button"
          class="char-card__exp char-card__exp--add"
          title="AI 生成更多表情"
          @click="onGenExp"
        >
          ＋
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.char-card {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 200ms;
  position: relative;
}

.char-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.char-card--selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
}

.char-card--locked {
  border-style: dashed;
}

/* ===== 预览 ===== */
.char-card__view {
  position: relative;
  aspect-ratio: 1/1;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.char-card__view-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.char-card__view-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}

.char-card__view-icon {
  font-size: 48px;
  opacity: 0.5;
}

.char-card__view-hint {
  font-size: 11px;
}

.char-card__lock {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-primary) 90%, transparent);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  transition: all 150ms;
  backdrop-filter: blur(4px);
}

.char-card__lock:hover { border-color: var(--accent); }

.char-card__lock--on {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.char-card__score {
  position: absolute;
  bottom: 8px;
  left: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.char-card__score--high { background: var(--success); color: var(--bg-primary); }
.char-card__score--mid { background: var(--warning); color: var(--bg-primary); }
.char-card__score--low { background: var(--danger); color: var(--bg-primary); }

/* ===== 角度 tab ===== */
.char-card__tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid var(--border);
}

.char-card__tab {
  border: none;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  padding: 6px 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border-right: 1px solid var(--border);
  transition: all 150ms;
}

.char-card__tab:last-child { border-right: none; }

.char-card__tab:hover {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 4%, var(--bg-secondary));
}

.char-card__tab--on {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-secondary));
  color: var(--accent);
  font-weight: 600;
}

.char-card__tab-label {
  font-size: 10px;
}

/* ===== 信息 ===== */
.char-card__body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.char-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.char-card__head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.char-card__btns {
  display: flex;
  gap: 3px;
  opacity: 0;
  transition: opacity 200ms;
}

.char-card:hover .char-card__btns {
  opacity: 1;
}

.char-card__btn {
  width: 22px;
  height: 22px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
  font-family: inherit;
}

.char-card__btn:hover { border-color: var(--accent); color: var(--accent); }
.char-card__btn--danger:hover { border-color: var(--danger); color: var(--danger); }

.char-card__desc {
  margin: 0;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.char-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.char-card__tag {
  font-size: 10px;
  padding: 1px 5px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  border-radius: 3px;
}

/* ===== 表情 ===== */
.char-card__exps {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 10px;
  border-top: 1px solid var(--border);
}

.char-card__exps-label {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
  flex-shrink: 0;
}

.char-card__exps-list {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
  flex: 1;
}

.char-card__exp {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 150ms;
  font-family: inherit;
  padding: 0;
}

.char-card__exp:hover {
  border-color: var(--accent);
  transform: scale(1.1);
}

.char-card__exp--on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 15%, var(--bg-primary));
}

.char-card__exp--add {
  font-weight: 700;
  color: var(--accent);
  font-size: 14px;
}
</style>
