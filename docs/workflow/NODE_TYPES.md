# 节点类型详细文档

工作流引擎支持 **6 种节点类型**，每种对应 ai-orchestrator 的一个 `*.refined.ts` pipeline。

---

## 1. `translate`

**用途**：自动翻译（多语种互译 + 风格保留）。

**对应 pipeline**：`auto-translate.refined`

### 输入参数

```typescript
interface TranslateInput {
  sourceText: string;
  sourceLang: "zh" | "en" | "ja" | "ko" | "es" | "fr";
  targetLang: "zh" | "en" | "ja" | "ko" | "es" | "fr";
  preserveStyle?: boolean;       // 默认 true：保留原作修辞/口吻
  glossaryId?: string;           // 术语表 ID（可选）
}
```

### 输出

```typescript
interface TranslateOutput {
  translatedText: string;
  detectedSourceLang: string;
  tokenCount: number;
  glossaryHits: number;
  costUsd: number;
  latencyMs: number;
}
```

### 典型用例
- 中文小说 → 英文剧本
- 日文漫画 → 中文字幕

---

## 2. `character-replace`

**用途**：单角色替换，**保持跨场景视觉一致性**（用嵌入相似度 + reference image）。

**对应 pipeline**：`character-replace.refined`

### 输入参数

```typescript
interface CharacterReplaceInput {
  characterId: string;            // 角色档案 ID
  referenceImage?: string;        // 参考图 URL（可选，自动用上次生成）
  targetScenes: string[];         // 目标场景 ID 列表
  stylePreset?: string;           // "anime" | "realistic" | "ink" 等
  consistencyThreshold?: number;   // 默认 0.7
}
```

### 输出

```typescript
interface CharacterReplaceOutput {
  results: Array<{
    sceneId: string;
    imageUrl: string;
    consistencyScore: number;     // 0..1，与角色档案的嵌入相似度
    prompt: string;
  }>;
  averageConsistency: number;
  costUsd: number;
  latencyMs: number;
}
```

### 典型用例
- 同一主角在 20 个分镜里保持脸型/发型/服装一致

---

## 3. `episode-batch`

**用途**：批处理多集内容（并发执行 + 配额管控）。

**对应 pipeline**：`episode-batch.refined`

### 输入参数

```typescript
interface EpisodeBatchInput {
  episodes: Array<{
    id: string;
    chapterId: string;
  }>;
  concurrency?: number;           // 默认 3
  perEpisodePipeline: NodeType;   // 每集执行的 pipeline 类型
  perEpisodeParams: Record<string, unknown>;
}
```

### 输出

```typescript
interface EpisodeBatchOutput {
  results: Array<{
    episodeId: string;
    runId: string;
    status: "succeeded" | "failed";
    costUsd: number;
  }>;
  totalCostUsd: number;
  totalLatencyMs: number;
}
```

### 典型用例
- 一夜生成 30 集，每集独立走 novel-to-drama

---

## 4. `style-transfer`

**用途**：风格迁移（写实 ↔ 二次元、墨水 ↔ 油画等）。

**对应 pipeline**：`style-transfer.refined`

### 输入参数

```typescript
interface StyleTransferInput {
  sourceImage: string;            // 源图 URL
  stylePreset: "anime" | "realistic" | "ink" | "oil" | "pixel";
  intensity?: number;             // 0..1，默认 0.7
  preserveComposition?: boolean;  // 默认 true：保持构图
}
```

### 输出

```typescript
interface StyleTransferOutput {
  outputImageUrl: string;
  styleUsed: string;
  intensity: number;
  costUsd: number;
  latencyMs: number;
}
```

### 典型用例
- 把真人物照片转二次元角色图

---

## 5. `novel-to-drama`

**用途**：小说章节 → 漫剧剧本（含分镜、对话、镜头指示）。

**对应 pipeline**：`novel-to-drama.refined`

### 输入参数

```typescript
interface NovelToDramaInput {
  chapterId: string;
  text: string;                   // 章节正文
  sceneCount?: number;            // 目标分镜数，默认 20
  language?: string;              // 默认 "zh"
  includeNarration?: boolean;     // 默认 true
}
```

### 输出

```typescript
interface NovelToDramaOutput {
  scenes: Array<{
    index: number;
    description: string;
    dialogues: Array<{ character: string; text: string }>;
    cameraHint: string;
  }>;
  characterAppearances: string[]; // 涉及的角色 ID
  costUsd: number;
  latencyMs: number;
}
```

### 典型用例
- 把 5000 字小说转 20 个分镜的剧本

---

## 6. `multi-character`

**用途**：多角色协同替换（同一场景中多个角色同时替换）。

**对应 pipeline**：`multi-character-replace.refined`

### 输入参数

```typescript
interface MultiCharacterInput {
  characterIds: string[];         // 2-5 个角色
  targetScene: string;            // 场景 ID
  interactionHint?: string;       // 互动描述（"对话"/"打斗"）
  layout?: "horizontal" | "vertical" | "dynamic";
}
```

### 输出

```typescript
interface MultiCharacterOutput {
  imageUrl: string;
  characterConsistency: Record<string, number>; // characterId → 0..1
  averageConsistency: number;
  costUsd: number;
  latencyMs: number;
}
```

### 典型用例
- 主角 + 配角同框对戏

---

## 节点间数据传递

### 方式 1：显式 `dependsOn`

下游节点通过 `executor` 上下文拿上游输出：

```typescript
const executor: NodeExecutor = async (node, ctx) => {
  const drama = ctx.upstreamOutputs["drama"];   // 上游 novel-to-drama 的 output
  const scenes = drama.scenes as Array<{ index: number }>;
  // ...
};
```

### 方式 2：节点 `params` 模板

UI 编辑工作流时，可指定 `params.sceneId = "{{drama.scenes[0].id}}"` 模板，引擎执行前自动注入。

### 方式 3：全局 `workflowParams`

工作流层参数（如 `projectId`）通过 `ctx.workflowParams` 注入，与节点 output 隔离。

---

## 节点参数 Schema 校验

每个节点在执行前会经过 Zod 校验，参数缺失/类型错误时立即抛 `WorkflowEngine: invalid params for node 'X'`。
