/**
 * asset-service · 入口
 *
 * 端口 8085，路由：
 *   GET  /health
 *   GET  /v1/assets
 *
 *   # 项目空间
 *   GET    /v1/projects
 *   POST   /v1/projects
 *   GET    /v1/projects/:id
 *   PATCH  /v1/projects/:id
 *   DELETE /v1/projects/:id
 *
 *   # 协作成员
 *   GET    /v1/projects/:id/members
 *   POST   /v1/projects/:id/members
 *   PATCH  /v1/projects/:id/members/:userId
 *   DELETE /v1/projects/:id/members/:userId
 *   POST   /v1/projects/:id/lock
 *   POST   /v1/projects/:id/unlock
 *
 *   # 资产元信息
 *   GET    /v1/assets/story-types
 *   GET    /v1/assets/art-styles
 *   GET    /v1/assets/prompts
 *
 *   # 资产 CRUD
 *   GET    /v1/assets/:id
 *   DELETE /v1/assets/:id
 *   POST   /v1/assets/upload
 *   GET    /v1/assets/story-types/:id
 *   POST   /v1/assets/story-types
 *   PATCH  /v1/assets/story-types/:id
 *   DELETE /v1/assets/story-types/:id
 *   GET    /v1/assets/art-styles/:id
 *   POST   /v1/assets/art-styles
 *   PATCH  /v1/assets/art-styles/:id
 *   DELETE /v1/assets/art-styles/:id
 *
 *   # 锁脸
 *   POST   /v1/assets/lock-face
 *   GET    /v1/assets/lock-face/:characterId
 *   PATCH  /v1/assets/lock-face/:characterId
 *   DELETE /v1/assets/lock-face/:characterId
 *
 *   # 版本
 *   POST   /v1/assets/:id/versions
 *   GET    /v1/assets/:id/versions
 *   GET    /v1/assets/:id/versions/:vNo
 *   POST   /v1/assets/:id/versions/:vNo/restore
 *   POST   /v1/assets/:id/versions/:vNo/diff
 *
 *   # 导出
 *   POST   /v1/assets/export/episode
 *   POST   /v1/assets/export/season
 *   POST   /v1/assets/export/srt
 *
 *   # 货架
 *   GET    /v1/shelf
 *   GET    /v1/shelf/project/:projectId
 *   GET    /v1/shelf/global
 *
 *   # 参考图档案
 *   GET    /v1/reference-images
 *   POST   /v1/reference-images
 *   POST   /v1/reference-images/batch
 *   GET    /v1/reference-images/project/:projectId/summary
 *   PATCH  /v1/reference-images/:id
 *   DELETE /v1/reference-images/:id
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { authMiddleware } from './middleware/auth.js';
import { projectsRoute } from './projects/routes.js';
import { collaborationRoute } from './projects/collaboration.js';
import { storyTypesRoute, STORY_TYPES, PROMPT_LIBS } from './assets/story-types.js';
import { artStylesRoute, ART_STYLES } from './assets/art-styles.js';
import { uploadRoute } from './assets/upload.js';
import { lockFaceRoute } from './assets/lock-face.js';
import { versionRoute } from './assets/version.js';
import { exportRoute } from './assets/export.js';
import { shelfRoute } from './assets/shelf.js';
import { referenceImagesRoute } from './assets/reference-images.js';

const app = new Hono();

// 中间件
app.use('*', logger());
app.use('*', cors({ origin: '*', allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'] }));

// 全局错误兜底
app.onError((err, c) => {
  console.error('[asset-service] unhandled', err);
  return c.json({ error: 'internal', message: err.message }, 500);
});

// 404 兜底
app.notFound((c) => c.json({ error: 'not_found', path: c.req.path }, 404));

// =================== 健康检查 ===================
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'asset-service',
    version: '0.1.0',
    port: config.port,
    env: config.env,
    storage: config.s3.enabled ? 's3' : 'local',
    s3: {
      enabled: config.s3.enabled,
      bucket: config.s3.bucket,
      region: config.s3.region,
    },
    time: new Date().toISOString(),
  })
);

// =================== 资产清单概览 ===================
app.get('/v1/assets', (c) =>
  c.json({
    storyTypes: STORY_TYPES.map((s) => ({
      id: s.id,
      name: s.name,
      nameZh: s.nameZh,
      shotsPerChapter: s.shotsPerChapter,
    })),
    artStyles: ART_STYLES.map((s) => ({
      id: s.id,
      name: s.name,
      nameZh: s.nameZh,
      palette: s.palette,
    })),
    promptLibs: PROMPT_LIBS.map((p) => ({
      id: p.id,
      name: p.name,
      nameZh: p.nameZh,
      appliesTo: p.appliesTo,
    })),
  })
);

// =================== 鉴权保护 ===================
app.use('/v1/*', authMiddleware);

// =================== 业务路由 ===================
// 项目空间 + 协作
app.route('/v1/projects', projectsRoute);
app.route('/v1/projects', collaborationRoute);

// 资产：故事类型 / 艺术风格 / prompt 库
app.route('/v1/assets/story-types', storyTypesRoute);
app.route('/v1/assets/art-styles', artStylesRoute);

app.get('/v1/assets/prompts', (c) => c.json({ total: PROMPT_LIBS.length, list: PROMPT_LIBS }));
app.get('/v1/assets/prompts/:id', (c) => {
  const id = c.req.param('id');
  const p = PROMPT_LIBS.find((x) => x.id === id);
  if (!p) return c.json({ error: 'not_found' }, 404);
  return c.json(p);
});

// 资产上传 / 详情 / 删除
app.route('/v1/assets', uploadRoute);

// 锁脸
app.route('/v1/assets/lock-face', lockFaceRoute);

// 版本
app.route('/', versionRoute);

// 导出
app.route('/v1/assets/export', exportRoute);

// 货架
app.route('/v1/shelf', shelfRoute);

// 参考图档案
app.route('/v1/reference-images', referenceImagesRoute);

// =================== 启动 ===================
const port = config.port;
console.log(`[asset-service] starting on port ${port}, env=${config.env}, storage=${config.s3.enabled ? 's3' : 'local'}`);

const server = serve(
  {
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0',
  },
  (info) => {
    console.log(`[asset-service] listening on http://0.0.0.0:${info.port}`);
  }
);

// 优雅关闭
const shutdown = async (signal: string): Promise<void> => {
  console.log(`[asset-service] received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
