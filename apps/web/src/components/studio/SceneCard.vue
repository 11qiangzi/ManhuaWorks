<script setup lang="ts">
/**
 * SceneCard - 场景卡片
 * ManhuaWorks studio component
 *
 * 展示场景信息（分类、光影、复用状态）
 */

export type SceneLighting = 'sunrise' | 'noon' | 'sunset' | 'night' | 'rainy' | 'snowy' | 'neon' | string

export interface Scene {
  id: string
  name: string
  category: string
  imageUrl: string | null
  description?: string | null
  lighting: SceneLighting | {
    name: string
    timeOfDay?: string
    lightDir?: string
    colorTemp?: number
    intensity?: number
  }
  tags?: string[]
  reusable?: boolean
}

interface Props {
  scene: Scene
  selected?: boolean
  tags?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  tags: () => []
})

const emit = defineEmits<{
  select: [id: string]
  edit: [id: string]
  remove: [id: string]
}>()

const LIGHTING_ICONS: Record<string, string> = {
  sunrise: '\u{1F305}',
  noon: '\u2600\uFE0F',
  sunset: '\u{1F307}',
  night: '\u{1F319}',
  rainy: '\u{1F327}',
  snowy: '\u2744\uFE0F',
  neon: '\u{1F4A1}'
}

const CATEGORY_LABELS: Record<string, string> = {
  indoor: '室内',
  outdoor: '室外',
  urban: '城市',
  nature: '自然',
  fantasy: '奇幻',
  other: '其他'
}

function getLightingKey(): string {
  if (typeof props.scene.lighting === 'string') return props.scene.lighting
  return props.scene.lighting.name ?? ''
}

function getLightingLabel(): string {
  const key = getLightingKey()
  if (typeof props.scene.lighting === 'object' && props.scene.lighting.timeOfDay) {
    return props.scene.lighting.timeOfDay
  }
  return key
}
</script>

<template>
  <article
    class="scene-card"
    :class="{
      'scene-card--selected': props.selected,
      'scene-card--reusable': props.scene.reusable
    }"
    @click="emit('select', props.scene.id)"
  >
    <!-- 图片 -->
    <div class="scene-card__thumb">
      <img
        v-if="props.scene.imageUrl"
        :src="props.scene.imageUrl"
        :alt="props.scene.name"
        class="scene-card__img"
        loading="lazy"
      />
      <span v-else class="scene-card__placeholder">{{ props.scene.name.slice(0, 1) }}</span>

      <!-- 分类标签 -->
      <span class="scene-card__category">{{ CATEGORY_LABELS[props.scene.category] ?? props.scene.category }}</span>

      <!-- 可复用标记 -->
      <span v-if="props.scene.reusable" class="scene-card__reusable">&#128260;</span>
    </div>

    <!-- 信息 -->
    <div class="scene-card__body">
      <h3 class="scene-card__name">{{ props.scene.name }}</h3>

      <p v-if="props.scene.description" class="scene-card__desc">{{ props.scene.description }}</p>

      <!-- 光影 -->
      <div class="scene-card__lighting">
        <span class="scene-card__light-icon">{{ LIGHTING_ICONS[getLightingKey()] ?? '\u{1F4A1}' }}</span>
        <span class="scene-card__light-label">{{ getLightingLabel() }}</span>
      </div>

      <!-- 标签 -->
      <div v-if="(props.tags ?? props.scene.tags)?.length" class="scene-card__tags">
        <span v-for="t in (props.tags ?? props.scene.tags)" :key="t" class="scene-card__tag">{{ t }}</span>
      </div>

      <!-- 操作 -->
      <div class="scene-card__actions">
        <button type="button" class="scene-card__btn" @click.stop="emit('edit', props.scene.id)" title="编辑">&#9998;</button>
        <button type="button" class="scene-card__btn scene-card__btn--danger" @click.stop="emit('remove', props.scene.id)" title="删除">&#10005;</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.scene-card {
  background: var(--bg-secondary);
  border: 1.5px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 200ms;
}

.scene-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.scene-card--selected {
  border-color: var(--accent);
  box-shadow: var(--glow);
}

.scene-card--reusable {
  border-left: 3px solid var(--success, #22c55e);
}

/* 缩略图 */
.scene-card__thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.scene-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scene-card__placeholder {
  font-size: 40px;
  font-weight: 800;
  color: var(--text-secondary);
  opacity: 0.3;
}

.scene-card__category {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--bg-primary) 85%, transparent);
  backdrop-filter: blur(4px);
  color: var(--text-primary);
}

.scene-card__reusable {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 14px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--success, #22c55e) 20%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 信息 */
.scene-card__body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scene-card__name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.scene-card__desc {
  margin: 0;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.scene-card__lighting {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.scene-card__light-icon {
  font-size: 14px;
}

.scene-card__light-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.scene-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.scene-card__tag {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.scene-card__actions {
  display: flex;
  gap: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
  margin-top: 2px;
}

.scene-card__btn {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
  font-family: inherit;
  padding: 0;
}

.scene-card__btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.scene-card__btn--danger:hover {
  border-color: var(--danger, #ef4444);
  color: var(--danger, #ef4444);
}
</style>
