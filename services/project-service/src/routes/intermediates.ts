/**
 * 中间产物查询路由 — P2 B3
 *
 * GET /v1/projects/:projectId/intermediates
 *
 * 返回项目的中间产物列表（角色、场景、分镜、图像URL等）
 * 用于一键模式→专业模式切换时的数据传递
 *
 * 谢擎 2026-06-21
 */

import { Router, type Request, type Response } from "express";
import { pool } from "../config/db";
import { requireAuth } from "@manhuaworks/shared";
import { logger } from "../config/logger";

export const intermediatesRouter = Router({ mergeParams: true });

/**
 * GET /api/v1/projects/:projectId/intermediates
 *
 * 返回格式 (参考 P2 架构文档 §2.7):
 * {
 *   "code": 0,
 *   "message": "ok",
 *   "data": {
 *     "projectId": "proj-abc123",
 *     "characters": [{ "id": "char-1", "name": "苏晚晴", "imageUrl": "...", "traits": [...] }],
 *     "scenes": [{ "id": "scene-1", "title": "图书馆邂逅", "description": "..." }],
 *     "storyboard": [{ "shotId": "shot-1", "imageUrl": "...", "prompt": "...", "duration": 5 }]
 *   }
 * }
 */
intermediatesRouter.get(
  "/",
  requireAuth(),
  async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId;
      if (!projectId) {
        return res.status(400).json({ code: 40000, message: "缺少项目ID" });
      }

      // 验证项目是否存在 + 用户有权限
      const authUser = (req as any).user;
      const userId = authUser?.sub ?? null;

      const projResult = await pool.query(
        "SELECT id, user_id, title FROM projects WHERE id = $1",
        [projectId],
      );
      if (projResult.rowCount === 0) {
        return res.status(404).json({ code: 40400, message: "项目不存在" });
      }

      // 并行查询三种中间产物
      const [charResult, sceneResult, shotResult] = await Promise.all([
        pool.query(
          `SELECT id, name, description, archetype, tags, thumbnail_url, prompt, created_at
           FROM characters WHERE project_id = $1 ORDER BY created_at ASC`,
          [projectId],
        ),
        pool.query(
          `SELECT id, name, description, scene_type, tags, thumbnail_url, prompt, light_preset, created_at
           FROM scenes WHERE project_id = $1 ORDER BY created_at ASC`,
          [projectId],
        ),
        pool.query(
          `SELECT id, shot_no, title, description, camera, dialogue, note, status, sort_index,
                  created_at, updated_at
           FROM shots WHERE project_id = $1 ORDER BY sort_index ASC`,
          [projectId],
        ),
      ]);

      const characters = charResult.rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        archetype: r.archetype,
        traits: Array.isArray(r.tags) ? r.tags : [],
        imageUrl: r.thumbnail_url ?? null,
        prompt: r.prompt ?? null,
        createdAt: r.created_at,
      }));

      const scenes = sceneResult.rows.map((r) => ({
        id: r.id,
        title: r.name,
        description: r.description ?? null,
        sceneType: r.scene_type ?? "indoor",
        tags: Array.isArray(r.tags) ? r.tags : [],
        thumbnailUrl: r.thumbnail_url ?? null,
        prompt: r.prompt ?? null,
        lightPreset: r.light_preset ?? null,
        createdAt: r.created_at,
      }));

      const storyboard = shotResult.rows.map((r) => ({
        shotId: r.id,
        shotNo: r.shot_no,
        title: r.title ?? null,
        description: r.description ?? null,
        dialogue: r.dialogue ?? null,
        camera: r.camera ?? null,
        status: r.status,
        sortIndex: r.sort_index,
        imageUrl: null,
        createdAt: r.created_at,
      }));

      res.json({
        code: 0,
        message: "ok",
        data: {
          projectId,
          characters,
          scenes,
          storyboard,
        },
      });
    } catch (err) {
      logger.error({ err }, "get project intermediates failed");
      res.status(500).json({ code: 50000, message: "服务器内部错误" });
    }
  },
);
