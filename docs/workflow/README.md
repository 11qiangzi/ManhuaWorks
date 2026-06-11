# ManhuaWorks 工作流系统

> 编排层：把 6 种 AI 生成能力（pipeline）组合成可执行的有向无环图（DAG）。

---

## 1. 什么是工作流

工作流 = **节点（Node）** + **边（Edge）** + **执行引擎（Engine）**。

```
┌──────────┐    ┌────────────────┐    ┌──────────┐
│ node A   │───▶│ node B         │───▶│ node C   │
│ translate│    │ style-transfer │    │ episode  │
└──────────┘    └────────────────┘    └──────────┘
      │                │
      ▼                ▼
┌──────────┐    ┌────────────────┐
│ node D   │    │ node E (与 D   │
│ 角色图   │    │  并行执行)     │
└──────────┘    └────────────────┘
```

- **节点** = 一个 AI 任务单元（如"翻译一章小说"、"生成 20 张分镜"）。
- **边** = 节点间的数据/控制流（`dependsOn`）。
- **引擎** = 把图跑起来：拓扑排序、并行执行、错误隔离、重试。

工作流和单条 pipeline 的区别：

| 维度 | Pipeline | Workflow |
|------|----------|----------|
| 颗粒度 | 单个 AI 任务的内部步骤 | 多个 AI 任务的编排 |
| 编排位置 | `PipelineRunner` | `WorkflowEngine` |
| 失败处理 | 步骤级重试 + 成本追踪 | 节点级重试 + 整图中止/隔离 |
| 典型场景 | 一条漫剧的完整生成 | "先翻译 → 再分镜 → 再角色图 → 再视频"的串联/并联 |

---

## 2. 6 种节点类型

| 类型 | 用途 | 典型参数 | 详情 |
|------|------|----------|------|
| `translate` | 自动翻译（多语种互译） | `sourceText`, `sourceLang`, `targetLang` | [NODE_TYPES.md](./NODE_TYPES.md#1-translate) |
| `character-replace` | 单角色替换（保持视觉一致） | `characterId`, `referenceImage`, `targetScene` | [NODE_TYPES.md](./NODE_TYPES.md#2-character-replace) |
| `episode-batch` | 集数分集批处理 | `episodes`, `concurrency` | [NODE_TYPES.md](./NODE_TYPES.md#3-episode-batch) |
| `style-transfer` | 风格迁移（写实↔二次元等） | `sourceImage`, `stylePreset` | [NODE_TYPES.md](./NODE_TYPES.md#4-style-transfer) |
| `novel-to-drama` | 小说 → 漫剧剧本 | `chapterId`, `sceneCount` | [NODE_TYPES.md](./NODE_TYPES.md#5-novel-to-drama) |
| `multi-character` | 多角色协同替换 | `characterIds[]`, `targetScene` | [NODE_TYPES.md](./NODE_TYPES.md#6-multi-character) |

每种节点对应 ai-orchestrator 里的一个 `*.refined.ts` pipeline，由 `pipeline-bridge.ts` 做映射。

---

## 3. 完整工作流示例

**场景**：把中文小说第 1 章做成 1 集漫剧。

```typescript
import { buildWorkflow, WorkflowEngine } from "@manhuaworks/ai-orchestrator";
import { makeBridgeExecutor } from "@manhuaworks/ai-orchestrator/workflow/pipeline-bridge";

const wf = buildWorkflow({
  id: "wf-ch001-001",
  name: "Chapter 1 → Episode 1",
  nodes: [
    {
      id: "translate",
      type: "translate",
      params: { sourceText: "...", sourceLang: "zh", targetLang: "en" },
    },
    {
      id: "drama",
      type: "novel-to-drama",
      params: { chapterId: "ch-001", sceneCount: 20 },
      dependsOn: ["translate"],
    },
    {
      id: "characterImg1",
      type: "character-replace",
      params: { characterId: "alice", targetScene: "scene-001" },
      dependsOn: ["drama"],
    },
    {
      id: "characterImg2",
      type: "character-replace",
      params: { characterId: "alice", targetScene: "scene-002" },
      dependsOn: ["drama"],
    },
    {
      id: "video",
      type: "multi-character",
      params: { characterIds: ["alice", "bob"], episodeId: "ep-001" },
      dependsOn: ["characterImg1", "characterImg2"],
    },
  ],
});

const engine = new WorkflowEngine();
const executor = makeBridgeExecutor((p) => ({ userId: p.userId, tier: "pro" }));
const result = await engine.execute(wf, { executor });
```

**执行图**（同层并行）：

```
Layer 0: [translate]
         ↓
Layer 1: [drama]
         ↓
Layer 2: [characterImg1, characterImg2]   ← 并行
         ↓
Layer 3: [video]
```

---

## 4. 引擎关键能力

### 4.1 拓扑排序（Kahn 算法）
- 入口节点（无依赖）放在 Layer 0
- 同层节点可并行
- 检测环 → 抛 `WorkflowEngine: cycle detected`

### 4.2 并行执行
- 同层节点用 `Promise.allSettled` 并发
- 跨层严格顺序执行（下层等上层全部完成）

### 4.3 错误隔离
- 单个节点失败 → 标记 `failed`，**不阻塞同层其他节点**
- 下层节点依赖失败 → 标记 `skipped`
- `optional: true` 的节点失败不阻塞整图

### 4.4 重试策略
- 默认重试 **3 次**（指数退避：200ms → 400ms → 800ms，上限 2s）
- 重试耗尽 → 标 `failed`
- 取消信号触发 → 标 `skipped`，不重试

### 4.5 节点状态机
```
idle → running → succeeded
              ↘ failed
              ↘ skipped
```

### 4.6 上下文传递
- 每个节点的 `output` 自动存进 `upstreamOutputs[nodeId]`
- 下游节点的 `executor` 通过 `ctx.upstreamOutputs` 拿到所有上游输出

---

## 5. 测试覆盖

| 文件 | 测试数 | 状态 |
|------|--------|------|
| `engine.test.ts` | 27 | ✅ |
| `pipeline-bridge.test.ts` | 6 | ✅ |

合计 **33 个 workflow 单元测试**，覆盖：
- 拓扑排序正确性
- 并行层执行
- 重试 + 退避
- 错误隔离
- 取消信号
- 节点状态机转换
- pipeline 路由映射

---

## 6. 下一步

- [NODE_TYPES.md](./NODE_TYPES.md) — 节点类型详细文档
- [ENGINE.md](./ENGINE.md) — 引擎技术细节
- [INTEGRATION.md](./INTEGRATION.md) — studio + API 集成指南
