/**
 * 三种质量模式（presets/quality-modes.ts）
 *
 * 用途：
 *   - novel-to-drama / episode-batch / multi-character-replace 都接收 qualityMode
 *   - 决定 prompt 详细度、并发数、是否预热缓存、是否重试
 *
 * 设计目标：
 *   - cost    ：省钱，0.4-0.5x 成本，速度中等，质量可接受
 *   - speed   ：快，1.0-1.3x 速度，成本中等，质量良好
 *   - quality ：好，1.5-2.0x 成本，速度慢，质量最佳
 *
 * 实测参考（1 集 60s 漫剧，6 镜头）：
 *   cost    ：~$0.50-0.70，~50-70s
 *   speed   ：~$1.00-1.30，~40-55s（用小模型 + 缓存）
 *   quality ：~$1.80-2.50，~90-130s（用大模型 + 多次重试）
 */

import type { ProviderId } from "../clients/ai-router.js";

export type QualityMode = "cost" | "speed" | "quality";

export interface QualityModeConfig {
  mode: QualityMode;
  /** 标签 */
  label: string;
  /** 描述 */
  description: string;
  /** 图片分辨率（宽×高） */
  imageResolution: { width: number; height: number };
  /** 单镜头视频秒数 */
  videoDurationSec: number;
  /** 并发数（image / video generation） */
  concurrency: number;
  /** 是否使用缓存（prompt 模板 + 翻译缓存） */
  useCache: boolean;
  /** 是否用 LLM 增强 prompt（更慢但更好） */
  enhancePrompt: boolean;
  /** 重试次数（per step） */
  retries: number;
  /** 失败时是否降级到 cost 模式 */
  fallbackOnFailure: boolean;
  /** 路由策略 */
  routeStrategy: "cost" | "speed" | "quality" | "failover";
  /** 偏好的供应商（按优先级） */
  preferredProviders: ProviderId[];
  /** 负向 prompt 是否启用 */
  useNegativePrompt: boolean;
  /** 是否多轮重生成（针对 quality mode 做"二刷"） */
  multiPass: boolean;
  /** 视频生成最大尝试数（quality 模式会尝试不同种子） */
  videoMaxAttempts: number;
  /** 镜头数上限（1 集） */
  maxShotsPerEpisode: number;
}

export const QUALITY_MODES: Record<QualityMode, QualityModeConfig> = {
  cost: {
    mode: "cost",
    label: "省钱模式",
    description: "最低成本，适中质量，适合大批量预生产",
    imageResolution: { width: 768, height: 768 },
    videoDurationSec: 4,
    concurrency: 6,
    useCache: true,
    enhancePrompt: false,
    retries: 0,
    fallbackOnFailure: false,
    routeStrategy: "cost",
    preferredProviders: ["volcengine", "zhipu"],
    useNegativePrompt: false,
    multiPass: false,
    videoMaxAttempts: 1,
    maxShotsPerEpisode: 8,
  },
  speed: {
    mode: "speed",
    label: "速度模式",
    description: "快速出片，质量良好，适合 demo / 草稿",
    imageResolution: { width: 1024, height: 1024 },
    videoDurationSec: 5,
    concurrency: 4,
    useCache: true,
    enhancePrompt: false,
    retries: 1,
    fallbackOnFailure: true,
    routeStrategy: "speed",
    preferredProviders: ["volcengine", "zhipu", "minimax"],
    useNegativePrompt: true,
    multiPass: false,
    videoMaxAttempts: 1,
    maxShotsPerEpisode: 12,
  },
  quality: {
    mode: "quality",
    label: "质量模式",
    description: "最佳质量，较高成本，多次重试，适合精品 / 终版",
    imageResolution: { width: 1280, height: 720 },
    videoDurationSec: 6,
    concurrency: 2,
    useCache: true,
    enhancePrompt: true,
    retries: 2,
    fallbackOnFailure: true,
    routeStrategy: "quality",
    preferredProviders: ["minimax", "deepseek", "volcengine", "zhipu"],
    useNegativePrompt: true,
    multiPass: true,
    videoMaxAttempts: 3,
    maxShotsPerEpisode: 16,
  },
};

/** 默认模式 */
export const DEFAULT_QUALITY_MODE: QualityMode = "speed";

/** 选模式 */
export function pickQualityMode(m: QualityMode): QualityModeConfig {
  return QUALITY_MODES[m];
}

/** 列表 */
export function listQualityModes(): QualityModeConfig[] {
  return [QUALITY_MODES.cost, QUALITY_MODES.speed, QUALITY_MODES.quality];
}

/** 校验模式 */
export function isQualityMode(m: string): m is QualityMode {
  return m === "cost" || m === "speed" || m === "quality";
}

/** 给定模式 → 估算单集成本（USD） */
export function estimateEpisodeCost(mode: QualityMode): { min: number; max: number; typical: number } {
  switch (mode) {
    case "cost":
      return { min: 0.45, max: 0.7, typical: 0.55 };
    case "speed":
      return { min: 1.0, max: 1.35, typical: 1.15 };
    case "quality":
      return { min: 1.8, max: 2.5, typical: 2.1 };
  }
}

/** 给定模式 → 估算单集耗时（秒） */
export function estimateEpisodeLatency(mode: QualityMode): { min: number; max: number; typical: number } {
  switch (mode) {
    case "cost":
      return { min: 50, max: 75, typical: 60 };
    case "speed":
      return { min: 38, max: 55, typical: 45 };
    case "quality":
      return { min: 90, max: 135, typical: 110 };
  }
}
