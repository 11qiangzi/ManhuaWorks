/**
 * 用户偏好路由 — P2 A4
 *
 * PUT  /v1/users/me/preferences  → 保存偏好
 * GET  /v1/users/me/preferences  → 读取偏好
 *
 * 存储在 users 表的 preferences JSONB 字段
 * 当前支持的 key: mangaEditorMode ("simple" | "pro")
 *
 * 谢擎 2026-06-21
 */

import { Router, type Request, type Response } from "express";
import { pool } from "../config/db";
import { requireAuth } from "@manhuaworks/shared";
import { logger } from "../config/logger";

export const preferencesRouter = Router();

/** 允许的偏好 key 白名单 */
const ALLOWED_KEYS = ["mangaEditorMode"] as const;
type PreferenceKey = (typeof ALLOWED_KEYS)[number];

/** 每个 key 的值校验 */
function validatePref(key: string, value: unknown): string | null {
  if (!ALLOWED_KEYS.includes(key as PreferenceKey)) {
    return `不支持的偏好 key: ${key}，允许: ${ALLOWED_KEYS.join(", ")}`;
  }
  if (key === "mangaEditorMode") {
    if (value !== "simple" && value !== "pro") {
      return `mangaEditorMode 必须是 "simple" 或 "pro"`;
    }
  }
  return null;
}

/**
 * PUT /api/v1/users/me/preferences
 *
 * Body: { "mangaEditorMode": "simple" | "pro" }
 * Response: { code: 0, message: "ok", data: { mangaEditorMode: "pro" } }
 */
preferencesRouter.put(
  "/",
  requireAuth(),
  async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user;
      const userId = authUser?.sub ?? null;
      if (!userId) {
        return res.status(401).json({ code: 40100, message: "未登录" });
      }

      const body = req.body ?? {};
      if (typeof body !== "object" || Object.keys(body).length === 0) {
        return res.status(400).json({ code: 40000, message: "请求体为空" });
      }

      // 校验传入的每个 key
      for (const [key, value] of Object.entries(body)) {
        const err = validatePref(key, value);
        if (err) {
          return res.status(400).json({ code: 40000, message: err });
        }
      }

      // 合并到现有 preferences (atomic)
      const result = await pool.query(
        `UPDATE users
         SET preferences = COALESCE(preferences, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING preferences`,
        [userId, JSON.stringify(body)],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ code: 40400, message: "用户不存在" });
      }

      // 返回当前全量偏好（一次读取，不额外查询）
      const prefs = result.rows[0].preferences ?? {};

      res.json({
        code: 0,
        message: "ok",
        data: prefs,
      });
    } catch (err) {
      logger.error({ err }, "update preferences failed");
      res.status(500).json({ code: 50000, message: "服务器内部错误" });
    }
  },
);

/**
 * GET /api/v1/users/me/preferences
 *
 * Response: { code: 0, message: "ok", data: { mangaEditorMode: "simple" } }
 */
preferencesRouter.get(
  "/",
  requireAuth(),
  async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user;
      const userId = authUser?.sub ?? null;
      if (!userId) {
        return res.status(401).json({ code: 40100, message: "未登录" });
      }

      const result = await pool.query(
        "SELECT preferences FROM users WHERE id = $1",
        [userId],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ code: 40400, message: "用户不存在" });
      }

      const prefs = result.rows[0].preferences ?? {};

      res.json({
        code: 0,
        message: "ok",
        data: prefs,
      });
    } catch (err) {
      logger.error({ err }, "get preferences failed");
      res.status(500).json({ code: 50000, message: "服务器内部错误" });
    }
  },
);
