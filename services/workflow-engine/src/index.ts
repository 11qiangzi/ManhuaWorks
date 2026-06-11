/**
 * workflow-engine · 入口
 *
 * 端口 8084，路由：
 *   GET  /health
 *   POST /v1/workflow/storyboard
 *   POST /v1/workflow/character
 *   POST /v1/workflow/scene
 *   POST /v1/workflow/image-gen
 *   POST /v1/workflow/tts
 *   POST /v1/workflow/video-gen
 *   POST /v1/workflow/compose
 *   GET  /v1/workflow/:runId
 *   POST /v1/workflow/:runId/cancel
 *   POST /v1/workflow/:runId/resume
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { nanoid } from 'nanoid';
import { config } from './config.js';
import { authMiddleware } from './middleware/auth.js';
import { runStoryboardWorkflow, type StoryboardInput } from './workflows/storyboard.js';
import { runCharacterWorkflow, type CharacterInput } from './workflows/character.js';
import { runSceneWorkflow, type SceneInput } from './workflows/scene.js';
import { runImageGenWorkflow, type ImageGenInput } from './workflows/image-gen.js';
import { runTTSWorkflow, type TTSInput } from './workflows/tts.js';
import { runVideoGenWorkflow, type VideoGenInput } from './workflows/video-gen.js';
import { runComposeWorkflow, type ComposeInput } from './workflows/compose.js';
import { queueRegistry, type WorkflowKind, type WorkflowJob } from './orchestrator/queue.js';
import { loadSnapshot, deleteSnapshot, listActiveRuns } from './orchestrator/checkpoint.js';
import { STORY_TYPES } from './assets/story-types.js';
import { ART_STYLES } from './assets/art-styles.js';
import { VIDEO_PROMPTS } from './assets/prompts.js';
import { closeRedis } from './orchestrator/checkpoint.js';

const app = new Hono();

// 中间件
app.use('*', logger());
app.use('*', cors({ origin: '*', allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'] }));

// 全局错误兜底
app.onError((err, c) => {
  console.error('[workflow-engine] unhandled', err);
  return c.json({ error: 'internal', message: err.message }, 500);
});

// =================== 健康检查 ===================
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'workflow-engine',
    version: '0.1.0',
    port: config.port,
    env: config.env,
    time: new Date().toISOString(),
  })
);

// =================== 元信息（资产清单） ===================
app.get('/v1/assets', (c) =>
  c.json({
    storyTypes: STORY_TYPES.map((s) => ({ id: s.id, name: s.name, nameZh: s.nameZh })),
    artStyles: ART_STYLES.map((s) => ({ id: s.id, name: s.name, nameZh: s.nameZh })),
    videoPrompts: VIDEO_PROMPTS.map((p) => ({ mode: p.mode, name: p.name })),
  })
);

// =================== 鉴权保护（/v1/* 走鉴权） ===================
app.use('/v1/*', authMiddleware);

// =================== 工具：入队并执行 ===================
async function enqueueAndRun<TIn extends Record<string, unknown>>(
  c: import('hono').Context,
  kind: WorkflowKind,
  inputs: TIn,
  runner: (runId: string, inp: TIn) => Promise<{ success: boolean; outputs: Record<string, unknown> }>
): Promise<Response> {
  const runId = `run-${nanoid(12)}`;
  const subject = c.get('auth').subject;
  const job: WorkflowJob = {
    runId,
    kind,
    inputs: inputs as Record<string, unknown>,
    subject,
    enqueuedAt: Date.now(),
  };
  // 同步执行（demo）；生产环境会丢到队列异步
  try {
    queueRegistry.enqueue(kind, job);
  } catch {
    // 队列不可用不影响同步执行路径
  }
  const result = await runner(runId, inputs);
  return c.json({ runId, kind, ...result }, result.success ? 200 : 500);
}

// =================== 7 个工作流入口 ===================
app.post('/v1/workflow/storyboard', async (c) => {
  const body = await c.req.json<StoryboardInput>();
  if (!body.text || !body.storyType) {
    return c.json({ error: 'bad_request', message: 'text and storyType required' }, 400);
  }
  return enqueueAndRun(c, 'storyboard', body as unknown as Record<string, unknown>, async (rid, inp) =>
    runStoryboardWorkflow(rid, inp as unknown as StoryboardInput)
  );
});

app.post('/v1/workflow/character', async (c) => {
  const body = await c.req.json<CharacterInput>();
  if (!body.text || !body.artStyle) {
    return c.json({ error: 'bad_request', message: 'text and artStyle required' }, 400);
  }
  return enqueueAndRun(c, 'character', body as unknown as Record<string, unknown>, async (rid, inp) =>
    runCharacterWorkflow(rid, inp as unknown as CharacterInput)
  );
});

app.post('/v1/workflow/scene', async (c) => {
  const body = await c.req.json<SceneInput>();
  if (!body.shot || !body.artStyle) {
    return c.json({ error: 'bad_request', message: 'shot and artStyle required' }, 400);
  }
  return enqueueAndRun(c, 'scene', body as unknown as Record<string, unknown>, async (rid, inp) =>
    runSceneWorkflow(rid, inp as unknown as SceneInput)
  );
});

app.post('/v1/workflow/image-gen', async (c) => {
  const body = await c.req.json<ImageGenInput>();
  if (!body.sceneDesign || !body.artStyle) {
    return c.json({ error: 'bad_request', message: 'sceneDesign and artStyle required' }, 400);
  }
  return enqueueAndRun(c, 'image-gen', body as unknown as Record<string, unknown>, async (rid, inp) =>
    runImageGenWorkflow(rid, inp as unknown as ImageGenInput)
  );
});

app.post('/v1/workflow/tts', async (c) => {
  const body = await c.req.json<TTSInput>();
  if (!body.text || !body.provider) {
    return c.json({ error: 'bad_request', message: 'text and provider required' }, 400);
  }
  return enqueueAndRun(c, 'tts', body as unknown as Record<string, unknown>, async (rid, inp) =>
    runTTSWorkflow(rid, inp as unknown as TTSInput)
  );
});

app.post('/v1/workflow/video-gen', async (c) => {
  const body = await c.req.json<VideoGenInput>();
  if (!body.sceneDesign || !body.artStyle) {
    return c.json({ error: 'bad_request', message: 'sceneDesign and artStyle required' }, 400);
  }
  return enqueueAndRun(c, 'video-gen', body as unknown as Record<string, unknown>, async (rid, inp) =>
    runVideoGenWorkflow(rid, inp as unknown as VideoGenInput)
  );
});

app.post('/v1/workflow/compose', async (c) => {
  const body = await c.req.json<ComposeInput>();
  if (!body.videoUrls || body.videoUrls.length === 0) {
    return c.json({ error: 'bad_request', message: 'videoUrls required' }, 400);
  }
  return enqueueAndRun(c, 'compose', body as unknown as Record<string, unknown>, async (rid, inp) =>
    runComposeWorkflow(rid, inp as unknown as ComposeInput)
  );
});

// =================== 状态查询 / 取消 / 续跑 ===================
app.get('/v1/workflow/:runId', async (c) => {
  const runId = c.req.param('runId');
  const snap = await loadSnapshot(runId);
  if (!snap) return c.json({ error: 'not_found' }, 404);
  return c.json(snap);
});

app.post('/v1/workflow/:runId/cancel', async (c) => {
  const runId = c.req.param('runId');
  const snap = await loadSnapshot(runId);
  if (!snap) return c.json({ error: 'not_found' }, 404);
  const removed = await queueRegistry.cancel(snap.workflow as WorkflowKind, runId).catch(() => false);
  snap.status = 'cancelled';
  await deleteSnapshot(runId);
  return c.json({ runId, cancelled: true, removed });
});

app.post('/v1/workflow/:runId/resume', async (c) => {
  const runId = c.req.param('runId');
  const snap = await loadSnapshot(runId);
  if (!snap) return c.json({ error: 'not_found' }, 404);
  if (snap.status !== 'failed') {
    return c.json({ error: 'bad_state', message: `status is ${snap.status}, not resumable` }, 400);
  }
  // 简化版续跑：直接重跑整个工作流（生产环境会从失败节点继续）
  const inputs = snap.inputs as unknown as Record<string, unknown>;
  let result;
  switch (snap.workflow) {
    case 'storyboard':
      result = await runStoryboardWorkflow(runId, inputs as unknown as StoryboardInput);
      break;
    case 'character':
      result = await runCharacterWorkflow(runId, inputs as unknown as CharacterInput);
      break;
    case 'scene':
      result = await runSceneWorkflow(runId, inputs as unknown as SceneInput);
      break;
    case 'image-gen':
      result = await runImageGenWorkflow(runId, inputs as unknown as ImageGenInput);
      break;
    case 'tts':
      result = await runTTSWorkflow(runId, inputs as unknown as TTSInput);
      break;
    case 'video-gen':
      result = await runVideoGenWorkflow(runId, inputs as unknown as VideoGenInput);
      break;
    case 'compose':
      result = await runComposeWorkflow(runId, inputs as unknown as ComposeInput);
      break;
    default:
      return c.json({ error: 'unknown_workflow' }, 400);
  }
  return c.json({ runId, resumed: true, result });
});

// =================== 运维端点 ===================
app.get('/v1/runs', async (c) => {
  const runs = await listActiveRuns();
  return c.json({ count: runs.length, runs });
});

// =================== 启动 ===================
const port = config.port;
console.log(`[workflow-engine] starting on port ${port}, env=${config.env}`);

const server = serve(
  {
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0',
  },
  (info) => {
    console.log(`[workflow-engine] listening on http://0.0.0.0:${info.port}`);
  }
);

// 优雅关闭
const shutdown = async (signal: string): Promise<void> => {
  console.log(`[workflow-engine] received ${signal}, shutting down...`);
  await queueRegistry.close().catch(() => undefined);
  await closeRedis().catch(() => undefined);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
