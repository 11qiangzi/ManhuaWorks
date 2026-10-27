<script setup lang="ts">
/**
 * CharacterCard
 * ManhuaWorks studio component
 */

export interface CharacterExpression {
  id: string
  label: string
  imageUrl: string | null
}

export interface Character {
  id: string
  name: string
  description?: string | null
  artStyle: string
  views: {
    front: string | null
    side: string | null
    back: string | null
    threeQ: string | null
  }
  expressions: CharacterExpression[]
  tags?: string[]
  locked?: boolean
  consistencyScore?: number
}

interface Props {
  character: Character
  selected?: boolean
  activeExpressionId?: string | null
  tags?: string[]
  consistencyScore?: number
  locked?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  activeExpressionId: null,
  tags: () => [],
  consistencyScore: undefined,
  locked: false
})

const emit = defineEmits<{
  select: [id: string]
  edit: [id: string]
  remove: [id: string]
  'toggle-lock': [id: string]
  'select-expression': [characterId: string, expressionId: string]
  'generate-expressions': [id: string]
}>()

const viewLabels = [
  { key: 'front' as const, label: 'Front' },
  { key: 'side' as const, label: 'Side' },
  { key: 'back' as const, label: 'Back' },
  { key: 'threeQ' as const, label: '3/4' }
]
</script>

<template>
  <article
    class="char-card"
    :class="{
      'char-card--selected': props.selected,
      'char-card--locked': props.locked
    }"
    @click="emit('select', props.character.id)"
  >
    <div class="char-card__views">
      <div v-for="v in viewLabels" :key="v.key" class="char-card__view">
        <img
          v-if="props.character.views[v.key]"
          :src="props.character.views[v.key]!"
          :alt="v.label"
          class="char-card__view-img"
        />
        <span v-else class="char-card__view-empty">{{ v.label }}</span>
      </div>
    </div>

    <div class="char-card__body">
      <div class="char-card__head">
        <h3 class="char-card__name">{{ props.character.name }}</h3>
        <span v-if="props.locked" class="char-card__lock">&#128274;</span>
        <span v-if="props.consistencyScore !== undefined" class="char-card__score">
          {{ props.consistencyScore.toFixed(1) }}
        </span>
      </div>

      <p v-if="props.character.description" class="char-card__desc">
        {{ props.character.description }}
      </p>

      <div class="char-card__tags">
        <span class="char-card__tag char-card__tag--style">{{ props.character.artStyle }}</span>
        <span v-for="t in (props.tags ?? props.character.tags)" :key="t" class="char-card__tag">{{ t }}</span>
      </div>

      <div v-if="props.character.expressions.length > 0" class="char-card__expressions">
        <button
          v-for="expr in props.character.expressions"
          :key="expr.id"
          type="button"
          class="char-card__expr"
          :class="{ 'char-card__expr--active': props.activeExpressionId === expr.id }"
          :title="expr.label"
          @click.stop="emit('select-expression', props.character.id, expr.id)"
        >
          <img v-if="expr.imageUrl" :src="expr.imageUrl" :alt="expr.label" class="char-card__expr-img" />
          <span v-else class="char-card__expr-label">{{ expr.label }}</span>
        </button>
      </div>

      <div class="char-card__actions">
        <button type="button" class="char-card__btn" @click.stop="emit('edit', props.character.id)">&#9998;</button>
        <button type="button" class="char-card__btn" @click.stop="emit('toggle-lock', props.character.id)">
          <span v-if="props.locked">&#128275;</span><span v-else>&#128274;</span>
        </button>
        <button type="button" class="char-card__btn char-card__btn--danger" @click.stop="emit('remove', props.character.id)">&#10005;</button>
        <button type="button" class="char-card__btn" @click.stop="emit('generate-expressions', props.character.id)">&#9889;</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.char-card { background: var(--bg-secondary); border: 1.5px solid var(--border); border-radius: 12px; overflow: hidden; cursor: pointer; transition: all 200ms; }
.char-card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow); }
.char-card--selected { border-color: var(--accent); box-shadow: var(--glow); }
.char-card--locked { border-left: 3px solid var(--warning, #f59e0b); }
.char-card__views { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border); }
.char-card__view { aspect-ratio: 1; background: var(--bg-primary); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.char-card__view-img { width: 100%; height: 100%; object-fit: cover; }
.char-card__view-empty { font-size: 12px; color: var(--text-secondary); font-weight: 600; }
.char-card__body { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.char-card__head { display: flex; align-items: center; gap: 6px; }
.char-card__name { margin: 0; font-size: 14px; font-weight: 600; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.char-card__lock { font-size: 12px; opacity: 0.6; }
.char-card__score { font-size: 10px; font-weight: 700; font-family: monospace; padding: 1px 6px; border-radius: 4px; background: color-mix(in srgb, var(--success, #22c55e) 12%, transparent); color: var(--success, #22c55e); }
.char-card__desc { margin: 0; font-size: 11px; color: var(--text-secondary); line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.char-card__tags { display: flex; flex-wrap: wrap; gap: 4px; }
.char-card__tag { font-size: 10px; padding: 1px 7px; border-radius: 4px; background: var(--bg-primary); color: var(--text-secondary); border: 1px solid var(--border); }
.char-card__tag--style { background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 20%, transparent); }
.char-card__expressions { display: flex; gap: 4px; overflow-x: auto; padding: 2px 0; }
.char-card__expr { width: 32px; height: 32px; border-radius: 6px; border: 1.5px solid var(--border); background: var(--bg-primary); cursor: pointer; padding: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 150ms; }
.char-card__expr:hover { border-color: var(--accent); }
.char-card__expr--active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.char-card__expr-img { width: 100%; height: 100%; object-fit: cover; }
.char-card__expr-label { font-size: 8px; color: var(--text-secondary); }
.char-card__actions { display: flex; gap: 4px; padding-top: 4px; border-top: 1px solid var(--border); }
.char-card__btn { width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-secondary); font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 150ms; font-family: inherit; padding: 0; }
.char-card__btn:hover { border-color: var(--accent); color: var(--accent); }
.char-card__btn--danger:hover { border-color: var(--danger, #ef4444); color: var(--danger, #ef4444); }
</style>