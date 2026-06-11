<script setup lang="ts">
/**
 * AdminLayout — 管理后台布局 (派单 47 重构)
 * 使用共享 AppShell + SidebarNavItem
 */
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { AppShell, SidebarNavItem } from '@manhuaworks/ui'
import { useAdminStore, THEME_LIST, type ThemeName } from '@/stores/admin'

const route = useRoute()
const store = useAdminStore()

onMounted(() => store.initTheme())

const currentTheme = computed(() => store.theme)

function pickTheme(name: ThemeName) {
  store.setTheme(name)
}
</script>

<template>
  <AppShell
    brand-name="漫工场"
    brand-short="漫"
    sidebar-title="管理后台"
  >
    <!-- 品牌副标题 -->
    <template #brand>
      <div>
        <div class="admin-brand-title">漫工场</div>
        <div class="admin-brand-sub">管理后台</div>
      </div>
    </template>

    <!-- 导航项 -->
    <template #nav-items>
      <SidebarNavItem to="/dashboard" icon="📊" title="仪表盘" />
      <SidebarNavItem to="/users" icon="👥" title="用户管理" />
      <SidebarNavItem to="/billing" icon="💳" title="计费管理" />
      <SidebarNavItem to="/audit" icon="📜" title="审计日志" />
      <SidebarNavItem to="/settings" icon="⚙️" title="系统设置" />
      <SidebarNavItem to="/ops" icon="📈" title="业务运营" />
      <SidebarNavItem to="/compliance" icon="🛡️" title="合规审计" />
      <SidebarNavItem to="/projects" icon="📁" title="项目审核" />
      <SidebarNavItem to="/logs" icon="📋" title="系统日志" />
    </template>

    <!-- 顶栏 -->
    <template #header-content>
      <h1 class="admin-topbar-title">{{ route.meta?.title || '管理后台' }}</h1>
      <div class="admin-topbar-right">
        <span class="admin-topbar-pill">🟢 在线</span>
        <span class="admin-topbar-user">林染 · admin</span>
      </div>
    </template>

    <!-- 侧边栏底部 (主题切换) -->
    <template #sidebar-footer>
      <div class="admin-theme-label">主题</div>
      <div class="admin-theme-row">
        <button
          v-for="t in THEME_LIST"
          :key="t.name"
          class="admin-theme-swatch"
          :class="{ active: currentTheme === t.name }"
          :title="t.label"
          :style="{ background: t.preview.bg, borderColor: t.preview.accent }"
          @click="pickTheme(t.name)"
        />
      </div>
    </template>

    <router-view />
  </AppShell>
</template>

<style scoped>
.admin-brand-title { font-weight: 700; font-size: 15px; }
.admin-brand-sub { font-size: 11px; opacity: 0.6; }
.admin-topbar-title { font-size: 18px; font-weight: 600; margin: 0; }
.admin-topbar-right { display: flex; align-items: center; gap: 12px; margin-left: auto; font-size: 13px; }
.admin-topbar-pill {
  background: var(--bg-primary, #0a0e1a);
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border, #1f2937);
  font-size: 12px;
}
.admin-topbar-user { opacity: 0.8; }

.admin-theme-label { font-size: 11px; opacity: 0.6; margin-bottom: 8px; }
.admin-theme-row { display: flex; gap: 6px; }
.admin-theme-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--border, #1f2937);
  cursor: pointer;
  transition: transform 150ms;
}
.admin-theme-swatch:hover { transform: scale(1.1); }
.admin-theme-swatch.active { transform: scale(1.15); }
.admin-theme-swatch.active::after {
  content: '✓';
  display: grid;
  place-items: center;
  height: 100%;
  color: white;
  font-size: 12px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
}
</style>
