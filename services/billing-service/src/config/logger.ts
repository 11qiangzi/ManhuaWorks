/**
 * pino logger —— 结构化日志
 */

import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.isProd ? "info" : "debug",
  base: { service: "billing-service" },
  transport: env.isProd
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname,service",
        },
      },
});
