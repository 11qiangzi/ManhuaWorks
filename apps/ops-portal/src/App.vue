<script setup lang="ts">
/**
 * ops-portal App.vue · 业务运营后台 (派单 47 重构)
 * 使用共享 AppShell 布局
 */
import { RouterView, useRoute } from 'vue-router'
import { AppShell, SidebarNavItem } from '@manhuaworks/ui'

const route = useRoute()
</script>

<template>
  <AppShell
    brand-name="漫工场"
    brand-short="漫"
    sidebar-title="业务运营"
  >
    <template #brand>
      <div>
        <div class="ops-brand-title">漫工场</div>
        <div class="ops-brand-sub">业务运营</div>
      </div>
    </template>

    <template #nav-items>
      <SidebarNavItem to="/dashboard" icon="📊" title="数据看板" />
      <SidebarNavItem to="/users" icon="👥" title="用户管理" />
      <SidebarNavItem to="/billing" icon="💰" title="计费充值" />
      <SidebarNavItem to="/monitoring" icon="📡" title="系统监控" />
      <SidebarNavItem to="/system" icon="⚙️" title="系统管理" />
      <SidebarNavItem to="/logs" icon="📜" title="运维日志" />
    </template>

    <template #header-content>
      <h1 class="ops-topbar-title">{{ route.meta?.title || '业务运营' }}</h1>
      <div class="ops-topbar-right">
        <span class="ops-topbar-pill">🟢 在线</span>
      </div>
    </template>

    <template #sidebar-footer>
      <span class="ops-version">v0.3</span>
    </template>

    <RouterView />
  </AppShell>
</template>

<style scoped>
.ops-brand-title { font-weight: 700; font-size: 15px; }
.ops-brand-sub { font-size: 11px; opacity: 0.6; }
.ops-topbar-title { font-size: 18px; font-weight: 600; margin: 0; }
.ops-topbar-right { display: flex; align-items: center; gap: 12px; margin-left: auto; font-size: 13px; }
.ops-topbar-pill {
  background: var(--bg-tertiary, #F1F5F9);
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border, #E2E8F0);
  font-size: 12px;
}
.ops-version { font-size: 11px; color: var(--text-muted, #94A3B8); }
</style>
