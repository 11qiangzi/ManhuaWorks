# 派单59 漫改工作室工作流节点编辑器 UI 设计交付报告

> **负责人**: 赵千影 🎬 漫改部长  
> **交付日期**: 2026-06-11  
> **项目**: Studio Workflow 可视化节点编辑器 UI / UX 设计稿  
> **后端对接**: 谢擎 (程构部)

---

## 1. 完成时间

**2026-06-11** — 全部设计稿定稿交付，共 5 张核心 UI 切图。

---

## 2. 设计稿交付清单 (5 张图)

所有资源位于 `D:\ManhuaWorks\docs\design\mockups\studio-workflow\`：

| # | 文件名 | 大小 | 用途 | 设计描述 |
|---|--------|------|------|----------|
| 1 | `input-node-01.png` | 70.3 KB | **输入节点** | 素材/任务入口节点。包含节点标题区(紫色品牌色 #7C3AED)、icon 插槽、输入数据类型选择器、来源路径字段。卡片式设计，8px 圆角投影面板。左侧/顶部连接点锚位。 |
| 2 | `process-node-02.png` | 81.5 KB | **处理节点** | 核心处理工具箱节点。青色系(#06B6D4)标识，中部为操作类型下拉 + 参数配置区，可展开/折叠的子步骤列表。支持拖拽排序、内联参数编辑。底部状态指示灯(运行中/完成/错误)。 |
| 3 | `output-node-03.png` | 77.5 KB | **输出节点** | 成品导出/发布节点。绿色系(#10B981)标识，输出格式选择(PSD / PNG / PDF / 飞书云文档)、分辨率配置、导出路径。包含"一键导出全部图层"快捷按钮。右侧输出锚点。 |
| 4 | `node-inspector-04.png` | 89.3 KB | **节点检视器** | 右侧属性面板(Inspector Panel)。紫色顶部标题栏，表单字段包括：节点名称(文本)、节点类型(下拉/只读)、执行条件(条件编辑器)、超时设置(数字+单位)、备注(multiline 文本)、高级参数折叠区。底部"应用"+"重置"双按钮。 |
| 5 | `connection-line-05.png` | 43.5 KB | **连接线/数据流** | 节点间连线可视化规范。展示三种连线类型：实线(数据流)、虚线(条件分支)、点线(反馈回路)。连线颜色对应源节点品牌色渐变过渡，箭头端点统一 8px 半圆。贝塞尔曲线路径，默认水平出→水平入。 |

> ⚠️ **多余文件**: `node-input-01.png` (93.6 KB) 为第 1 次生成跑挂残留，与 `input-node-01.png` 重名冲突，**不计入交付**。建议删除清理。

---

## 3. 设计规范

### 3.1 品牌色彩系统

| 用途 | 色值 | Tailwind 类名参考 |
|------|------|-------------------|
| **主色调 (输入/导航)** | `#7C3AED` | purple-600 |
| **辅色调 (处理/工具)** | `#06B6D4` | cyan-500 |
| **成功色 (输出/完成)** | `#10B981` | emerald-500 |
| **背景色 (画布)** | `#0F172A` | slate-900 |
| **面板背景** | `#1E293B` | slate-800 |
| **文字主色** | `#F1F5F9` | slate-100 |
| **文字辅色** | `#94A3B8` | slate-400 |
| **边框/分割线** | `#334155` | slate-700 |
| **错误/告警** | `#EF4444` | red-500 |
| **警告** | `#F59E0B` | amber-500 |

### 3.2 布局规范

- **节点卡片圆角**: 统一 `8px` (`border-radius: 8px`)
- **按钮/输入框圆角**: `6px`
- **面板圆角**: `12px` (检视器侧栏)
- **节点最小宽度**: 240px, 最小高度: 120px
- **节点间距**: 水平 40px, 垂直 32px
- **连接点锚位半径**: 6px (内圈 4px)
- **面板内边距**: 16px

### 3.3 Icon 风格

- **图标库**: 统一使用 Lucide Icons (线框风格, stroke-width: 2px)
- **尺寸规格**: 节点标题 icon = 20px, 操作 icon = 16px, 状态 icon = 12px
- **配色规则**: icon 颜色跟随所属节点品牌色, 不可操作状态用 `#64748B` (slate-500)
- **节点类型图标映射**:
  - 输入节点 → `ArrowDownToLine` / `FileInput`
  - 处理节点 → `Cog` / `Wand2` / `Layers`
  - 输出节点 → `FileOutput` / `PackageOpen` / `Share2`
  - 条件分支 → `GitBranch` / `Split`

### 3.4 字体规范

- **字体栈**: `'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif`
- **节点标题**: 14px / Bold / 字重 600
- **标签/字段名**: 12px / Medium / 字重 500 / 文字辅色
- **正文/参数值**: 13px / Regular / 字重 400
- **代码/路径**: 12px / `'JetBrains Mono', monospace`

### 3.5 交互状态

| 状态 | 视觉表现 |
|------|----------|
| **默认 (default)** | 节点卡片阴影 `0 1px 3px rgba(0,0,0,0.3)` |
| **悬停 (hover)** | 边框高亮至品牌色, 阴影加深 |
| **选中 (selected)** | 2px 品牌色实线边框 + 外发光 `0 0 0 3px` 品牌色 20% 透明度 |
| **拖拽中 (dragging)** | 透明度 85%, 阴影 `0 8px 24px rgba(0,0,0,0.5)` |
| **执行中 (running)** | 标题栏呼吸动画 (品牌色脉冲), 状态指示灯闪烁 |
| **错误 (error)** | 边框变红, 节点底部错误摘要条 |
| **禁用 (disabled)** | 整体 50% 透明度, 不可拖拽/interact |

---

## 4. 截止时间

**2026-06-12 18:00 (GMT+8)** — 谢擎后端接口对接截止。

进度里程碑:
- ✅ 6/11 赵千影设计稿交付 (本报告)
- 🔲 6/12 18:00 谢擎完成节点引擎后端接口
- 🔲 6/13 联调测试

---

## 5. 关键路径说明 (供谢擎后端使用)

### 5.1 节点数据模型 (JSON Schema)

```json
{
  "workflow": {
    "id": "wf_xxx",
    "name": "工作流名称",
    "nodes": [],
    "edges": [],
    "viewport": { "x": 0, "y": 0, "zoom": 1.0 }
  },
  "node": {
    "id": "node_xxx",
    "type": "input | process | output",
    "position": { "x": 0, "y": 0 },
    "data": {
      "label": "节点名称",
      "config": {},
      "inputs": [],
      "outputs": []
    }
  },
  "edge": {
    "id": "edge_xxx",
    "source": "node_id",
    "target": "node_id",
    "sourceHandle": "output-0",
    "targetHandle": "input-0",
    "type": "solid | dashed | dotted",
    "animated": true
  }
}
```

### 5.2 后端 API 端点需求

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/workflows` | GET | 获取工作流列表 |
| `/api/workflows/:id` | GET | 获取单个工作流详情 (含节点+连线) |
| `/api/workflows` | POST | 创建新工作流 |
| `/api/workflows/:id` | PUT | 全量更新工作流 (保存画布状态) |
| `/api/workflows/:id` | DELETE | 删除工作流 |
| `/api/workflows/:id/execute` | POST | 执行工作流 (触发节点遍历) |
| `/api/workflows/:id/execute/:nodeId` | POST | 单节点试运行 (调试模式) |
| `/api/workflows/:id/status` | GET | 查询执行状态 (轮询) |

### 5.3 节点执行引擎要点

1. **DAG 拓扑排序**: 执行前校验无环, BFS 遍历执行顺序
2. **节点生命周期**: `PENDING → QUEUED → RUNNING → COMPLETED / FAILED`
3. **并行执行**: 同一层级无依赖节点可并行调度
4. **执行上下文传递**: 上游节点 output → 下游节点 input (JSON 透传)
5. **断点续跑**: 支持从任意失败节点重试, 不重复执行已完成上游
6. **WebSocket 推送**: `/ws/workflows/:id` 实时推送节点状态变化

### 5.4 连接线规则

| 连线类型 | 视觉 | 后端语义 |
|----------|------|----------|
| 实线 (solid) | 数据流主路径 | source.output → target.input, 数据传递 |
| 虚线 (dashed) | 条件分支 | 条件表达式求值, 分支路由 |
| 点线 (dotted) | 反馈/回环 | 迭代器回传, 循环控制 |

### 5.5 前端依赖 (谢擎若需前端联调参考)

- **画布引擎**: React Flow (`@xyflow/react` v12+)
- **节点类型注册**: 按 `type` 字段动态加载组件
- **自定义 Handle**: 左侧=输入锚点 (target), 右侧=输出锚点 (source)
- **缩放范围**: 0.25x ~ 2.0x

---

## 6. 规格表

### 6.1 节点类型规格

| 节点类型 | type 值 | 品牌色 | 图标 | 输入锚点数 | 输出锚点数 | 特有字段 |
|----------|---------|--------|------|-----------|-----------|----------|
| 输入节点 | `input` | #7C3AED | FileInput | 0 | 1~N | `sourceType`, `sourcePath`, `fileFilter` |
| 处理节点 | `process` | #06B6D4 | Cog | 1~N | 1~N | `operation`, `params`, `substeps[]`, `timeout` |
| 输出节点 | `output` | #10B981 | FileOutput | 1~N | 0 | `format`, `resolution`, `exportPath`, `autoExport` |
| 条件节点 | `condition` | #F59E0B | GitBranch | 1 | 2+ (true/false + N分支) | `expression`, `branches[]` |
| 循环节点 | `loop` | #EC4899 | Repeat | 1 | 2 (body / done) | `iterator`, `maxIterations`, `collectionRef` |

### 6.2 节点检视器 (Inspector) 表单字段

| 字段名 | 字段类型 | 适用于 | 必填 | 默认值 | 说明 |
|--------|----------|--------|------|--------|------|
| `label` | 文本 (text) | 全部节点 | ✅ | "未命名节点" | 画布上显示的节点名称 |
| `description` | 多行文本 (textarea) | 全部节点 | ❌ | "" | 节点功能描述/备注 |
| `sourceType` | 下拉 (select) | input 节点 | ✅ | "file" | [file, folder, url, api, clipboard] |
| `sourcePath` | 文本+文件选择器 | input 节点 | ✅ | "" | 素材来源路径 |
| `fileFilter` | 多选 (multiselect) | input 节点 | ❌ | [] | [.psd, .png, .jpg, .pdf, .ai] |
| `operation` | 下拉 (select) | process 节点 | ✅ | "resize" | [resize, crop, filter, textOverlay, layerMerge, psdExport, batchRename, colorCorrect, sharpening, watermark] |
| `params` | JSON 编辑器 | process 节点 | ✅ | {} | 操作参数 (JSON 对象) |
| `substeps` | 动态列表 | process 节点 | ❌ | [] | 子步骤数组, 支持拖拽排序 |
| `timeout` | 数字+单位 | process 节点 | ❌ | 300 | 超时秒数 (30~3600) |
| `format` | 下拉 (select) | output 节点 | ✅ | "png" | [png, jpg, psd, pdf, svg, webp, gif, mp4] |
| `resolution` | 预设+自定义 | output 节点 | ✅ | "original" | [original, 1x, 2x, 4x, custom] |
| `exportPath` | 文本+文件夹选择器 | output 节点 | ✅ | "" | 导出目标路径 |
| `autoExport` | 复选框 (checkbox) | output 节点 | ❌ | false | 流程完成自动导出 |
| `expression` | 表达式编辑器 | condition 节点 | ✅ | "" | 条件表达式 (JavaScript eval) |
| `branches` | 键值对列表 | condition 节点 | ✅ | [] | 条件分支名→目标 |
| `iterator` | 文本 | loop 节点 | ✅ | "item" | 迭代变量名 |
| `maxIterations` | 数字 | loop 节点 | ❌ | 100 | 最大迭代次数 |
| `collectionRef` | 节点选择器 | loop 节点 | ✅ | "" | 引用上游节点的输出集合字段 |

### 6.3 执行状态码

| 状态 | 色值 | 图标 | 前端动画 |
|------|------|------|----------|
| PENDING | #64748B | Circle | 无 |
| QUEUED | #F59E0B | Clock | 无 |
| RUNNING | #3B82F6 | Loader2 | 旋转 + 标题栏脉冲 |
| COMPLETED | #10B981 | CheckCircle2 | 短暂绿色闪烁后静止 |
| FAILED | #EF4444 | XCircle | 红色闪烁 + 展开错误详情条 |
| SKIPPED | #94A3B8 | SkipForward | 无 (条件分支跳过) |

---

## 附：文件校验

```
交付文件数: 5
总大小: 70.3 + 81.5 + 77.5 + 89.3 + 43.5 = 362.1 KB
路径前缀: D:\ManhuaWorks\docs\design\mockups\studio-workflow\
校验人: 赵千影
状态: ✅ 全部就绪
```

---

**下次派单请虾总助确认: 图已在盘, 莫再生成。** 📋
