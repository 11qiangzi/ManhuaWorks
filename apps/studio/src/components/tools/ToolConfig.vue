<script setup lang="ts">
/**
 * ToolConfig.vue — 工具配置面板
 * L2 林染 任务 2
 *
 * 编辑：
 *   - 提示词模板（用 {{var}} 包裹变量）
 *   - 变量值（按 tool.promptVars 渲染对应输入）
 *   - 启用/禁用、批量开关
 *
 * 实时预览：填入变量值后渲染最终 prompt
 */
import { ref, computed, watch } from 'vue'
import type { StudioTool, ToolPromptVar } from '../../types/studio'

const props = defineProps<{
  tool: StudioTool
  /** 初始变量值 */
  initialValues?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'update:tool', v: StudioTool): void
  (e: 'run', values: Record<string, string>, batch: boolean): void
}>()

const values = ref<Record<string, string>>({})
const batch = ref(false)
const editingTemplate = ref(false)
const draftTemplate = ref(props.tool.promptTemplate)

// 初始化变量值
function initValues() {
  const init: Record<string, string> = {}
  for (const v of props.tool.promptVars) {
    init[v.name] = props.initialValues?.[v.name] ?? v.default
  }
  values.value = init
  draftTemplate.value = props.tool.promptTemplate
}

watch(() => props.tool.id, initValues, { immediate: true })

// 渲染后的 prompt
const renderedPrompt = computed(() => {
  let tpl = props.tool.promptTemplate
  for (const v of props.tool.promptVars) {
    const val = values.value[v.name] ?? ''
    tpl = tpl.replaceAll(`{{${v.name}}}`, val)
  }
  return tpl
})

function onVarInput(v: ToolPromptVar, e: Event) {
  const el = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  values.value[v.name] = el.value
}

function onToggle() {
  emit('update:tool', { ...props.tool, enabled: !props.tool.enabled })
}

function onSaveTemplate() {
  emit('update:tool', { ...props.tool, promptTemplate: draftTemplate.value })
  editingTemplate.value = false
}

function onRun() {
  emit('run', { ...values.value }, batch.value)
}
</script>

<template>
  <div class="tool-config flex flex-col gap-3 text-[12px]">
    <!-- 顶部 -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="flex h-8 w-8 items-center justify-center rounded text-xl">{{ tool.icon }}</span>
        <div>
          <h3 class="text-[14px] font-semibold text-gray-800 dark:text-gray-100">{{ tool.name }}</h3>
          <p class="text-[11px] text-gray-500">{{ tool.description }}</p>
        </div>
      </div>
      <label class="flex items-center gap-1 text-[11px]">
        <input
          type="checkbox"
          :checked="tool.enabled"
          @change="onToggle"
        />
        <span>启用</span>
      </label>
    </div>

    <!-- 提示词模板 -->
    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-semibold uppercase text-gray-500">提示词模板</span>
        <button
          v-if="!editingTemplate"
          class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] hover:bg-gray-200 dark:bg-gray-800"
          @click="editingTemplate = true"
        >✏️ 编辑</button>
        <div v-else class="flex items-center gap-1">
          <button
            class="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] text-white hover:bg-amber-600"
            @click="onSaveTemplate"
          >保存</button>
          <button
            class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] hover:bg-gray-200 dark:bg-gray-800"
            @click="editingTemplate = false"
          >取消</button>
        </div>
      </div>
      <textarea
        v-if="editingTemplate"
        v-model="draftTemplate"
        rows="4"
        class="rounded border border-gray-300 bg-white px-2 py-1 font-mono text-[11px] dark:border-gray-600 dark:bg-gray-800"
      ></textarea>
      <pre
        v-else
        class="overflow-x-auto rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
      >{{ tool.promptTemplate }}</pre>
      <p class="text-[10px] text-gray-400">用 <code class="rounded bg-gray-100 px-1 dark:bg-gray-800">&#123;&#123;name&#125;&#125;</code> 包裹变量</p>
    </div>

    <!-- 变量输入 -->
    <div v-if="tool.promptVars.length > 0" class="flex flex-col gap-2">
      <span class="text-[10px] font-semibold uppercase text-gray-500">变量（{{ tool.promptVars.length }}）</span>
      <div
        v-for="v in tool.promptVars"
        :key="v.name"
        class="flex flex-col gap-1"
      >
        <label class="flex items-center justify-between text-[11px]">
          <span class="font-medium text-gray-700 dark:text-gray-200">
            {{ v.label }}
            <span v-if="v.required" class="text-red-500">*</span>
          </span>
          <span class="font-mono text-[10px] text-gray-400">{{ v.name }} · {{ v.type }}</span>
        </label>
        <textarea
          v-if="v.type === 'textarea'"
          :value="values[v.name] ?? ''"
          rows="2"
          class="rounded border border-gray-300 bg-white px-2 py-1 text-[12px] dark:border-gray-600 dark:bg-gray-800"
          @input="(e) => onVarInput(v, e)"
        ></textarea>
        <select
          v-else-if="v.type === 'select'"
          :value="values[v.name] ?? ''"
          class="rounded border border-gray-300 bg-white px-2 py-1 text-[12px] dark:border-gray-600 dark:bg-gray-800"
          @change="(e) => onVarInput(v, e)"
        >
          <option v-for="o in (v.options ?? [])" :key="o" :value="o">{{ o }}</option>
        </select>
        <input
          v-else
          :type="v.type === 'number' ? 'number' : 'text'"
          :value="values[v.name] ?? ''"
          :step="v.type === 'number' ? 'any' : undefined"
          class="rounded border border-gray-300 bg-white px-2 py-1 text-[12px] dark:border-gray-600 dark:bg-gray-800"
          @input="(e) => onVarInput(v, e)"
        />
        <span v-if="v.help" class="text-[10px] text-gray-400">{{ v.help }}</span>
      </div>
    </div>

    <!-- 实时预览 -->
    <div class="flex flex-col gap-1">
      <span class="text-[10px] font-semibold uppercase text-gray-500">实时预览（替换变量后）</span>
      <pre
        class="max-h-40 overflow-y-auto rounded border border-amber-200 bg-amber-50/50 px-2 py-1 font-mono text-[11px] text-gray-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-gray-200"
      >{{ renderedPrompt }}</pre>
    </div>

    <!-- 操作 -->
    <div class="flex items-center gap-2">
      <label v-if="tool.batchable" class="flex items-center gap-1 text-[11px]">
        <input
          v-model="batch"
          type="checkbox"
        />
        <span>批量运行（按镜头/角色循环）</span>
      </label>
      <button
        class="ml-auto rounded bg-amber-500 px-3 py-1 text-[12px] font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!tool.enabled"
        @click="onRun"
      >▶ 运行</button>
    </div>
  </div>
</template>

<style scoped>
.tool-config {
  width: 100%;
}
</style>
