/**
 * DeepSeek 即梦（jimeng）
 *
 * 端点：https://api.deepseek.com/v1/images/generations
 * 即梦通过 DeepSeek 路由，OpenAI 兼容格式
 */

import type {
  ImageEditRequest,
  ImageProvider,
  ImageRequestCommon,
  ImageResult,
  ImageVariationRequest,
} from './base.js';
import { ImageError, NotSupportedError, fetchAsBuffer } from './base.js';

export interface DeepSeekJimengConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

interface RawResponse {
  data?: { b64_json?: string; url?: string }[];
  created?: number;
}

export class DeepSeekJimengProvider implements ImageProvider {
  readonly id = 'deepseek-jimeng';
  readonly model: string;
  readonly supportsEdit = false;
  readonly supportsVariations = false;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: DeepSeekJimengConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'jimeng-3.0';
    this.baseUrl = (config.baseUrl ?? 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 90_000;
  }

  async generate(req: ImageRequestCommon): Promise<ImageResult[]> {
    try {
      const n = req.n ?? 1;
      const body = {
        model: this.model,
        prompt: req.prompt,
        n,
        size: req.size ?? '1024x1024',
        response_format: req.returnBinary === false ? 'url' : 'b64_json',
      };
      const res = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
      }
      const raw = (await res.json()) as RawResponse;
      const items = raw.data ?? [];
      const out: ImageResult[] = [];
      for (const item of items) {
        if (item.b64_json) {
          out.push({
            provider: this.id,
            model: this.model,
            binary: Buffer.from(item.b64_json, 'base64'),
            mimeType: 'image/png',
            seed: req.seed,
          });
        } else if (item.url) {
          if (req.returnBinary === false) {
            out.push({ provider: this.id, model: this.model, url: item.url, mimeType: 'image/png' });
          } else {
            const { buf, mime } = await fetchAsBuffer(item.url);
            out.push({ provider: this.id, model: this.model, binary: buf, mimeType: mime });
          }
        }
      }
      return out;
    } catch (err) {
      throw new ImageError(this.id, err);
    }
  }

  async edit(_req: ImageEditRequest): Promise<ImageResult[]> {
    throw new NotSupportedError(this.id, 'edit');
  }

  async variations(_req: ImageVariationRequest): Promise<ImageResult[]> {
    throw new NotSupportedError(this.id, 'variations');
  }
}

export function createDeepSeekJimeng(config: DeepSeekJimengConfig): DeepSeekJimengProvider {
  return new DeepSeekJimengProvider(config);
}
