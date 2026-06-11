# 侧边栏统一规范 — P0

> **林知行审定 · 林染 (前端) · 2026-06-10**
> **生效范围**: web / studio / user-portal / admin-portal / ops-portal
> **引用**: `packages/shared/design-tokens/tokens.css`

---

## 统一规范

### 尺寸

| 属性 | 值 | CSS Token |
|------|-----|-----------|
| 展开宽度 | 240px | `--sidebar-expanded` |
| 折叠宽度 | 64px | `--sidebar-collapsed` |
| 折叠态图标 | 24×24 | Lucide icons |
| 展开态图标+文字间距 | 12px | `gap: var(--space-3)` |

### 颜色

| 状态 | 背景 | 文字 | 图标 | 激活态 |
|------|------|------|------|--------|
| 深色 (web/studio/admin) | `--color-bg-deep` | `--color-text-inverse` | 白色 70% | 主紫底 + 白字 |
| 浅色 (user-portal/ops) | `--color-bg-card` | `--color-text-primary` | 灰色 60% | 主紫浅底 + 紫字 |

### 交互

| 行为 | 效果 |
|------|------|
| hover 菜单项 | 背景变半透明紫, transition 150ms |
| 激活菜单项 | 主紫底 + 白字 + 左侧 3px 紫色竖线 |
| 折叠/展开 | transition 200ms ease, 宽度动画 |
| 子菜单展开 | 缩进 24px, 背景略深 |

---

## 各站侧边栏内容

### web (3000) — 产品主页

```
[Logo 漫工场]          ← 顶部
├── 首页
├── 探索作品
├── 创作工作台
├── 定价
└── 帮助

[登录] [注册]           ← 底部
```

- web 侧边栏仅在大屏 (>1024px) 显示, 移动端用底部 tab bar
- 登录后切换到 user-portal 侧边栏

---

### studio (5175) — 创作者工作台

```
[Logo 漫工场]           ← 顶部
├── 🏠 首页
├── 🎬 项目编辑器
├── 🎨 角色管理
├── 🏞️ 场景管理
├── 📚 剧本工作台
├── 🛠️ 工具箱
├── 📤 导出中心
└── 📊 项目数据

[用户头像 ▼]            ← 底部
```

- 默认展开, 可折叠到 64px (方便专注创作)
- 项目编辑器内: 左侧面板复用侧边栏区域 (集数/场景/镜头树)

---

### user-portal (5180) — 用户后台

```
[Logo 漫工场]           ← 顶部
├── 📊 工作台
├── 📁 我的项目
├── 🎬 我的作品
├── 🎨 素材库
├── 👥 我的团队
├── 💳 账户
├── 🎁 福利中心
└── ⚙️ 设置

[用户头像 ▼]            ← 底部
```

---

### admin-portal (5174) — 平台总后台

```
[Logo 漫工场 Admin]     ← 顶部
├── 🖥️ 系统监控
├── 📋 服务列表
├── 🔌 API 管理
├── 🗄️ 数据库
├── 🔐 权限中心
├── 💰 财务管理
├── 📦 资源管理
├── 📜 审计日志
└── ⚙️ 系统配置

[管理员头像 ▼]          ← 底部
```

---

### ops-portal (5176) — 业务总后台

```
[Logo 漫工场 Ops]       ← 顶部
├── 📊 数据看板
├── 👥 用户管理
├── 🎨 内容审核
├── 💬 客服工单
├── 📢 营销活动
├── 📈 营收分析
├── 🔍 用户画像
├── 📝 内容运营
├── 📰 消息中心
└── ⚙️ 设置

[运营头像 ▼]            ← 底部
```

---

## 技术实现

### 组件接口 (预期)

```typescript
// packages/shared/ui/Sidebar.vue
interface SidebarProps {
  items: SidebarItem[]       // 菜单项
  collapsed?: boolean        // 是否折叠
  variant?: 'dark' | 'light' // 主题变体
  logoText?: string          // Logo 文字
  userMenu?: UserMenuProps   // 底部用户菜单
}

interface SidebarItem {
  key: string
  icon: string               // Lucide icon name
  label: string              // 中文标签
  path?: string              // 路由路径
  children?: SidebarItem[]   // 子菜单
  badge?: number             // 红点数
}
```

### 提取计划 (P1)

- 从 studio 当前侧边栏提取 → `packages/shared/ui/Sidebar.vue`
- 5 站统一引用, 仅通过 props 区分内容
- P0 阶段: 规范文档定稿 (本文), 林染 P1 提取组件

---

## 检查清单

- [ ] web — 侧边栏仅大屏, 移动端用底部 tab
- [ ] studio — 默认展开 240px, 可折叠 64px
- [ ] user-portal — 浅色主题, 卡片式选中态
- [ ] admin-portal — 深色主题, 专业后台风
- [ ] ops-portal — 浅色主题, 运营风
- [ ] 全部: 使用统一的 `--sidebar-expanded` / `--sidebar-collapsed` token
- [ ] 全部: 图标统一 Lucide (P2), P0 阶段规范定稿
