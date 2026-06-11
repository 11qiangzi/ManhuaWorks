/**
 * MiniMax image-01
 *
 * 端点：https://api.minimax.chat/v1/image/generation
 * 请求：{ model, prompt, n, size, response_format }
 * 响应：{ data: { b64_json?: string, url?: string }[] }
 */

import type {
  ImageEditRequest,
  ImageProvider,
  ImageRequestCommon,
  ImageResult,
  ImageVariationRequest,
} from './base.js';
import { ImageError, NotSupportedError, fetchAsBuffer } from './base.js';

export interface MiniMaxImageConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

interface RawResponse {
  data?: { b64_json?: string; url?: string }[];
  base_resp?: { status_code?: number; status_msg?: string };
}

export class MiniMaxImageProvider implements ImageProvider {
  readonly id = 'minimax';
  readonly model: string;
  readonly supportsEdit = false;
  readonly supportsVariations = false;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: MiniMaxImageConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'image-01';
    this.baseUrl = (config.baseUrl ?? 'https://api.minimax.chat/v1').replace(/\/+$/, '');
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
        response_format: req.returnBinary === false ? 'url' : 'b64_json',
        seed: req.seed,
      };
      const res = await fetch(`${this.baseUrl}/image/generation`, {
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
      if (raw.base_resp?.status_code && raw.base_resp.status_code !== 0) {
        throw new Error(raw.base_resp.status_msg ?? 'Unknown MiniMax image error');
      }
      const items = raw.data ?? [];
      const out: ImageResult[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
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

export function createMiniMaxImage(config: MiniMaxImageConfig): MiniMaxImageProvider {
  return new MiniMaxImageProvider(config);
}
