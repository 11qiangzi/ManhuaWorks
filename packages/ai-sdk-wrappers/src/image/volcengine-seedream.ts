/**
 * 火山方舟 doubao-seedream
 *
 * 端点：https://ark.cn-beijing.volces.com/api/v3/images/generations
 * 支持 generate / edit（image2image）
 */

import type {
  ImageEditRequest,
  ImageProvider,
  ImageRequestCommon,
  ImageResult,
  ImageVariationRequest,
} from './base.js';
import { ImageError, NotSupportedError, fetchAsBuffer } from './base.js';

export interface VolcengineSeedreamConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

interface RawResponse {
  data?: { b64_json?: string; url?: string; size?: string }[];
  created?: number;
}

function sizeToRatio(size?: string, aspect?: string): string | undefined {
  if (aspect && aspect !== 'auto') return aspect.replace(':', ':');
  return size;
}

export class VolcengineSeedreamProvider implements ImageProvider {
  readonly id = 'volcengine-seedream';
  readonly model: string;
  readonly supportsEdit = true;
  readonly supportsVariations = false;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: VolcengineSeedreamConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'doubao-seedream-3-0-t2i-250415';
    this.baseUrl = (config.baseUrl ?? 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 90_000;
  }

  async generate(req: ImageRequestCommon): Promise<ImageResult[]> {
    return this.call(req.prompt, undefined, req);
  }

  async edit(req: ImageEditRequest): Promise<ImageResult[]> {
    const sources = Array.isArray(req.source) ? req.source : [req.source];
    if (sources.length === 0) {
      throw new Error('edit: source is required');
    }
    return this.call(req.prompt, sources[0], req);
  }

  async variations(_req: ImageVariationRequest): Promise<ImageResult[]> {
    throw new NotSupportedError(this.id, 'variations');
  }

  private async call(
    prompt: string,
    image: string | undefined,
    req: ImageRequestCommon,
  ): Promise<ImageResult[]> {
    try {
      const n = req.n ?? 1;
      const body: Record<string, unknown> = {
        model: this.model,
        prompt,
        n,
        size: sizeToRatio(req.size, req.aspect) ?? '1024x1024',
        response_format: req.returnBinary === false ? 'url' : 'b64_json',
        seed: req.seed,
      };
      if (image) {
        body.image = image;
      }
      if (req.negativePrompt) {
        body.negative_prompt = req.negativePrompt;
      }

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
}

export function createVolcengineSeedream(config: VolcengineSeedreamConfig): VolcengineSeedreamProvider {
  return new VolcengineSeedreamProvider(config);
}
