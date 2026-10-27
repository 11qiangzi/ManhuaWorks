<script setup lang="ts">
/**
 * SceneCard.vue — 场景卡片
 * L2 林染 任务 2
 *
 * 显示：模板图标 / 名称 / 描述 / 子场景数 / 光影参数 / 关联角色 archetype
 */
import { computed } from 'vue'
import type { SceneTemplateMeta, SceneSubScene } from '../../types/scene'
import type { StudioThemeId } from '../../types/studio'

const props = defineProps<{
  meta: SceneTemplateMeta
  /** 已有场景数（用于本模板） */
  sceneCount?: number
  /** 选中的子场景 ID（用于详情模式） */
  activeSubSceneId?: string | null
  /** 当前主题 */
  themeId?: StudioThemeId
  /** 是否选中（卡片模式） */
  selected?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', id: string): void
  (e: 'pickSubScene', sub: SceneSubScene): void
}>()

const themeVariant = computed(() =>
  props.themeId ? (props.meta.themeAdapters[props.themeId] ?? null) : null,
)

const subScenes = computed(() => props.meta.subScenes)
</script>

<template>
  <div
    class="scene-card flex flex-col overflow-hidden rounded-lg border bg-white transition-all hover:shadow-md dark:bg-gray-900"
    :class="[
      selected
        ? 'border-amber-500 ring-2 ring-amber-400/40'
        : 'border-gray-200 dark:border-gray-700',
    ]"
    :data-template-id="meta.id"
  >
    <!-- 顶部 -->
    <div class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-2 py-1.5 text-[11px] dark:border-gray-800 dark:bg-gray-800/60">
      <div class="flex items-center gap-1.5">
        <span class="text-xl">{{ meta.icon }}</span>
        <div class="flex flex-col">
          <span class="font-semibold text-gray-800 dark:text-gray-100">{{ meta.label }}</span>
          <span class="text-[10px] text-gray-400">{{ meta.styleId }}</span>
        </div>
      </div>
      <span
        v-if="(sceneCount ?? 0) > 0"
        class="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
      >{{ sceneCount }}</span>
    </div>

    <!-- 缩略图 / 占位 -->
    <div
      class="relative aspect-video w-full cursor-pointer overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700"
      @click="emit('click', meta.id)"
    >
      <div class="flex h-full w-full flex-col items-center justify-center text-gray-400">
        <span class="text-4xl">{{ meta.icon }}</span>
        <span class="mt-1 text-[10px]">{{ meta.label }}</span>
      </div>
      <div class="absolute bottom-1 left-1 flex flex-wrap gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">
        <span>{{ meta.defaultColorTemp }}K</span>
        <span>·</span>
        <span>{{ meta.defaultLightDir }}</span>
        <span>·</span>
        <span>{{ Math.round(meta.defaultIntensity * 100) }}%</span>
      </div>
    </div>

    <!-- 内容 -->
    <div class="flex flex-1 flex-col gap-1.5 p-2">
      <p class="line-clamp-2 text-[11px] text-gray-500 dark:text-gray-400">{{ meta.description.split('。')[0] }}</p>

      <!-- 子场景 -->
      <div class="flex flex-col gap-0.5">
        <span class="text-[10px] font-semibold uppercase text-gray-400">子场景 ({{ subScenes.length }})</span>
        <div class="flex flex-wrap gap-0.5">
          <button
            v-for="sub in subScenes.slice(0, 4)"
            :key="sub.id"
            type="button"
            class="rounded border px-1 py-0.5 text-[9px]"
            :class="activeSubSceneId === sub.id
              ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700'"
            :title="sub.description"
            @click="emit('pickSubScene', sub)"
          >{{ sub.name }}</button>
          <span
            v-if="subScenes.length > 4"
            class="rounded bg-gray-100 px-1 py-0.5 text-[9px] text-gray-500 dark:bg-gray-800"
          >+{{ subScenes.length - 4 }}</span>
        </div>
      </div>

      <!-- 适配 archetype -->
      <div class="flex flex-wrap gap-0.5">
        <span
          v-for="a in meta.compatibleArchetypes"
          :key="a"
          class="rounded bg-blue-100 px-1 py-0.5 text-[9px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        >{{ a }}</span>
      </div>

      <!-- 主题提示 -->
      <div
        v-if="themeVariant?.promptHint"
        class="mt-auto rounded bg-gray-50 px-2 py-1 text-[10px] text-gray-500 dark:bg-gray-800/60 dark:text-gray-400"
      >
        💡 {{ themeVariant.promptHint }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene-card {
  user-select: none;
  font-size: 12px;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
