/**
 * 本地嵌入：all-MiniLM-L6-v2（384 维）
 *
 * 使用 @huggingface/transformers 在 Node 进程内 ONNX 推理。
 * 模型文件位于本包 embeddings/all-MiniLM-L6-v2/。
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import type { EmbeddingOptions, EmbeddingProvider, EmbeddingVector } from './base.js';
import { EmbeddingError } from './base.js';

// 定位模型目录：<pkg>/embeddings/all-MiniLM-L6-v2
// transformers 期望结构是：
//   <localModelPath>/Xenova/all-MiniLM-L6-v2/{onnx,tokenizer.json,...}
// W1 迁入的原始结构是：
//   <pkg>/embeddings/all-MiniLM-L6-v2/{onnx,tokenizer.json,...}  （缺 Xenova/ 中间层）
//
// 为了兼容两种结构，本模块在初始化时动态检查并在不存在 Xenova/ 中间层时
// 临时建一个符号链接/拷贝（同一个包内仅一次）。这样不依赖 W1 调整目录布局。

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EMBED_ROOT = resolve(__dirname, '..', '..', 'embeddings', 'all-MiniLM-L6-v2');
const MODEL_ID_DIR = resolve(EMBED_ROOT, 'Xenova', 'all-MiniLM-L6-v2');

function ensureModelLayout(): string {
  // 情况 A：已经有 Xenova/all-MiniLM-L6-v2/，直接返回
  if (existsSync(resolve(MODEL_ID_DIR, 'tokenizer.json'))) {
    return MODEL_ID_DIR;
  }
  // 情况 B：原始 W1 布局在 EMBED_ROOT 下，需要在 EMBED_ROOT 下建 Xenova/all-MiniLM-L6-v2/ 软链接
  if (existsSync(resolve(EMBED_ROOT, 'tokenizer.json'))) {
    try {
      if (!existsSync(resolve(EMBED_ROOT, 'Xenova'))) {
        mkdirSync(resolve(EMBED_ROOT, 'Xenova'), { recursive: true });
      }
      if (!existsSync(MODEL_ID_DIR)) {
        try {
          // Windows 需要 junction 或 admin 权限。优先 symlink，败了回退到 junction
          symlinkSync(EMBED_ROOT, MODEL_ID_DIR, 'junction');
        } catch {
          // 软链接失败也不管，交给下面 pipeline 报错
        }
      }
    } catch {
      // ignore
    }
    return MODEL_ID_DIR;
  }
  return EMBED_ROOT;
}

type FeatureExtractor = (
  text: string | string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array }>;

interface TransformersEnv {
  allowLocalModels?: boolean;
  allowRemoteModels?: boolean;
  useFs?: boolean;
  localModelPath?: string;
}

interface TransformersModule {
  pipeline: (
    task: 'feature-extraction',
    model: string,
    opts?: { quantized?: boolean; local?: boolean },
  ) => Promise<FeatureExtractor>;
  env: TransformersEnv;
}

let extractorPromise: Promise<FeatureExtractor> | null = null;

async function loadTransformers(): Promise<TransformersModule> {
  // 动态加载：避免没装 @huggingface/transformers 时 typecheck 也能过
  // 运行时再 require，业务方可选择把 transformers 装到 peer deps
  return (await import('@huggingface/transformers')) as TransformersModule;
}

async function getExtractor(): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    const modelIdDir = ensureModelLayout();
    if (!existsSync(modelIdDir)) {
      throw new EmbeddingError(
        'local-mini-lm',
        `Model directory not found: ${modelIdDir}`,
        `Local MiniLM model not found. W1 migration may be incomplete.`,
      );
    }
    const { pipeline, env } = await loadTransformers();
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.useFs = true;
    // localModelPath 必须指向包含 <model-id>/ 子目录的父目录
    // 如果 modelIdDir 是 EMBED_ROOT/Xenova/all-MiniLM-L6-v2，
    // 那么 localModelPath 设为 EMBED_ROOT 即可。
    env.localModelPath = modelIdDir.endsWith('Xenova/all-MiniLM-L6-v2')
      ? modelIdDir.slice(0, -'Xenova/all-MiniLM-L6-v2'.length).replace(/[\\/]+$/, '')
      : modelIdDir;
    extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
      local: true,
    });
  }
  return extractorPromise;
}

function toVector(arr: Float32Array, dim: number, text: string, provider: string, model: string): EmbeddingVector {
  return {
    values: Array.from(arr),
    dim,
    provider,
    model,
    text,
  };
}

export class LocalMiniLMProvider implements EmbeddingProvider {
  readonly id = 'local-mini-lm';
  readonly model = 'Xenova/all-MiniLM-L6-v2';
  readonly dim = 384;

  async embed(text: string, options: EmbeddingOptions = {}): Promise<EmbeddingVector> {
    const { normalize = true, maxLength = 256 } = options;
    const truncated = text.length > maxLength * 4 ? text.slice(0, maxLength * 4) : text;
    try {
      const extractor = await getExtractor();
      const output = await extractor(truncated, { pooling: 'mean', normalize });
      return toVector(output.data, this.dim, truncated, this.id, this.model);
    } catch (err) {
      throw new EmbeddingError(this.id, err);
    }
  }

  async embedBatch(texts: string[], options: EmbeddingOptions = {}): Promise<EmbeddingVector[]> {
    const { batchSize = 32, normalize = true, maxLength = 256 } = options;
    const results: EmbeddingVector[] = [];
    const extractor = await getExtractor();

    for (let i = 0; i < texts.length; i += batchSize) {
      const chunk = texts.slice(i, i + batchSize).map((t) =>
        t.length > maxLength * 4 ? t.slice(0, maxLength * 4) : t,
      );
      try {
        const output = await extractor(chunk, { pooling: 'mean', normalize });
        // output.data 长度 = batch * dim，按 batch 切片
        for (let j = 0; j < chunk.length; j++) {
          const start = j * this.dim;
          const end = start + this.dim;
          const slice = output.data.subarray(start, end);
          results.push(toVector(new Float32Array(slice), this.dim, chunk[j]!, this.id, this.model));
        }
      } catch (err) {
        throw new EmbeddingError(this.id, err, `Batch embed failed at index ${i}`);
      }
    }
    return results;
  }
}

export const localMiniLM = new LocalMiniLMProvider();
