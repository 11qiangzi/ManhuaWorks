/**
 * 短视频模块 API 路由（API-8 + ENH-7/8）
 *
 * 派单51：谢擎 | 日期：2026-06-25
 * 派单53：谢擎 | 日期：2026-06-25 — P1 UX增强
 *
 * API-8:  POST /v1/creative/short-video/product-parse   - 商品链接解析
 * ENH-7:  GET  /v1/creative/short-video/script-templates - 脚本模板列表
 * ENH-8:  POST /v1/creative/short-video/batch-generate   - 批量生成任务队列
 * ENH-8:  GET  /v1/creative/short-video/batch/:batchId/status - 批次状态查询
 */

import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { requireUser, type AppEnv } from "../middleware/auth.js";
import { aiRouterClient as aiRouter } from "../clients/ai-router.js";
import { ErrorCodes } from "@manhuaworks/shared";

import {
  PRODUCT_PARSE_SYSTEM_PROMPT,
  PRODUCT_PARSE_USER_PROMPT,
} from "../prompts/product-parse.js";
// P1 (派单53)
import { getScriptTemplates } from "../prompts/script-template.js";

import type {
  ProductParseResponse,
  // P1
  ScriptTemplateListResponse,
  BatchGenerateRequest,
  BatchGenerateResponse,
  BatchStatusResponse,
  BatchProductStatus,
  BatchProductProgress,
  // P2 (派单55)
  VideoTrackingTagRequest,
  VideoTrackingTagResponse,
} from "./types.js";

// ---- Zod Schemas ----

const ProductParseSchema = z.object({
  platform: z.enum(["taobao", "pinduoduo", "jd", "xiaohongshu", "douyin"]),
  url: z.string().url(),
  rawContent: z.string().min(10).max(20000),
});

// P1: ENH-8 批量生成
const ProductItemSchema = z.object({
  index: z.number().int().min(0).max(19),
  productName: z.string().min(1).max(200),
  mainImageUrl: z.string().url().optional(),
  sellingPoints: z.string().max(1000).optional(),
  productUrl: z.string().url().optional(),
});

// P2 (派单55): ENH-17 追踪标签
const TrackingTagSchema = z.object({
  videoTitle: z.string().min(1).max(200),
  platform: z.string().max(50).optional(),
  projectId: z.string().optional(),
});

const BatchGenerateSchema = z.object({
  products: z.array(ProductItemSchema).min(1).max(20),
  platform: z.string().min(1).max(50),
  category: z.string().max(50).optional(),
  scriptTemplateId: z.string().max(50).optional(),
  style: z.string().max(50).optional(),
  projectId: z.string().optional(),
});

// ========== ENH-8: 内存批量任务队列 ==========

interface BatchJob {
  batchId: string;
  userId: string;
  products: BatchProductProgress[];
  status: "processing" | "completed" | "partially_completed" | "failed";
  platform: string;
  category?: string;
  scriptTemplateId?: string;
  style?: string;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

const batchStore = new Map<string, BatchJob>();

// ---- Router ----

export const shortVideoRoutes = new Hono<AppEnv>();

// ---- API-8: 商品链接解析 ----
shortVideoRoutes.post("/product-parse", async (c) => {
  const user = requireUser(c);
  const body = ProductParseSchema.parse(await c.req.json());

  const userPrompt = PRODUCT_PARSE_USER_PROMPT(body.platform, body.rawContent);

  try {
    const result = await aiRouter.chat({
      messages: [
        { role: "system", content: PRODUCT_PARSE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3, // 提取任务需要最低温度保证准确
      maxTokens: 2500,
      taskTag: "short-video-product-parse",
    });

    const parsed = JSON.parse(
      result.content.replace(/```json|```/g, "").trim(),
    ) as ProductParseResponse;

    return c.json({
      code: 0,
      message: "ok",
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[short-video/product-parse] error: ${msg}\n`);
    if (err instanceof SyntaxError) {
      return c.json({
        code: ErrorCodes.INTERNAL_ERROR,
        message: "AI返回格式异常，请重试",
      }, 502);
    }
    return c.json({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: "商品解析服务暂不可用",
    }, 502);
  }
});

// ---- P1: ENH-7 脚本模板列表（预置数据，不调AI）----
shortVideoRoutes.get("/script-templates", (c) => {
  const response: ScriptTemplateListResponse = getScriptTemplates();
  return c.json({
    code: 0,
    message: "ok",
    data: response,
  });
});

// ---- P1: ENH-8 批量生成任务队列 ----
shortVideoRoutes.post("/batch-generate", async (c) => {
  const user = requireUser(c);
  const body = BatchGenerateSchema.parse(await c.req.json()) as BatchGenerateRequest;

  const batchId = `batch-${nanoid(12)}`;
  const now = Date.now();

  // 创建产品进度列表
  const products: BatchProductProgress[] = body.products.map((p) => ({
    index: p.index,
    productName: p.productName,
    status: "queued" as BatchProductStatus,
    progress: 0,
  }));

  const job: BatchJob = {
    batchId,
    userId: user.userId,
    products,
    status: "processing",
    platform: body.platform,
    category: body.category,
    scriptTemplateId: body.scriptTemplateId,
    style: body.style,
    projectId: body.projectId,
    createdAt: now,
    updatedAt: now,
  };

  batchStore.set(batchId, job);

  // 异步模拟逐产品处理（产线接入后替换为真实生成流程）
  processBatchAsync(batchId, body.products.length);

  const response: BatchGenerateResponse = {
    batchId,
    status: "accepted",
    totalProducts: body.products.length,
    createdAt: new Date(now).toISOString(),
    estimatedTotalTime: `${body.products.length * 15}-${body.products.length * 30}秒`,
  };

  return c.json({
    code: 0,
    message: "ok",
    data: response,
  }, 201);
});

// ENH-8: 批次状态查询
shortVideoRoutes.get("/batch/:batchId/status", (c) => {
  const batchId = c.req.param("batchId");
  const job = batchStore.get(batchId);

  if (!job) {
    return c.json({
      code: ErrorCodes.NOT_FOUND,
      message: "批次不存在或已过期",
    }, 404);
  }

  const completedCount = job.products.filter((p) => p.status === "completed").length;
  const failedCount = job.products.filter((p) => p.status === "failed").length;

  const response: BatchStatusResponse = {
    batchId: job.batchId,
    status: job.status,
    totalProducts: job.products.length,
    completedCount,
    failedCount,
    products: job.products,
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
  };

  return c.json({
    code: 0,
    message: "ok",
    data: response,
  });
});

// ---- P2 (派单55): ENH-17 视频追踪标签生成 ----
shortVideoRoutes.post("/tracking-tag", async (c) => {
  const user = requireUser(c);
  const body = TrackingTagSchema.parse(await c.req.json()) as VideoTrackingTagRequest;

  const trackingId = `qjf-${nanoid(10)}`;
  const now = new Date();

  const tracking: VideoTrackingTagResponse = {
    videoTitle: body.videoTitle,
    platform: body.platform ?? "unknown",
    tracking: {
      trackingId,
      trackingUrl: `https://qianjigongfang.com/track/${trackingId}`,
      trackingTag: `#qianji_track_${trackingId}`,
      trackingParam: `utm_source=qianjigongfang&utm_medium=ai_video&utm_campaign=${trackingId}`,
      createdAt: now.toISOString(),
    },
    usageInstructions: `发布视频时，请在描述或评论区粘贴以下任意一项：
1. 追踪链接：${`https://qianjigongfang.com/track/${trackingId}`}
2. 追踪标签：${`#qianji_track_${trackingId}`}
3. 追踪参数（附加到商品链接后）：${`?utm_source=qianjigongfang&utm_medium=ai_video&utm_campaign=${trackingId}`}

后续可在千机工坊管理后台查看该视频的播放/转化数据。`,
  };

  return c.json({
    code: 0,
    message: "ok",
    data: tracking,
  });
});

// ========== 内部：模拟批量异步处理 ==========
async function processBatchAsync(batchId: string, totalProducts: number): Promise<void> {
  const job = batchStore.get(batchId);
  if (!job) return;

  for (let i = 0; i < totalProducts; i++) {
    const product = job.products[i];
    if (!product) continue;

    // 模拟：状态流转 queued → processing（每产品300ms）
    product.status = "processing";
    product.progress = 0;
    job.updatedAt = Date.now();

    // 模拟处理进度
    for (let p = 20; p <= 100; p += 20) {
      await new Promise((r) => setTimeout(r, 200));
      product.progress = p;
      job.updatedAt = Date.now();
    }

    // 90%成功率模拟
    if (Math.random() > 0.1) {
      product.status = "completed";
      product.progress = 100;
      product.result = {
        productName: product.productName,
        videoUrl: `https://cdn.qianjigongfang.com/demo/${batchId}-${product.index}.mp4`,
        scriptPreview: `为"${product.productName}"生成的短视频脚本预览...`,
      };
    } else {
      product.status = "failed";
      product.progress = 0;
      product.error = "AI生成服务超时，请重试该产品";
    }
    job.updatedAt = Date.now();
  }

  // 最终状态判定
  const completed = job.products.filter((p) => p.status === "completed").length;
  const failed = job.products.filter((p) => p.status === "failed").length;
  if (failed === 0) {
    job.status = "completed";
  } else if (completed > 0) {
    job.status = "partially_completed";
  } else {
    job.status = "failed";
  }
  job.updatedAt = Date.now();

  // 内存队列30分钟后自动清理
  setTimeout(() => { batchStore.delete(batchId); }, 30 * 60 * 1000);
}
