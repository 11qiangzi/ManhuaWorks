<script setup lang="ts">
/**
 * NodePalette.vue — 节点面板 V2
 * 林染 🔮 2026-06-10: 重设计 — 卡片式节点，深色主题，搜索过滤
 */
import { ref, computed } from 'vue'
import {
  NODE_DEFINITIONS,
  NODE_CATEGORY_LABELS,
  NODE_CATEGORY_ORDER,
  type NodeDefinition,
  type NodeCategory,
} from '../../types/workflow'

const emit = defineEmits<{
  dragStart: [def: NodeDefinition, e: PointerEvent]
}>()

const searchQuery = ref('')
const collapsedCategories = ref<Set<NodeCategory>>(new Set())

const grouped = computed(() => {
  const m = new Map<NodeCategory, NodeDefinition[]>()
  for (const cat of NODE_CATEGORY_ORDER) m.set(cat, [])
  for (const def of NODE_DEFINITIONS) {
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      if (!def.label.toLowerCase().includes(q) && !def.description.toLowerCase().includes(q)) continue
    }
    m.get(def.category)!.push(def)
  }
  return m
})

const visibleCategories = computed(() =>
  NODE_CATEGORY_ORDER.filter(cat => (grouped.value.get(cat)?.length ?? 0) > 0)
)

const totalVisible = computed(() =>
  NODE_CATEGORY_ORDER.reduce((s, cat) => s + (grouped.value.get(cat)?.length ?? 0), 0)
)

function toggleCategory(cat: NodeCategory) {
  const s = new Set(collapsedCategories.value)
  if (s.has(cat)) s.delete(cat); else s.add(cat)
  collapsedCategories.value = s
}

function onPointerDown(def: NodeDefinition, e: PointerEvent) {
  emit('dragStart', def, e)
}
</script>

<template>
  <div class="np-root">
    <!-- 标题 + 搜索 -->
    <div class="np-head">
      <h3 class="np-title">节点面板</h3>
      <div class="np-search-wrap">
        <span class="np-search-icon">🔍</span>
        <input
          v-model="searchQuery"
          class="np-search-input"
          placeholder="搜索节点…"
        />
      </div>
    </div>

    <!-- 节点列表 -->
    <div class="np-list">
      <div
        v-for="cat in visibleCategories"
        :key="cat"
        class="np-category"
      >
        <button
          class="np-cat-header"
          @click="toggleCategory(cat)"
        >
          <span class="np-cat-arrow" :class="{ 'np-cat-arrow--collapsed': collapsedCategories.has(cat) }">▾</span>
          <span class="np-cat-label">{{ NODE_CATEGORY_LABELS[cat] }}</span>
          <span class="np-cat-count">{{ grouped.get(cat)?.length }}</span>
        </button>

        <div v-if="!collapsedCategories.has(cat)" class="np-cat-items">
          <button
            v-for="def in grouped.get(cat)"
            :key="def.type"
            class="np-item"
            :style="{ '--n-color': `var(--node-${def.type}, #667eea)` }"
            :title="def.description"
            @pointerdown="onPointerDown(def, $event)"
          >
            <span class="np-item-icon">{{ def.icon }}</span>
            <div class="np-item-body">
              <span class="np-item-label">{{ def.label }}</span>
              <span class="np-item-desc">{{ def.description.slice(0, 30) }}{{ def.description.length > 30 ? '…' : '' }}</span>
            </div>
            <span class="np-item-grip">⠿</span>
          </button>
        </div>
      </div>

      <!-- 空搜索结果 -->
      <div v-if="totalVisible === 0" class="np-empty">
        <span>未找到匹配节点</span>
      </div>
    </div>

    <!-- 底部 -->
    <div class="np-foot">
      <span>{{ totalVisible }} 个节点</span>
      <span class="np-foot-hint">拖拽到画布</span>
    </div>
  </div>
</template>

<style scoped>
.np-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary, #111827);
}

/* === Head === */
.np-head {
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--border, #1f2937);
}

.np-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary, #e4e4e7);
  margin: 0 0 10px;
}

.np-search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1f2937);
}

.np-search-icon {
  font-size: 12px;
  opacity: 0.5;
}

.np-search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary, #e4e4e7);
  font-size: 12px;
  font-family: inherit;
  outline: none;
}

.np-search-input::placeholder {
  color: var(--text-secondary, #94a3b8);
}

/* === List === */
.np-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

/* === Category === */
.np-category {
  border-bottom: 1px solid var(--border, #1f2937);
}

.np-category:last-child {
  border-bottom: none;
}

.np-cat-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: var(--bg-tertiary, #1f2937);
  color: var(--text-secondary, #94a3b8);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background 150ms;
}

.np-cat-header:hover {
  background: rgba(129, 140, 248, 0.06);
}

.np-cat-arrow {
  font-size: 8px;
  transition: transform 200ms;
  flex-shrink: 0;
}

.np-cat-arrow--collapsed {
  transform: rotate(-90deg);
}

.np-cat-label {
  flex: 1;
  text-align: left;
}

.np-cat-count {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--bg-primary, #0a0e1a);
  color: var(--text-secondary, #94a3b8);
}

/* === Items === */
.np-cat-items {
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.np-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary, #e4e4e7);
  cursor: grab;
  transition: all 150ms;
  text-align: left;
}

.np-item:hover {
  border-color: rgba(129, 140, 248, 0.3);
  background: rgba(129, 140, 248, 0.06);
}

.np-item:active {
  cursor: grabbing;
  border-color: var(--accent, #818cf8);
  background: rgba(129, 140, 248, 0.1);
}

.np-item-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.np-item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.np-item-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
}

.np-item-desc {
  font-size: 10px;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.np-item-grip {
  font-size: 14px;
  color: var(--text-secondary, #94a3b8);
  opacity: 0.4;
  flex-shrink: 0;
  letter-spacing: 1px;
}

.np-item:hover .np-item-grip {
  opacity: 0.8;
  color: var(--accent, #818cf8);
}

/* === Empty === */
.np-empty {
  padding: 40px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}

/* === Foot === */
.np-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  border-top: 1px solid var(--border, #1f2937);
  font-size: 10px;
  color: var(--text-secondary, #94a3b8);
}

.np-foot-hint {
  opacity: 0.5;
}
</style>
