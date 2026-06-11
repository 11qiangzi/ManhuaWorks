/**
 * 图像模型统一接口：generate / edit / variations
 *
 * 各家供应商实现 ImageProvider 接口，
 * 业务层只与 generate() / edit() / variations() 打交道，不关心供应商差异。
 */

export type ImageSize =
  | '512x512'
  | '768x768'
  | '1024x1024'
  | '1024x1792'
  | '1792x1024'
  | '2048x2048';

export type ImageAspect = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9' | 'auto';

export type ImageFormat = 'png' | 'jpeg' | 'webp';

export interface ImageRequestCommon {
  prompt: string;
  negativePrompt?: string;
  size?: ImageSize;
  aspect?: ImageAspect;
  n?: number;
  seed?: number;
  format?: ImageFormat;
  /** 风格/参考图（remote-only，local 占位） */
  referenceImages?: string[];
  /** 是否返回二进制 Buffer 而不是 URL，默认 true */
  returnBinary?: boolean;
  /** 透传 provider 自定义参数 */
  extra?: Record<string, unknown>;
}

export interface ImageEditRequest extends ImageRequestCommon {
  /** base64 编码原图 或 可访问 URL */
  source: string | string[];
  /** 蒙版（base64 编码），可选 */
  mask?: string;
}

export interface ImageVariationRequest {
  source: string;
  n?: number;
  strength?: number;
  format?: ImageFormat;
  extra?: Record<string, unknown>;
}

export interface ImageResult {
  provider: string;
  model: string;
  /** 图片二进制或 base64 字符串 */
  binary?: Buffer;
  /** 可访问 URL（不 returnBinary 时优先） */
  url?: string;
  /** MIME 类型 */
  mimeType: string;
  width?: number;
  height?: number;
  seed?: number;
  /** 业务侧自定义 trace id，便于审计 */
  traceId?: string;
}

export interface ImageProvider {
  readonly id: string;
  readonly model: string;
  /** 是否支持 edit */
  readonly supportsEdit: boolean;
  /** 是否支持 variations */
  readonly supportsVariations: boolean;

  generate(req: ImageRequestCommon): Promise<ImageResult[]>;
  edit(req: ImageEditRequest): Promise<ImageResult[]>;
  variations(req: ImageVariationRequest): Promise<ImageResult[]>;
}

export class ImageError extends Error {
  constructor(
    public readonly provider: string,
    public readonly cause: unknown,
    message?: string,
  ) {
    super(message ?? `Image provider [${provider}] failed: ${String(cause)}`);
    this.name = 'ImageError';
  }
}

export class NotSupportedError extends Error {
  constructor(public readonly provider: string, public readonly op: 'edit' | 'variations') {
    super(`Image provider [${provider}] does not support ${op}`);
    this.name = 'NotSupportedError';
  }
}

// 通用：把 URL 转 Buffer
export async function fetchAsBuffer(url: string, timeoutMs = 60_000): Promise<{ buf: Buffer; mime: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(`Fetch image failed: HTTP ${res.status}`);
  }
  const mime = res.headers.get('content-type') ?? 'image/png';
  const ab = await res.arrayBuffer();
  return { buf: Buffer.from(ab), mime };
}

// 通用：从 data: URL / base64 解析
export function parseDataUrl(input: string): { buf: Buffer; mime: string } {
  const m = input.match(/^data:([^;]+);base64,(.+)$/s);
  if (m) {
    return { buf: Buffer.from(m[2]!, 'base64'), mime: m[1]! };
  }
  // 纯 base64
  try {
    const buf = Buffer.from(input, 'base64');
    if (buf.length > 0) {
      return { buf, mime: 'image/png' };
    }
  } catch {
    // ignore
  }
  throw new Error('Invalid image data: not data URL or base64');
}
