<script setup lang="ts">
/**
 * AppShell — 共享应用布局 (派单 47)
 *
 * 5 站统一使用:
 *  - 侧边栏 (响应式: 移动端折叠)
 *  - 顶栏
 *  - 主内容区
 *  - 主题 CSS 变量驱动
 *
 * Slots:
 *  - #brand        品牌 LOGO+名称
 *  - #nav-items    导航菜单项 (RouterLink)
 *  - #sidebar-footer  侧边栏底部 (用户/主题/退出)
 *  - #header-content  顶栏内容
 *  - #default      主内容区
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

export interface AppShellProps {
  /** 侧边栏宽度 (px), default 240 */
  sidebarWidth?: number
  /** 是否折叠侧边栏 (移动端默认折叠) */
  collapsed?: boolean
  /** 品牌名称 */
  brandName?: string
  /** 品牌短名 */
  brandShort?: string
  /** 侧边栏标题 */
  sidebarTitle?: string
}

const props = withDefaults(defineProps<AppShellProps>(), {
  sidebarWidth: 240,
  collapsed: false,
  brandName: '漫工场',
  brandShort: '漫',
  sidebarTitle: '导航',
})

const emit = defineEmits<{
  'update:collapsed': [val: boolean]
}>()

const isCollapsed = ref(props.collapsed)
const isMobile = ref(false)
const mobileDrawerOpen = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value && !mobileDrawerOpen.value) {
    isCollapsed.value = true
  }
}

function toggleSidebar() {
  if (isMobile.value) {
    mobileDrawerOpen.value = !mobileDrawerOpen.value
    isCollapsed.value = !mobileDrawerOpen.value
    return
  }
  isCollapsed.value = !isCollapsed.value
  emit('update:collapsed', isCollapsed.value)
}

function closeMobileDrawer() {
  mobileDrawerOpen.value = false
  isCollapsed.value = true
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})

watch(() => props.collapsed, (v) => {
  isCollapsed.value = v
})
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--mobile': isMobile }">
    <!-- 移动端遮罩 -->
    <div
      v-if="isMobile && !isCollapsed"
      class="app-shell-overlay"
      @click="closeMobileDrawer"
    />

    <!-- 侧边栏 -->
    <aside
      class="app-sidebar"
      :class="{ 'app-sidebar--collapsed': isCollapsed }"
      :style="{ '--sidebar-w': sidebarWidth + 'px' }"
    >
      <!-- 品牌 -->
      <div class="app-sidebar-brand">
        <span class="app-sidebar-logo">{{ brandShort }}</span>
        <slot name="brand">
          <span v-if="!isCollapsed" class="app-sidebar-name">{{ brandName }}</span>
        </slot>
      </div>

      <!-- 导航标题 -->
      <div v-if="!isCollapsed" class="app-sidebar-title">{{ sidebarTitle }}</div>

      <!-- 导航项 -->
      <nav class="app-sidebar-nav" @click="isMobile ? closeMobileDrawer() : undefined">
        <slot name="nav-items" />
      </nav>

      <!-- 底部 -->
      <div class="app-sidebar-footer">
        <slot name="sidebar-footer" />
      </div>
    </aside>

    <!-- 主区域 -->
    <div class="app-main">
      <!-- 顶栏 -->
      <header class="app-header">
        <button class="app-header-toggle" @click="toggleSidebar" :aria-label="isCollapsed ? '展开菜单' : '折叠菜单'">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <div class="app-header-content">
          <slot name="header-content" />
        </div>
      </header>

      <!-- 内容 -->
      <main class="app-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ===== Layout ===== */
.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary, #0a0e1a);
  color: var(--text-primary, #e4e4e7);
}

/* ===== Sidebar ===== */
.app-sidebar {
  width: var(--sidebar-w, 240px);
  flex-shrink: 0;
  background: var(--bg-secondary, #111827);
  border-right: 1px solid var(--border, #1f2937);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  transition: width 0.25s ease;
  z-index: 20;
}
.app-sidebar--collapsed {
  width: 64px;
  overflow-x: hidden;
}

.app-sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px;
  border-bottom: 1px solid var(--border, #1f2937);
}
.app-sidebar-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  background: var(--gradient, linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%));
  color: white;
  font-weight: 800;
  font-size: 16px;
}
.app-sidebar-name {
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
}

.app-sidebar-title {
  padding: 16px 16px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary, #94a3b8);
  opacity: 0.7;
  white-space: nowrap;
}

.app-sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
}

.app-sidebar-footer {
  border-top: 1px solid var(--border, #1f2937);
  padding: 12px 16px;
  margin-top: auto;
}

/* ===== Overlay (mobile) ===== */
.app-shell-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 15;
}

/* ===== Main ===== */
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  height: 56px;
  background: var(--bg-secondary, #111827);
  border-bottom: 1px solid var(--border, #1f2937);
  position: sticky;
  top: 0;
  z-index: 10;
}
.app-header-toggle {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--border, #1f2937);
  color: var(--text-secondary, #94a3b8);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 150ms;
}
.app-header-toggle:hover {
  background: var(--bg-primary, #0a0e1a);
  color: var(--text-primary, #e4e4e7);
}
.app-header-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-content {
  flex: 1;
  padding: 24px 28px;
  overflow-y: auto;
}

/* ===== Responsive ===== */
@media (max-width: 767px) {
  .app-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    z-index: 25;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
  }
  .app-sidebar:not(.app-sidebar--collapsed) {
    transform: translateX(0);
  }
  .app-content {
    padding: 16px 16px;
  }
  .app-header {
    padding: 0 12px;
  }
}
</style>
