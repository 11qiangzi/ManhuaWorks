// =============================================================================
// orchestrator-jobs.ts — 一键创作 Job API 客户端
//
// @deprecated 已合并到 orchestrator.ts。请从 orchestrator 导入。
// 此文件保留为向后兼容的薄封装层，后续将移除。
// =============================================================================
export {
  createJob,
  getJob,
  getJobStatus,
  getIntermediates,
  getJobWsUrl,
  type StyleKey,
  type AspectRatio,
  type StepStatus,
  type JobStep,
  type JobStatus,
  type JobData,
  type CreateJobParams,
  type CreateJobResponse,
  type GetJobResponse,
} from './orchestrator'
