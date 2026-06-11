/**
 * Redis 客户端 (单例)
 *  - pub: 用于发布 WS 消息 (跨进程广播)
 *  - sub: 用于订阅 WS 消息 (子进程不消费自己的发布)
 *  - cmd: 普通 KV 操作 (例如 presence / rate limit)
 */
import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

function makeClient(label: "pub" | "sub" | "cmd"): Redis {
  const c = new Redis(env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
  c.on("error", (err) => logger.error({ err, label }, "redis error"));
  c.on("connect", () => logger.info({ label }, "redis connected"));
  return c;
}

export const redisPub = makeClient("pub");
export const redisSub = makeClient("sub");
export const redisCmd = makeClient("cmd");

export const REDIS_CHANNELS = {
  /** 项目维度广播: collab:project:<projectId> */
  project: (projectId: string) => `collab:project:${projectId}`,
  /** 用户维度 (站内通知/个人推送): collab:user:<userId> */
  user: (userId: string) => `collab:user:${userId}`,
  /** 全局: collab:global */
  global: "collab:global",
} as const;

export async function closeRedis(): Promise<void> {
  await Promise.all([redisPub.quit(), redisSub.quit(), redisCmd.quit()]);
}
