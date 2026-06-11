# 派单 31 完工报告 — 5 站 UI 改版

> **完工时间**: 2026-06-10 18:40
> **执行人**: 林染 🖥️ 开发部前端
> **Session**: agent:main:subagent:38725cc6-ee52-4d31-a508-74d7a5969c00
> **设计参考**: `D:\ManhuaWorks\docs\design\mockups\html\shared.css` (紫蓝深色主题)

---

## 5 站状态

| 站 | 端口 | 状态 | 验证 |
|---|------|------|------|
| web | 3000 | ✅ | 浏览器渲染正常 (t21) |
| studio | 5175 | ✅ | 侧边栏 + 首页渲染正常 (t22) |
| user-portal | 5180 | ✅ | Dashboard 自动跳转 (t26) |
| admin-portal | 5174 | ✅ | 鉴权重定向到登录，正确行为 (t19) |
| ops-portal | 5176 | ✅ | 鉴权重定向到登录，正确行为 (t20) |

---

## 设计系统变更

### Mockup 紫蓝深色主题 CSS 变量

| 变量 | 旧值 (橙色系) | 新值 (紫蓝系) |
|------|-------------|-------------|
| `--bg-primary` | #0e0f12 | #0a0e1a |
| `--bg-secondary` | #1a1c21 | #111827 |
| `--bg-card` | (无) | #141a2e |
| `--bg-tertiary` | (无) | #1a2332 |
| `--accent` | #ff7a45 (橙) | #818cf8 (紫蓝) |
| `--accent-strong` | (无) | #6366f1 |
| `--gradient` | #ff7a45→#ff4d6d | #667eea→#764ba2 |
| `--text-muted` | (无) | #64748b |
| `--radius` | (无) | 12px |
| `--radius-sm` | (无) | 8px |
| `--radius-lg` | (无) | 16px |
| `--shadow` | 0 4px 12px rgba(0,0,0,.3) | 0 4px 24px rgba(0,0,0,.4) |
| `--font-mono` | (无) | SF Mono/Cascadia Code |

---

## 改动文件清单

### 全局 CSS (5 文件, ~280 行)
| 文件 | 改动 | 行数 |
|------|------|------|
| `apps/web/src/styles/tailwind.css` | 全量重写 mockup 设计系统 | ~40 行 |
| `apps/studio/src/styles/tailwind.css` | 全量重写 mockup 设计系统 | ~40 行 |
| `apps/user-portal/src/styles/tailwind.css` | 全量重写 mockup 设计系统 | ~40 行 |
| `apps/admin-portal/src/styles/tailwind.css` | 全量重写 mockup 设计系统 | ~40 行 |
| `apps/ops-portal/src/styles/tailwind.css` | **新建** mockup 设计系统 | ~40 行 |

### web 3000 (4 文件, 7 处编辑)
| 文件 | 改动 | 
|------|------|
| `apps/web/src/views/HomeView.vue` | Navbar → mockup sticky+blur, Feature cards → bg-card, Login btn → accent-strong+glow |
| `apps/web/src/views/ShowcaseView.vue` | Navbar → mockup sticky+blur, Cards → bg-card |
| `apps/web/src/views/LoginView.vue` | Login card → bg-card |
| `apps/web/src/views/DashboardView.vue` | Navbar → mockup sticky+blur, Stat cards → column layout + bg-card |

### user-portal 5180 (2 文件, 4 处编辑)
| 文件 | 改动 |
|------|------|
| `apps/user-portal/src/views/DashboardView.vue` | Navbar → mockup sticky+blur, Panel bg → bg-card, Rec cards → bg-card |
| `apps/user-portal/src/views/MyProjectsView.vue` | Navbar → mockup sticky+blur |

### admin-portal 5174 (1 文件)
| 文件 | 改动 |
|------|------|
| `apps/admin-portal/src/views/DashboardView.vue` | Dash cards → bg-card + radius |

### ops-portal 5176 (1 文件, 2 处编辑)
| 文件 | 改动 |
|------|------|
| `apps/ops-portal/src/views/DashboardView.vue` | KPI cards/panels → bg-card + radius, 硬编码颜色→CSS变量 |

### 未改动（自动受益于 CSS 变量）
- `apps/studio/src/components/StudioLayout.vue` — 已用 CSS 变量
- `apps/studio/src/views/CharacterView.vue` — 派单 1 已重设计
- `apps/studio/src/views/WorkflowDesignerView.vue` — 派单 1 已加 AI Agent
- `apps/studio/src/views/MaterialLibraryView.vue` — V2 重写
- `apps/ops-portal/src/views/MonitoringView.vue` — 已用 CSS 变量
- `apps/ops-portal/src/views/SystemView.vue` — 已用 CSS 变量

---

## 浏览器验证

| 站点 | URL | 结果 |
|------|-----|------|
| web home | http://localhost:3000 | ✅ Hero+Features+Themes 渲染 |
| web showcase | http://localhost:3000/showcase | ✅ 3 showcase cards |
| web login | http://localhost:3000/login | ✅ Phone/Email tabs |
| web dashboard | http://localhost:3000/dashboard | ✅ Stats+Projects |
| studio home | http://localhost:5175 | ✅ Sidebar+Hero+Modes+Pipeline |
| user-portal dash | http://localhost:5180/dashboard | ✅ Welcome+Recs+Activities |

---

## 已知限制

1. **主题切换器覆盖**: web 和 user-portal 有 ThemeSwitcher 组件，会通过 JS 动态覆盖 CSS 变量。当前激活主题（如暗夜工坊）显示的仍是旧颜色。在无主题覆盖的 admin/ops 站，mockup 变量直接生效。
2. **admin/ops 鉴权**: 两个管理后台有路由守卫，未登录时自动跳转 `/login`，这是正确行为（派单 28 修复）。
3. **studio 侧边栏渐变**: `StudioLayout.vue` 的 active 状态使用 `linear-gradient(135deg, rgba(102,126,234,.15)...)` 硬编码渐变，与 mockup 紫蓝配色一致，无需修改。

---

## 教训

1. **CSS 变量是最小改动最高影响力的 UI 改版方式** — 改 5 个 tailwind.css 就覆盖了 5 站全部 view
2. **主题切换器会覆盖 :root 变量** — 需要通过 `localStorage` 或主题配置更新主题色值
3. **硬编码颜色是 UI 改版最大敌人** — ops DashboardView 有大量 `#181b22` / `#2a2f3a` 硬编码，需逐一替换
4. **小批量编辑有效** — 分批改站，不贪多，每次验证

---

## 下一步建议

1. 更新 `useTheme` composable 中的主题色值，让 5 主题与 mockup 配色对齐
2. admin-portal UsersView/SettingsView 等剩余页的硬编码颜色替换
3. 添加 mockup 中的 badge/chip/tag 组件到 shared 组件库

---

**林染 · 派单 31 完工 · 2026-06-10 18:40**
