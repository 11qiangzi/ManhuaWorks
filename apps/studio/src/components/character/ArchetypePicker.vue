<script setup lang="ts">
/**
 * ArchetypePicker.vue — 6 类 archetype 选择器
 * L2 林染 任务 2：用作新增角色时的入口
 */
import { computed } from 'vue'
import type { CharacterArchetype } from '../../types/character'
import { CHARACTER_ARCHETYPES_V2 } from '../../data/character-archetypes-v2'
import ArchetypeCard from './ArchetypeCard.vue'
import type { StudioThemeId } from '../../types/studio'

const props = defineProps<{
  /** 已选 archetype */
  modelValue?: CharacterArchetype | null
  /** 当前主题 */
  themeId?: StudioThemeId
  /** 显示角色数（可选） */
  countMap?: Record<CharacterArchetype, number>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', id: CharacterArchetype | null): void
  (e: 'pick', id: CharacterArchetype): void
}>()

const archetypes = computed(() => CHARACTER_ARCHETYPES_V2)

function onPick(id: string) {
  emit('update:modelValue', id as CharacterArchetype)
  emit('pick', id as CharacterArchetype)
}
</script>

<template>
  <div class="archetype-picker grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
    <ArchetypeCard
      v-for="a in archetypes"
      :key="a.id"
      :meta="a"
      :count="countMap?.[a.id] ?? 0"
      :selected="modelValue === a.id"
      :theme-id="themeId"
      @click="onPick"
      @pick="onPick"
    />
  </div>
</template>

<style scoped>
.archetype-picker {
  width: 100%;
}
</style>
