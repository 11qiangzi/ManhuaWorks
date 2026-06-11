<script setup lang="ts">
/**
 * SettingModule — 通用设置模块
 * 接受 schema（字段定义）+ value（当前值），渲染表单，emit save
 */
import { ref, watch } from 'vue'

export interface FieldSchema {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'switch'
  options?: { label: string; value: string }[]
  placeholder?: string
  hint?: string
}

const props = defineProps<{
  moduleKey: string
  title: string
  desc: string
  icon: string
  fields: FieldSchema[]
  value: Record<string, unknown>
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'save', payload: { module: string; value: Record<string, unknown> }): void
}>()

const local = ref<Record<string, unknown>>({ ...props.value })
const dirty = ref(false)

watch(() => props.value, (v) => { local.value = { ...v }; dirty.value = false }, { deep: true })

function onInput() { dirty.value = true }

function save() {
  emit('save', { module: props.moduleKey, value: { ...local.value } })
  dirty.value = false
}

function reset() {
  local.value = { ...props.value }
  dirty.value = false
}
</script>

<template>
  <section class="sm">
    <header class="sm-head">
      <div class="sm-head-left">
        <span class="sm-icon">{{ icon }}</span>
        <div>
          <h3 class="sm-title">{{ title }}</h3>
          <p class="sm-desc">{{ desc }}</p>
        </div>
      </div>
      <div class="sm-head-right">
        <span v-if="dirty" class="sm-dirty">未保存</span>
        <button class="sm-btn" :disabled="!dirty" @click="reset">重置</button>
        <button class="sm-btn primary" :disabled="!dirty || loading" @click="save">
          {{ loading ? '保存中…' : '保存' }}
        </button>
      </div>
    </header>

    <div v-if="loading && !fields.length" class="sm-loading">加载中…</div>
    <div v-else class="sm-grid">
      <label v-for="f in fields" :key="f.key" class="sm-field">
        <span class="sm-label">{{ f.label }}</span>

        <input
          v-if="f.type === 'text'"
          v-model="local[f.key]"
          :placeholder="f.placeholder"
          class="sm-input"
          @input="onInput"
        />

        <input
          v-else-if="f.type === 'number'"
          v-model.number="local[f.key]"
          type="number"
          :placeholder="f.placeholder"
          class="sm-input"
          @input="onInput"
        />

        <select
          v-else-if="f.type === 'select'"
          v-model="local[f.key]"
          class="sm-input"
          @change="onInput"
        >
          <option v-for="opt in f.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>

        <label v-else-if="f.type === 'switch'" class="sm-switch">
          <input
            type="checkbox"
            :checked="!!local[f.key]"
            @change="(e) => { local[f.key] = (e.target as HTMLInputElement).checked; onInput() }"
          />
          <span class="sm-switch-track" />
          <span class="sm-switch-label">{{ local[f.key] ? '开启' : '关闭' }}</span>
        </label>

        <span v-if="f.hint" class="sm-hint">{{ f.hint }}</span>
      </label>
    </div>
  </section>
</template>

<style scoped>
.sm {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 22px;
}
.sm-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
.sm-head-left { display: flex; gap: 12px; align-items: flex-start; }
.sm-icon { font-size: 24px; line-height: 1; }
.sm-title { margin: 0; font-size: 16px; font-weight: 600; }
.sm-desc { margin: 4px 0 0; font-size: 12px; color: var(--text-secondary); }
.sm-head-right { display: flex; gap: 8px; align-items: center; }
.sm-dirty { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(251, 191, 36, 0.12); color: var(--warning); }

.sm-btn { padding: 7px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); font-size: 13px; cursor: pointer; }
.sm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sm-btn.primary { background: var(--accent); color: white; border-color: var(--accent); }
.sm-btn.primary:disabled { background: var(--border); color: var(--text-secondary); border-color: var(--border); }

.sm-loading { padding: 20px; text-align: center; opacity: 0.6; }

.sm-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px 20px; }
.sm-field { display: flex; flex-direction: column; gap: 6px; }
.sm-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
.sm-input {
  padding: 8px 10px; background: var(--bg-primary); border: 1px solid var(--border);
  border-radius: 6px; color: var(--text-primary); font-size: 13px; outline: none;
  font-family: inherit;
}
.sm-input:focus { border-color: var(--accent); }
.sm-hint { font-size: 11px; color: var(--text-secondary); }

.sm-switch { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
.sm-switch input { display: none; }
.sm-switch-track { width: 36px; height: 20px; background: var(--border); border-radius: 999px; position: relative; transition: background 200ms; }
.sm-switch-track::after { content: ''; position: absolute; width: 16px; height: 16px; border-radius: 50%; background: white; top: 2px; left: 2px; transition: left 200ms; }
.sm-switch input:checked + .sm-switch-track { background: var(--accent); }
.sm-switch input:checked + .sm-switch-track::after { left: 18px; }
.sm-switch-label { font-size: 13px; color: var(--text-primary); }
</style>
