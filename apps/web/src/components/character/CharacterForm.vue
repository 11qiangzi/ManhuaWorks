<script setup lang="ts">
/**
 * CharacterForm.vue — 角色编辑表单
 * L2 林染 任务 2
 *
 * 编辑字段：name / description / tags / themeId / locked / expressions
 * 只读：archetype（用 picker 改）
 */
import { computed } from 'vue'
import type { CharacterV2, CharacterExpression } from '../../types/character'
import { getArchetypeMeta } from '../../data/character-archetypes-v2'
import { STUDIO_THEMES, type StudioThemeId } from '../../types/studio'

const props = defineProps<{
  modelValue: CharacterV2
  readonlyArchetype?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: CharacterV2): void
  (e: 'addExpression', v: CharacterExpression): void
  (e: 'removeExpression', id: string): void
}>()

const meta = computed(() => getArchetypeMeta(props.modelValue.archetype))

function patch(p: Partial<CharacterV2>) {
  emit('update:modelValue', { ...props.modelValue, ...p, updatedAt: Date.now() })
}

function onAddExpression() {
  const id = `expr_${Date.now().toString(36)}`
  const exp: CharacterExpression = {
    id,
    name: '新表情',
    icon: '😐',
    imageUrl: null,
  }
  emit('addExpression', exp)
}

function onSetTheme(themeId: StudioThemeId) {
  patch({ themeId })
}

function toggleTag(tag: string) {
  const tags = props.modelValue.tags
  if (tags.includes(tag)) patch({ tags: tags.filter(t => t !== tag) })
  else patch({ tags: [...tags, tag] })
}
</script>

<template>
  <form
    class="character-form flex flex-col gap-3 text-[12px]"
    @submit.prevent
  >
    <!-- 顶部：archetype 徽章 + 主题 -->
    <div class="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/60">
      <div class="flex items-center gap-2">
        <span
          class="flex h-8 w-8 items-center justify-center rounded text-xl"
          :style="{ background: `color-mix(in srgb, currentColor 10%, transparent)` }"
        >{{ meta.icon }}</span>
        <div class="flex flex-col">
          <span class="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{{ meta.label }}</span>
          <span class="text-[10px] text-gray-400">{{ meta.styleId }} · {{ meta.ageRange.min }}-{{ meta.ageRange.max }} 岁</span>
        </div>
      </div>
      <span
        v-if="readonlyArchetype"
        class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
      >archetype 不可改</span>
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
      <span class="text-[10px] font-semibold uppercase text-gray-500">描述（剧情 / 性格 / 外形）</span>
      <textarea
        :value="modelValue.description"
        rows="4"
        class="rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
        @input="(e) => patch({ description: (e.target as HTMLTextAreaElement).value })"
      ></textarea>
    </label>

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

    <!-- archetype traits & relationships（只读展示） -->
    <div class="flex flex-col gap-1">
      <span class="text-[10px] font-semibold uppercase text-gray-500">特征</span>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="t in meta.traits"
          :key="t"
          class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        >{{ t }}</span>
      </div>
    </div>
    <div class="flex flex-col gap-1">
      <span class="text-[10px] font-semibold uppercase text-gray-500">关系</span>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="r in meta.relationships"
          :key="r"
          class="rounded bg-pink-100 px-1.5 py-0.5 text-[10px] text-pink-700 dark:bg-pink-900/40 dark:text-pink-300"
        >{{ r }}</span>
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
          @click="toggleTag(t)"
        >{{ t }} ✕</span>
        <input
          class="w-20 rounded border border-dashed border-gray-300 bg-transparent px-1 py-0.5 text-[10px] dark:border-gray-600"
          placeholder="+ 标签"
          @keydown.enter.prevent="(e) => {
            const v = (e.target as HTMLInputElement).value.trim()
            if (v) { toggleTag(v); (e.target as HTMLInputElement).value = '' }
          }"
        />
      </div>
    </div>

    <!-- 表情 -->
    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-semibold uppercase text-gray-500">表情</span>
        <button
          type="button"
          class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] hover:bg-gray-200 dark:bg-gray-800"
          @click="onAddExpression"
        >+ 添加</button>
      </div>
      <div class="flex flex-wrap gap-1">
        <div
          v-for="e in modelValue.expressions"
          :key="e.id"
          class="flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] dark:border-gray-700 dark:bg-gray-800"
        >
          <span>{{ e.icon }}</span>
          <span>{{ e.name }}</span>
          <button
            type="button"
            class="text-gray-400 hover:text-red-500"
            @click="emit('removeExpression', e.id)"
          >✕</button>
        </div>
        <span
          v-if="modelValue.expressions.length === 0"
          class="text-[10px] text-gray-400"
        >无表情</span>
      </div>
    </div>

    <!-- 锁定 -->
    <label class="flex items-center gap-2 text-[11px]">
      <input
        type="checkbox"
        :checked="modelValue.locked"
        @change="(e) => patch({ locked: (e.target as HTMLInputElement).checked })"
      />
      <span>锁定（防止 AI 改写）</span>
    </label>
  </form>
</template>

<style scoped>
.character-form {
  width: 100%;
}
</style>
