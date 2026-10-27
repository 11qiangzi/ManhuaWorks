<script setup lang="ts">
/**
 * ModelCard - 模型选择卡片
 * ManhuaWorks studio component
 */

interface ModelInfo {
  id: string
  name: string
  description: string
  provider: string
  capabilities: string[]
  [key: string]: unknown
}

interface Props {
  model: ModelInfo
  selected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

const emit = defineEmits<{
  select: [id: string]
}>()

function onClick() {
  emit('select', props.model.id)
}
</script>

<template>
  <button
    type="button"
    class="model-card"
    :class="{ 'model-card--selected': props.selected }"
    @click="onClick"
  >
    <div class="model-card__head">
      <strong class="model-card__name">{{ model.name }}</strong>
      <span v-if="props.selected" class="model-card__check">&#10003;</span>
    </div>

    <p class="model-card__desc">{{ model.description }}</p>

    <div class="model-card__caps">
      <span
        v-for="cap in model.capabilities"
        :key="cap"
        class="model-card__cap"
      >
        {{ cap }}
      </span>
    </div>
  </button>
</template>

<style scoped>
.model-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: var(--text-primary);
  transition: all 200ms;
}

.model-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.model-card--selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-secondary));
  box-shadow: var(--glow);
}

.model-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.model-card__name {
  font-size: 14px;
  font-weight: 600;
}

.model-card__check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.model-card__desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.model-card__caps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.model-card__cap {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  font-weight: 500;
}
</style>
