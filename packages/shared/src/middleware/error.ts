/**
 * 统一错误处理中间件 — 5 服务共用
 *
 * 谢擎标准 (派单 48 后端统一化, 2026-06-10)
 *
 * 返回格式: { code: number, message: string, data?: unknown }
 *
 * 错误码:
 *   40000  - 参数错误 (含 Zod validation)
 *   40100  - 未登录
 *   40101  - 密码错误
 *   40102  - token 无效或过期
 *   40103  - refreshToken 过期
 *   40201  - 支付失败
 *   40300  - 无权访问
 *   40301  - 不可给他人操作
 *   40400  - 资源不存在
 *   40900  - 资源冲突 (含 PG unique violation)
 *   42900  - 请求过于频繁
 *   50000  - 服务器内部错误
 *   50300  - 服务不可用
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, ErrorCodes } from "../types/errors.js";

// ─── asyncHandler — 包装 async route handler ─────────────────

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ─── notFoundHandler — 404 兜底 ──────────────────────────────

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: ErrorCodes.NOT_FOUND,
    message: "接口不存在",
  });
}

// ─── errorHandler — 全局错误处理 ─────────────────────────────

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  // 1. AppError (谢擎标准) → 直接返回
  if (err instanceof AppError) {
    res.status(err.statusCode()).json({
      code: err.code,
      message: err.message,
      ...(err.data ? { data: err.data } : {}),
    });
    return;
  }

  // 2. ZodError → 40000 参数校验失败
  if (err instanceof ZodError) {
    res.status(400).json({
      code: ErrorCodes.BAD_REQUEST,
      message: "参数校验失败",
      data: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      })),
    });
    return;
  }

  // 3. PostgreSQL 错误码
  const pgErr = err as { code?: string; detail?: string };
  if (pgErr?.code === "23505") {
    // unique_violation
    res.status(409).json({
      code: ErrorCodes.CONFLICT,
      message: "资源已存在",
    });
    return;
  }
  if (pgErr?.code === "23503") {
    // foreign_key_violation
    res.status(400).json({
      code: ErrorCodes.BAD_REQUEST,
      message: "关联资源不存在",
    });
    return;
  }
  if (pgErr?.code === "23502") {
    // not_null_violation
    res.status(400).json({
      code: ErrorCodes.BAD_REQUEST,
      message: "必填字段缺失",
    });
    return;
  }

  // 4. JWT 相关错误
  const jwtErr = err as { name?: string; message?: string };
  if (jwtErr?.name === "JsonWebTokenError" || jwtErr?.name === "TokenExpiredError") {
    res.status(401).json({
      code: ErrorCodes.INVALID_TOKEN,
      message: "token 无效或已过期",
    });
    return;
  }

  // 5. 兜底 500 — 不返回 stack trace
  const isProd = process.env.NODE_ENV === "production";
  const e = err as Error;

  // 结构化日志 (如有 logger 则使用)
  if (typeof process !== "undefined" && process.stderr) {
    process.stderr.write(
      `[error] ${req.method} ${req.path} | ${e?.name ?? "Error"}: ${e?.message ?? "unknown"}\n`
    );
  }

  res.status(500).json({
    code: ErrorCodes.INTERNAL_ERROR,
    message: isProd ? "服务器内部错误" : `服务器内部错误: ${e?.message ?? "unknown"}`,
  });
};
