/**
 * ManhuaWorks project-service logger (pino)
 *
 * 开发环境带 pino-pretty；生产仅 ISO 时间戳 JSON 输出。
 */
import pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';
const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
 level,
 base: { service: 'project-service' },
 timestamp: pino.stdTimeFunctions.isoTime,
 ...(isDev
 ? {
 // 不引入 pino-pretty依赖也能用 node 控制台可读输出
 formatters: {
 level: (label: string) => ({ level: label }),
 },
 }
 : {}),
});

export type Logger = typeof logger;
