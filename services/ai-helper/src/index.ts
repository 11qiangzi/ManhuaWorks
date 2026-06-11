/**
 * ai-helper · 入口
 *
 * 端口 8086，路由：
 *   GET  /health
 *   GET  /v1/helper/prompts                 (公开元信息)
 *   POST /v1/helper/suggest-storyboard
 *   POST /v1/helper/suggest-character
 *   POST /v1/helper/suggest-scene
 *   POST /v1/helper/polish-dialogue
 *   POST /v1/helper/continue-plot
 *   POST /v1/helper/generate-title
 *   POST /v1/helper/translate
 *   POST /v1/helper/detect-issue
 *
 * 8 个 feature 共用 ai-router 作为底层 LLM 通道，自身不持有模型。
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { authMiddleware } from './middleware/auth.js';
import { STORY_TYPES, ART_STYLES } from './prompts/system.js';

import { runSuggestStoryboard, SuggestStoryboardInputSchema } from './features/suggest-storyboard.js';
import { runSuggestCharacter, SuggestCharacterInputSchema } from './features/suggest-character.js';
import { runSuggestScene, SuggestSceneInputSchema } from './features/suggest-scene.js';
import { runPolishDialogue, PolishDialogueInputSchema } from './features/polish-dialogue.js';
import { runContinuePlot, ContinuePlotInputSchema } from './features/continue-plot.js';
import { runGenerateTitle, GenerateTitleInputSchema } from './features/generate-title.js';
import { runTranslate, TranslateInputSchema } from './features/translate.js';
import { runDetectIssue, DetectIssueInputSchema } from './features/detect-issue.js';

const app = new Hono();

// 中间件
app.use('*', logger());
app.use('*', cors({ origin: '*', allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'] }));

// 全局错误兜底
app.onError((err, c) => {
  console.error('[ai-helper] unhandled', err);
  return c.json({ error: 'internal', message: err.message }, 500);
});

// =================== 健康检查 ===================
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'ai-helper',
    version: '0.1.0',
    port: config.port,
    env: config.env,
    features: [
      'suggest-storyboard',
      'suggest-character',
      'suggest-scene',
      'polish-dialogue',
      'continue-plot',
      'generate-title',
      'translate',
      'detect-issue',
    ],
    time: new Date().toISOString(),
  })
);

// =================== 公开元信息（无需鉴权，便于前端一次性拉） ===================
app.get('/v1/helper/prompts', (c) =>
  c.json({
    storyTypes: STORY_TYPES.map((s) => ({ id: s.id, name: s.name, nameZh: s.nameZh, description: s.description })),
    artStyles: ART_STYLES.map((s) => ({
      id: s.id,
      name: s.name,
      nameZh: s.nameZh,
      description: s.description,
      visualKeywords: s.visualKeywords,
    })),
  })
);

// =================== 鉴权保护（/v1/helper/* 走鉴权） ===================
app.use('/v1/helper/*', authMiddleware);

// =================== 通用：Zod 校验 + 错误处理 ===================
function zodParse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: unknown } } }, body: unknown): { ok: true; data: T } | { ok: false; resp: Response } {
  const r = schema.safeParse(body);
  if (!r.success) {
    return {
      ok: false,
      resp: new Response(JSON.stringify({ error: 'bad_request', issues: r.error.issues }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }
  return { ok: true, data: r.data };
}

// =================== 8 个 feature 端点 ===================

app.post('/v1/helper/suggest-storyboard', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = zodParse(SuggestStoryboardInputSchema, body);
  if (!parsed.ok) return parsed.resp;
  const result = await runSuggestStoryboard(parsed.data);
  return c.json(result);
});

app.post('/v1/helper/suggest-character', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = zodParse(SuggestCharacterInputSchema, body);
  if (!parsed.ok) return parsed.resp;
  const result = await runSuggestCharacter(parsed.data);
  return c.json(result);
});

app.post('/v1/helper/suggest-scene', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = zodParse(SuggestSceneInputSchema, body);
  if (!parsed.ok) return parsed.resp;
  const result = await runSuggestScene(parsed.data);
  return c.json(result);
});

app.post('/v1/helper/polish-dialogue', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = zodParse(PolishDialogueInputSchema, body);
  if (!parsed.ok) return parsed.resp;
  const result = await runPolishDialogue(parsed.data);
  return c.json(result);
});

app.post('/v1/helper/continue-plot', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = zodParse(ContinuePlotInputSchema, body);
  if (!parsed.ok) return parsed.resp;
  const result = await runContinuePlot(parsed.data);
  return c.json(result);
});

app.post('/v1/helper/generate-title', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = zodParse(GenerateTitleInputSchema, body);
  if (!parsed.ok) return parsed.resp;
  const result = await runGenerateTitle(parsed.data);
  return c.json(result);
});

app.post('/v1/helper/translate', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = zodParse(TranslateInputSchema, body);
  if (!parsed.ok) return parsed.resp;
  const result = await runTranslate(parsed.data);
  return c.json(result);
});

app.post('/v1/helper/detect-issue', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = zodParse(DetectIssueInputSchema, body);
  if (!parsed.ok) return parsed.resp;
  const result = await runDetectIssue(parsed.data);
  return c.json(result);
});

// =================== 启动 ===================
const port = config.port;
console.log(`[ai-helper] starting on port ${port}, env=${config.env}, ai-router=${config.aiRouter.url}`);

const server = serve(
  {
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0',
  },
  (info) => {
    console.log(`[ai-helper] listening on http://0.0.0.0:${info.port}`);
  }
);

// 优雅关闭
const shutdown = async (signal: string): Promise<void> => {
  console.log(`[ai-helper] received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
