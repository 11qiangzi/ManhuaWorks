/**
 * ai-helper HTTP 客户端
 * 6 个功能：续写 / 改写 / 润色 / 分镜推荐 / 标题生成 / 翻译 / 错别字检查
 * 这里封装 orchestrator 实际用到的几个。
 */

import { config } from "../config.js";

export type Language = "zh" | "en" | "ja" | "ko" | "es";

export interface ContinueRequest {
  text: string;
  /** 续写长度（字） */
  length?: number;
  /** 风格（romance / action / wuxia...） */
  style?: string;
}

export interface RewriteRequest {
  text: string;
  instruction: string;
}

export interface PolishRequest {
  text: string;
  /** 目标语种 */
  target?: Language;
}

export interface ShotSuggestionRequest {
  text: string;
  /** 期望镜头数 */
  shotCount?: number;
}

export interface TitleRequest {
  text: string;
  /** 期望候选数 */
  count?: number;
}

export interface TranslateRequest {
  text: string;
  from: Language;
  to: Language;
}

export interface ProofreadRequest {
  text: string;
}

export interface HelperResponse<T> {
  ok: boolean;
  data: T;
  cost?: number;
  latencyMs?: number;
}

export class HelperClientError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(`[ai-helper ${status} ${endpoint}] ${message}`);
    this.name = "HelperClientError";
  }
}

async function call<T>(endpoint: string, body: unknown): Promise<T> {
  const url = `${config.aiHelper.url}${endpoint}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), config.aiHelper.timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.auth.apiKey}` },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new HelperClientError(resp.status, endpoint, text.slice(0, 500));
    }
    return (await resp.json()) as T;
  } catch (err) {
    if (err instanceof HelperClientError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new HelperClientError(504, endpoint, `timeout after ${config.aiHelper.timeoutMs}ms`);
    }
    throw new HelperClientError(502, endpoint, (err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

export const aiHelperClient = {
  /** 智能续写 */
  continue(req: ContinueRequest) {
    return call<HelperResponse<string>>("/v1/helper/continue", req);
  },
  /** 改写 */
  rewrite(req: RewriteRequest) {
    return call<HelperResponse<string>>("/v1/helper/rewrite", req);
  },
  /** 润色 */
  polish(req: PolishRequest) {
    return call<HelperResponse<string>>("/v1/helper/polish", req);
  },
  /** 分镜推荐 */
  suggestShots(req: ShotSuggestionRequest) {
    return call<HelperResponse<Array<{ shotId: string; description: string; shotType: string; cameraMove: string }>>>(
      "/v1/helper/shot-suggest",
      req,
    );
  },
  /** 标题生成 */
  titles(req: TitleRequest) {
    return call<HelperResponse<string[]>>("/v1/helper/title-generate", req);
  },
  /** 翻译 */
  translate(req: TranslateRequest) {
    return call<HelperResponse<string>>("/v1/helper/translate", req);
  },
  /** 错别字检查 */
  proofread(req: ProofreadRequest) {
    return call<HelperResponse<{ corrected: string; issues: Array<{ position: number; suggestion: string }> }>>(
      "/v1/helper/proofread",
      req,
    );
  },
  async health(): Promise<unknown> {
    const resp = await fetch(`${config.aiHelper.url}/health`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`ai-helper health ${resp.status}`);
    return resp.json();
  },
};
