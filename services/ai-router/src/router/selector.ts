// 智能选择：考虑成本+延迟+健康+用户偏好
// 输入：任务类型、用户偏好 provider 列表、策略
// 输出：有序的 provider 候选链

import { registry } from "./registry.js";
import { applyStrategy, type ScoredModel } from "./rules.js";
import type { ProviderId, RouteStrategy, TaskType } from "../types.js";

export interface SelectOptions {
  task: TaskType;
  strategy?: RouteStrategy;
  /** 用户偏好：按优先级排序的 Provider 列表 */
  preferredProviders?: ProviderId[];
  /** 用户在请求中显式指定的模型 ID（如 "M3"） */
  requestedModel?: string;
}

export interface Selection {
  /** 已经按策略排好序的候选 */
  ranked: ScoredModel[];
  /** 最终选中的 provider（ranked[0].model.provider） */
  chosen: ProviderId;
  chosenModelId: string;
  reason: string;
}

export function select(options: SelectOptions): Selection {
  // 1. 候选集 = 健康 provider 的所有支持模型
  let candidates = registry.candidatesFor(options.task);

  // 2. 用户指定模型时优先匹配
  if (options.requestedModel) {
    const exact = candidates.find((m) => m.id === options.requestedModel);
    if (exact) {
      const preferred = applyStrategy(options.strategy, [exact]);
      return {
        ranked: preferred,
        chosen: exact.provider,
        chosenModelId: exact.id,
        reason: `requested model ${exact.id}`,
      };
    }
    // 跨 provider 同名 → 退化为打分
  }

  // 3. 用户偏好 Provider 提权（在前缀保留，再接剩余）
  if (options.preferredProviders && options.preferredProviders.length > 0) {
    const preferredSet = new Set(options.preferredProviders);
    const head = candidates.filter((m) => preferredSet.has(m.provider));
    const tail = candidates.filter((m) => !preferredSet.has(m.provider));
    candidates = [...head, ...tail];
  }

  // 4. 策略打分
  const ranked = applyStrategy(options.strategy, candidates);

  if (ranked.length === 0) {
    throw new Error(`no healthy provider supports task=${options.task}`);
  }

  const top = ranked[0]!;
  return {
    ranked,
    chosen: top.model.provider,
    chosenModelId: top.model.id,
    reason: top.reason,
  };
}
