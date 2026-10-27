/**
 * workflow-engine HTTP 客户端
 * 7 个工作流入口 + 状态查询/取消/续跑。
 */

import { config } from "../config.js";

export type StoryType = "sweet_romance_novel" | "urban_fantasy" | "wuxia_martial" | "scifi_mecha" | "school_life" | "mystery_suspense" | "isekai";
export type ArtStyle = "anime" | "manhua_chinese" | "realistic_3d" | "watercolor" | "pixel" | "ink_painting" | "comic_western";

export interface StoryboardInput {
  text: string;
  storyType: StoryType;
  chapterTitle?: string;
  chapterNo?: number;
}

export interface CharacterInput {
  text: string;
  artStyle: ArtStyle;
  characterHints?: string[];
}

export interface SceneInput {
  shot: { shotId: string; sceneId: string; shotType: string; cameraMove: string; description: string; dialogue?: string };
  artStyle: ArtStyle;
}

export interface ImageGenInput {
  sceneDesign: { location: string; description: string; characters: string[]; mood: string };
  artStyle: ArtStyle;
}

export type TTSProvider = "edge-tts" | "volcengine" | "aliyun" | "elevenlabs";

export interface TTSInput {
  text: string;
  provider: TTSProvider;
  voiceId?: string;
}

export interface VideoGenInput {
  sceneDesign: { location: string; description: string; characters: string[]; mood: string };
  artStyle: ArtStyle;
  durationSeconds?: number;
  resolution?: string;
  sourceImageUrl?: string;
}

export interface BeatSplitInput {
  text: string;
  storyType: StoryType;
  chapterTitle?: string;
}

export interface ShotComposeInput {
  beats: Array<{ beatId: string; type: string; description: string; duration: number }>;
  targetShotCount: number;
  artStyle: ArtStyle;
}

export interface AudioAlignInput {
  segmentUrls: string[];
  audioUrl?: string;
  bgmUrl?: string;
  shots?: Array<{ shotId: string; duration: number; dialogue?: string }>;
}

export interface SubtitleBurnInput {
  segmentUrls: string[];
  subtitleText: string;
  style?: { position?: string; fontSize?: number; color?: string; outline?: boolean };
}

export interface ComposeInput {
  videoUrls: string[];
  audioUrls?: string[];
  subtitleText?: string;
  outputFormat?: "mp4" | "mov";
  transitions?: { type: string; duration: number };
}

export interface WorkflowResult<R = unknown> {
  runId: string;
  kind: string;
  success: boolean;
  outputs: R;
}

export class WorkflowClientError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(`[workflow ${status} ${endpoint}] ${message}`);
    this.name = "WorkflowClientError";
  }
}

async function call<T>(endpoint: string, body: unknown, timeoutMs: number): Promise<T> {
  const url = `${config.workflow.url}${endpoint}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.auth.apiKey}` },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new WorkflowClientError(resp.status, endpoint, text.slice(0, 500));
    }
    return (await resp.json()) as T;
  } catch (err) {
    if (err instanceof WorkflowClientError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new WorkflowClientError(504, endpoint, `timeout after ${timeoutMs}ms`);
    }
    throw new WorkflowClientError(502, endpoint, (err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

async function getCall<T>(endpoint: string, timeoutMs: number): Promise<T> {
  const url = `${config.workflow.url}${endpoint}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { authorization: `Bearer ${config.auth.apiKey}` },
      signal: ac.signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new WorkflowClientError(resp.status, endpoint, text.slice(0, 500));
    }
    return (await resp.json()) as T;
  } catch (err) {
    if (err instanceof WorkflowClientError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new WorkflowClientError(504, endpoint, `timeout after ${timeoutMs}ms`);
    }
    throw new WorkflowClientError(502, endpoint, (err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

export const workflowClient = {
  storyboard(input: StoryboardInput) {
    return call<WorkflowResult>("/v1/workflow/storyboard", input, config.workflow.timeoutMs);
  },
  character(input: CharacterInput) {
    return call<WorkflowResult>("/v1/workflow/character", input, config.workflow.timeoutMs);
  },
  scene(input: SceneInput) {
    return call<WorkflowResult>("/v1/workflow/scene", input, config.workflow.timeoutMs);
  },
  imageGen(input: ImageGenInput) {
    return call<WorkflowResult>("/v1/workflow/image-gen", input, config.workflow.timeoutMs);
  },
  tts(input: TTSInput) {
    return call<WorkflowResult>("/v1/workflow/tts", input, config.workflow.timeoutMs);
  },
  videoGen(input: VideoGenInput) {
    return call<WorkflowResult>("/v1/workflow/video-gen", input, config.workflow.timeoutMs);
  },
  compose(input: ComposeInput) {
    return call<WorkflowResult>("/v1/workflow/compose", input, config.workflow.timeoutMs);
  },
  beatSplit(input: BeatSplitInput) {
    return call<WorkflowResult>("/v1/workflow/beat-split", input, config.workflow.timeoutMs);
  },
  shotCompose(input: ShotComposeInput) {
    return call<WorkflowResult>("/v1/workflow/shot-compose", input, config.workflow.timeoutMs);
  },
  audioAlign(input: AudioAlignInput) {
    return call<WorkflowResult>("/v1/workflow/audio-align", input, config.workflow.timeoutMs);
  },
  subtitleBurn(input: SubtitleBurnInput) {
    return call<WorkflowResult>("/v1/workflow/subtitle-burn", input, config.workflow.timeoutMs);
  },
  getStatus(runId: string) {
    return getCall<{ runId: string; status: string; [k: string]: unknown }>(
      `/v1/workflow/${runId}`,
      10_000,
    );
  },
  cancel(runId: string) {
    return call<{ runId: string; cancelled: boolean }>(`/v1/workflow/${runId}/cancel`, {}, 10_000);
  },
  resume(runId: string) {
    return call<{ runId: string; resumed: boolean; result: WorkflowResult }>(
      `/v1/workflow/${runId}/resume`,
      {},
      config.workflow.timeoutMs,
    );
  },
  async health(): Promise<unknown> {
    const resp = await fetch(`${config.workflow.url}/health`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`workflow health ${resp.status}`);
    return resp.json();
  },
};
