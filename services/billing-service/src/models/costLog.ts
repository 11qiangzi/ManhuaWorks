/**
 * Cost Log 模型 — AI 调用成本日志
 *
 * 记录每次 LLM/AI 调用的 token 用量与对应成本（按 provider 价格表折算）。
 * 用于按用户/项目/工作流/Provider 维度的成本聚合与报表。
 */

export type AiProvider = "openai" | "anthropic" | "google" | "deepseek" | "minimax";

/** 聚合周期 */
export type AggregatePeriod = "day" | "week" | "month" | "year" | "all";

/** 聚合维度 */
export type AggregateBy = "user" | "project" | "provider";

/** 内存中的成本日志记录（camelCase，业务层统一用） */
export interface CostLogRecord {
  id: string;
  userId: string;
  projectId: string | null;
  workflowId: string | null;
  nodeId: string | null;
  provider: AiProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costCents: number;
  currency: string;
  requestId: string | null;
  createdAt: Date;
}

/** 创建日志的入参（id/createdAt 由仓库生成） */
export interface CostLogCreateInput {
  userId: string;
  projectId?: string | null;
  workflowId?: string | null;
  nodeId?: string | null;
  provider: AiProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  currency?: string;
  requestId?: string | null;
}

/** 列表查询参数 */
export interface CostLogListOptions {
  from?: Date;
  to?: Date;
  provider?: AiProvider;
  limit?: number;
  offset?: number;
}

/** 聚合结果（通用结构） */
export interface CostAggregate {
  key: string;                  // 分组键（user_id / project_id / provider）
  count: number;                // 记录条数
  promptTokens: number;         // 入 token 累计
  completionTokens: number;     // 出 token 累计
  totalTokens: number;          // 总 token
  costCents: number;            // 总成本（分）
  currency: string;             // 计价货币
  period?: AggregatePeriod;     // 聚合周期
  from?: string;                // 周期起点（ISO）
  to?: string;                  // 周期终点（ISO）
}

/** 格式化后的成本报表（给前端用） */
export interface CostReportRow {
  key: string;
  label: string;
  count: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costCents: number;
  costYuan: string;       // 格式化后的人民币字符串
  currency: string;
  sharePercent: number;   // 占总成本百分比
}

export interface CostReport {
  period: AggregatePeriod;
  from: string;
  to: string;
  totalCostCents: number;
  totalCostYuan: string;
  totalTokens: number;
  totalCalls: number;
  currency: string;
  rows: CostReportRow[];
}
