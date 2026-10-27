<script setup lang="ts">
/**
 * ops-portal App.vue · 业务运营后台 (派单 47 重构)
 * P1-3 更新: 删除已迁移到 admin 的 dashboard/users/billing 导航项
 * 使用共享 AppShell 布局
 */
import { RouterView, useRoute } from 'vue-router'
import { AppShell, SidebarNavItem } from '@manhuaworks/ui'

const route = useRoute()
</script>

<template>
  <AppShell
    brand-name="千机工坊"
    brand-short="千机"
    sidebar-title="业务运营"
  >
    <template #brand>
      <div>
        <div class="ops-brand-title">千机工坊</div>
        <div class="ops-brand-sub">业务运营</div>
      </div>
    </template>

    <template #nav-items>
      <!-- P1-3: dashboard/users/billing 已迁入 admin-portal(5174), 侧边栏仅保留独特视图 -->
      <SidebarNavItem to="/monitoring" icon="📡" title="系统监控" />
      <SidebarNavItem to="/system" icon="⚙️" title="系统管理" />
      <SidebarNavItem to="/logs" icon="📋" title="运维日志" />
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
