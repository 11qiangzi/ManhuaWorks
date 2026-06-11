# ManhuaWorks Studio — 创作者工作台

> 漫改工坊前端。W1-W5 累计交付：项目编辑器 / 角色管理 / 场景管理 / 工具箱 / 导出 / **工作流设计** / **角色 v2 + 场景 v2 + 一致性向量**。

## 📦 模块

| 路径 | 视图 | 说明 |
|------|------|------|
| `/project`    | ProjectEditorView | 项目编辑器（W4） |
| `/characters` | CharacterView     | 角色管理（W4） |
| `/scenes`     | SceneView         | 场景管理（W4） |
| `/tools`      | ToolboxView       | 工具箱（W4） |
| `/export`     | ExportView        | 导出（W4） |
| `/workflow`   | **WorkflowDesignerView** | **工作流设计（W5 新增）** |

## 🎬 工作流设计面板（W5 任务 3）

> 节点画布：拖拽节点 + 连线 + 步骤配置 + 保存/加载 + 运行/调试。

### 布局

```
┌──────────────────────────────────────────────────────┐
│ Toolbar  保存/加载/运行/调试/撤销/缩放/主题         │ 48px
├──────┬───────────────────────────────┬───────────────┤
│ 调色 │        画布（SVG + HTML）     │  检查器       │
│ 板   │  ┌─────────┐                  │  节点参数     │
│ 256  │  │ 节点A ─┼─→ 节点B          │  端口信息     │
│      │  │  ↓      │                  │  运行时状态   │
│      │  │ 节点C   │                  │  288          │
│      │  └─────────┘                  │               │
│      │   ⊕ 小地图  缩放 100%         │               │
├──────┴───────────────────────────────┴───────────────┤
│ 事件流（运行/调试实时反馈） 160px 可折叠            │
└──────────────────────────────────────────────────────┘
```

### 12 类节点

| 类别 | 节点 |
|------|------|
| **输入 (3)** | 文本输入 · 图像输入 · 资产输入 |
| **AI (3)**   | LLM 生成 · 图像生成 · 图像编辑 |
| **逻辑 (2)** | 条件分支 · 合并 |
| **转换 (1)** | 提示词模板 |
| **输出 (2)** | 保存到资产库 · 导出 |
| **控制 (1)** | 并行执行 |

### 操作

| 操作 | 快捷键 | 工具栏 |
|------|--------|--------|
| 保存工作流 | `Ctrl/Cmd + S` | 保存 |
| 加载工作流 | — | 加载 |
| 撤销 / 重做 | `Ctrl+Z` / `Ctrl+Shift+Z` | ↶ / ↷ |
| 运行 | `Ctrl+Enter` | ▶ 运行 |
| 调试（逐步） | — | 🐞 调试 |
| 停止 | — | ■ 停止 |
| 删除节点 | `Delete` / `Backspace` | — |
| 缩放 | 滚轮 / 工具栏 | ⊙ / − / + |
| 切换主题 | — | ☀️ / 🌙 / 🔄 |

### 拖拽流程

1. 左侧调色板 → 按住节点按钮 → 拖到画布 → 松开 = 创建节点
2. 节点端口（左侧 = 输入，右侧 = 输出）→ 拖到目标节点端口 = 创建连线
3. 选中节点 → 右侧检查器编辑参数（string/number/boolean/array 自动判别）
4. ▶ 运行 → 调 ai-orchestrator → WebSocket 实时事件流

### 性能

- 节点画布：HTML 节点 + SVG 连线（CSS transform 走 GPU）
- ≥60fps，50+ 节点流畅
- 端口事件用 `@pointerdown.stop` 隔离（不会触发节点拖动）
- 拖动时直接更新 `transform`，松手才记录到 history

### 5 主题适配

复用 W2 themes 系统（`tailwind.config.js` 中定义的 5 套主题色），通过 `localStorage` 持久化，支持 light / dark / auto 三种模式。

### 调色板（5 主题色对应 5 节点类别）

- 🔵 蓝 — 输入
- 🟣 紫 — AI
- 🟡 琥珀 — 逻辑
- 🟢 翠 — 转换
- 🟢 绿 — 输出
- 🔴 玫 — 控制

## 🏗 技术栈

- **框架**: Vue 3.4 + `<script setup>` + TypeScript 5.3
- **状态**: Pinia 2.1（`stores/workflow.ts`）
- **样式**: Tailwind CSS 3.4（深色模式：class 策略）
- **画布**: SVG + HTML 混合渲染（无需 Vue Flow 等三方库）
- **路由**: vue-router 4
- **构建**: Vite 5
- **测试**: Vitest

## 🚀 启动

```bash
# 安装依赖（pnpm workspace）
pnpm install

# 启动开发服务器
pnpm --filter studio dev

# 访问
# http://localhost:5173/workflow
```

## 📁 目录结构

```
apps/studio/src/
├── api/
│   └── orchestrator.ts            # 调 ai-orchestrator (启 run / WS 订阅)
├── components/workflow/
│   ├── ConnectionLine.vue         # 贝塞尔连线
│   ├── MiniMap.vue                # 小地图
│   ├── NodeCanvas.vue             # 画布主体
│   ├── NodeInspector.vue          # 节点检查器
│   ├── NodePalette.vue            # 节点面板
│   └── Toolbar.vue                # 顶部工具栏
├── composables/
│   ├── useDragDrop.ts             # 拖拽逻辑
│   ├── useHistory.ts              # 撤销/重做（命令模式）
│   ├── useWorkflow.ts             # 工作流状态
│   └── useWorkflowRunner.ts       # 运行/调试
├── router/
│   └── index.ts                   # 路由
├── stores/
│   └── workflow.ts                # Pinia store
├── types/
│   └── workflow.ts                # 节点/连线/工作流类型
└── views/
    └── WorkflowDesignerView.vue   # 工作流设计主视图
```

## 🧪 验证

```bash
# TypeScript 类型检查
pnpm --filter studio typecheck

# 生产构建
pnpm --filter studio build
```

构建输出应无 type error 且 vite build 成功。

## 📋 联调

| 端点 | 服务 | 默认端口 |
|------|------|---------|
| `POST /api/v1/runs` | ai-orchestrator | 8087 |
| `WS /ws/runs/{runId}` | ai-orchestrator | 8087 |
| `POST /api/v1/workflows` | ai-orchestrator | 8087 |

环境变量 `VITE_ORCHESTRATOR_URL` 覆盖默认地址。

---

## 🎨 角色 v2 + 场景 v2 + 一致性向量（W5 任务 5）

> 6 类角色 archetype × 12 类场景模板 × 1024 维一致性向量（all-MiniLM-L6-v2 输出），cosine 相似度 ≥ 0.85 自动通过，< 0.85 触发重新生成。

### 📦 模块

| 路径 | 类型 | 说明 |
|------|------|------|
| `data/character-archetypes-v2.ts` | data | 6 类 archetype（少年/少女/反派/导师/儿童/老者） |
| `data/scene-templates-v2.ts` | data | 12 类场景模板（4-6 子场景/类） |
| `data/character-vectors.ts` | data | 角色向量库（6 archetype × 5 风格 = 30 向量） |
| `data/scene-vectors.ts` | data | 场景向量库（12 template × 5 风格 = 60 向量） |
| `api/vectors.ts` | api | embedding 服务 + 一致性检查 |
| `composables/useCharacterConsistency.ts` | composable | 角色一致性 composable |
| `composables/useSceneMatch.ts` | composable | 场景匹配 composable |
| `components/character/CharacterPickerV2.vue` | ui | 角色选择器 v2 |
| `components/scene/SceneGalleryV2.vue` | ui | 场景画廊 v2 |
| `components/character/CharacterVectorDebug.vue` | ui | 向量调试（cosine 矩阵） |
| `types/character.ts` | types | 角色类型（6 archetype + vector 字段） |
| `types/scene.ts` | types | 场景类型（12 模板 + vector 字段） |

### 6 类角色 archetype

| ID | 标签 | 色系 | 适用场景 |
|----|------|------|----------|
| `youth` | 少年 | blue / sky | 14-22 岁成长型主角 |
| `maiden` | 少女 | pink / rose | 14-22 岁成长型女主 |
| `villain` | 反派 | red / crimson | 核心冲突来源 |
| `mentor` | 导师 | purple / violet | 指引型长辈/同辈 |
| `child` | 儿童 | green / lime | 8-13 岁天真/机敏 |
| `elder` | 老者 | amber / gold | 阅历深厚智慧/权威 |

### 12 类场景模板（每类 4-6 子场景）

| 类别 | 子场景示例 |
|------|------------|
| 科幻都市 `scifi-city` | 霓虹主街 / 悬空平台 / 地下城 / 磁悬浮站 / 天台机场 |
| 废土 `wasteland` | 沙暴荒原 / 废土城废墟 / 锈铁货场 / 地下掩体 / 枯木林 / 集市据点 |
| 太空船 `spaceship` | 舰桥 / 船员舱 / 气闸 / 货舱 / 引擎室 |
| 现代校园 `modern-school` | 教室 / 操场 / 图书馆 / 天台 |
| 古风仙侠 `xianxia` | 云海山峰 / 亭台楼阁 / 竹林剑场 / 洞府福地 / 天宫瑶池 |
| 民国 `republic` | 租界洋楼 / 黄包车雨夜 / 茶馆戏台 / 火车站 / 旗袍裁缝铺 |
| 末日 `apocalypse` | 毒雾废墟 / 幸存营地 / 变异丛林 / 核冬公路 / 地下避难所 |
| 校园日常 `school-life` | 课间走廊 / 食堂 / 放学回家路 / 宿舍夜谈 / 校园祭 |
| 赛博朋克 `cyberpunk` | 雨夜霓虹街 / 义体诊所 / 企业大厦 / 黑市夜市 / 天空城 |
| 海洋 `ocean` | 海面 / 深海 / 珊瑚礁 / 海底遗迹 / 风暴海 |
| 雪山 `snow-mountain` | 雪峰 / 雪松林 / 极光 / 冰洞 / 雪原村落 |
| 森林 `forest` | 密林 / 晨雾森林 / 林间小屋 / 林间小径 / 古老树根 |

### 一致性检查

```ts
import { useCharacterConsistency } from '@/composables/useCharacterConsistency'
import { useSceneMatch } from '@/composables/useSceneMatch'

// 1. 角色一致性
const consistency = useCharacterConsistency({ threshold: 0.85 })
const result = await consistency.check(character, newVector)
if (!result.passed) {
  const hint = consistency.regenerateHint(result)
  // 调 AI 服务 + 新提示词重新生成
}

// 2. 场景匹配
const matcher = useSceneMatch({ styleId: 'neon-cyber', subSceneCount: 5 })
const results = await matcher.match('雨夜霓虹改造人')
// results[i].template / results[i].subScenes（4-6 个）
```

### 5 主题适配

复用 W2 themes 系统（`minimal-light / dark-workshop / creator-orange / neon-cyber / national-ink`），每个 archetype 和 scene template 都有 5 套主题配色变体 + 提示词 hint。

### 测试

```bash
# Vitest（从 monorepo 根目录）
cd apps/studio
pnpm test
```

测试覆盖：
- 角色一致性：6 archetype × 5 case + 5 元数据 + 5 API + 5 composable = 30+ case
- 场景匹配：12 template × 5 case + 5 元数据 + 5 匹配 + 5 子场景 + 5 tokenize + 5 一致性 = 60+ case

### 联调

| 端点 | 服务 | 默认端口 |
|------|------|---------|
| `POST /api/v1/embeddings` | embedding-service | 8090 |
| `POST /api/v1/embeddings/batch` | embedding-service | 8090 |
| `GET /healthz` | embedding-service | 8090 |

环境变量 `VITE_EMBEDDING_URL` 覆盖默认地址。无可用服务时自动 fallback 到本地 mock。
