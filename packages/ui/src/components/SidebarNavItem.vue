<script setup lang="ts">
/**
 * SidebarNavItem — 共享侧边栏导航项 (派单 47)
 *
 * 用法:
 *   <SidebarNavItem to="/dashboard" icon="📊" title="仪表盘" />
 *   <SidebarNavItem to="/projects" icon="📁" title="项目" match-prefix />
 *
 * 注意: 不直接依赖 vue-router。消费者可以传入 linkComponent 来自定义路由行为。
 */
import { computed, type Component } from 'vue'

const props = withDefaults(
  defineProps<{
    to: string
    icon?: string
    title: string
    /** 前缀匹配 (子路由也算 active) */
    matchPrefix?: boolean
    /** 精确匹配 */
    exact?: boolean
    /** 当前路径 (由父组件传入, 用于 active 判断) */
    currentPath?: string
    /** 自定义链接组件 (默认 <a>) */
    linkComponent?: string | Component
  }>(),
  {
    icon: '',
    matchPrefix: false,
    exact: false,
    currentPath: '/',
    linkComponent: 'a',
  }
)

const isActive = computed(() => {
  const path = props.currentPath
  if (props.exact) return path === props.to
  if (props.matchPrefix) return path.startsWith(props.to)
  return path === props.to
})
</script>

<template>
  <component
    :is="linkComponent"
    :to="linkComponent !== 'a' ? to : undefined"
    :href="linkComponent === 'a' ? to : undefined"
    class="sidebar-nav-item"
    :class="{ 'sidebar-nav-item--active': isActive }"
  >
    <span v-if="icon" class="sidebar-nav-item-icon">{{ icon }}</span>
    <span class="sidebar-nav-item-title">{{ title }}</span>
  </component>
</template>

<style scoped>
.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-secondary, #94a3b8);
  font-size: 14px;
  font-weight: 500;
  transition: all 150ms;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
}
.sidebar-nav-item:hover {
  background: var(--bg-primary, #0a0e1a);
  color: var(--text-primary, #e4e4e7);
}
.sidebar-nav-item--active {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%);
  color: var(--accent);
  border-left: 3px solid var(--accent);
  padding-left: 9px;
  font-weight: 600;
}
.sidebar-nav-item-icon {
  font-size: 18px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}
.sidebar-nav-item-title {
  flex: 1;
  min-width: 0;
}
</style>
