<script setup lang="ts">
/**
 * SceneForm.vue — 场景编辑表单
 * L2 林染 任务 2
 *
 * 编辑字段：name / description / lighting / tags / reusable
 * 只读：template + 子场景
 */
import { computed } from 'vue'
import type { SceneV2, SceneSubScene } from '../../types/scene'
import { getSceneTemplateMeta } from '../../data/scene-templates-v2'
import { STUDIO_THEMES, type StudioThemeId } from '../../types/studio'

const props = defineProps<{
  modelValue: SceneV2
  readonlyTemplate?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: SceneV2): void
  (e: 'pickSubScene', sub: SceneSubScene): void
}>()

const meta = computed(() => getSceneTemplateMeta(props.modelValue.template))
const subScenes = computed(() => meta.value.subScenes)

function patch(p: Partial<SceneV2>) {
  emit('update:modelValue', { ...props.modelValue, ...p, updatedAt: Date.now() })
}

function onSetLighting(k: keyof SceneV2['lighting'], v: string | number) {
  patch({
    lighting: { ...props.modelValue.lighting, [k]: v },
  })
}

function onToggleTag(t: string) {
  const tags = props.modelValue.tags
  if (tags.includes(t)) patch({ tags: tags.filter(x => x !== t) })
  else patch({ tags: [...tags, t] })
}

function onSetTheme(themeId: StudioThemeId) {
  patch({ themeId })
}
</script>

<template>
  <form class="scene-form flex flex-col gap-3 text-[12px]" @submit.prevent>
    <!-- 顶部：模板徽章 -->
    <div class="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/60">
      <div class="flex items-center gap-2">
        <span class="flex h-8 w-8 items-center justify-center rounded text-xl">{{ meta.icon }}</span>
        <div class="flex flex-col">
          <span class="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{{ meta.label }}</span>
          <span class="text-[10px] text-gray-400">{{ meta.styleId }} · {{ meta.subScenes.length }} 子场景</span>
        </div>
      </div>
      <span
        v-if="readonlyTemplate"
        class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
      >template 不可改</span>
    </div>

    <!-- 名称 -->
    <label class="flex flex-col gap-1">
      <span class="text-[10px] font-semibold uppercase text-gray-500">名称</span>
      <input
        :value="modelValue.name"
        class="rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
        @input="(e) => patch({ name: (e.target as HTMLInputElement).value })"
      />
    </label>

    <!-- 描述 -->
    <label class="flex flex-col gap-1">
      <span class="text-[10px] font-semibold uppercase text-gray-500">描述</span>
      <textarea
        :value="modelValue.description"
        rows="3"
        class="rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
        @input="(e) => patch({ description: (e.target as HTMLTextAreaElement).value })"
      ></textarea>
    </label>

    <!-- 子场景 -->
    <div class="flex flex-col gap-1">
      <span class="text-[10px] font-semibold uppercase text-gray-500">子场景</span>
      <div class="grid grid-cols-2 gap-1">
        <button
          v-for="sub in subScenes"
          :key="sub.id"
          type="button"
          class="rounded border px-1.5 py-1 text-left text-[10px] hover:border-amber-500"
          :class="modelValue.lighting.name === sub.name
            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
            : 'border-gray-200 dark:border-gray-700'"
          @click="emit('pickSubScene', sub)"
        >
          <div class="font-semibold text-gray-700 dark:text-gray-200">{{ sub.name }}</div>
          <div class="text-gray-400">{{ sub.colorTemp }}K · {{ sub.lightDir }}</div>
        </button>
      </div>
    </div>

    <!-- 光影参数 -->
    <div class="grid grid-cols-3 gap-2">
      <label class="flex flex-col gap-1">
        <span class="text-[10px] font-semibold uppercase text-gray-500">色温 (K)</span>
        <input
          type="number"
          :value="modelValue.lighting.colorTemp"
          class="rounded border border-gray-300 bg-white px-1 py-0.5 text-[11px] dark:border-gray-600 dark:bg-gray-800"
          @input="(e) => onSetLighting('colorTemp', Number((e.target as HTMLInputElement).value))"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-[10px] font-semibold uppercase text-gray-500">光向</span>
        <input
          :value="modelValue.lighting.lightDir"
          class="rounded border border-gray-300 bg-white px-1 py-0.5 text-[11px] dark:border-gray-600 dark:bg-gray-800"
          @input="(e) => onSetLighting('lightDir', (e.target as HTMLInputElement).value)"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-[10px] font-semibold uppercase text-gray-500">强度</span>
        <input
          type="number"
          step="0.05"
          min="0"
          max="1"
          :value="modelValue.lighting.intensity"
          class="rounded border border-gray-300 bg-white px-1 py-0.5 text-[11px] dark:border-gray-600 dark:bg-gray-800"
          @input="(e) => onSetLighting('intensity', Number((e.target as HTMLInputElement).value))"
        />
      </label>
    </div>

    <!-- 主题 -->
    <div class="flex flex-col gap-1">
      <span class="text-[10px] font-semibold uppercase text-gray-500">主题（5 主题适配）</span>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="t in STUDIO_THEMES"
          :key="t.id"
          type="button"
          class="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]"
          :class="modelValue.themeId === t.id
            ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'"
          @click="onSetTheme(t.id)"
        >
          <span>{{ t.icon }}</span>
          <span>{{ t.label }}</span>
        </button>
      </div>
    </div>

    <!-- 标签 -->
    <div class="flex flex-col gap-1">
      <span class="text-[10px] font-semibold uppercase text-gray-500">标签</span>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="t in modelValue.tags"
          :key="t"
          class="flex cursor-pointer items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
          @click="onToggleTag(t)"
        >{{ t }} ✕</span>
        <input
          class="w-20 rounded border border-dashed border-gray-300 bg-transparent px-1 py-0.5 text-[10px] dark:border-gray-600"
          placeholder="+ 标签"
          @keydown.enter.prevent="(e) => {
            const v = (e.target as HTMLInputElement).value.trim()
            if (v) { onToggleTag(v); (e.target as HTMLInputElement).value = '' }
          }"
        />
      </div>
    </div>

    <!-- 选项 -->
    <div class="flex items-center gap-3 text-[11px]">
      <label class="flex items-center gap-1">
        <input
          type="checkbox"
          :checked="modelValue.reusable"
          @change="(e) => patch({ reusable: (e.target as HTMLInputElement).checked })"
        />
        <span>可复用</span>
      </label>
    </div>
  </form>
</template>

<style scoped>
.scene-form {
  width: 100%;
}
</style>
