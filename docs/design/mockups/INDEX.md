# ManhuaWorks 前端 Mockup 图索引

> 生成时间: 2026-06-10 11:42  
> 生成者: 林染 🔮 开发部前端 (派单 17)  
> 风格: Linear/Notion/Figma 现代 SaaS, 深色主题, 紫蓝色渐变  
> 方式: HTML mockup 页面 + headless Chrome 截图 (真中文渲染)

---

## web (4 张) — 1440×900

| 文件 | 页面 | HTML 源 | 说明 |
|------|------|---------|------|
| `web-home.png` | 产品首页 | `html/web-home.html` | 顶部导航 + Hero 主视觉 + 3 大产品力卡片 + 5 套主题选择 + 底部 |
| `web-showcase.png` | 作品展示 | `html/web-showcase.html` | 3 部示例作品卡片（都市/仙侠/科幻）+ 状态徽章 + CTA 引导注册 |
| `web-login.png` | 登录 | `html/web-login.html` | 双 Tab（手机验证码 / 邮箱密码）+ 60s 倒计时 + 表单验证 |
| `web-dashboard.png` | 用户工作台 | `html/web-dashboard.html` | 4 统计卡 + 最近项目卡 + 主题变量展示 + 侧边导航 |

## studio (9 张) — 1920×1080

| 文件 | 页面 | HTML 源 | 说明 |
|------|------|---------|------|
| `studio-home.png` | Studio 首页 | `html/studio-home.html` | Hero Banner + 3 创作模式选择 + 6 步创作链路 + 更新公告 + 素材案例 |
| `studio-characters.png` | 角色管理 | `html/studio-characters.html` | 角色卡片网格 + 搜索 + Archetype 筛选 + 详情面板 + 新成员 Modal |
| `studio-scenes.png` | 场景管理 | `html/studio-scenes.html` | 12 类场景模板卡片 + 场景类型筛选 + 子场景编辑 + 详情面板 |
| `studio-workflow.png` | 工作流设计器 | `html/studio-workflow.html` | 节点画布 + 左侧节点面板 + 右侧 AI Agent 对话 + 工具栏 |
| `studio-project.png` | 项目编辑器 | `html/studio-project.html` | 项目概览 Header + 分镜卡片列表 + 状态筛选 + 进度统计条 |
| `studio-tools.png` | 工具箱 | `html/studio-tools.html` | 6 大类 × 24 工具卡片网格 + 搜索/分类筛选 + 工具详情 |
| `studio-export.png` | 导出中心 | `html/studio-export.html` | 左：导出格式卡片网格 / 右：历史记录面板 + 进度条 |
| `studio-materials.png` | 素材库 | `html/studio-materials.html` | 4 Tab（角色/场景/道具/音色）+ 图片卡片 + 新建素材 |
| `studio-placeholder.png` | 占位页 | `html/studio-placeholder.html` | 居中卡片 + 「W3 待补」徽章 + 跳转工作流链接 |

## user-portal (6 张) — 1440×900

| 文件 | 页面 | HTML 源 | 说明 |
|------|------|---------|------|
| `portal-dashboard.png` | 用户工作台 | `html/portal-dashboard.html` | 欢迎条 + 今日推荐 4 卡 + 最近活动时间线 + 5 快速入口 |
| `portal-home.png` | 首页 | `html/portal-home.html` | 4 统计卡 + 积分进度条 + 最近项目 + 6 快捷入口 + 平台公告 |
| `portal-projects.png` | 我的项目 | `html/portal-projects.html` | 5 状态筛选 Tab + 项目卡片网格 + 搜索 + 新建项目 |
| `portal-team.png` | 团队协作 | `html/portal-team.html` | 成员列表（头像/角色徽章/状态点）+ 邀请功能 + 角色过滤 |
| `portal-apikeys.png` | API 密钥 | `html/portal-apikeys.html` | KPI 统计 + 添加密钥表单 + 密钥列表（Provider 彩标/掩码/显示/撤销） |
| `portal-settings.png` | 设置 | `html/portal-settings.html` | 4 Tab（账号/订阅/BYOK/通知）+ 头像编辑 + 通知开关矩阵 + 退出登录 |

---

## 统计

- **总计**: 28 张 PNG (原 19 + 子功能 9)
- **来源**: 19 个 Vue 源文件 + 9 个子功能编辑页
- **HTML 源**: `html/` 子目录下 28 个 HTML + 1 个共享 CSS
- **生成方式**: HTML mockup + headless Chrome 截图 → 真中文完美渲染

---

## 🆕 子功能编辑页 (9 张)

| 文件 | 页面 | HTML 源 | 说明 |
|------|------|---------|------|
| `studio-shot-editor.png` | 分镜编辑 | `html/studio-shot-editor.html` | 单镜头编辑：机位（中景/特写/远景/俯拍）、运镜、时长、转场、对白编辑、风格覆盖 |
| `studio-storyboard-grid.png` | 分镜宫格视图 | `html/studio-storyboard-grid.html` | 3×3 宫格布局 + 列表切换、状态筛选、新建分镜入口 |
| `studio-character-edit.png` | 角色详情编辑 | `html/studio-character-edit.html` | 主视觉图 + 表情集 (12)、一致性参数 (99.2%)、Prompt、标签 |
| `studio-scene-edit.png` | 场景详情编辑 | `html/studio-scene-edit.html` | 光照设置（色温/亮度/预设）、子场景编辑、场景 Prompt |
| `studio-node-config.png` | 工作流节点配置 | `html/studio-node-config.html` | 模型选择/尺寸/步数/CFG/Seed、正反向 Prompt、输入输出定义、重试/批量开关 |
| `studio-project-settings.png` | 项目设置 | `html/studio-project-settings.html` | 基本信息 + 协作成员管理 + 归档/删除危险操作 |
| `studio-export-settings.png` | 导出参数设置 | `html/studio-export-settings.html` | 分辨率预设、编码/帧率/码率、水印/字幕/章节开关 |
| `studio-new-project-wizard.png` | 新建项目向导 | `html/studio-new-project-wizard.html` | 4 步引导：选择模式→基本信息→初始角色→完成 |
| `portal-profile-edit.png` | 用户 Profile 编辑 | `html/portal-profile-edit.html` | 头像上传、昵称/简介/邮箱/手机、社交链接（Twitter/B站/Web/知乎） |
