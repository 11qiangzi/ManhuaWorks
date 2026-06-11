<script setup lang="ts">
/**
 * MobileNav - 移动端底部 Tab 导航
 * - 显示在 ≤ 768px 视口
 * - 桌面端自动隐藏
 * - 可配置 3-5 个 tab
 */
import { computed } from 'vue'
import { useBreakpoint } from '../composables/useBreakpoint'

export interface NavItem {
  key: string
  label: string
  icon?: string
  badge?: number | string
  to?: string
  onClick?: () => void
}

interface Props {
  items: NavItem[]
  activeKey?: string
  modelValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  activeKey: '',
  modelValue: ''
})

const emit = defineEmits<{
  'update:modelValue': [k: string]
  'select': [k: string]
}>()

const bp = useBreakpoint()
const showOnDesktop = computed(() => bp.isDesktop.value || bp.is4K.value)
// 默认桌面端隐藏
const hidden = computed(() => showOnDesktop.value)

function activeOf(item: NavItem): boolean {
  return (props.modelValue || props.activeKey) === item.key
}
function onSelect(item: NavItem) {
  emit('update:modelValue', item.key)
  emit('select', item.key)
  if (item.onClick) item.onClick()
}
</script>

<template>
  <nav
    class="mnav"
    :class="{ 'mnav-hidden': hidden }"
    role="navigation"
    aria-label="移动端导航"
  >
    <button
      v-for="item in items"
      :key="item.key"
      class="mnav-item mi-click-press mi-focus-ring"
      :class="{ active: activeOf(item) }"
      :aria-current="activeOf(item) ? 'page' : undefined"
      @click="onSelect(item)"
    >
      <span v-if="item.icon" class="mnav-icon" aria-hidden="true">{{ item.icon }}</span>
      <span class="mnav-label">{{ item.label }}</span>
      <span v-if="item.badge !== undefined" class="mnav-badge">{{ item.badge }}</span>
    </button>
  </nav>
</template>

<style scoped>
.mnav {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  box-shadow: 0 -2px 8px rgba(0,0,0,0.08);
  padding: var(--space-1) 0 calc(var(--space-1) + env(safe-area-inset-bottom, 0px));
  z-index: var(--z-drawer);
}
.mnav-hidden { display: none; }
.mnav-item {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: none; border: none; cursor: pointer; color: var(--text-secondary);
  padding: var(--space-2) var(--space-1);
  font-size: var(--text-xs);
  position: relative;
  transition: color var(--dur-fast) var(--ease-out);
}
.mnav-item.active { color: var(--primary); }
.mnav-icon { font-size: 20px; line-height: 1; }
.mnav-label { font-size: var(--text-xs); }
.mnav-badge {
  position: absolute;
  top: 4px; right: calc(50% - 20px);
  min-width: 16px; height: 16px; padding: 0 4px;
  background: var(--error); color: white;
  border-radius: 8px;
  font-size: 10px; line-height: 16px;
  text-align: center;
}

@media (min-width: 1024px) {
  .mnav { display: none; }
}
</style>
