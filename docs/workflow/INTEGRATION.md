# 工作流集成指南

> 把 studio 的可视化工作流设计器、API 执行端点、外部系统串起来。

---

## 1. 在 studio WorkflowDesigner 创建工作流

### 1.1 UI 操作

```
项目页 → 工作流 Tab → "+ New Workflow" → 拖拽节点 → 连线 → 保存
```

### 1.2 节点拖拽面板

studio 左侧节点面板会列出 6 种类型（`NODE_TYPES` 来自 `@manhuaworks/shared-types`）：

| 类型 | 图标 | 颜色 |
|------|------|------|
| `translate` | 🌐 | blue |
| `character-replace` | 👤 | purple |
| `episode-batch` | 📚 | cyan |
| `style-transfer` | 🎨 | pink |
| `novel-to-drama` | 🎬 | amber |
| `multi-character` | 👥 | violet |

### 1.3 节点配置面板

点节点 → 右侧抽屉：
- **Params 表单**：根据节点类型动态渲染（zod schema 驱动）
- **DependsOn 列表**：可选上游节点
- **节点级选项**：`optional: true/false`，`maxRetries: 0-5`

### 1.4 保存

点击保存 → POST `/api/workflows`，返回 `{ id, version }`。

---

## 2. 通过 API 提交执行

### 2.1 启动

```http
POST /api/workflows/{wfId}/executions
Content-Type: application/json
Authorization: Bearer <token>

{
  "params": {
    "userId": "u-001",
    "projectId": "p-001"
  }
}
```

**响应**：
```json
{
  "executionId": "exec-abc123",
  "status": "running",
  "startedAt": 1717854000000
}
```

### 2.2 实现位置

```
D:\ManhuaWorks\services\studio\src\pages\api\workflows\[wfId]\executions.ts
D:\ManhuaWorks\services\ai-orchestrator\src\routes\workflow-execute.ts
```

---

## 3. 轮询执行状态

### 3.1 状态查询

```http
GET /api/executions/{executionId}
```

**响应**：
```json
{
  "executionId": "exec-abc123",
  "workflowId": "wf-001",
  "status": "running" | "succeeded" | "partial" | "failed",
  "layers": [
    {
      "layer": 0,
      "status": "succeeded",
      "nodes": {
        "translate": { "status": "succeeded", "attempts": 1, "latencyMs": 1234 }
      },
      "durationMs": 1234
    }
  ],
  "startedAt": 1717854000000,
  "finishedAt": null,
  "durationMs": null,
  "failedNodes": [],
  "error": null
}
```

### 3.2 推荐轮询节奏

```typescript
const poll = async (execId: string) => {
  while (true) {
    const r = await fetch(`/api/executions/${execId}`);
    const { status, layers } = await r.json();
    
    // 实时推 UI
    onProgress(layers);
    
    if (status === "succeeded" || status === "failed") {
      return { status, layers };
    }
    if (status === "partial") {
      // 部分失败，可选终止
      const shouldContinue = await askUser();
      if (!shouldContinue) await fetch(`/api/executions/${execId}/cancel`, { method: "POST" });
    }
    
    // 智能退避
    const nextDelay = status === "running" ? 2000 : 5000;
    await sleep(nextDelay);
  }
};
```

### 3.3 SSE 实时推送（推荐）

如果项目支持，优先用 SSE 代替轮询：

```
GET /api/executions/{execId}/stream   (text/event-stream)
```

事件流：
```
event: layer-complete
data: {"layer": 1, "status": "succeeded"}

event: node-finish
data: {"nodeId": "drama", "status": "succeeded", "attempts": 1}

event: execution-finish
data: {"status": "succeeded", "durationMs": 12345}
```

---

## 4. 错误处理建议

### 4.1 前端

| 引擎 status | UI 行为 |
|------------|---------|
| `succeeded` | 绿勾 + 跳转结果页 |
| `partial` | 黄警告 + 列出 failed 节点 + 手动重试按钮 |
| `failed` | 红叉 + 错误详情 + "查看日志" 跳 cost-log |

### 4.2 后端

```typescript
// 推荐：失败节点不删除，让用户决定重试 / 跳过
if (result.status === "failed") {
  // 不 throw，让上层决定
  return NextResponse.json({ 
    execution: result, 
    canRetry: result.failedNodes.length > 0 
  });
}
```

### 4.3 重试单个节点

```http
POST /api/executions/{execId}/nodes/{nodeId}/retry
```

引擎会用新参数（可选）重跑该节点及其下游。

---

## 5. 与 cost-log 的集成

### 5.1 自动计费

每次工作流执行会**自动**在 `cost-tracker.ts` 累加成本：

```typescript
// pipeline-bridge.ts
snap.costSummary.totalCostUsd      // 当前节点
snap.costSummary.totalLatencyMs    // 当前节点

// 整图成本 = 所有节点之和
const totalCost = result.layers
  .flatMap((l) => Object.values(l.nodes))
  .reduce((sum, n) => sum + (n.costUsd ?? 0), 0);
```

### 5.2 cost-log 写入

`pipeline-runner.ts` 完成后会调用 `byokClient.recordUsage()`，把 step-level cost 落到 ai-keys-service。

工作流层 cost-log 写入位置：
```
D:\ManhuaWorks\services\cost-log\src\workflow-cost.ts
```

### 5.3 用户配额检查

工作流启动前会校验：
- `monthlyUsedUsd + estimatedCost ≤ quota.monthlyUsd`
- `activeRuns ≤ quota.maxConcurrent`

超额直接拒，`status: "failed"`，`error: "quota exceeded"`。

### 5.4 成本可视化

studio 项目页 → "成本" Tab：
- 本月已用 / 配额上限（环形图）
- 各 workflow 累计 cost（柱状图）
- 单次 execution cost breakdown（树形）

---

## 6. 完整代码示例

```typescript
// 1. 构造工作流
import { buildWorkflow } from "@manhuaworks/ai-orchestrator/workflow/engine";
import { makeBridgeExecutor } from "@manhuaworks/ai-orchestrator/workflow/pipeline-bridge";

const wf = buildWorkflow({
  id: "wf-001",
  name: "My Workflow",
  nodes: [
    { id: "t", type: "translate", params: { /* ... */ } },
    { id: "d", type: "novel-to-drama", params: { /* ... */ }, dependsOn: ["t"] },
  ],
});

// 2. 启动执行
const executor = makeBridgeExecutor((p) => ({ 
  userId: p.userId as string, 
  tier: "pro" 
}));

import { WorkflowEngine } from "@manhuaworks/ai-orchestrator/workflow/engine";
const engine = new WorkflowEngine();
const ac = new AbortController();

// 3. 监听进度
engine.execute(wf, {
  executor,
  signal: ac.signal,
  onLayerComplete: (layer) => console.log("Layer done", layer),
  onNodeStart: (id) => console.log("Start", id),
  onNodeFinish: (id, r) => console.log("Finish", id, r.status),
}).then((result) => {
  console.log("Total cost: $", computeTotalCost(result));
  console.log("Status:", result.status);
});

// 4. 可选：取消
setTimeout(() => ac.abort(), 30_000);
```

---

## 7. 监控与日志

- **应用日志**：`/var/log/ai-orchestrator/workflow-{execId}.log`
- **指标**：`workflow_execution_duration_seconds`, `workflow_node_failure_total`
- **Trace**：每个 execution 注入 `X-Trace-Id`，串到 OpenTelemetry
