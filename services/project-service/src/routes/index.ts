/**
 * project-service 路由聚合
 *
 * 2026-06-10 谢擎 P0 改造: 聚合 shots / scenes / characters 业务路由
 * 2026-06-10 谢擎 P2 追加: admin 项目管理路由 (派单 48)
 * 2026-06-10 追加: members 协作者管理 + archive 归档切换
 * 2026-06-10 追加: projects 用户级项目 PATCH/DELETE
 */
import { Router } from 'express';
import { shotsRouter } from './shots';
import { scenesRouter } from './scenes';
import { charactersRouter } from './characters';
import { adminRouter } from './admin';
import { membersRouter } from './members';
import { archiveRouter } from './archive';
import { intermediatesRouter } from './intermediates';
import { projectsRouter } from './projects';
import { assetsRouter } from './assets';

export const apiRouter = Router();

/* ============== Admin 项目管理 (P2) ============== */
apiRouter.use('/admin', adminRouter);

/* ============== Projects 用户级项目操作 ============== */
apiRouter.use('/projects', projectsRouter);

/* ============== Shots (P0-1) ============== */
apiRouter.use('/projects/:id/shots', shotsRouter);

/* ============== Scenes (P0-2) ============== */
apiRouter.use('/scenes', scenesRouter);

/* ============== Characters (P0-3) ============== */
apiRouter.use('/characters', charactersRouter);

/* ============== Assets 素材资产（武器/道具/饰品/特效·技能） ============== */
apiRouter.use('/assets', assetsRouter);

/* ============== Members 协作者管理 ============== */
apiRouter.use('/projects/:id/members', membersRouter);

/* ============== Intermediates 中间产物查询 (P2 B3) ============== */
apiRouter.use('/projects/:projectId/intermediates', intermediatesRouter);

/* ============== Archive 归档切换 ============== */
apiRouter.use('/projects/:id/archive', archiveRouter);
