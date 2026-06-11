<script setup lang="ts">
/**
 * Toolbar.vue — 顶部工具栏 V2
 * 林染 🔮 2026-06-10: 深色主题重设计，分组清晰
 */
import { ref } from 'vue'

const props = defineProps<{
  workflowName: string
  dirty: boolean
  canUndo: boolean
  canRedo: boolean
  isRunning: boolean
  theme: 'light' | 'dark' | 'auto'
  nodeCount: number
  edgeCount: number
}>()

const emit = defineEmits<{
  rename: [name: string]
  save: []
  load: []
  run: []
  debug: []
  cancel: []
  undo: []
  redo: []
  zoomIn: []
  zoomOut: []
  zoomReset: []
  changeTheme: [t: 'light' | 'dark' | 'auto']
  newWorkflow: []
}>()

const editing = ref(false)
const draftName = ref(props.workflowName)

function startEdit() {
  draftName.value = props.workflowName
  editing.value = true
}
function commitEdit() {
  if (draftName.value.trim() && draftName.value !== props.workflowName) {
    emit('rename', draftName.value.trim())
  }
  editing.value = false
}
</script>

<template>
  <header class="tb-root">
    <!-- 左：名称 + 编辑 -->
    <div class="tb-left">
      <span class="tb-icon">🔀</span>
      <div class="tb-name-wrap">
        <input
          v-if="editing"
          v-model="draftName"
          class="tb-name-input"
          @blur="commitEdit"
          @keydown.enter="commitEdit"
          @keydown.esc="editing = false"
        />
        <span v-else class="tb-name" @click="startEdit">
          {{ workflowName }}
          <span v-if="dirty" class="tb-dirty">●</span>
        </span>
      </div>
      <span class="tb-sep">|</span>
      <span class="tb-stat">{{ nodeCount }} 节点</span>
      <span class="tb-stat">{{ edgeCount }} 连线</span>
      <span v-if="isRunning" class="tb-badge tb-badge--running">运行中</span>
    </div>

    <!-- 右：操作按钮组 -->
    <div class="tb-right">
      <!-- 文件操作 -->
      <div class="tb-group">
        <button class="tb-btn" title="新建工作流" @click="emit('newWorkflow')">新建</button>
        <button class="tb-btn" title="加载工作流" @click="emit('load')">加载</button>
        <button class="tb-btn tb-btn--accent" title="保存 (Ctrl+S)" @click="emit('save')">保存</button>
      </div>

      <!-- 缩放 -->
      <div class="tb-group">
        <button class="tb-btn tb-btn--icon" title="缩小" @click="emit('zoomOut')">−</button>
        <button class="tb-btn tb-btn--icon" title="重置缩放" @click="emit('zoomReset')">⊙</button>
        <button class="tb-btn tb-btn--icon" title="放大" @click="emit('zoomIn')">+</button>
      </div>

      <!-- 运行 -->
      <div class="tb-group">
        <button
          v-if="!isRunning"
          class="tb-btn tb-btn--run"
          title="运行 (Ctrl+Enter)"
          @click="emit('run')"
        >▶ 运行</button>
        <button
          v-else
          class="tb-btn tb-btn--stop"
          title="停止"
          @click="emit('cancel')"
        >■ 停止</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.tb-root {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  flex-shrink: 0;
  padding: 0 16px;
  border-bottom: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  gap: 16px;
}

/* === Left === */
.tb-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.tb-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.tb-name-wrap {
  min-width: 0;
}

.tb-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary, #e4e4e7);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  display: block;
}

.tb-name:hover {
  color: var(--accent, #818cf8);
}

.tb-dirty {
  color: #fbbf24;
  margin-left: 2px;
}

.tb-name-input {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary, #e4e4e7);
  background: var(--bg-tertiary, #1f2937);
  border: 1px solid var(--accent, #818cf8);
  border-radius: 6px;
  padding: 3px 8px;
  width: 200px;
  outline: none;
}

.tb-sep {
  color: var(--border, #1f2937);
  font-size: 12px;
}

.tb-stat {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
  white-space: nowrap;
}

.tb-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 8px;
}

.tb-badge--running {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
}

/* === Right === */
.tb-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.tb-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-tertiary, #1f2937);
}

/* === Buttons === */
.tb-btn {
  padding: 5px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #94a3b8);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms;
  white-space: nowrap;
}

.tb-btn:hover {
  background: var(--bg-primary, #0a0e1a);
  color: var(--text-primary, #e4e4e7);
}

.tb-btn:active {
  transform: scale(0.97);
}

.tb-btn--icon {
  padding: 5px 8px;
  font-size: 14px;
  font-weight: 400;
}

.tb-btn--accent {
  color: var(--accent, #818cf8);
}

.tb-btn--accent:hover {
  color: #a5b4fc;
}

.tb-btn--run {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
  padding: 5px 14px;
}

.tb-btn--run:hover {
  background: linear-gradient(135deg, #7c85f0 0%, #8c5cbc 100%);
  color: white;
  box-shadow: 0 2px 12px rgba(102,126,234,0.3);
}

.tb-btn--stop {
  color: #ef4444;
  font-weight: 600;
}

.tb-btn--stop:hover {
  background: rgba(239, 68, 68, 0.08);
}
</style>
