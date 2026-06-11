<script setup lang="ts">
/**
 * ScenePicker.vue — 12 类场景模板选择器
 * L2 林染 任务 2
 */
import { computed } from 'vue'
import type { SceneTemplate, SceneSubScene } from '../../types/scene'
import { SCENE_TEMPLATES_V2 } from '../../data/scene-templates-v2'
import SceneCard from './SceneCard.vue'
import type { StudioThemeId } from '../../types/studio'

const props = defineProps<{
  modelValue?: SceneTemplate | null
  activeSubSceneId?: string | null
  sceneCountMap?: Record<SceneTemplate, number>
  themeId?: StudioThemeId
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', id: SceneTemplate | null): void
  (e: 'pick', id: SceneTemplate): void
  (e: 'pickSubScene', sub: SceneSubScene): void
}>()

const templates = computed(() => SCENE_TEMPLATES_V2)

function onPick(id: string) {
  emit('update:modelValue', id as SceneTemplate)
  emit('pick', id as SceneTemplate)
}

function onPickSubScene(sub: SceneSubScene) {
  emit('pickSubScene', sub)
}
</script>

<template>
  <div class="scene-picker grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <SceneCard
      v-for="t in templates"
      :key="t.id"
      :meta="t"
      :scene-count="sceneCountMap?.[t.id] ?? 0"
      :active-sub-scene-id="activeSubSceneId"
      :theme-id="themeId"
      :selected="modelValue === t.id"
      @click="onPick"
      @pick-sub-scene="onPickSubScene"
    />
  </div>
</template>

<style scoped>
.scene-picker {
  width: 100%;
}
</style>
