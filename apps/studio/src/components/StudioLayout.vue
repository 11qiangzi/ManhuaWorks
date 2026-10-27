<script setup lang="ts">
/**
 * StudioLayout · 创作者工作台侧边栏
 * 给所有 view 提供统一导航入口
 */
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const userEmail = computed(() => auth.user?.email ?? '')

/** Dynamic storyboard path — uses current project ID from route, falls back to /projects */
const storyboardPath = computed(() => {
  const id = route.params.id
  return id ? `/project/${id}/storyboard` : '/project'
})

const menus = computed(() => [
  { name: 'home', title: '首页', icon: '🏠', to: '/' },
  { name: 'project', title: '项目编辑器', icon: '📖', to: '/project' },
  { name: 'storyboard', title: '配乐编辑', icon: '🎼', to: storyboardPath.value },
  { name: 'materials', title: '素材库', icon: '🎭', to: '/materials' },
  { name: 'workflow', title: '工作流', icon: '🔀', to: '/workflow' },
  { name: 'tools', title: '工具箱', icon: '🧰', to: '/tools' },
  { name: 'export', title: '导出', icon: '📤', to: '/export' }
])

const isActive = (to: string) => {
  if (to === '/') return route.path === '/'
  if (to === '/project') return route.path.startsWith('/project') && !route.path.includes('/storyboard')
  if (to === storyboardPath.value && to.includes('/storyboard')) return route.path.includes('/storyboard')
  if (to === '/materials') return route.path.startsWith('/materials') || route.path === '/characters' || route.path === '/scenes'
  return route.path === to
}

async function logout() {
  try {
    await auth.logout()
  } catch {}
  window.location.href = `http://${window.location.hostname}:3000/login`
}
</script>

<template>
  <div class="studio-layout">
    <aside class="studio-sidebar">
      <div class="studio-brand">
        <span class="studio-logo">千机</span>
        <span class="studio-brand-text">千机工坊</span>
      </div>

      <div class="studio-section-label">创作工作台</div>

      <nav class="studio-nav">
        <RouterLink
          v-for="m in menus"
          :key="m.name"
          :to="m.to"
          class="studio-nav-item"
          :class="{ 'studio-nav-item--active': isActive(m.to) }"
        >
          <span class="studio-nav-icon">{{ m.icon }}</span>
          <span class="studio-nav-title">{{ m.title }}</span>
        </RouterLink>
      </nav>

      <div class="studio-sidebar-footer">
        <div class="studio-user" v-if="userEmail">
          <span class="studio-user-icon">👤</span>
          <span class="studio-user-email" :title="userEmail">{{ userEmail }}</span>
        </div>
        <button class="studio-logout" @click="logout">退出登录</button>
      </div>
    </aside>

    <main class="studio-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.studio-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary, #0a0e1a);
  color: var(--text-primary, #e4e4e7);
}

.studio-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--bg-secondary, #111827);
  border-right: 1px solid var(--border, #1f2937);
  display: flex;
  flex-direction: column;
  padding: 20px 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.studio-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px 20px;
  border-bottom: 1px solid var(--border, #1f2937);
}

.studio-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--gradient);
  color: white;
  font-weight: 800;
  font-size: 16px;
}

.studio-brand-text {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.studio-section-label {
  padding: 16px 20px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary, #94a3b8);
  opacity: 0.7;
}

.studio-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 12px;
}

.studio-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-secondary, #94a3b8);
  font-size: 14px;
  font-weight: 500;
  transition: all 200ms;
}

.studio-nav-item:hover {
  background: var(--bg-tertiary, #1f2937);
  color: var(--text-primary, #e4e4e7);
}

.studio-nav-item--active {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%);
  color: var(--accent);
  border-left: 3px solid var(--accent);
  padding-left: 9px;
}

.studio-nav-icon {
  font-size: 18px;
  width: 20px;
  text-align: center;
}

.studio-nav-title {
  flex: 1;
}

.studio-sidebar-footer {
  border-top: 1px solid var(--border, #1f2937);
  padding: 16px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.studio-user {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}

.studio-user-icon {
  font-size: 14px;
}

.studio-user-email {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.studio-logout {
  padding: 8px 12px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid var(--border, #1f2937);
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
  cursor: pointer;
  transition: all 200ms;
}

.studio-logout:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #ef4444;
}

.studio-main {
  flex: 1;
  overflow: hidden;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
</style>
