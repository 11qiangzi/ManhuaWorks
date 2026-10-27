/**
 * one-click-manga 共享常量与类型
 * 从 one-click-manga.ts 拆出的子模块
 */

import type { ArtStyle, StoryType } from "../../clients/workflow.js";

export interface OneClickMangaInput {
  text: string;
  storyType?: StoryType;
  artStyle?: ArtStyle;
  aspectRatio?: "16:9" | "9:16" | "4:3" | "1:1";
  episodeCount?: number;
  durationSeconds?: number;
  ttsProvider?: "edge-tts" | "volcengine" | "aliyun" | "elevenlabs";
  musicStyle?: "epic" | "emotional" | "tense" | "relaxing" | "upbeat";
  language?: string;
  projectId?: string;
}

export interface StepResult {
  step: number;
  name: string;
  status: "completed" | "failed";
  previewUrl?: string;
  assetIds?: string[];
  error?: string;
}

export interface OneClickMangaOutput {
  plan: Record<string, unknown>;
  storyboardShotCount: number;
  characterNames: string[];
  styleDescription: string;
  videoUrl?: string;
  musicUrl?: string;
  steps: StepResult[];
  totalCostUsd: number;
  totalLatencyMs: number;
}

export const DEFAULT_STORY_TYPE: StoryType = "sweet_romance_novel";
export const DEFAULT_ART_STYLE: ArtStyle = "anime";
export const DEFAULT_DURATION = 60;
export const DEFAULT_EPISODE_COUNT = 1;

export const STEP_NAMES: Record<number, string> = {
  1: "剧本生成",
  2: "角色提取",
  3: "风格分析",
  4: "分镜拆分",
  5: "图像批量生成",
  6: "视频合成",
  7: "配乐生成",
};

export const TOTAL_STEPS = 7;

// ---- 文本截断常量 ----
export const MAX_INPUT_FULL = 2000;
export const MAX_INPUT_MEDIUM = 1500;
export const MAX_INPUT_CHAR_FRAGMENT = 500;
export const MAX_TTS_DIALOGUE = 800;
export const MAX_INPUT_SNIPPET = 200;
export const MAX_INPUT_SHORT = 500;
export const MAX_SHOTS_PER_STEP = 6;

export function progressPct(step: number): number {
  return Math.round((step / TOTAL_STEPS) * 100);
}

export function mapMoodToMusicStyle(mood: string): "epic" | "emotional" | "tense" | "relaxing" | "upbeat" {
  const lower = mood.toLowerCase();
  if (lower.includes("epic") || lower.includes("heroic") || lower.includes("action")) return "epic";
  if (lower.includes("sad") || lower.includes("romantic") || lower.includes("melancholy") || lower.includes("sweet")) return "emotional";
  if (lower.includes("tense") || lower.includes("suspense") || lower.includes("thriller")) return "tense";
  if (lower.includes("relax") || lower.includes("peace") || lower.includes("calm")) return "relaxing";
  if (lower.includes("happy") || lower.includes("joy") || lower.includes("fun")) return "upbeat";
  return "emotional";
}
