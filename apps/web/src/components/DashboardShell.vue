<script setup lang="ts">
/**
 * DashboardShell · web 站通用 shell
 * 派单 32 林染 · 2026-06-15
 *
 * 顶栏 (logo + 5 导航 + 用户菜单 + 主题切换)
 * 内容区 <slot/>
 *
 * 所有 web 顶级路由 /projects /assets /settings /materials /works /team 都用这个 shell,
 * 保证导航一致 + 旧死链页面有完整 UI
 */
import { RouterLink, useRouter } from 'vue-router'
import { computed, onMounted, ref } from 'vue'

const router = useRouter()
const hostname = window.location.hostname

interface UserInfo {
  id: string
  phone?: string
  email?: string
  nickname: string
  display_name?: string
}
const user = ref<UserInfo | null>(null)

onMounted(() => {
  try {
    const raw = localStorage.getItem('user')
    if (raw) user.value = JSON.parse(raw)
  } catch {
    user.value = null
  }
})

const navItems = [
  { to: '/dashboard', label: '工作台', icon: '📊' },
  { to: '/projects', label: '项目', icon: '📁' },
  { to: '/materials', label: '素材中心', icon: '🎨' },
  { to: '/showcase', label: '作品展示', icon: '✨' },
  { to: '/pricing', label: '定价', icon: '💰' },
  { to: '/settings', label: '设置', icon: '⚙️' },
]

function isActive(path: string): boolean {
  return router.currentRoute.value.path.startsWith(path)
}

function logout(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('mhw.access_token')
  localStorage.removeItem('mhw.user')
  window.location.href = '/login'
}

const displayName = computed(() => user.value?.nickname || user.value?.display_name || '创作者')
</script>

<template>
  <main class="ds">
    <header class="ds__nav">
      <div class="ds__brand">
        <span class="ds__logo">千</span>
        <span class="ds__brand-name">千机工坊</span>
      </div>
      <nav class="ds__nav-links">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="ds__nav-link"
          :class="{ 'ds__nav-link--active': isActive(item.to) }"
        >
          <span class="ds__nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="ds__nav-right">
        <span class="ds__avatar" v-if="user">{{ displayName[0] }}</span>
        <button class="ds__logout" @click="logout">退出</button>
      </div>
    </header>

    <div class="ds__content">
      <slot />
    </div>
  </main>
</template>

<style scoped>
.ds {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

.ds__nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: rgba(10, 14, 26, 0.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}

.ds__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
}

.ds__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--gradient);
  color: white;
  font-size: 14px;
  font-weight: 800;
}

.ds__brand-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.ds__nav-links {
  display: flex;
  gap: 4px;
  flex: 1;
  justify-content: center;
}

.ds__nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s;
}

.ds__nav-link:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.ds__nav-link--active {
  color: white;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
}

.ds__nav-icon {
  font-size: 14px;
}

.ds__nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.ds__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
}

.ds__logout {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 200ms;
}

.ds__logout:hover {
  border-color: var(--danger);
  color: var(--danger);
}

.ds__content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 28px 60px;
}
</style>
