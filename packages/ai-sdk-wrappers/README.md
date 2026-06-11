# @manhuaworks/ai-sdk-wrappers

ManhuaWorks 统一 AI SDK 封装层。W1 阶段已迁入本地 `all-MiniLM-L6-v2` 嵌入模型，本包（W2 任务 4）将其与 4 家图像模型、2 家视频模型、pgvector 向量存储一起打成统一 SDK。

- **Node**: `>=20.10.0`
- **TypeScript**: `5.7.2`
- **包管理**: pnpm workspace（根 `pnpm-workspace.yaml` 由 monorepo 统一管理）

## 目录

```
src/
├── embeddings/
│   ├── base.ts                # 统一接口 EmbeddingProvider
│   ├── local-mini-lm.ts       # 本地 all-MiniLM-L6-v2 (ONNX, 384d)
│   ├── remote.ts              # 4 家远程供应商封装
│   └── index.ts
├── image/
│   ├── base.ts                # 统一接口 ImageProvider (generate/edit/variations)
│   ├── minimax-image.ts       # MiniMax image-01
│   ├── volcengine-seedream.ts # 火山方舟 doubao-seedream（支持 edit）
│   ├── zhipu-cogview.ts       # 智谱 cogview-3
│   ├── deepseek-jimeng.ts     # DeepSeek 即梦
│   └── index.ts
├── video/
│   ├── base.ts                # 统一接口 VideoProvider (text2video/image2video)
│   ├── volcengine-seedance.ts # 火山方舟 Seedance 2.0
│   ├── minimax-video.ts       # MiniMax 视频 API
│   └── index.ts
├── vector/
│   ├── store.ts               # pgvector (Postgres) 封装
│   ├── similarity.ts          # cosine / l2 / dot / cosine01 / topK
│   └── index.ts
└── index.ts                   # 统一导出
embeddings/
└── all-MiniLM-L6-v2/          # W1 迁入的本地模型（ONNX + tokenizer）
```

## 安装

```bash
# 根目录已经声明 workspace，直接 pnpm install 即可
pnpm install
```

依赖：

- 运行时：`@huggingface/transformers`（本地嵌入 ONNX 推理）、`pg`（pgvector 连接）
- 开发：`typescript@5.7.2`、`tsx`、`@types/node`、`@types/pg`

## 快速上手

### 嵌入（本地 + 远程）

```ts
import { localMiniLM, createRemoteEmbedding, cosine01 } from '@manhuaworks/ai-sdk-wrappers';

// 1) 本地 384 维（无需 API key）
const a = await localMiniLM.embed('在霓虹灯下奔跑的少女');
const b = await localMiniLM.embed('赛博朋克少女在雨中站立');
console.log(cosine01(a.values, b.values)); // ≈ 0.7

// 2) 远程供应商
const remote = createRemoteEmbedding('zhipu', {
  apiKey: process.env.ZHIPU_API_KEY!,
  model: 'embedding-2',
  dim: 1024,
});
const v = await remote.embed('hello world');
```

| 供应商 | 默认 baseUrl | 默认 model | dim |
| --- | --- | --- | --- |
| minimax | `https://api.minimax.chat/v1` | `embo-01` | 1536 |
| volcengine | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-embedding-text-240715` | 1024 |
| zhipu | `https://open.bigmodel.cn/api/paas/v4` | `embedding-2` | 1024 |
| deepseek | `https://api.deepseek.com/v1` | `deepseek-embed` | 1024 |

### 图像

```ts
import { createMiniMaxImage, createVolcengineSeedream } from '@manhuaworks/ai-sdk-wrappers';

const mm = createMiniMaxImage({ apiKey: process.env.MINIMAX_API_KEY! });
const [img] = await mm.generate({
  prompt: 'a tiny cute cat sitting on a book, watercolor',
  size: '1024x1024',
  n: 1,
  returnBinary: false, // true → Buffer，false → URL
});
console.log(img.url);

// volcengine 支持 edit
const seedream = createVolcengineSeedream({ apiKey: process.env.VOLCENGINE_API_KEY! });
const [edited] = await seedream.edit({
  prompt: 'convert to oil painting',
  source: 'data:image/png;base64,iVBOR...',
  size: '1024x1024',
});
```

### 视频

视频是异步任务模型：先 `text2video` / `image2video` 拿到 `taskId`，再 `waitForCompletion` 阻塞到结果。

```ts
import { createVolcengineSeedance } from '@manhuaworks/ai-sdk-wrappers';

const seedance = createVolcengineSeedance({ apiKey: process.env.VOLCENGINE_API_KEY! });
const task = await seedance.text2video({
  prompt: 'A cat walking on the beach, sunset, cinematic',
  aspect: '16:9',
  resolution: '1080p',
  durationSec: 5,
});
const final = await seedance.waitForCompletion(task.taskId, 5 * 60_000);
if (final.status === 'succeeded' && final.videoBinary) {
  // final.videoBinary 是 mp4 Buffer
}
```

### 向量存储（pgvector）

```ts
import { VectorStore, localMiniLM } from '@manhuaworks/ai-sdk-wrappers';

const store = new VectorStore({
  connectionString: process.env.PG_VECTOR_URL!,
  dim: 384, // 必须与本地模型维度一致
});

// 首次调用自动建表（pgvector 扩展 + vectors 表 + IVFFlat 索引）
await store.migrate();

const v = await localMiniLM.embed('第一篇分镜的描述');
await store.upsertFromEmbedding('storyboard', 'frame-1', v, '第一篇分镜的描述');

// 相似检索
const hits = await store.search('storyboard', v.values, 5);
hits.forEach((h) => console.log(h.refId, h.score));

await store.close();
```

## API 一览

### embeddings

```ts
interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  readonly dim: number;
  embed(text: string, options?: EmbeddingOptions): Promise<EmbeddingVector>;
  embedBatch(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingVector[]>;
}
```

### image

```ts
interface ImageProvider {
  readonly id: string;
  readonly model: string;
  readonly supportsEdit: boolean;
  readonly supportsVariations: boolean;
  generate(req: ImageRequestCommon): Promise<ImageResult[]>;
  edit(req: ImageEditRequest): Promise<ImageResult[]>;
  variations(req: ImageVariationRequest): Promise<ImageResult[]>;
}
```

不支持的操作抛 `NotSupportedError(provider, op)`。

### video

```ts
interface VideoProvider {
  readonly id: string;
  readonly model: string;
  readonly supportsImage2Video: boolean;
  text2video(req: Text2VideoRequest): Promise<VideoTask>;
  image2video(req: Image2VideoRequest): Promise<VideoTask>;
  poll(taskId: string): Promise<VideoTask>;
  waitForCompletion(taskId: string, timeoutMs?: number, pollIntervalMs?: number): Promise<VideoTask>;
}
```

### vector

```ts
class VectorStore {
  migrate(): Promise<void>;
  upsert(record: VectorRecord): Promise<number>;
  upsertFromEmbedding(ns: string, refId: string, emb: EmbeddingVector, content?: string, meta?: object): Promise<number>;
  get(ns: string, refId: string): Promise<VectorRecord | null>;
  remove(ns: string, refId: string): Promise<boolean>;
  search(ns: string, query: number[], topK?: number, filter?: object): Promise<VectorSearchHit[]>;
  count(ns: string): Promise<number>;
  close(): Promise<void>;
}

// 工具
cosine(a, b)         // ∈ [-1, 1]
cosine01(a, b)       // ∈ [0, 1]
l2(a, b)             // 欧氏距离
dot(a, b)            // 点积
l2Normalize(v)
topK(query, items, vectorOf, k, metric?)
```

## 错误类型

- `EmbeddingError(provider, cause, message?)`
- `ImageError(provider, cause, message?)`
- `VideoError(provider, cause, message?)`
- `NotSupportedError(provider, 'edit' | 'variations')`
- `NotSupportedVideoError(provider)`

## 示例

```bash
# 嵌入（本地模型离线就能跑，远程供应商用环境变量）
pnpm --filter @manhuaworks/ai-sdk-wrappers examples:embeddings

# 图像
MINIMAX_API_KEY=... VOLCENGINE_API_KEY=... \
  ZHIPU_API_KEY=... DEEPSEEK_API_KEY=... \
  pnpm --filter @manhuaworks/ai-sdk-wrappers examples:image
```

## 环境变量

| 名称 | 用途 |
| --- | --- |
| `MINIMAX_API_KEY` | MiniMax image + video + embedding |
| `VOLCENGINE_API_KEY` | 火山方舟 seedream + seedance + embedding |
| `ZHIPU_API_KEY` | 智谱 cogview + embedding |
| `DEEPSEEK_API_KEY` | DeepSeek 即梦 + embedding |
| `PG_VECTOR_URL` | `postgres://user:pass@host:5432/db` 启用向量存储 |

## 编译

```bash
pnpm --filter @manhuaworks/ai-sdk-wrappers typecheck
pnpm --filter @manhuaworks/ai-sdk-wrappers build
```

## 设计原则

1. **零硬编码业务**：所有凭证通过配置/环境变量传入。
2. **统一错误类型**：上层只需 try/catch，根据 `provider` 字段决定 fallback。
3. **二进制优先**：`returnBinary` 默认 `true` 直接拿到 Buffer，省掉一次下载。
4. **可降级**：`supportsEdit` / `supportsImage2Video` 让业务层在调用前就判断，而不是等到服务器 4xx 才知道不支持。
5. **幂等迁移**：`VectorStore.migrate()` 内部用 `IF NOT EXISTS`，可以反复调用。
