# 派单 49 — UserLayout 接入 App.vue 修复报告

**执行人**: 林染 (开发部前端)  
**派单人**: 虾总助  
**完工时间**: 2026-06-11 01:10  
**来源**: 林知行 P0 内容整改 25/25 ✅，遗留 P1 待办

---

## 改动文件

### `apps/user-portal/src/App.vue`

**改动**: 从 `AppShell` (共享 UI 包) 切换为独立 `UserLayout` 组件

| 项目 | 改动前 | 改动后 |
|------|--------|--------|
| 布局组件 | `<AppShell>` from `@manhuaworks/ui` | `<UserLayout>` from `./components/UserLayout.vue` |
| 导航项 | 8 个 `<SidebarNavItem>` 模板内声明 | UserLayout 内置 7 项中文化菜单 |
| 用户信息 | Options API `<script>` 块独立管理 | UserLayout 内置 localStorage 读取 |
| 无用样式 | `.portal-header-title` / `.portal-header-user` | 已清理 |

**关键 diff**:
```
- import { AppShell, SidebarNavItem } from '@manhuaworks/ui'
+ import UserLayout from './components/UserLayout.vue'

- <AppShell brand-name="漫工场" ...>
-   <template #nav-items>...</template>
-   <template #header-content>...</template>
-   <RouterView v-slot="...">...</RouterView>
- </AppShell>
+ <UserLayout>
+   <RouterView v-slot="...">...</RouterView>
+ </UserLayout>
```

---

## UserLayout 内置导航菜单 (全中文)

| 路由 | 图标 | 标题 |
|------|------|------|
| `/dashboard` | 🏠 | 工作台 |
| `/projects` | 📁 | 我的项目 |
| `/works` | 🎬 | 我的作品 |
| `/assets` | 🖼️ | 素材库 |
| `/team` | 👥 | 我的团队 |
| `/byok` | 🔑 | API 密钥 |
| `/settings` | ⚙️ | 设置 |

侧边栏品牌色: `#7C3AED` (紫色), 展开宽度 240px, 用户信息/退出登录在底栏。

---

## 5 站验证结果

| # | 站 | 端口 | 布局状态 | 侧边栏 | 导航中文化 |
|---|-----|------|----------|--------|------------|
| 1 | **user-portal** | 5180 | ✅ UserLayout | ✅ 独立组件 | ✅ 全中文 (7项) |
| 2 | **studio** | 5170 | ✅ AppShell | ✅ 共享UI | ✅ 全中文 (6项) |
| 3 | **admin-portal** | 5181 | ⚠️ 无布局 | ❌ 仅 `<router-view />` | ❌ 无侧边栏 |
| 4 | **ops-portal** | 5182 | ✅ AppShell | ✅ 共享UI | ✅ 全中文 (6项) |
| 5 | **web** | 5173 | N/A 公开站 | N/A | N/A |

### 说明

- **user-portal** ✅: UserLayout 已接入，侧边栏 + 路由动画正常。
- **studio** ✅: 派单 47 已用 AppShell 重构，中文化完成。
- **ops-portal** ✅: 派单 47 已用 AppShell 重构，中文化完成。
- **admin-portal** ⚠️: 当前仅 `<router-view />`，无任何布局包裹。**建议单独派单给林知行/林染补充 admin 侧边栏。**
- **web**: 公开展示站，无需后台布局。

---

## 构建状态

- **TypeScript 类型检查**: 预存错误 50+ (AccountView, SettingsView, packages/ui 等)，均为历史遗留，本次改动**零新增错误**。
- **Vite 构建**: 失败于 `@manhuaworks/vite-plugin-webp` 包解析 (monorepo 依赖链接问题，预存 bug)，与本改动无关。

---

## 遗留建议

1. **admin-portal 布局补充**: 当前 admin-portal 的 `App.vue` 仅有 `<router-view />`，建议参照 user-portal/studio/ops 补充侧边栏布局（可复用 AppShell 或独立 Layout）。
2. **monorepo 依赖修复**: `pnpm install` 报错 + `vite-plugin-webp` 无法解析，需排查 pnpm workspace 链接配置。
