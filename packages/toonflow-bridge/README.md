# @manhuaworks/toonflow-bridge

ManhuaWorks × Toonflow 兼容对接层 v1。让 ManhuaWorks 系统能接收 Toonflow 格式的输入并返回标准 mp4 输出。

> W5 任务 1 交付。位于 ManhuaWorks monorepo 的 `packages/toonflow-bridge`。
>
> 上游：`@manhuaworks/ai-orchestrator`（W3/W4 已交付）的 5 pipeline + 7 步骤。
> 下游：Toonflow 现有客户端（无需改动，桥接层做形态转换）。

---

## 1. 它做什么

```
┌────────────┐   ToonflowRunRequest   ┌─────────────────────┐   POST novel-to-drama
│  Toonflow  │ ─────────────────────▶ │ ToonflowBridge      │ ────────────────────────▶  ai-orchestrator
│  Caller    │                        │ (this package)      │ ◀─────  RunSnapshot  ────  (HTTP)
│            │ ◀─────────────────────  │                     │
└────────────┘   ToonflowJobResult    └─────────────────────┘
                                         │ WS progress
                                         ▼
                                      ToonflowProgressEvent
```

| 维度 | Toonflow 侧 | 桥接层 | ManhuaWorks 侧 |
|------|------------|--------|----------------|
| 状态 | 5 状态（pending/running/composing/done/failed） | 双向映射 | 5 状态（pending/running/success/failed/cancelled） |
| 步骤 | 9 节点（input_text…output_mp4） | 折叠成 1 个 input | 7 步骤（storyboard…compose） |
| 进度 | 0-100 百分比 + 当前节点 | 加权累计 | step.status + cost |
| 输出 | mp4 + shots + srt | 字段重命名 + 失败收敛 | finalVideoUrl + imageUrls + videoUrls |

---

## 2. 目录结构

```
packages/toonflow-bridge/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                    # 主入口，导出 ToonflowBridge 类 + 所有子模块
│   ├── bridge.ts                   # 门面：run() / start() / handle
│   ├── adapters/
│   │   ├── _id.ts                  # 极简 ID 生成（无第三方依赖）
│   │   ├── input.ts                # Toonflow → 调 ai-orchestrator
│   │   ├── output.ts               # RunSnapshot → ToonflowJobResult（含轮询）
│   │   └── progress.ts             # 5 状态 ↔ 7 步骤映射
│   ├── client/
│   │   ├── http.ts                 # ai-orchestrator HTTP 客户端
│   │   └── ws.ts                   # Toonflow WS 推送客户端（带心跳+重连）
│   ├── mapper/
│   │   ├── toonflow-to-novel.ts    # Toonflow workflow → NovelToDramaInput
│   │   └── novel-to-toonflow.ts    # RunSnapshot+Output → ToonflowJobResult
│   ├── types/
│   │   ├── toonflow.ts             # Toonflow 对外契约类型
│   │   └── manhua.ts               # ManhuaWorks 端类型（同步自 ai-orchestrator）
│   └── examples/
│       ├── basic.ts                # 5 步生成 1 集
│       └── advanced.ts             # 自定义 prompt + BYOK + WS
└── tests/
    ├── bridge.test.ts              # 端到端（含 mock ai-orchestrator）
    └── mapper.test.ts              # 双向 mapper 单测
```

---

## 3. 状态 / 步骤映射速查

### 状态（5 ↔ 5）

| Toonflow | 触发条件 | ManhuaWorks |
|----------|---------|-------------|
| `pending` | snap.status='pending' | `pending` |
| `running` | snap.status='running' 且 compose 未到 | `running` |
| `composing` | snap.steps["compose"] 在 running/success | `running` |
| `done` | snap.status='success' | `success` |
| `failed` | snap.status='failed' 或 'cancelled' | `failed` / `cancelled` |

### 步骤（9 节点 → 7 步骤 + 丢弃）

| Toonflow 节点 | 折叠到 NovelToDramaInput 字段 |
|---------------|-----------------------------|
| `input_text` | `text`（≥20 字符） + `chapterTitle` |
| `generate_storyboard` | `storyType` |
| `image_diffusion` | `artStyle` |
| `tts` | `ttsProvider` |
| `video_animate` | `durationSeconds`（15-180） |
| `split_chapters` / `extract_characters` / `compose` / `output_mp4` | 忽略（由 ManhuaWorks 内部处理） |
| 其他未知节点 | 抛 `ToonflowMappingError` |

### 进度百分比加权

```
storyboard 0.10 + character 0.10 + scene 0.10 + image-gen 0.20
+ tts 0.05 + video-gen 0.30 + compose 0.15 = 1.00
```

成功步骤累加 100%，当前 running 步骤算 50%。

---

## 4. 用法

### 4.1 基础（同步等 mp4）

```ts
import { ToonflowBridge } from "@manhuaworks/toonflow-bridge";

const bridge = new ToonflowBridge({
  orchestratorUrl: "http://127.0.0.1:8087",
  orchestratorToken: process.env.ORCH_TOKEN,
});

const result = await bridge.run(workflow, runRequest, {
  onProgress: (ev) => console.log(ev.status, ev.progress),
  timeoutMs: 10 * 60_000,
});

console.log(result.finalVideoUrl); // https://...
```

### 4.2 高级（自定义 prompt + BYOK + WS）

```ts
const bridge = new ToonflowBridge({
  orchestratorUrl: "http://127.0.0.1:8087",
  toonflowWsUrl: "wss://toonflow.example.com",
  toonflowToken: process.env.TOONFLOW_TOKEN,
  pollIntervalMs: 3_000,
});

const handle = await bridge.start(workflow, {
  ...runRequest,
  byok: { imageKey: "...", videoKey: "...", ttsKey: "..." },
}, { onProgress: (ev) => ui.update(ev) });

// 同时做别的事
setInterval(() => handle.latestSnapshot().then(s => console.log(s.status)), 15_000);

const result = await handle.waitForResult();
```

---

## 5. 运行

```bash
# 装依赖（首次）
pnpm install

# 类型检查（应 0 错）
pnpm --filter @manhuaworks/toonflow-bridge typecheck

# 单测
pnpm --filter @manhuaworks/toonflow-bridge test

# 示例（需要 ai-orchestrator 跑在 8087）
pnpm --filter @manhuaworks/toonflow-bridge example:basic
pnpm --filter @manhuaworks/toonflow-bridge example:advanced

# 构建产物（dist/）
pnpm --filter @manhuaworks/toonflow-bridge build
```

环境变量：

| 变量 | 用途 | 默认 |
|------|------|------|
| `ORCHESTRATOR_URL` | ai-orchestrator 基址 | `http://127.0.0.1:8087` |
| `ORCH_TOKEN` | ai-orchestrator Bearer token | （无） |
| `TOONFLOW_WS_URL` | Toonflow WS 基址（可选） | （无 → 不推送） |
| `TOONFLOW_TOKEN` | Toonflow WS 鉴权 token | （无） |

---

## 6. 错误类型

| 类 | 触发场景 |
|----|---------|
| `ToonflowMappingError` | workflow 节点不合法 / 文本缺失 / duration 越界 |
| `InputAdapterError` | 包装 `ToonflowMappingError` 或 start 失败 |
| `OutputAdapterError` | 轮询超时 / 终态映射失败 |
| `OrchestratorHttpError` | ai-orchestrator 返回非 2xx |
| `NovelToToonflowError` | 成功 snapshot 缺 `finalVideoUrl` / 非终态 |
| `WS` 错误 | 通过 `logger` 回调，不抛 |

所有错误都带 `name` 字段 + 可读 message，方便上游 `err.name` 分流。

---

## 7. 类型复用策略

`src/types/manhua.ts` 当前是「同步镜像」ai-orchestrator 类型（因为后者 main 入口尚未 re-export 公共类型，dist 也没有 declaration 输出）。

**W6 待办**：
1. 在 `services/ai-orchestrator/src/index.ts` 增加公共类型 re-export
2. 让 `services/ai-orchestrator/package.json` 的 `types` 指向有效的 `dist/index.d.ts`
3. 把 `manhua.ts` 改为 `export type { ... } from "@manhuaworks/ai-orchestrator"`，删除同步镜像

改动后 toonflow-bridge 业务代码（src/adapters/*、src/mapper/*、src/bridge.ts）零改动，类型零拷贝。

---

## 8. 范围 / 限制（v1）

- ✅ 支持 Toonflow 标准 9 节点
- ✅ 支持 BYOK 标记透传（不直接打到 NovelToDramaInput，挂到 projectId 旁路）
- ✅ 支持 WS 进度回推 + 指数退避重连
- ✅ 支持 cancelled → failed 收敛
- ❌ 不支持自定义中间节点（如多 model 路由）
- ❌ 不支持 Toonflow 旧版协议（仅 toonflow/1.0）
- ❌ 不内置 token bucket / 限流（依赖 ai-orchestrator 端 quota）
