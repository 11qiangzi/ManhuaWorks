/**
 * 智谱 cogview-3
 *
 * 端点：https://open.bigmodel.cn/api/paas/v4/images/generations
 * 请求：{ model, prompt, size } → 同步返回 url
 */

import type {
  ImageEditRequest,
  ImageProvider,
  ImageRequestCommon,
  ImageResult,
  ImageVariationRequest,
} from './base.js';
import { ImageError, NotSupportedError, fetchAsBuffer } from './base.js';

export interface ZhipuCogviewConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

interface RawResponse {
  data?: { url?: string; b64_json?: string }[];
  created?: number;
}

export class ZhipuCogviewProvider implements ImageProvider {
  readonly id = 'zhipu-cogview';
  readonly model: string;
  readonly supportsEdit = false;
  readonly supportsVariations = false;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ZhipuCogviewConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'cogview-3';
    this.baseUrl = (config.baseUrl ?? 'https://open.bigmodel.cn/api/paas/v4').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  async generate(req: ImageRequestCommon): Promise<ImageResult[]> {
    try {
      const n = req.n ?? 1;
      const body = {
        model: this.model,
        prompt: req.prompt,
        n,
        size: req.size ?? '1024x1024',
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
        if (item.url) {
          if (req.returnBinary === false) {
            out.push({ provider: this.id, model: this.model, url: item.url, mimeType: 'image/jpeg' });
          } else {
            const { buf, mime } = await fetchAsBuffer(item.url);
            out.push({ provider: this.id, model: this.model, binary: buf, mimeType: mime });
          }
        } else if (item.b64_json) {
          out.push({
            provider: this.id,
            model: this.model,
            binary: Buffer.from(item.b64_json, 'base64'),
            mimeType: 'image/jpeg',
          });
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

export function createZhipuCogview(config: ZhipuCogviewConfig): ZhipuCogviewProvider {
  return new ZhipuCogviewProvider(config);
}
