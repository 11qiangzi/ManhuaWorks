/**
 * 统一健康检查 — 重导出
 *
 * 谢擎标准 (派单 48 后端统一化, P0 第3次派)
 * 实际实现在 src/middleware/health.ts
 *
 * Usage:
 *   import { healthRouter, createHealthRouter } from '@manhuaworks/shared/middleware/health';
 */
export {
  healthRouter,
  createHealthRouter,
} from "../src/middleware/health.js";
export type { HealthOptions, HealthDeps, HealthReport, DepStatus } from "../src/middleware/health.js";
