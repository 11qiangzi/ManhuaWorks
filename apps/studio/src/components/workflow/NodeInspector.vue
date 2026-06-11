<script setup lang="ts">
/**
 * NodeInspector.vue — 节点检查器：选中节点后配置参数
 * W5 任务 3
 */
import { computed } from 'vue'
import type { WorkflowNode, NodeDefinition } from '../../types/workflow'

const props = defineProps<{
  node: WorkflowNode | null
  definition: NodeDefinition | null
}>()

const emit = defineEmits<{
  update: [patch: Record<string, unknown>]
  remove: []
  close: []
}>()

/** 把 params 的字段按类型简单渲染 */
const fields = computed(() => {
  if (!props.definition) return []
  const params = props.node?.params ?? {}
  return Object.entries(params).map(([key, value]) => ({
    key,
    value,
    type: inferType(value),
  }))
})

function inferType(v: unknown): 'string' | 'number' | 'boolean' | 'array' | 'object' {
  if (typeof v === 'number') return 'number'
  if (typeof v === 'boolean') return 'boolean'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'object' && v !== null) return 'object'
  return 'string'
}

function onInput(key: string, e: Event) {
  const target = e.target as HTMLInputElement | HTMLTextAreaElement
  let val: unknown = target.value
  if (target instanceof HTMLInputElement && target.type === 'number') {
    val = Number(target.value)
  } else if (target instanceof HTMLInputElement && target.type === 'checkbox') {
    val = target.checked
  }
  emit('update', { [key]: val })
}

function onArrayInput(key: string, e: Event) {
  const val = (e.target as HTMLInputElement).value
  emit('update', { [key]: val.split(',').map(s => s.trim()).filter(Boolean) })
}

/** JSON 原始编辑：仅在能 parse 的情况下发 update，避免破环画布 */
function onJsonEdit(e: Event) {
  const txt = (e.target as HTMLTextAreaElement).value
  try {
    const parsed = JSON.parse(txt) as Record<string, unknown>
    // 全量替换 params
    for (const key of Object.keys(props.node?.params ?? {})) {
      emit('update', { [key]: undefined })
    }
    for (const [k, v] of Object.entries(parsed)) {
      emit('update', { [k]: v })
    }
  } catch {
    // 静默：JSON 还没输入完整，保持原状
  }
}
</script>

<template>
  <div
    class="flex h-full w-72 flex-col overflow-hidden border-l border-gray-200 bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80"
  >
    <!-- 标题 -->
    <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">节点检查器</h2>
      <button
        v-if="node"
        class="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>

    <!-- 空状态 -->
    <div
      v-if="!node || !definition"
      class="flex flex-1 items-center justify-center p-6 text-center text-xs text-gray-400"
    >
      <div>
        <div class="mb-2 text-2xl">👈</div>
        <div>选中画布上的节点<br />在此编辑参数</div>
      </div>
    </div>

    <!-- 节点详情 -->
    <div v-else class="flex-1 overflow-y-auto">
      <!-- 头部：图标+类型+id -->
      <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div class="flex items-center gap-2">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-md text-lg"
            :class="`bg-${definition.color}-100 text-${definition.color}-600 dark:bg-${definition.color}-900/40 dark:text-${definition.color}-300`"
          >
            {{ definition.icon }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
              {{ definition.label }}
            </div>
            <div class="truncate font-mono text-[10px] text-gray-400">
              {{ node.id }}
            </div>
          </div>
        </div>
        <p class="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {{ definition.description }}
        </p>
      </div>

      <!-- 端口信息 -->
      <div class="border-b border-gray-200 px-4 py-3 text-xs dark:border-gray-700">
        <div class="mb-1.5 font-semibold text-gray-600 dark:text-gray-300">输入端口</div>
        <div v-if="definition.inputs.length === 0" class="text-gray-400">无</div>
        <div
          v-for="p in definition.inputs"
          :key="p.id"
          class="flex items-center justify-between py-0.5 text-gray-500 dark:text-gray-400"
        >
          <span>{{ p.label }}<span v-if="p.required" class="text-red-500">*</span></span>
          <span class="font-mono text-[10px] text-gray-400">{{ p.dataType }}</span>
        </div>
        <div class="mb-1.5 mt-2 font-semibold text-gray-600 dark:text-gray-300">输出端口</div>
        <div
          v-for="p in definition.outputs"
          :key="p.id"
          class="flex items-center justify-between py-0.5 text-gray-500 dark:text-gray-400"
        >
          <span>{{ p.label }}</span>
          <span class="font-mono text-[10px] text-gray-400">{{ p.dataType }}</span>
        </div>
      </div>

      <!-- 参数编辑 -->
      <div class="px-4 py-3">
        <div class="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">参数</div>
        <div class="space-y-3">
          <div v-for="f in fields" :key="f.key">
            <label class="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">
              {{ f.key }}
            </label>
            <textarea
              v-if="f.type === 'string' && String(f.value).length > 40"
              :value="String(f.value)"
              rows="3"
              class="w-full rounded border border-gray-300 bg-white px-2 py-1 font-mono text-xs text-gray-800 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              @input="onInput(f.key, $event)"
            />
            <input
              v-else-if="f.type === 'string'"
              type="text"
              :value="String(f.value)"
              class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              @input="onInput(f.key, $event)"
            />
            <input
              v-else-if="f.type === 'number'"
              type="number"
              :value="Number(f.value)"
              step="0.1"
              class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              @input="onInput(f.key, $event)"
            />
            <label v-else-if="f.type === 'boolean'" class="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                :checked="Boolean(f.value)"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                @input="onInput(f.key, $event)"
              />
              <span>{{ f.value ? '开启' : '关闭' }}</span>
            </label>
            <input
              v-else-if="f.type === 'array'"
              type="text"
              :value="Array.isArray(f.value) ? f.value.join(', ') : ''"
              placeholder="逗号分隔"
              class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              @input="onArrayInput(f.key, $event)"
            />
            <input
              v-else
              type="text"
              :value="JSON.stringify(f.value)"
              disabled
              class="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900/50"
            />
          </div>
        </div>
      </div>

      <!-- 参数 JSON（原始） -->
      <div class="mx-4 mb-3">
        <details class="rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/60">
          <summary class="cursor-pointer px-2 py-1 text-[11px] font-semibold text-gray-500 dark:text-gray-300">
            params JSON (raw)
          </summary>
          <textarea
            :value="JSON.stringify(node.params, null, 2)"
            rows="6"
            class="mt-1 w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200"
            @input="onJsonEdit($event)"
          />
        </details>
      </div>

      <!-- 运行时信息（如果有） -->
      <div
        v-if="node.status"
        class="mx-4 mb-3 rounded border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-800/50"
      >
        <div class="mb-1 font-semibold text-gray-600 dark:text-gray-300">运行时</div>
        <div class="flex items-center gap-2">
          <span
            class="h-2 w-2 rounded-full"
            :class="{
              'bg-gray-400': node.status === 'idle',
              'bg-yellow-400': node.status === 'queued',
              'bg-blue-500 animate-pulse': node.status === 'running',
              'bg-green-500': node.status === 'success',
              'bg-red-500': node.status === 'error',
              'bg-gray-300': node.status === 'skipped',
            }"
          />
          <span class="text-gray-600 dark:text-gray-300">{{ node.status }}</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="px-4 pb-4">
        <button
          class="w-full rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
          @click="emit('remove')"
        >
          删除节点
        </button>
      </div>
    </div>
  </div>
</template>
