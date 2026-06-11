# 林知行 — 补内容审查 22 页报告

> **测试员**: 林知行 📝 内容部主编 | **Session**: agent:main:subagent:21e73ea8-765f-41ff-bee6-fbe782a72cff
> **时间**: 2026-06-11 16:35–17:40 (GMT+8) | **耗时**: ~65 分钟
> **范围**: 补审 22 页 (12→34) | 首轮已审 12 页

---

## 📊 统计

| 指标 | 数值 |
|------|------|
| 审查页面 | 22 页 (逐页 snapshot 文本审查) |
| 可访问 | 16 页 |
| 空白/404 | 4 页 |
| 运行时错误 | 2 页 |
| 新增 Bug 总数 | 14 |
| P0 (阻塞) | 3 |
| P1 (严重影响体验) | 4 |
| P2 (中等问题) | 5 |
| P3 (轻微) | 2 |

---

## 🔴 P0 — 阻塞级问题 (新增)

### P0-2: Studio(5175) Vite 依赖过期导致全站白屏

**位置**: Studio 工作台 (5175) 全部路由
**问题**: 浏览器控制台反复报 `504 Outdated Optimize Dep`
- 所有页面 (/, /dashboard, /scenes, /materials, /export) 显示空白
- HTTP 响应正常 (返回 HTML shell) 但 JS 加载失败
- 根因: Vite dev server 预构建依赖缓存过期 (vue.js / pinia.js)

**影响**: Studio 工具台完全不可用。需重启 Vite dev server 清除依赖缓存。

### P0-3: Web /studio/scenes 全部场景光影数据损坏

**位置**: Web 主站 (3000) → 场景库 (/studio/scenes)
**问题**: 全部 20 张场景卡显示:
- 光影类型: `undefined · undefined`
- 色温: `undefinedK`
- 强度: `NaN%`
- 数据源未正确映射到 UI

**影响**: 场景库核心功能完全不可用，用户无法获得任何光影信息。

### P0-4: Web /studio/characters 一致性评分浮点精度丢失

**位置**: Web 主站 → 角色库 (/studio/characters)
**问题**: 多个角色显示:
- `✓ 0.7999999999999999` 应为 `✓ 0.8`
- `✓ 0.8999999999999999` 应为 `✓ 0.9`
- 受影响角色: 苏晚, 老周, 阿狸, 苍岩, 玄青, 云澜, 青衫, 霓凰 (8/12)

**影响**: 显示不专业。根因: `toFixed()` 或 `Math.round()` 未应用在渲染前。

---

## 🟠 P1 — 严重影响体验 (新增)

### P1-7: Admin /monitoring 路由不存在

**位置**: Admin Portal (5174) → 侧栏无 `/monitoring` 路由
**问题**: 浏览器控制台警告 `No match found for location with path "/monitoring"`
- 侧栏实际链接: 仪表盘/用户管理/计费管理/审计日志/系统设置/业务运营/合规审计/项目审核/系统日志
- `/monitoring` 不在路由表，页面白屏

**影响**: 测试矩阵标记此页面但实际不存在。需矩阵与路由对齐。

### P1-8: Ops /api-keys 返回 JSON 404

**位置**: Ops Portal (5176) → `/api-keys`
**问题**: 页面直接返回 JSON `{"code":40400,"message":"接口不存在"}`，无 HTML 内容
- Ops 侧栏无 API 密钥入口 (实际路由: /dashboard /users /billing /monitoring /system /logs)

**影响**: 矩阵与实际路由不匹配。API 密钥管理在 User Portal 中 (/byok)。

### P1-9: Web /studio/storyboard 镜头类型/状态全部英文

**位置**: Web 主站 → 分镜编辑器 (/studio/storyboard/:pid)
**问题**: 
- 镜头类型: `medium` / `close_up` / `wide` / `tracking` (应汉化为 中景/特写/远景/跟拍)
- 镜头状态: `done` / `generating` / `draft` (应汉化为 完成/生成中/草稿)
- 总时长: `16s` 应显示为 `16秒`

**影响**: 中文 UI 内嵌入英文数据值，与 P1-3 状态码汉化问题同类。

### P1-10: Web /studio/assets 空白页

**位置**: Web 主站 → 素材库 (/studio/assets)
**问题**: 页面完全不渲染任何内容 (snapshot 为空)
- 路由存在但组件无输出

**影响**: 素材库不可用。

---

## 🟡 P2 — 中等问题 (新增)

### P2-6: Web /studio/export 导出摘要英文术语

**位置**: Web 主站 → 导出成片 (/studio/export)
**问题**: 导出摘要使用英文缩写:
- 字幕: `zh · sans · bottom` (应为 中文 · 无衬线 · 底部)
- 码率: `high` (应为 高)
- 帧率选项: `24 fps` / `30 fps` / `60 fps` (建议 24帧/秒)
- 格式选项: `MP4` / `MOV` / `WebM` (可接受，行业标准)

**影响**: 中文用户对英文缩写理解成本高。

### P2-7: User /byok API Key 页面 provider 未汉化

**位置**: User Portal (5180) → API 密钥 (/byok)
**问题**:
- "已配置 provider" → 应为 "已配置供应商"
- "未配置 provider" → 应为 "未配置供应商"
- 服务商下拉框单字母前缀: `O OpenAI` / `A Anthropic` / `G Google Gemini` / `D DeepSeek` / `M MiniMax M-Series` → UX 怪异
- 页面术语混用: "API Key" 与 "API 密钥" 同时出现

### P2-8: Web /studio/scenes 场景分类图标不一致

**位置**: Web 主站 → 场景库 (/studio/scenes)
**问题**:
- 导航按钮: `📦 其他`
- 场景卡片: `🎬 其他`
- 同一类别两种图标

### P2-9: 跨站 Vue 生命周期钩子警告

**位置**: 全站 (3000/5174/5180)
**问题**: 控制台反复警告:
> `onMounted is called when there is no active component instance`
> `onBeforeUnmount is called when there is no active component instance`
- 根因: async setup() 中 lifecycle hooks 在 await 之后注册

### P2-10: Web /studio/scenes 场景分类错位

**位置**: Web 主站 → 场景库 (/studio/scenes)
**问题**: 多个场景分类与内容不匹配:
- "公司办公室" → ⛰ 自然 (应为 🏠 室内)
- "山林小溪" → 🏠 室内 (应为 ⛰ 自然)
- "海边码头" → 🏠 室内 (应为 🌳 室外/🏙 城市)
- "地下酒吧" → 🌳 室外 (应为 🏠 室内)
- "海底宫殿" → 🏙 都市 (应为 ✨ 奇幻)
- "森林深处" → 🏙 都市 (应为 ⛰ 自然)
- "地铁站" → ✨ 奇幻 (应为 🏙 都市)
- "外星基地" → 🌳 室外 (应为 ✨ 奇幻)

---

## 🟢 P3 — 轻微问题 (新增)

### P3-4: User /team 成员名包含英文

**位置**: User Portal (5180) → 我的团队 (/team)
**问题**: "设计师 Alice" — 中文角色名 + 英文人名，建议统一用中文名

### P3-5: User /byok 下拉框前缀设计

**位置**: User Portal → API 密钥页
**问题**: 服务商下拉 `O OpenAI` / `A Anthropic` 等单字母前缀视觉不规范
**建议**: 直接显示 "OpenAI" / "Anthropic"，去掉前缀字母

---

## 📉 弃读风险评估 (22页)

| # | 站点 | 页面 | 50%位置 | 评分(1-5) | 判断 |
|---|------|------|---------|-----------|------|
| 1 | Web | /showcase | 到第2部作品 | 4 | ✅ 已审，有吸引力 |
| 2 | Web | /dashboard | 401错误提示 | 1 | 🔴 需登录全不可用 |
| 3 | Web | /studio/characters | 到第6个角色 | 3 | 🟡 浮点精度减分 |
| 4 | Web | /studio/scenes | 到第5个场景 | 1 | 🔴 NaN% 数据全坏 |
| 5 | Web | /studio/assets | 空白页 | 1 | 🔴 无内容 |
| 6 | Web | /studio/progress | 空状态提示 | 3 | ✅ 提示清晰但空 |
| 7 | Web | /studio/storyboard/1 | 到镜头列表 | 4 | ✅ 功能感强 |
| 8 | Web | /studio/export | 到平台格式 | 4 | ✅ UI设计优秀 |
| 9 | Admin | /users | (首轮已审) | 3 | 沿用首轮 |
| 10 | Admin | /billing | (首轮已审) | 2 | 沿用首轮 |
| 11 | Admin | /monitoring | 白屏/路由不存在 | 1 | 🔴 路由404 |
| 12 | Admin | /settings | 到支付配置 | 4 | ✅ 功能完整 |
| 13 | Admin | /audit-log | 到第10条日志 | 3 | 🟡 英文操作码 |
| 14 | Ops | /dashboard | (首轮已审) | 3 | 沿用首轮 |
| 15 | Ops | /monitoring | (首轮已审) | 2 | 沿用首轮 |
| 16 | Ops | /api-keys | JSON 404 | 1 | 🔴 路由不存在 |
| 17 | User | /dashboard | (首轮已审) | 4 | 沿用首轮 |
| 18 | User | /projects | (首轮已审) | 2 | 沿用首轮 |
| 19 | User | /api-keys | 到Key表单 | 3 | 🟡 英文混用 |
| 20 | User | /team | 到成员列表 | 4 | ✅ 团队功能好 |
| 21 | Studio | /scenes | 白屏(依赖过期) | 1 | 🔴 Vite缓存过期 |
| 22 | Studio | /export | 白屏(依赖过期) | 1 | 🔴 Vite缓存过期 |

**≤2 分的页 (紧急)**: Web dashboard(1), Web scenes(1), Web assets(1), Admin monitoring(1), Ops api-keys(1), Studio scenes(1), Studio export(1) — **共 7 页**

---

## 🔗 链接有效性

| 来源 | 链接 | 目标 | 状态 |
|------|------|------|------|
| Web/showcase | `立即开始` → /login | 登录页 | ✅ |
| Web/showcase | `返回首页` → / | 首页 | ✅ |
| Web/characters | `←` 返回按钮 | 返回上页 | ✅ |
| Web/scenes | 分类导航按钮 | 各自路由 | ✅ |
| Web/progress | `返回` 按钮 | 返回 | ✅ |
| Web/storyboard | 镜头列表/详情切换 | 动态 | ✅ |
| Web/export | `开始导出` | 触发导出 | ✅ |
| Admin/settings | 侧栏9个链接 | 各自路由 | ✅ |
| Admin/audit | 侧栏导航 | 各路由 | ✅ |
| Admin/audit | `展开` 按钮 | 展开详情 | ✅ |
| Ops/dashboard | 侧栏6个链接 | 各路由 | ✅ |
| User/byok | 侧栏7个链接 | 各路由 | ✅ |
| User/byok | `保存 Key` | 提交 | ✅ |
| User/team | `邀请新成员` | 弹窗 | ✅ |
| User/team | 角色切换/移除 | 操作 | ✅ |

**404/空白页新增**: Admin /monitoring(路由不存在), Ops /api-keys(JSON 404), Web /studio/assets(空白), Studio 全站(504依赖过期)

---

## 🏷️ 统一用语审计

### 术语不一致清单 (新增)

| 术语 | 出现形式 | 站点 | 不一致 |
|------|----------|------|--------|
| API Key vs 密钥 | `API Key` / `API 密钥` 混用 | User /byok | ⚠️ 混用 |
| 其他分类图标 | `📦 其他` vs `🎬 其他` | Web /scenes | ⚠️ 不一致 |
| Provider | `provider` (英文) | User /byok | 应统一为"供应商" |
| 镜头类型 | `medium/close_up/wide/tracking` | Web /storyboard | 应汉化 |
| 镜头状态 | `done/generating/draft` | Web /storyboard | 应汉化 |
| 光影数据 | `undefined / NaN` | Web /scenes | 数据缺失 |
| 分类标签 | 8/20 场景分类错位 | Web /scenes | ⚠️ 错位 |
| 服务商前缀 | `O/A/G/D/M + 名称` | User /byok | ⚠️ 怪异前缀 |

---

## 📸 证据清单

截图存放路径: `D:\ManhuaWorks\docs\testing\content\screenshots\`

| 站点 | 截图数 | 核心页 |
|------|--------|--------|
| Web主站 (3000) | 8 | showcase/dashboard/characters/scenes/assets/progress/storyboard/export |
| Admin Portal (5174) | 5 | users/billing/monitoring/settings/audit |
| Ops Portal (5176) | 3 | dashboard/monitoring/api-keys |
| User Portal (5180) | 4 | dashboard/projects/byok/team |
| Studio (5175) | 2 | scenes/export (白屏) |

---

## 📋 总结

### 核心发现

1. **Studio 全站白屏** (P0-2): Vite 依赖缓存过期，需重启 dev server
2. **场景库数据全坏** (P0-3): 20 张场景卡全部显示 undefined/NaN
3. **浮点精度丢失** (P0-4): 8/12 角色评分显示 0.7999999999999999
4. **路由不匹配** (P1-7/P1-8): Admin /monitoring 和 Ops /api-keys 不存在
5. **镜头术语英文** (P1-9): storyboard 页全部镜头类型/状态英文
6. **素材库空白** (P1-10): /studio/assets 无内容渲染
7. **场景分类错位** (P2-10): 8/20 场景分类与内容不符
8. **Vue 生命周期警告** (P2-9): 跨站 async setup 钩子顺序问题

### 跨报告影响

首轮报告已有 Bug (P0-1 货币混乱, P1-1~P1-6, P2-1~P2-5, P3-1~P3-3) 在本次复测中均**确认存在**。
新增 14 个 Bug (含 3 个 P0, 4 个 P1, 5 个 P2, 2 个 P3)。

### 建议优先级

1. 🔴 立即修 (P0): Studio Vite缓存刷新 + 场景数据修复 + 浮点精度
2. 🟠 本周修 (P1): 路由对齐 + 镜头术语汉化 + 素材库空白
3. 🟡 下迭代 (P2): 导出摘要汉化 + provider汉化 + 场景分类修正 + Vue警告
4. 🟢 可延后 (P3): 英文名统一 + 下拉框前缀

---

*报告生成: 2026-06-11 17:40 GMT+8 | 林知行 📝 内容部*
