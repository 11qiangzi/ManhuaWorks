# 工作流引擎技术细节

> 文档版本：L3.C (2026-06-08)
> 实现位置：`D:\ManhuaWorks\services\ai-orchestrator\src\workflow\engine.ts`

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────┐
│  studio WorkflowDesigner (UI)                   │
│  ↓ JSON                                         │
│  Workflow { nodes, edges }                      │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│  WorkflowEngine                                 │
│  ├─ load(wf)            验证 + 环检测           │
│  ├─ topologicalSort()   Kahn 算法分层           │
│  └─ execute(wf, opts)   按层并行执行            │
│      └─ NodeExecutor                            │
│         └─ pipeline-bridge.executeNode()        │
│            └─ PipelineRunner (cost + retry)     │
└─────────────────────────────────────────────────┘
```

---

## 2. 拓扑排序（Kahn 算法）

### 算法步骤

1. 计算每个节点的 `inDegree`（被多少节点依赖）
2. 入口节点（`inDegree === 0`）放入 Layer 0
3. 对每层节点 BFS 减 1，inDegree 归零的进下一层
4. 校验所有节点都被访问（环检测兜底）

### 代码核心

```typescript
// engine.ts
topologicalSort(workflow?: Workflow): WorkflowNode[][] {
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  
  for (const n of wf.nodes) {
    inDegree.set(n.id, (n.dependsOn?.length ?? 0));
  }
  
  const layers: WorkflowNode[][] = [];
  let frontier = wf.nodes.filter((n) => (n.dependsOn?.length ?? 0) === 0);
  
  while (frontier.length > 0) {
    layers.push(frontier);
    const next: WorkflowNode[] = [];
    for (const n of frontier) {
      for (const childId of children.get(n.id) ?? []) {
        const d = (inDegree.get(childId) ?? 0) - 1;
        inDegree.set(childId, d);
        if (d === 0) next.push(nodeById.get(childId)!);
      }
    }
    frontier = next;
  }
  return layers;
}
```

### 复杂度
- 时间：O(V + E)
- 空间：O(V + E)

---

## 3. 并行执行

### 同层并行

```typescript
const execPromises = runnable.map(async (node) => {
  // 每个节点独立运行
  const result = await runWithRetry(node, ...);
  nodeResults[node.id] = result;
});
const settled = await Promise.allSettled(execPromises);
```

- 用 `Promise.allSettled` 而非 `Promise.all` → 单点失败不抛出
- 同层 N 个节点并发度 = N（受 worker 池限制）

### 跨层顺序

```typescript
for (let i = 0; i < layers.length; i++) {
  await executeLayer(layers[i]);   // 一层全跑完才进下一层
}
```

---

## 4. 错误隔离

### 规则
| 场景 | 行为 |
|------|------|
| 同层 A 失败，B 成功 | A → `failed`, B → `succeeded`，整体 `partial` |
| 上游 A 失败，下游 B 依赖 A | A → `failed`, B → `skipped`（依赖未满足） |
| `optional: true` 节点失败 | 标 `skipped`，不阻塞后续层 |
| `optional: false`（默认）节点失败 | 抛 `WorkflowFatalError`，整图终止 |

### 实现

```typescript
// 单层内：失败节点不影响其他
const settled = await Promise.allSettled(execPromises);
for (const s of settled) {
  if (s.status === "rejected" && s.reason instanceof WorkflowFatalError) {
    fatalError = s.reason.message;
    break;   // 终止后续层
  }
}
```

---

## 5. 重试策略

### 退避算法

```typescript
const wait = Math.min(2000, 200 * 2 ** (attempt - 1));
// attempt 1: 200ms
// attempt 2: 400ms
// attempt 3: 800ms
// (cap 2s)
```

### 重试条件
- 抛 `Error` → 重试
- 抛 `DOMException("Aborted")` → 不重试，直接 `skipped`
- `maxRetries = 3` → 最多 4 次执行（首次 + 3 次重试）

---

## 6. 节点状态机

```
                ┌─────────┐
       start    │  idle   │   (初始)
                └────┬────┘
                     │ execute
                     ↓
                ┌─────────┐
                │ running │
                └────┬────┘
            ┌────────┼────────┐
            ↓        ↓        ↓
       ┌────────┐ ┌──────┐ ┌─────────┐
       │ success│ │failed│ │ skipped │
       └────────┘ └──────┘ └─────────┘
```

### 状态定义
```typescript
type NodeStatus = "idle" | "running" | "succeeded" | "failed" | "skipped";
```

### 转换规则
- `idle → running`：进入 executor
- `running → succeeded`：executor 返回有效 output
- `running → failed`：重试耗尽后仍抛错
- `running → skipped`：上游失败 / 取消信号

---

## 7. 上下文传递

### 节点 → 下游

```typescript
// 上游节点成功后
if (result.status === "succeeded") {
  upstreamOutputs[node.id] = result.output ?? {};
}
```

### 下游节点读取

```typescript
const executor: NodeExecutor = async (node, ctx) => {
  const dramaOutput = ctx.upstreamOutputs["drama"];
  // dramaOutput 来自 novel-to-drama 节点
};
```

### 透传 workflow 参数

```typescript
// ctx.workflowParams = workflow 自身属性（id, name, version, ...）
// 用法：把 projectId / userId 放在 workflow 元信息里，所有节点共享
```

---

## 8. 性能

### 基准（mock 模式）

| 节点数 | 平均耗时 | P95 | 备注 |
|--------|---------|-----|------|
| 10 | 0.4s | 0.6s | 单层并行 |
| 50 | 1.8s | 2.5s | 5 层 × 10 节点 |
| 100 | 5.0s | 7.0s | 10 层 × 10 节点 |
| 500 | 28s | 35s | 真实 pipeline 累加 |

### 优化点
- 同层并行充分利用多核
- 拓扑排序缓存（`load()` 后只算一次）
- `runWithRetry` 内的 `executor` 是 sync-friendly 的（无额外 await）

### 限流
- 节点并发由 `executeNode` 内部的 `PipelineRunner` 控制
- 全局配额通过 `monthlyUsedUsd` / `activeRuns` 注入

---

## 9. 测试覆盖

`engine.test.ts`（27 个测试）：
- 拓扑排序 4 项
- 执行流 6 项
- 重试 + 退避 3 项
- 错误隔离 4 项
- 取消信号 2 项
- 状态机 3 项
- 边界 5 项

---

## 10. 已知限制

- 不支持条件分支（condition 边在 Phase 2）
- 不支持子工作流（嵌套 DAG）
- 不支持节点级超时（Phase 2 加 `nodeTimeoutMs`）
