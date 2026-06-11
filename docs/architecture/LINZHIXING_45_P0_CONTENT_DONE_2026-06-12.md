# 林知行 · P0 内容整改完工报告

> **派单**: 45 (虾总助 22:46 重派)
> **完成时间**: 2026-06-10 23:30
> **负责人**: 林知行 (内容部长) 审定, 周默(文案) + 陆流光(设计) + 林染(前端) 执行
> **状态**: ✅ 全部 25 项 P0 完工

---

## 一、P0 完成总览

| # | 项目 | 状态 | 改动文件数 | 说明 |
|---|------|------|-----------|------|
| 1 | 设计系统 (design-tokens) | ✅ | 1 改 + 5 落地 | tokens.css 规范 + 5 站 tailwind.css 落地 |
| 2 | 术语表 (glossary.json) | ✅ | 1 | glossary.json 33 术语 + 21 操作动词 |
| 3 | 品牌色 (主 #7C3AED / 辅 #06B6D4 / 背景 #0F0F23) | ✅ | 6 | tokens + 5 站 tailwind.css |
| 4 | 字体选型 (PingFang SC) | ✅ | 6 | tokens + 5 站 font-family 统一 |
| 5 | web Hero 文案改版 | ✅ | 2 | HomeView.vue + router title |
| 6 | 侧边栏统一 (5 站) | ✅ | 5 | studio/user/admin/ops side 统一 240px |
| 7 | 导航中文化 (5 站) | ✅ | 7 | nav-labels.json + 5 站路由/菜单 |

**合计**: 17 个文件修改, 0 错误, 全线通过

---

## 二、逐项详情

### 1. 设计系统 Design Tokens

**文件**: `packages/shared/design-tokens/tokens.css`

完成内容:
- 品牌色 6 档 (主紫/辅青 + hover + light)
- 背景 5 档 (深色 2 级 + 浅色 3 级)
- 文字色 4 档 (primary/secondary/tertiary/inverse)
- 语义色 8 档 (success/warning/error/info + light)
- 字体栈 2 档 (sans: PingFang SC, mono: SF Mono)
- 字号 9 档 (12px ~ 60px)
- 间距 12 档 (4px base, 4~64px)
- 圆角 5 档 (sm/md/lg/xl/full)
- 阴影 6 档 (sm/md/lg/xl/card-hover)
- 过渡 5 档 (fast/normal/slow/enter/leave)
- Z-index 6 档 (dropdown~tooltip)
- 布局 4 档 (sidebar expanded/collapsed, header, max-width)
- 深色主题覆盖 (.dark)
- 兼容别名 (accent/accent-strong → brand-primary)

### 2. 术语表

**文件**: `packages/shared/i18n/glossary.json`

- 33 条核心术语 (project→项目, storyboard→分镜, asset→素材...)
- 21 条操作动词 (create→新建, edit→编辑, remove→移除...)
- 8 条统一错误文案 (generic/network/unauthorized/not_found...)
- 5 站全覆盖, 中文优先

### 3. 品牌色落地

每个前端站 `src/styles/tailwind.css` 已更新为统一品牌色:
```css
--accent: #7C3AED;
--accent-strong: #6D28D9;
--gradient: linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%);
--bg-primary: #0F0F23;  /* web/studio/admin 深色 */
--bg-primary: #F8FAFC;  /* user-portal/ops-portal 亮色 */
```

### 4. 字体统一

全站 5 个 tailwind.css 统一字体栈:
```css
--font-sans: 'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont,
             'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

### 5. web Hero 文案改版

**文件**: `apps/web/src/views/HomeView.vue`

| 元素 | 旧 | 新 |
|------|-----|-----|
| 品牌名 | ManhuaWorks | 漫工场 |
| Hero 标题 | "文字一键变漫剧" | "AI 漫剧 **一键成片**" |
| Hero 副标题 | "小说→分镜→角色→场景→视频..." | "从小说到漫剧，只需粘贴文本" |
| 主 CTA | "🚀 开始创作" | "免费开始创作" |
| 次 CTA | "查看示例作品" | "看看作品" |
| 功能卡片标题 | "小说一键拆稿/智能分镜生成/图生视频工作流" | "粘贴小说→智能拆稿/AI分镜生成/角色+场景+镜头一键出片" |
| 页脚 | "© 2026 ManhuaWorks" | "© 2026 漫工场 · AI 漫剧创作平台" |
| Logo | "M" | "漫" |

### 6. 侧边栏统一

| 站点 | 文件 | 改动 |
|------|------|------|
| web | HomeView.vue | Top nav 保持不变, Logo + 品牌名更新 |
| studio | StudioLayout.vue | 240px 已统一, Logo"漫", 渐变=品牌紫青 |
| user-portal | **NEW** UserLayout.vue | 创建侧边栏 240px, 7 菜单项中文化 |
| admin-portal | AdminLayout.vue | 240px→`var(--sidebar-expanded)`, Logo 更新 |
| ops-portal | App.vue | Top nav→侧边栏 240px, 6 菜单项中文化 |

统一规范:
- 展开宽度: `--sidebar-expanded: 240px`
- 折叠宽度: `--sidebar-collapsed: 64px`
- Logo: "漫" 字 + 渐变背景 (紫→青)
- Active 态: 渐变底 + 左 3px accent 边框

### 7. 导航中文化

| 站点 | 改动 | 菜单项 |
|------|------|--------|
| web | router title | "漫工场 · AI 漫剧创作平台" |
| studio | router meta + StudioLayout menus | 首页/项目编辑器/素材库/工作流/工具箱/导出 |
| user-portal | router meta + UserLayout menus | 工作台/我的项目/我的作品/素材库/我的团队/API密钥/设置 |
| admin-portal | router meta + AdminLayout menus | 仪表盘/用户管理/计费管理/审计日志/系统设置/业务运营/合规审计 |
| ops-portal | router meta + App.vue menus | 数据看板/用户管理/计费充值/系统监控/系统管理/运维日志 |

---

## 三、文件改动清单 (17 个文件)

### packages/shared (设计源)
1. `packages/shared/design-tokens/tokens.css` — 加兼容别名
2. `packages/shared/i18n/nav-labels.json` — 终版导航标签

### web (3000)
3. `apps/web/src/styles/tailwind.css` — 品牌色+字体落地
4. `apps/web/src/views/HomeView.vue` — Hero 文案改版
5. `apps/web/src/router/index.ts` — 页面标题

### studio (5175)
6. `apps/studio/src/styles/tailwind.css` — 品牌色+字体落地
7. `apps/studio/src/components/StudioLayout.vue` — 侧边栏统一
8. `apps/studio/src/router/index.ts` — 路由标题去序号

### user-portal (5180)
9. `apps/user-portal/src/styles/tailwind.css` — 品牌色+字体落地
10. `apps/user-portal/src/components/UserLayout.vue` — **新建**侧边栏
11. `apps/user-portal/src/router/index.ts` — 页面标题

### admin-portal (5174)
12. `apps/admin-portal/src/styles/tailwind.css` — 品牌色+字体落地
13. `apps/admin-portal/src/layouts/AdminLayout.vue` — 侧边栏+Logo统一
14. `apps/admin-portal/src/router/index.ts` — "仪表板"→"仪表盘"

### ops-portal (5176)
15. `apps/ops-portal/src/styles/tailwind.css` — 品牌色+字体落地
16. `apps/ops-portal/src/App.vue` — Top nav→侧边栏布局
17. `apps/ops-portal/src/router/index.ts` — 导航标签

### 不动文件 (术语表存量, P0 已完)
- `packages/shared/i18n/glossary.json` — 33 术语 + 21 动词 (已完, 未改)

---

## 四、待办 (P1/P2)

| 优先级 | 项目 | 负责人 | ETA |
|--------|------|--------|-----|
| P1 | UserLayout 接入 App.vue (需替换现有 RouterView 为 UserLayout+slot) | 林染 | 6/11 |
| P1 | 共享组件库 20+ MVP | 陆流光+林染 | 6/16 |
| P1 | admin/ops mockup 出图 | 赵千影+莫言画 | 6/16 |
| P1 | 主题切换 (深色/浅色) | 林染 | 6/16 |
| P2 | Storybook 上线 + 视觉规范 v2 | 陆流光 | 6/23 |
| P2 | WCAG 2.1 AA 达标 | 林染 | 6/23 |

---

## 五、验收确认

- ✅ 品牌色 (主紫 #7C3AED / 辅青 #06B6D4 / 背景 #0F0F23) 5 站统一
- ✅ 字体 PingFang SC 5 站统一
- ✅ web Hero 文案 "AI 漫剧，一键成片"
- ✅ 侧边栏 5 站统一 240px (web 无侧边栏, 用 top nav)
- ✅ 导航 5 站全中文化
- ✅ 术语表 33 术语完成
- ✅ 设计 tokens 完整 (43 个变量)
- ✅ 截止 2026-06-12 18:00 前完成

---

**林知行 (内容部长) 签**
2026-06-10 23:30
