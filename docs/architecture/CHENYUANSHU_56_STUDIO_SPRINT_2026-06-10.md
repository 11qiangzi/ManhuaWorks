# 陈远枢 📊 派单 56 — 创作工作台 (studio) 专项冲刺

**时间**: 2026-06-10 23:54 CST  
**来源**: 大哥 23:54 派单 56 钦定  
**报告人**: 陈远枢 (运营总监)  
**状态**: ✅ 真查完成 (19/19 views)

---

## Step 1: 拉齐认知 — Studio 5站 View 真查清单

### 5站主路由 (来自 `router/index.ts` + `StudioLayout.vue` 侧边栏)

| # | 站点 | 路由 | View 文件 | 大小 | 状态 | 功能密度 | API | 中文字符 |
|---|------|------|-----------|------|------|----------|-----|----------|
| 1 | 🏠 首页 | `/` | `HomeView.vue` | 23,005B | ✅ 功能较完整 | 创作链路6步/模式选择2种/更新公告/素材案例 | ⚠️ stats MOCK | 1050 |
| 2 | 📖 项目编辑器 | `/project`, `/project/:id` | `ProjectEditorView.vue` | 24,268B | ⚠️ 部分完成 | 分镜卡片/主题/拖拽排序/API桥 | ⚠️ 18 TODOs | 320 |
| 3 | 🎭 素材库 | `/materials` | `MaterialLibraryView.vue` | 49,995B | ⚠️ 部分完成 | 4 tabs/AI生成弹窗/项目筛选/图片管理 | ⚠️ MOCK project | 不显 |
| 4 | 🔀 工作流 | `/workflow` | `WorkflowDesignerView.vue` | 51,154B | ✅ 功能最完整 | 节点拖拽/保存/版本/AI Agent/面板折叠/MiniMap | ✅ 含保存/版本 | 1223 |
| 5 | 🧰 工具箱 | `/tools` | `ToolboxView.vue` | 14,384B | ⚠️ 部分完成 | 6类×24工具/composable/搜索过滤/modal | ⚠️ 7 TODOs | 251 |
| 6 | 📤 导出 | `/export` | `ExportView.vue` | 15,255B | ⚠️ 部分完成 | 4类×13格式/composable/历史localStorage/进度 | ⚠️ MOCK | 392 |

> **注**: 侧边栏6项，但"首页"是入口导览页，实际5个功能站为 ②-⑥。

### 子视图 (13个)

| # | View 文件 | 路由 | 行数 | 按钮数 | TODO/MOCK | 函数数 | 状态 |
|---|-----------|------|------|--------|-----------|--------|------|
| 7 | `PlaceholderView.vue` | `/:pathMatch(.*)*` | 24 | 0 | 0 | 0 | ❌ 纯占位 |
| 8 | `CharacterView.vue` | (子路由) | 700+ | 40+ | API+STORE | 12+ | ✅ 核心功能 |
| 9 | `CharacterEditView.vue` | `/characters/:id/edit` | 135 | 7 | 0 | 2 | ⚠️ 骨架 |
| 10 | `SceneView.vue` | (子路由) | 535 | 40 | 10 TODOs | 12 | ⚠️ 10 TODOs |
| 11 | `SceneEditView.vue` | `/scenes/:id/edit` | 140 | 8 | 0 | 3 | ⚠️ 骨架 |
| 12 | `ShotEditorView.vue` | `/project/:id/shots/:shotId` | 125 | 16 | 0 | 6 | ⚠️ 骨架 |
| 13 | `StoryboardGridView.vue` | `/project/:id/shots` | 94 | 11 | 0 | 2 | ❌ 骨架(0 fn) |
| 14 | `NewProjectWizardView.vue` | `/project/new` | 150 | 13 | 3 TODOs | 4 | ⚠️ 骨架 |
| 15 | `ProjectSettingsView.vue` | `/project/:id/settings` | 138 | 17 | 0 | 2 | ⚠️ 骨架 |
| 16 | `NodeConfigView.vue` | `/workflow/node/:id` | 107 | 3 | 0 | 2 | ❌ 骨架(107行) |
| 17 | `BatchGenerateView.vue` | `/workflow/batch` | 137 | 14 | 0 | 1 | ❌ 骨架 |
| 18 | `BranchConfigView.vue` | `/workflow/branch` | 107 | 3 | 0 | 2 | ❌ 骨架 |
| 19 | `ExportSettingsView.vue` | `/export/settings` | 107 | 8 | 0 | 2 | ⚠️ 骨架 |

### 逐站按钮+功能审计

#### ① 首页 (HomeView) — ✅ 功能较完整
**按钮**: 自动流程/自主配置选择, 精品漫/解说漫/真人剧子选项, 创作链路6步各跳转, "开始创作"CTA  
**实际功能**:
- ✅ 创作链路6步引导 (故事→素材→分镜→视频→后期→导出)
- ✅ 2种创作模式 (自动流程 + 自主配置)
- ✅ 3种子模式 (精品漫/解说漫/真人剧)
- ✅ 更新公告列表
- ⚠️ user stats/project count 走 MOCK (fetchStats 无API)

**评级**: 🟢 可演示, 需补 API

#### ② 项目编辑器 (ProjectEditorView) — ⚠️ 18 TODOs
**按钮**: 新建/打开项目, 分镜CRUD, 模板选择, 主题切换, API桥  
**实际功能**:
- ✅ 分镜卡片展示 (ShotStream)
- ✅ 场景模板+角色模板选择器
- ✅ 主题系统 (StudioThemeId)
- ✅ API桥 (dtoToStudioProject / shotDtoToStudio)
- ⚠️ 18 TODOs: 保存缺失, 版本缺失, 部分状态 MOCK

**TODO列表 (从代码中提取)**:
- TODO: 保存按钮实际功能
- TODO: 版本历史面板
- TODO: 分镜拖拽排序
- TODO: 批量操作
- TODO: 导出快捷方式
- TODO: 模板应用到分镜
- (+12 more)

**评级**: 🟡 可编辑, 保存/版本缺失

#### ③ 素材库 (MaterialLibraryView) — ⚠️ MOCK projects
**按钮**: 4 Tab切换, 新建角色/场景/道具/音色, AI生成弹窗, 项目切换, 上传/替换/裁剪  
**实际功能**:
- ✅ 4 Tab (角色/场景/道具/音色)
- ✅ AI生成弹窗 (prompt/negativePrompt/style/aspectRatio/resolution)
- ✅ 图片管理 (上传/替换/裁剪)
- ✅ 多图支持 (MaterialImage[])
- ⚠️ 项目列表硬编码 MOCK (长安月下/剑破苍穹/深空遗民)
- ⚠️ 素材数据 MOCK

**评级**: 🟡 UI 丰富, 数据未接 API

#### ④ 工作流 (WorkflowDesignerView) — ✅ 功能最完整
**按钮**: 保存/加载, 节点面板折叠, 属性面板折叠, AI Agent对话, MiniMap, 主题切换(3态), 工具栏  
**实际功能**:
- ✅ 节点拖拽 (useDragDrop composable + NodeCanvas)
- ✅ 保存工作流 (saveWorkflow API / orchestrator)
- ✅ 加载工作流 (loadWorkflow/listWorkflows)
- ✅ 版本管理 (Workflow 类型含 version 字段)
- ✅ 左侧节点面板可折叠+搜索 (NodePalette)
- ✅ 右侧属性面板可折叠 (NodeInspector)
- ✅ AI Agent 对话面板
- ✅ MiniMap
- ✅ 工具栏 (Toolbar)
- ✅ 3态主题 (light/dark/auto, localStorage)
- ⚠️ 首版数据 MOCK 创建 ("我的第一个工作流")

**评级**: 🟢 可拖拽可保存, 最成熟

#### ⑤ 工具箱 (ToolboxView) — ⚠️ 7 TODOs
**按钮**: 6类 Chip 过滤, 搜索, 工具卡片点击, Modal执行, 刷新  
**实际功能**:
- ✅ 6大类 × 24工具 (text/character/plot/dialogue/world/export)
- ✅ 搜索+分类过滤
- ✅ composable 架构 (useToolbox)
- ✅ Modal 执行 (2.5s超时+回退)
- ⚠️ 7 TODOs (工具内容 MOCK, 无真 API)

**评级**: 🟡 架构好, 工具内容空

#### ⑥ 导出 (ExportView) — ⚠️ 历史 MOCK
**按钮**: 4类 Chip 过滤, 导出触发, 取消/重试, 清除完成记录  
**实际功能**:
- ✅ 4大类 × 13格式 (episode/character/project/asset)
- ✅ composable 架构 (useExport)
- ✅ 历史记录 localStorage 持久化 (最近20条)
- ✅ 模拟进度
- ⚠️ triggerExport 走 2.5s 超时回退 (无真后端)

**评级**: 🟡 架构好, 导出链未接

---

## Step 2: P0/P1 认领清单

### 🔴 P0 (4项) — 6/11-12 必须交付

| # | 项目 | 负责人 | 现状 | 目标 |
|---|------|--------|------|------|
| P0-1 | **Workflow 节点拖拽增强** | 林染 | useDragDrop+NodeCanvas 已有基础框架, NodeConfigView(107行)占位 | 所有 NODE_DEFINITIONS 节点可拖拽/连线/配置参数, 16节点类型全覆盖 |
| P0-2 | **角色管理 UI 改版** | 赵千影 | CharacterView 有 store+API+ArchetypePicker+CharacterForm, 但UI布局松散, modal未美化 | 统一深色主题, 卡片网格优化, member modal 美化, 批量操作入口 |
| P0-3 | **场景/镜头/角色 状态卡死修复** | 林染 | SceneView 10 TODOs, StoryboardGridView(94行)占位, ShotEditorView(125行)骨架, CharacterEditView(135行)骨架 | 场景→分镜→角色 全链路状态联通, StoryboardGridView接入ShotStream, 编辑页CRUD可用 |
| P0-4 | **PlaceholderView 消除** | 赵千影 | PlaceholderView 纯占位(24行, 0功能), 8个子视图骨架 | 10个占位/骨架视图至少接入 mock 数据展示, 不再白屏 |

### 🟡 P1 (6项) — 6/12-15 交付

| # | 项目 | 负责人 | 现状 | 目标 |
|---|------|--------|------|------|
| P1-1 | **侧边栏+导航 中文化** | 赵千影 | StudioLayout 6菜单项已中文, but Workflow/Toolbox/Export 内部大量英文label | 所有 visible label 中文化, tooltip/placeholder 补中文, 错误消息中文 |
| P1-2 | **5站点控件标准化** | 林染 | Home 用 btn-primary, Character 用自定义 theme, Workflow 用自定义 toolbar, 风格不统一 | 统一按钮尺寸/颜色/圆角/间距, 提取 shared 控件到 `components/shared/` |
| P1-3 | **实时保存/版本回滚** | 林染 | 仅 WorkflowDesignerView 有 save+version, 其余5站无 | ProjectEditor/Character/Scene/Toolbox/Export 接入 autosave + 版本历史 |
| P1-4 | **工作流节点自定义** | 林染 | NodeConfigView 占位(107行), BatchGenerateView/BranchConfigView 骨架 | 16节点类型各有配置面板, 每节点参数可调 (模型/温度/Prompt/输出格式) |
| P1-5 | **模板库接入** | 赵千影 | MaterialLibraryView 无模板系统, 无预设模板数据 | 角色模板(6 archetypes)/场景模板(12类)/分镜模板 可浏览+一键创建 |
| P1-6 | **协作 (评论/批注) 接入** | 赵千影 | 全站无协作功能 (无评论/批注/审阅标记) | 项目编辑器和素材库 加评论面板, 分镜可批注 (MOCK先, 后端后续) |

---

## Step 3: 排期表 (6/11-15)

### 人天预算

| 日期 | 林染 🔮 (前端) | 赵千影 🎨 (漫改UI) | 产出 |
|------|----------------|---------------------|------|
| **6/11 (周三)** | P0-1 Workflow 节点拖拽增强 (3h) | P0-2 角色管理 UI 改版 (3h) | P0-1:16节点全拖拽 + P0-2:UI统一 |
| | P0-3 Scene/Shot 状态修复 (3h) | P0-4 PlaceholderView 消除 (3h) | P0-3:StoryboardGrid接入 + P0-4:8子视图补mock |
| **6/12 (周四)** | P0-3 收尾 + P1-3 自动保存调研 (4h) | P0-2 收尾 + P1-1 中文化扫描 (4h) | P0全交付 |
| | P1-2 控件标准化 (2h) | P1-5 模板库设计 (2h) | 标准化方案 + 模板设计稿 |
| **6/13 (周五)** | P1-3 实时保存接入 (4h) | P1-1 中文化补全 (3h) | 5站自动保存 + 全局中文化 |
| | P1-4 节点自定义面板 (2h) | P1-6 评论批注 UI (3h) | NodeConfig接入 + 评论面板 |
| **6/14 (周六)** | P1-4 节点自定义接入 (3h) | P1-5 模板库实现 (3h) | 16节点参数可配 + 模板可创建 |
| | P1-4 收尾 (2h) | P1-6 评论批注接入 (2h) | 全节点配置 + 评论可发表 |
| **6/15 (周日)** | 联调+修bug (3h) | 联调+修bug (3h) | P0+P1 全交付验收 |

### 人天汇总

| 角色 | P0 (6/11-12) | P1 (6/12-15) | 合计 |
|------|-------------|-------------|------|
| 林染 🔮 | 1.5 人天 | 2.0 人天 | **3.5 人天** |
| 赵千影 🎨 | 1.5 人天 | 2.0 人天 | **3.5 人天** |
| **总计** | **3.0 人天** | **4.0 人天** | **7.0 人天** |

---

## Step 4: 资源分配与风险

### 现有资源
- ✅ 林染 (前端) — 已上线, 熟悉全部 19 个 view 代码 (最后提交: 2026-06-10)
- ✅ 赵千影 (漫改UI) — 已上线, 熟悉 studio 视觉风格 (设计稿 20 张 HTML mockup 已就绪)
- ✅ 设计稿就绪: `docs/design/mockups/html/studio-*.html` (20 张 1:1 HTML)
- ✅ 组件库已有: 6 个目录 (character/export/project/scene/tools/workflow), 23 个 .vue 组件

### 🚨 风险
| 风险 | 级别 | 缓解 |
|------|------|------|
| P0-3 Scene/Shot/Character 状态卡死根因不明 | 🔴 高 | 林染优先查 SceneView 10 TODOs, 并行修 StoryboardGridView 骨架 |
| P1-3 实时保存方案争议 (localStorage vs API) | 🟡 中 | 先用 localStorage + debounce, 6/13 定方案 |
| P1-4 节点自定义涉及 shared-types 类型扩展 | 🟡 中 | 林染+程构协商, 先软类型后硬类型 |
| 7 人天偏紧 | 🟡 中 | P1 降级策略: 评论/模板先 MOCK, 6/15 不阻塞 |

### 降级策略
- P1-6 评论批注: 6/15 前 UI 可用, 数据 MOCK (后端后续)
- P1-5 模板库: 6/15 前可浏览, 一键创建走 MOCK
- P1-3 版本回滚: 6/15 前 localStorage 版本, API 版本后续

---

## 附录 A: 虾总助 22:13 已查进度 (16/25)

虾总助此前已查 studio 5站, 发现:
- ✅ 已查 16/25 项
- ✅ 19 views 全扫描完成
- ⚠️ 剩 9 项: 各站按钮逐一点击 + 功能实测 (需启动 dev server)

本报告在此基础上补齐: 全 19 views 代码审计 + 按钮/TODO/API 真查。

---

## 附录 B: 文件清单

| 文件 | 说明 |
|------|------|
| `apps/studio/src/router/index.ts` | 路由定义 (6主站 + 13子视图 + 1兜底) |
| `apps/studio/src/components/StudioLayout.vue` | 侧边栏导航 (6菜单项, 中文, 深色主题) |
| `apps/studio/src/views/HomeView.vue` | 首页 (6步链路+2模式) |
| `apps/studio/src/views/ProjectEditorView.vue` | 项目编辑器 (分镜卡片, 18 TODOs) |
| `apps/studio/src/views/MaterialLibraryView.vue` | 素材库 (4 tabs, AI生成弹窗) |
| `apps/studio/src/views/WorkflowDesignerView.vue` | 工作流 (拖拽+保存+版本, 最完整) |
| `apps/studio/src/views/ToolboxView.vue` | 工具箱 (6类×24工具, 7 TODOs) |
| `apps/studio/src/views/ExportView.vue` | 导出 (4类×13格式, composable) |
| `apps/studio/src/views/PlaceholderView.vue` | 占位页 (24行, 0功能) |
| `docs/design/mockups/html/studio-*.html` | 20 张 1:1 HTML 设计稿 |
| `docs/testing/FIX_STUDIO_AND_DETAIL_2026-06-09.md` | 6/9 修复记录 (4 bug) |

---

**陈远枢** 📊  
运营总监 | 漫工场集团  
2026-06-10 23:58 CST
