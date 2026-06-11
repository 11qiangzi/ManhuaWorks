<script setup lang="ts">
/**
 * SceneCard · 场景卡片
 * ManhuaWorks · W3 工坊流程精修
 *
 * 环境图 + 光影参数（色温/光向/强度）+ 标签
 */
import { computed } from 'vue'

export interface SceneLighting {
  timeOfDay: string
  lightDir: string
  colorTemp: number
  intensity: number
  name?: string
}

export interface Scene {
  id: string
  name: string
  category: string // 'indoor' | 'outdoor' | 'fantasy' | 'urban' | 'nature' | 'other'
  imageUrl: string | null
  description?: string
  lighting?: SceneLighting
  tags?: string[]
  reusable?: boolean
}

const props = defineProps<{
  scene: Scene
  selected?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit', id: string): void
  (e: 'remove', id: string): void
  (e: 'select', id: string): void
  (e: 'applyLighting', id: string): void
}>()

const CATEGORY_MAP: Record<string, { label: string; icon: string; color: string }> = {
  indoor: { label: '室内', icon: '🏠', color: 'var(--accent)' },
  outdoor: { label: '室外', icon: '🌳', color: 'var(--success)' },
  fantasy: { label: '奇幻', icon: '✨', color: 'var(--warning)' },
  urban: { label: '都市', icon: '🏙️', color: 'var(--text-secondary)' },
  nature: { label: '自然', icon: '⛰️', color: 'var(--success)' },
  other: { label: '其他', icon: '📦', color: 'var(--text-secondary)' }
}

const categoryMeta = computed(() => CATEGORY_MAP[props.scene.category] ?? CATEGORY_MAP.other!)

const lightingLabel = computed(() => {
  const l = props.scene.lighting
  if (!l) return null
  return `${l.name ?? l.timeOfDay} · ${l.lightDir}`
})

function onClick() { emit('select', props.scene.id) }
function onEdit(e: Event) { e.stopPropagation(); emit('edit', props.scene.id) }
function onRemove(e: Event) {
  e.stopPropagation()
  if (confirm(`确认删除场景「${props.scene.name}」？`)) emit('remove', props.scene.id)
}
function onApply(e: Event) { e.stopPropagation(); emit('applyLighting', props.scene.id) }
</script>

<template>
  <article
    class="scene-card"
    :class="{ 'scene-card--selected': selected }"
    @click="onClick"
  >
    <!-- 环境图 -->
    <div class="scene-card__img">
      <img v-if="scene.imageUrl" :src="scene.imageUrl" :alt="scene.name" />
      <div v-else class="scene-card__placeholder">
        <span class="scene-card__placeholder-icon">{{ categoryMeta.icon }}</span>
        <span>点击上传环境图</span>
      </div>

      <span class="scene-card__cat" :style="{ background: categoryMeta.color }">
        {{ categoryMeta.icon }} {{ categoryMeta.label }}
      </span>
      <span v-if="scene.reusable" class="scene-card__reusable" title="可复用">♻</span>
    </div>

    <!-- 信息 -->
    <div class="scene-card__body">
      <div class="scene-card__head">
        <h3>{{ scene.name }}</h3>
        <div class="scene-card__btns">
          <button type="button" class="scene-card__btn" title="编辑" @click="onEdit">✏️</button>
          <button type="button" class="scene-card__btn scene-card__btn--danger" title="删除" @click="onRemove">🗑️</button>
        </div>
      </div>

      <p v-if="scene.description" class="scene-card__desc">{{ scene.description }}</p>

      <!-- 光影参数 -->
      <div v-if="scene.lighting" class="scene-card__lighting">
        <div class="scene-card__light-row">
          <span class="scene-card__light-label">🌅 光影</span>
          <strong>{{ lightingLabel }}</strong>
        </div>
        <div class="scene-card__light-meters">
          <div class="scene-card__meter" :title="`色温 ${scene.lighting.colorTemp}K`">
            <span class="scene-card__meter-label">色温</span>
            <div
              class="scene-card__meter-bar"
              :style="{
                background: `linear-gradient(90deg, #ff6b1a 0%, #fff5d6 50%, #5a8fff 100%)`,
                opacity: 0.85
              }"
            >
              <span
                class="scene-card__meter-thumb"
                :style="{ left: `${Math.min(100, Math.max(0, ((scene.lighting.colorTemp - 2500) / 5500) * 100))}%` }"
              />
            </div>
            <span class="scene-card__meter-value">{{ scene.lighting.colorTemp }}K</span>
          </div>
          <div class="scene-card__meter" :title="`强度 ${Math.round(scene.lighting.intensity * 100)}%`">
            <span class="scene-card__meter-label">强度</span>
            <div class="scene-card__meter-bar scene-card__meter-bar--single">
              <span
                class="scene-card__meter-fill"
                :style="{ width: `${scene.lighting.intensity * 100}%` }"
              />
            </div>
            <span class="scene-card__meter-value">{{ Math.round(scene.lighting.intensity * 100) }}%</span>
          </div>
        </div>
        <button
          type="button"
          class="scene-card__apply"
          title="把此光影应用到当前分镜"
          @click="onApply"
        >
          ✨ 应用光影
        </button>
      </div>

      <div v-if="scene.tags && scene.tags.length > 0" class="scene-card__tags">
        <span v-for="t in scene.tags.slice(0, 5)" :key="t" class="scene-card__tag">{{ t }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.scene-card {
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

.scene-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.scene-card--selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
}

/* ===== 图片 ===== */
.scene-card__img {
  position: relative;
  aspect-ratio: 16/9;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.scene-card__img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.scene-card__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}

.scene-card__placeholder-icon {
  font-size: 36px;
  opacity: 0.5;
}

.scene-card__cat {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.scene-card__reusable {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--bg-primary) 85%, transparent);
  color: var(--accent);
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  backdrop-filter: blur(4px);
  border: 1px solid var(--border);
}

/* ===== 主体 ===== */
.scene-card__body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scene-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.scene-card__head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.scene-card__btns {
  display: flex;
  gap: 3px;
  opacity: 0;
  transition: opacity 200ms;
}

.scene-card:hover .scene-card__btns { opacity: 1; }

.scene-card__btn {
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

.scene-card__btn:hover { border-color: var(--accent); color: var(--accent); }
.scene-card__btn--danger:hover { border-color: var(--danger); color: var(--danger); }

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

/* ===== 光影 ===== */
.scene-card__lighting {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.scene-card__light-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.scene-card__light-label { color: var(--text-secondary); }

.scene-card__light-row strong {
  color: var(--accent);
  font-weight: 600;
  font-size: 12px;
}

.scene-card__light-meters {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scene-card__meter {
  display: grid;
  grid-template-columns: 36px 1fr 44px;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.scene-card__meter-label {
  color: var(--text-secondary);
}

.scene-card__meter-bar {
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-secondary);
  overflow: hidden;
}

.scene-card__meter-thumb {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: white;
  border: 1.5px solid var(--text-primary);
  transform: translate(-50%, -50%);
}

.scene-card__meter-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--gradient);
  border-radius: 3px;
  transition: width 300ms;
}

.scene-card__meter-value {
  font-family: monospace;
  color: var(--text-primary);
  text-align: right;
  font-size: 10px;
}

.scene-card__apply {
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--accent);
  font-family: inherit;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 2px;
  transition: all 150ms;
}

.scene-card__apply:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-secondary));
}

/* ===== 标签 ===== */
.scene-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.scene-card__tag {
  font-size: 10px;
  padding: 1px 5px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  border-radius: 3px;
}
</style>
