<script setup lang="ts">
/**
 * LogFilter — 审计日志筛选
 */
const props = defineProps<{
  level: string
  action: string
  actor: string
}>()
const emit = defineEmits<{
  (e: 'update:level', v: string): void
  (e: 'update:action', v: string): void
  (e: 'update:actor', v: string): void
  (e: 'reset'): void
}>()

function setLevel(v: string) { emit('update:level', v) }
function setAction(v: string) { emit('update:action', v) }
function setActor(v: string) { emit('update:actor', v) }

/* ===== 音频操作类型快捷筛选 ===== */
const audioActions = [
  { key: 'music.generate', label: '生成音乐' },
  { key: 'music.assign',   label: '配乐关联项目' },
  { key: 'music.upload',   label: '上传音频素材' },
  { key: 'music.delete',   label: '删除音频' },
]

function toggleAudioAction(key: string) {
  setAction(props.action === key ? '' : key)
}
</script>

<template>
  <div class="lf">
    <div class="lf-field">
      <label>级别</label>
      <select :value="props.level" @change="setLevel(($event.target as HTMLSelectElement).value)" class="lf-select">
        <option value="">全部</option>
        <option value="info">INFO</option>
        <option value="warn">WARN</option>
        <option value="error">ERROR</option>
      </select>
    </div>
    <div class="lf-field">
      <label>操作</label>
      <input
        :value="props.action"
        @input="setAction(($event.target as HTMLInputElement).value)"
        placeholder="如 user.login"
        class="lf-input"
      />
    </div>
    <div class="lf-field">
      <label>操作人</label>
      <input
        :value="props.actor"
        @input="setActor(($event.target as HTMLInputElement).value)"
        placeholder="用户名"
        class="lf-input"
      />
    </div>
    <button class="lf-reset" @click="emit('reset')">重置</button>

    <!-- 音频操作类型快捷筛选 -->
    <div class="lf-chips-row">
      <span class="lf-chips-label">🎵 音频操作</span>
      <button
        v-for="a in audioActions"
        :key="a.key"
        class="lf-chip"
        :class="{ 'lf-chip--active': props.action === a.key }"
        @click="toggleAudioAction(a.key)"
      >
        {{ a.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.lf { display: flex; align-items: flex-end; gap: 12px; padding: 14px 16px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; flex-wrap: wrap; }
.lf-field { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
.lf-field label { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.lf-select, .lf-input {
  padding: 7px 10px; background: var(--bg-primary); border: 1px solid var(--border);
  border-radius: 6px; color: var(--text-primary); font-size: 13px; outline: none;
}
.lf-select:focus, .lf-input:focus { border-color: var(--accent); }
.lf-reset { padding: 7px 14px; border-radius: 6px; background: var(--bg-primary); border: 1px solid var(--border); color: var(--text-secondary); font-size: 12px; cursor: pointer; }
.lf-reset:hover { color: var(--accent); border-color: var(--accent); }

/* Audio operation filter chips */
.lf-chips-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  margin-top: 2px;
  flex-wrap: wrap;
}

.lf-chips-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-right: 4px;
  white-space: nowrap;
}

.lf-chip {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-family: inherit;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.lf-chip:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.lf-chip--active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}
</style>
