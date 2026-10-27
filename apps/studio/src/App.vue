<template>
  <AppShell
    brand-name="千机工坊"
    brand-short="千机"
    sidebar-title="创作工作台"
  >
    <template #nav-items>
      <SidebarNavItem :link-component="RouterLink" :current-path="route.path" to="/" icon="🏠" title="首页" exact />
      <SidebarNavItem :link-component="RouterLink" :current-path="route.path" to="/project/new" icon="✨" title="新建项目" />
      <SidebarNavItem :link-component="RouterLink" :current-path="route.path" to="/project" icon="📖" title="项目编辑器" match-prefix />
      <SidebarNavItem :link-component="RouterLink" :current-path="route.path" to="/project/1/storyboard" icon="🎼" title="配乐编辑" />
      <SidebarNavItem :link-component="RouterLink" :current-path="route.path" to="/materials" icon="🎭" title="素材库" match-prefix />
      <SidebarNavItem :link-component="RouterLink" :current-path="route.path" to="/characters" icon="👤" title="角色管理" match-prefix />
      <SidebarNavItem :link-component="RouterLink" :current-path="route.path" to="/scenes" icon="🎬" title="场景管理" match-prefix />
      <SidebarNavItem :link-component="RouterLink" :current-path="route.path" to="/workflow" icon="🔀" title="工作流" match-prefix />
      <SidebarNavItem :link-component="RouterLink" :current-path="route.path" to="/tools" icon="🧰" title="工具箱" />
      <SidebarNavItem :link-component="RouterLink" :current-path="route.path" to="/export" icon="📤" title="导出" match-prefix />
    </template>

    <template #header-content>
      <div class="studio-header-title">
        <span class="studio-header-app">创作工作台</span>
      </div>
      <div class="studio-header-right">
        <span class="studio-header-user" v-if="userEmail" :title="userEmail">👤 {{ userEmail }}</span>
        <button class="studio-header-logout" @click="logout">退出</button>
      </div>
    </template>

    <template #sidebar-footer>
      <div class="studio-footer-user" v-if="userEmail">
        <span>👤</span>
        <span class="studio-footer-email" :title="userEmail">{{ userEmail }}</span>
      </div>
      <button class="studio-footer-logout" @click="logout">退出登录</button>
    </template>

    <router-view />
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { AppShell, SidebarNavItem } from '@manhuaworks/ui'
import { useAuthStore } from './stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const userEmail = computed(() => auth.user?.email ?? '')

onMounted(() => {
  auth.initAuth()
})

function logout() {
  auth.logout()
  router.push('/')
}
</script>

<style scoped>
.studio-header-title { display: flex; align-items: center; gap: 8px; }
.studio-header-app { font-weight: 600; font-size: 14px; opacity: 0.8; }
.studio-header-right { display: flex; align-items: center; gap: 12px; margin-left: auto; font-size: 13px; }
.studio-header-user { opacity: 0.7; }
.studio-header-logout {
  padding: 4px 10px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid var(--border, #1f2937);
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
  cursor: pointer;
  transition: all 150ms;
}
.studio-header-logout:hover { border-color: #ef4444; color: #ef4444; }
.studio-footer-user { display: flex; align-items: center; gap: 8px; font-size: 12px; opacity: 0.7; margin-bottom: 8px; }
.studio-footer-email { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
.studio-footer-logout {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid var(--border, #1f2937);
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
  cursor: pointer;
  transition: all 150ms;
}
.studio-footer-logout:hover { background: rgba(239, 68, 68, 0.1); border-color: #ef4444; color: #ef4444; }
</style>
