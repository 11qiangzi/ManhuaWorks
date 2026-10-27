<script setup lang="ts">
/**
 * ArchetypeCard.vue — 6 类角色 archetype 卡片
 * L2 林染 任务 2
 *
 * 显示：图标 / 标签 / tagline / 角色数 / 适配关系 / 主题色
 */
import { computed } from 'vue'
import type { CharacterArchetypeMeta } from '../../types/character'
import { STUDIO_THEMES, type StudioThemeId } from '../../types/studio'

const props = defineProps<{
  meta: CharacterArchetypeMeta
  count?: number
  selected?: boolean
  /** 当前主题（用于 prompt hint 提示） */
  themeId?: StudioThemeId
}>()

const emit = defineEmits<{
  (e: 'click', id: string): void
  (e: 'pick', id: string): void
}>()

const themeVariant = computed(() => {
  if (!props.themeId) return null
  return props.meta.themeAdapters[props.themeId] ?? null
})

function onClick() {
  emit('click', props.meta.id)
}
function onPick(e: MouseEvent) {
  e.stopPropagation()
  emit('pick', props.meta.id)
}
</script>

<template>
  <button
    type="button"
    class="archetype-card group relative flex w-full flex-col items-start gap-1 overflow-hidden rounded-lg border p-3 text-left transition-all hover:shadow-md"
    :class="[
      selected
        ? 'border-amber-500 ring-2 ring-amber-400/40'
        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600',
    ]"
    :style="selected
      ? { background: 'rgba(245, 158, 11, 0.06)' }
      : {}"
    @click="onClick"
  >
    <!-- 顶部：icon + label + 计数 -->
    <div class="flex w-full items-center justify-between">
      <div class="flex items-center gap-2">
        <span
          class="flex h-9 w-9 items-center justify-center rounded-lg text-2xl"
          :style="{
            background: `color-mix(in srgb, var(--theme-${meta.color}, #6b7280) 12%, transparent)`,
          }"
        >{{ meta.icon }}</span>
        <div class="flex flex-col">
          <span class="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{{ meta.label }}</span>
          <span class="text-[10px] text-gray-400 dark:text-gray-500">
            {{ meta.ageRange.min }}-{{ meta.ageRange.max }} 岁 · {{ meta.styleId }}
          </span>
        </div>
      </div>
      <span
        v-if="(count ?? 0) > 0"
        class="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
      >{{ count }}</span>
    </div>

    <!-- tagline -->
    <p class="line-clamp-1 text-[11px] italic text-gray-500 dark:text-gray-400">
      {{ meta.tagline }}
    </p>

    <!-- 主题色适配条（5 主题） -->
    <div class="mt-1 flex w-full items-center gap-1">
      <span
        v-for="t in STUDIO_THEMES"
        :key="t.id"
        class="h-1.5 flex-1 rounded"
        :style="{ background: meta.themeAdapters[t.id]?.color ?? '#9ca3af' }"
        :title="`${t.label}: ${meta.themeAdapters[t.id]?.promptHint ?? '无'}`"
      ></span>
    </div>

    <!-- 当前主题提示词（可选展开） -->
    <div
      v-if="themeVariant?.promptHint"
      class="mt-1 w-full rounded bg-gray-50 px-2 py-1 text-[10px] text-gray-500 dark:bg-gray-800/60 dark:text-gray-400"
    >
      💡 {{ themeVariant.promptHint }}
    </div>

    <!-- 操作按钮 -->
    <div class="mt-1 flex w-full items-center justify-between text-[10px] text-gray-400">
      <span>{{ meta.traits.length }} 特征 · {{ meta.relationships.length }} 关系</span>
      <span
        class="rounded bg-gray-100 px-1.5 py-0.5 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-gray-800"
        @click="onPick"
      >+ 选用</span>
    </div>
  </button>
</template>

<style scoped>
.archetype-card {
  background: var(--bg-secondary, #ffffff);
  min-height: 110px;
  cursor: pointer;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  width: 100%;
}
</style>
