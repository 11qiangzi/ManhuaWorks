/**
 * Cost Log Service — 业务层
 *
 * 职责：
 *  - 写入：合并 calculator 计算成本 + repo 持久化
 *  - 读取：直接转 repo
 *  - 聚合：calculator.aggregateCosts
 *  - 报表：calculator.formatCostReport
 */

import { costLogRepository } from "../repositories/costLogRepository";
import { calculateCost, aggregateCosts, formatCostReport } from "./costCalculator";
import type {
  AiProvider,
  AggregateBy,
  AggregatePeriod,
  CostLogCreateInput,
  CostLogListOptions,
  CostLogRecord,
  CostReport,
} from "../models/costLog";

export const costLogService = {
  /**
   * 记录一次 AI 调用
   * - 接受 prompt/completion token 数 + provider/model
   * - 用 calculator 算 costCents，调用 repo 写入
   */
  recordCall(input: {
    userId: string;
    projectId?: string | null;
    workflowId?: string | null;
    nodeId?: string | null;
    provider: AiProvider;
    model: string;
    promptTokens: number;
    completionTokens: number;
    requestId?: string | null;
  }): CostLogRecord {
    const calc = calculateCost({
      provider: input.provider,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
    });
    const write: CostLogCreateInput = {
      userId: input.userId,
      projectId: input.projectId ?? null,
      workflowId: input.workflowId ?? null,
      nodeId: input.nodeId ?? null,
      provider: input.provider,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      costCents: calc.costCents,
      currency: calc.currency,
      requestId: input.requestId ?? null,
    };
    return costLogRepository.create(write);
  },

  /** 直接写入（外部已经算好成本，例如测试或旁路调用） */
  recordRaw(input: CostLogCreateInput): CostLogRecord {
    return costLogRepository.create(input);
  },

  findById(id: string): CostLogRecord | null {
    return costLogRepository.findById(id);
  },

  listByUser(userId: string, opts?: CostLogListOptions): CostLogRecord[] {
    return costLogRepository.listByUser(userId, opts ?? {});
  },

  listByProject(projectId: string, opts?: CostLogListOptions): CostLogRecord[] {
    return costLogRepository.listByProject(projectId, opts ?? {});
  },

  /** 通用聚合入口：上层传 by + 范围，内部走对应 repo 方法 */
  aggregate(input: {
    by: AggregateBy;
    period?: AggregatePeriod;
    userId?: string;
    projectId?: string;
  }): CostReport {
    const by = input.by;
    const period: AggregatePeriod = input.period ?? "month";
    let aggregated;
    if (by === "user") {
      const uid = input.userId;
      if (!uid) throw new Error("userId required for by=user");
      const arr = costLogRepository.aggregateByUser(uid, period);
      aggregated = arr.map((a) => ({ ...a, key: uid })); // 保持 key=userId 方便报表
    } else if (by === "project") {
      const pid = input.projectId;
      if (!pid) throw new Error("projectId required for by=project");
      const arr = costLogRepository.aggregateByProject(pid, period);
      aggregated = arr.map((a) => ({ ...a, key: pid }));
    } else {
      aggregated = costLogRepository.aggregateByProvider(period);
    }
    return formatCostReport({ aggregated, period });
  },

  /** 给定 records 数组聚合（不依赖 repo，方便测试/手工聚合） */
  aggregateRecords(records: CostLogRecord[], by: AggregateBy, period: AggregatePeriod = "month"): CostReport {
    const aggregated = aggregateCosts({ records, by, period });
    return formatCostReport({ aggregated, period });
  },

  /** 测试/管理：清空全部 */
  __reset(): void {
    costLogRepository.__reset();
  },
};

export default costLogService;
