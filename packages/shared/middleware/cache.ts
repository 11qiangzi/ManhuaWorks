/**
 * 统一 Redis 缓存策略 — 重导出
 *
 * 谢擎标准 (派单 48 后端统一化, P0 第3次派)
 * 实际实现在 src/middleware/cache.ts
 *
 * Usage:
 *   import { createCache, withCache, CacheKeys, CacheTTL } from '@manhuaworks/shared/middleware/cache';
 */
export {
  createCache,
  withCache,
  CacheKeys,
  CacheTTL,
} from "../src/middleware/cache.js";
export type { CacheOptions, CacheStore } from "../src/middleware/cache.js";
