/**
 * project-service 路由聚合
 *
 * 2026-06-10 谢擎 P0 改造: 聚合 shots / scenes / characters 业务路由
 * 2026-06-10 谢擎 P2 追加: admin 项目管理路由 (派单 48)
 */
import { Router } from 'express';
import { shotsRouter } from './shots';
import { scenesRouter } from './scenes';
import { charactersRouter } from './characters';
import { adminRouter } from './admin';

export const apiRouter = Router();

/* ============== Admin 项目管理 (P2) ============== */
apiRouter.use('/admin', adminRouter);

/* ============== Shots (P0-1) ============== */
apiRouter.use('/projects/:id/shots', shotsRouter);

/* ============== Scenes (P0-2) ============== */
apiRouter.use('/scenes', scenesRouter);

/* ============== Characters (P0-3) ============== */
apiRouter.use('/characters', charactersRouter);
