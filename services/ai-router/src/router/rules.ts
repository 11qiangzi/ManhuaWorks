// 路由规则：成本优先 / 速度优先 / 质量优先 / 故障转移
// 纯函数，输入候选模型 + 策略，输出排序后的得分。

import type { ModelInfo, RouteStrategy } from "../types.js";

export interface ScoredModel {
  model: ModelInfo;
  /** 原始得分（越大越优） */
  score: number;
  /** 原因说明（可观测/调试） */
  reason: string;
}

/** 故障转移专用：返回下一个候选 */
export type FailoverPlan = ScoredModel[];

export const rules = {
  /** 成本优先：越便宜越优。cost = input + output（按 1:1 输入输出估算）。 */
  cost(candidates: ModelInfo[]): ScoredModel[] {
    return candidates
      .map((m) => {
        const cost = m.costPer1kInput + m.costPer1kOutput;
        // 成本越低分数越高，归一到 0-100
        const score = 100 - Math.min(100, cost * 1000);
        return { model: m, score, reason: `cost=${cost.toFixed(5)}` };
      })
      .sort((a, b) => b.score - a.score);
  },

  /** 速度优先：典型延迟越低越优。 */
  speed(candidates: ModelInfo[]): ScoredModel[] {
    return candidates
      .map((m) => {
        const score = 100 - Math.min(100, m.typicalLatencyMs / 100);
        return { model: m, score, reason: `latency=${m.typicalLatencyMs}ms` };
      })
      .sort((a, b) => b.score - a.score);
  },

  /** 质量优先：qualityScore 越高越优。 */
  quality(candidates: ModelInfo[]): ScoredModel[] {
    return candidates
      .map((m) => ({
        model: m,
        score: m.qualityScore,
        reason: `quality=${m.qualityScore}`,
      }))
      .sort((a, b) => b.score - a.score);
  },

  /** 综合（默认）：成本 * 0.4 + 速度 * 0.2 + 质量 * 0.4。 */
  balanced(candidates: ModelInfo[]): ScoredModel[] {
    const normCost = Math.max(...candidates.map((c) => c.costPer1kInput + c.costPer1kOutput), 0.0001);
    const normLatency = Math.max(...candidates.map((c) => c.typicalLatencyMs), 1);
    return candidates
      .map((m) => {
        const cost = m.costPer1kInput + m.costPer1kOutput;
        const costScore = 100 * (1 - cost / normCost);
        const speedScore = 100 * (1 - m.typicalLatencyMs / normLatency);
        const qualityScore = m.qualityScore;
        const score = costScore * 0.4 + speedScore * 0.2 + qualityScore * 0.4;
        return {
          model: m,
          score,
          reason: `balanced: cost=${costScore.toFixed(1)} speed=${speedScore.toFixed(1)} quality=${qualityScore}`,
        };
      })
      .sort((a, b) => b.score - a.score);
  },
};

export function applyStrategy(strategy: RouteStrategy | undefined, candidates: ModelInfo[]): ScoredModel[] {
  switch (strategy) {
    case "cost":
      return rules.cost(candidates);
    case "speed":
      return rules.speed(candidates);
    case "quality":
      return rules.quality(candidates);
    case "failover":
      return rules.balanced(candidates);
    case undefined:
    default:
      return rules.balanced(candidates);
  }
}
