/**
 * @manhuaworks/ai-sdk-wrappers
 *
 * 统一导出：
 *   - embeddings/*  嵌入模型（本地 + 4 家远程）
 *   - image/*       图像模型（4 家供应商统一接口）
 *   - video/*       视频模型（2 家供应商异步任务）
 *   - vector/*      pgvector 存储 + 相似度工具
 */

export * from './embeddings/index.js';
export * from './image/index.js';
export * from './video/index.js';
export * from './vector/index.js';

export const VERSION = '0.1.0';
export const PACKAGE_NAME = '@manhuaworks/ai-sdk-wrappers';
