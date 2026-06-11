/**
 * Cost Log 模块测试（repo + calculator + routes + 集成）
 *
 * 设计：
 *  - in-memory repo 用 __reset() 清空，避免跨用例污染
 *  - controller 端用 node:http 起一个临时 server 测真实 HTTP 路径
 *  - 鉴权用 jsonwebtoken 自签一个 token（用 service 的 JWT_SECRET）
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import "dotenv/config";
import jwt from "jsonwebtoken";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "../src/config/env";

// 业务代码
import { costLogRepository } from "../src/repositories/costLogRepository";
import {
  calculateCost,
  aggregateCosts,
  formatCostReport,
  formatCentsToYuan,
  getPrice,
  listModels,
  ALL_PROVIDERS,
  PRICE_TABLE,
  PROVIDER_DEFAULT,
} from "../src/services/costCalculator";
import { costLogService } from "../src/services/costLogService";
import { errorHandler, notFoundHandler } from "../src/middleware/error";
import costLogController from "../src/controllers/costLogController";

/* ------------------ helpers ------------------ */

function tokenFor(sub: string, role: number = 0): string {
  return jwt.sign({ sub, role }, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

const ALICE = "00000000-0000-0000-0000-000000000a11";
const BOB = "00000000-0000-0000-0000-000000000b0b";
const CAROL = "00000000-0000-0000-0000-000000000c0c";
const PROJ_P1 = "p-1";
const PROJ_P2 = "p-2";

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "512kb" }));
  app.use("/api/v1/billing/cost-logs", costLogController);
  app.use(notFoundHandler);
  app.use(errorHandler);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  costLogRepository.__reset();
});

async function httpJson(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["authorization"] = `Bearer ${token}`;
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

/* ====================================================== */
/*  Repository 测试（5）                                    */
/* ====================================================== */

describe("costLogRepository", () => {
  it("create: 写入记录返回完整字段", () => {
    const r = costLogRepository.create({
      userId: ALICE,
      projectId: PROJ_P1,
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 1000,
      completionTokens: 500,
      costCents: 10,
    });
    expect(r.id).toMatch(/[0-9a-f-]{36}/);
    expect(r.totalTokens).toBe(1500);
    expect(r.userId).toBe(ALICE);
    expect(r.currency).toBe("CNY");
    expect(r.createdAt).toBeInstanceOf(Date);
  });

  it("findById: 命中 & miss", () => {
    const r = costLogRepository.create({
      userId: ALICE,
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 100,
      completionTokens: 50,
      costCents: 1,
    });
    expect(costLogRepository.findById(r.id)?.id).toBe(r.id);
    expect(costLogRepository.findById("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("listByUser: 时间/limit/offset/排序", async () => {
    for (let i = 0; i < 5; i++) {
      costLogRepository.create({
        userId: ALICE,
        provider: "openai",
        model: "gpt-4o",
        promptTokens: 100,
        completionTokens: 50,
        costCents: 1,
      });
      // 强制 1ms 间隔，确保排序稳定
      await new Promise((r) => setTimeout(r, 2));
    }
    const all = costLogRepository.listByUser(ALICE);
    expect(all).toHaveLength(5);
    // 最新在前
    expect(all[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(all[4]!.createdAt.getTime());
    const page = costLogRepository.listByUser(ALICE, { limit: 2, offset: 1 });
    expect(page).toHaveLength(2);
  });

  it("listByProject: 仅返回该项目", () => {
    costLogRepository.create({
      userId: ALICE,
      projectId: PROJ_P1,
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 1,
      completionTokens: 1,
      costCents: 1,
    });
    costLogRepository.create({
      userId: ALICE,
      projectId: PROJ_P2,
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 1,
      completionTokens: 1,
      costCents: 1,
    });
    costLogRepository.create({
      userId: BOB,
      projectId: PROJ_P1,
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 1,
      completionTokens: 1,
      costCents: 1,
    });
    const p1 = costLogRepository.listByProject(PROJ_P1);
    expect(p1).toHaveLength(2);
    expect(p1.every((r) => r.projectId === PROJ_P1)).toBe(true);
  });

  it("aggregateByProvider: 跨用户按 provider 聚合", () => {
    costLogRepository.create({ userId: ALICE, provider: "openai", model: "gpt-4o", promptTokens: 100, completionTokens: 0, costCents: 5 });
    costLogRepository.create({ userId: BOB, provider: "openai", model: "gpt-4o", promptTokens: 100, completionTokens: 0, costCents: 5 });
    costLogRepository.create({ userId: ALICE, provider: "deepseek", model: "deepseek-chat", promptTokens: 100, completionTokens: 0, costCents: 1 });
    const arr = costLogRepository.aggregateByProvider("all");
    const total = arr.reduce((s, a) => s + a.costCents, 0);
    expect(total).toBe(11);
    expect(arr.find((a) => a.key.startsWith("openai|"))).toBeDefined();
    expect(arr.find((a) => a.key.startsWith("deepseek|"))).toBeDefined();
  });
});

/* ====================================================== */
/*  Cost Calculator 测试（≥ 15）                            */
/* ====================================================== */

describe("costCalculator", () => {
  it("PRICE_TABLE: 5 个 provider 全部存在", () => {
    for (const p of ALL_PROVIDERS) {
      expect(PRICE_TABLE[p]).toBeDefined();
      expect(Object.keys(PRICE_TABLE[p]!).length).toBeGreaterThan(0);
    }
  });

  it("getPrice: 精确命中 model", () => {
    const r = getPrice("openai", "gpt-4o");
    expect(r.matched).toBe(true);
    expect(r.entry.promptPer1kCents).toBeCloseTo(1.8, 5);
  });

  it("getPrice: 未命中 model → 走 provider 默认价", () => {
    const r = getPrice("openai", "gpt-99-unknown");
    expect(r.matched).toBe(false);
    expect(r.entry.currency).toBe("CNY");
  });

  it("listModels: provider 含 model", () => {
    expect(listModels("anthropic")).toContain("claude-3-5-sonnet");
  });

  it("PROVIDER_DEFAULT: 5 provider 全有默认价", () => {
    for (const p of ALL_PROVIDERS) {
      expect(PROVIDER_DEFAULT[p].currency).toBe("CNY");
    }
  });

  it("OpenAI gpt-4o: 1K+1K 成本", () => {
    const r = calculateCost({ provider: "openai", model: "gpt-4o", promptTokens: 1000, completionTokens: 1000 });
    // 1.8 / 1K input + 5.4 / 1K output = 7.2
    expect(r.costCents).toBe(8); // ceil(1.8) + ceil(5.4)
    expect(r.matchedModel).toBe(true);
  });

  it("OpenAI gpt-4o-mini: 小额", () => {
    const r = calculateCost({ provider: "openai", model: "gpt-4o-mini", promptTokens: 200, completionTokens: 100 });
    // ceil(200*0.14/1000)=1, ceil(100*0.56/1000)=1
    expect(r.costCents).toBe(2);
  });

  it("OpenAI 未知名 model: 走 provider 默认", () => {
    const r = calculateCost({ provider: "openai", model: "gpt-99", promptTokens: 1000, completionTokens: 0 });
    expect(r.matchedModel).toBe(false);
    expect(r.costCents).toBe(2); // ceil(1.8)
  });

  it("Anthropic claude-3-5-sonnet: 大批量", () => {
    const r = calculateCost({ provider: "anthropic", model: "claude-3-5-sonnet", promptTokens: 10000, completionTokens: 5000 });
    // ceil(10000*2.4/1000)=24, ceil(5000*9.6/1000)=48
    expect(r.costCents).toBe(72);
  });

  it("Anthropic claude-3-haiku: 极小价", () => {
    const r = calculateCost({ provider: "anthropic", model: "claude-3-haiku", promptTokens: 100, completionTokens: 50 });
    // ceil(100*0.18/1000)=1, ceil(50*0.9/1000)=1
    expect(r.costCents).toBe(2);
  });

  it("Google gemini-1.5-pro: 中等", () => {
    const r = calculateCost({ provider: "google", model: "gemini-1.5-pro", promptTokens: 2000, completionTokens: 1000 });
    // ceil(2000*0.7/1000)=2, ceil(1000*2.1/1000)=3
    expect(r.costCents).toBe(5);
  });

  it("Google gemini-1.5-flash: 超低价", () => {
    const r = calculateCost({ provider: "google", model: "gemini-1.5-flash", promptTokens: 10000, completionTokens: 5000 });
    // ceil(10000*0.056/1000)=1, ceil(5000*0.168/1000)=1
    expect(r.costCents).toBe(2);
  });

  it("DeepSeek deepseek-chat: 千 token 1 角", () => {
    const r = calculateCost({ provider: "deepseek", model: "deepseek-chat", promptTokens: 1000, completionTokens: 1000 });
    // ceil(1000*0.1/1000)=1, ceil(1000*0.2/1000)=1, sum=2
    expect(r.costCents).toBe(2);
  });

  it("DeepSeek deepseek-coder: 同价", () => {
    const r = calculateCost({ provider: "deepseek", model: "deepseek-coder", promptTokens: 5000, completionTokens: 1000 });
    // ceil(5000*0.1/1000)=1, ceil(1000*0.2/1000)=1, sum=2
    expect(r.costCents).toBe(2);
  });

  it("MiniMax MiniMax-Text-01: 已知 model", () => {
    const r = calculateCost({ provider: "minimax", model: "MiniMax-Text-01", promptTokens: 1000, completionTokens: 1000 });
    // ceil(1000*0.1/1000)=1, ceil(1000*0.8/1000)=1, sum=2
    expect(r.costCents).toBe(2);
  });

  it("MiniMax MiniMax-Text-01-v2: 略低", () => {
    const r = calculateCost({ provider: "minimax", model: "MiniMax-Text-01-v2", promptTokens: 1000, completionTokens: 1000 });
    // ceil(1000*0.08/1000)=1, ceil(1000*0.64/1000)=1, sum=2
    expect(r.costCents).toBe(2);
  });

  it("0 token: 0 cost", () => {
    const r = calculateCost({ provider: "openai", model: "gpt-4o", promptTokens: 0, completionTokens: 0 });
    expect(r.costCents).toBe(0);
  });

  it("负数 token: 抛 RangeError", () => {
    expect(() => calculateCost({ provider: "openai", model: "gpt-4o", promptTokens: -1, completionTokens: 0 })).toThrow();
    expect(() => calculateCost({ provider: "openai", model: "gpt-4o", promptTokens: 0, completionTokens: -1 })).toThrow();
  });

  it("formatCentsToYuan: 0 / 普通 / 大数", () => {
    expect(formatCentsToYuan(0)).toBe("¥0.00");
    expect(formatCentsToYuan(100)).toBe("¥1.00");
    expect(formatCentsToYuan(123)).toBe("¥1.23");
    expect(formatCentsToYuan(1000000)).toBe("¥10000.00");
  });

  it("aggregateCosts: 按 user 聚合", () => {
    const records = [
      mkRec(ALICE, "openai", 1000, 0, 2),
      mkRec(ALICE, "deepseek", 1000, 0, 1),
      mkRec(BOB, "openai", 2000, 0, 4),
    ];
    const r = aggregateCosts({ records, by: "user" });
    expect(r).toHaveLength(2);
    const alice = r.find((a) => a.key === ALICE)!;
    expect(alice.costCents).toBe(3);
    const bob = r.find((a) => a.key === BOB)!;
    expect(bob.costCents).toBe(4);
  });

  it("aggregateCosts: 按 provider 聚合", () => {
    const records = [
      mkRec(ALICE, "openai", 1000, 0, 2),
      mkRec(ALICE, "openai", 2000, 0, 4),
      mkRec(ALICE, "deepseek", 5000, 0, 1),
    ];
    const r = aggregateCosts({ records, by: "provider" });
    const o = r.find((a) => a.key === "openai")!;
    expect(o.costCents).toBe(6);
    const d = r.find((a) => a.key === "deepseek")!;
    expect(d.costCents).toBe(1);
  });

  it("formatCostReport: 含百分比 / 汇总", () => {
    const records = [mkRec(ALICE, "openai", 0, 0, 60), mkRec(ALICE, "deepseek", 0, 0, 40)];
    const agg = aggregateCosts({ records, by: "provider" });
    const report = formatCostReport({ aggregated: agg, period: "month" });
    expect(report.totalCostCents).toBe(100);
    expect(report.totalCostYuan).toBe("¥1.00");
    expect(report.rows).toHaveLength(2);
    const openaiRow = report.rows.find((r) => r.key === "openai")!;
    expect(openaiRow.sharePercent).toBe(60);
  });
});

/** 工具：造一条 cost log record（聚合用） */
function mkRec(
  userId: string,
  provider: "openai" | "anthropic" | "google" | "deepseek" | "minimax",
  promptTokens: number,
  completionTokens: number,
  costCents: number
) {
  return {
    id: "rec-" + Math.random().toString(36).slice(2, 9),
    userId,
    projectId: null,
    workflowId: null,
    nodeId: null,
    provider,
    model: "x",
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costCents,
    currency: "CNY",
    requestId: null,
    createdAt: new Date(),
  };
}

/* ====================================================== */
/*  Routes 测试（10, 真 HTTP）                             */
/* ====================================================== */

describe("cost-log HTTP routes", () => {
  it("POST /: 鉴权失败 → 401", async () => {
    const r = await httpJson("POST", "/api/v1/billing/cost-logs", {
      user_id: ALICE,
      provider: "openai",
      model: "gpt-4o",
      prompt_tokens: 100,
      completion_tokens: 50,
    });
    expect(r.status).toBe(401);
  });

  it("POST /: 写入成功 + 返回 201", async () => {
    const token = tokenFor(ALICE);
    const r = await httpJson(
      "POST",
      "/api/v1/billing/cost-logs",
      {
        user_id: ALICE,
        project_id: PROJ_P1,
        provider: "openai",
        model: "gpt-4o",
        prompt_tokens: 1000,
        completion_tokens: 500,
      },
      token
    );
    expect(r.status).toBe(201);
    expect(r.body.code).toBe(0);
    expect(r.body.data.totalTokens).toBe(1500);
    expect(r.body.data.costCents).toBeGreaterThan(0);
  });

  it("POST /: 跨用户写 → 403", async () => {
    const token = tokenFor(ALICE, 0);
    const r = await httpJson(
      "POST",
      "/api/v1/billing/cost-logs",
      {
        user_id: BOB,
        provider: "openai",
        model: "gpt-4o",
        prompt_tokens: 10,
        completion_tokens: 0,
      },
      token
    );
    expect(r.status).toBe(403);
  });

  it("POST /: zod 校验失败 → 400", async () => {
    const token = tokenFor(ALICE);
    const r = await httpJson(
      "POST",
      "/api/v1/billing/cost-logs",
      {
        user_id: ALICE,
        provider: "openai",
        model: "gpt-4o",
        prompt_tokens: -1,
        completion_tokens: 0,
      },
      token
    );
    expect(r.status).toBe(400);
  });

  it("GET /: 默认按自己 user 列表", async () => {
    const token = tokenFor(ALICE);
    await httpJson(
      "POST",
      "/api/v1/billing/cost-logs",
      { user_id: ALICE, provider: "openai", model: "gpt-4o", prompt_tokens: 100, completion_tokens: 50 },
      token
    );
    const r = await httpJson("GET", "/api/v1/billing/cost-logs", undefined, token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
    expect(r.body.data.length).toBe(1);
  });

  it("GET /: 跨用户查 → 403", async () => {
    const token = tokenFor(ALICE, 0);
    const r = await httpJson("GET", `/api/v1/billing/cost-logs?user_id=${BOB}`, undefined, token);
    expect(r.status).toBe(403);
  });

  it("GET /aggregate by=user 报表", async () => {
    const token = tokenFor(ALICE);
    await httpJson("POST", "/api/v1/billing/cost-logs",
      { user_id: ALICE, provider: "openai", model: "gpt-4o", prompt_tokens: 1000, completion_tokens: 0 }, token);
    await httpJson("POST", "/api/v1/billing/cost-logs",
      { user_id: ALICE, provider: "deepseek", model: "deepseek-chat", prompt_tokens: 5000, completion_tokens: 0 }, token);
    const r = await httpJson("GET", "/api/v1/billing/cost-logs/aggregate?by=user&period=month", undefined, token);
    expect(r.status).toBe(200);
    expect(r.body.data.totalCostCents).toBeGreaterThan(0);
    expect(r.body.data.totalCalls).toBe(2);
  });

  it("GET /aggregate by=project 报表", async () => {
    const token = tokenFor(ALICE);
    await httpJson("POST", "/api/v1/billing/cost-logs",
      { user_id: ALICE, project_id: PROJ_P1, provider: "openai", model: "gpt-4o", prompt_tokens: 100, completion_tokens: 0 }, token);
    const r = await httpJson(
      "GET",
      `/api/v1/billing/cost-logs/aggregate?by=project&project_id=${PROJ_P1}&period=month`,
      undefined,
      token
    );
    expect(r.status).toBe(200);
    expect(r.body.data.totalCalls).toBe(1);
  });

  it("GET /aggregate by=provider 非 admin → 403", async () => {
    const token = tokenFor(ALICE, 0);
    const r = await httpJson("GET", "/api/v1/billing/cost-logs/aggregate?by=provider", undefined, token);
    expect(r.status).toBe(403);
  });

  it("GET /aggregate by=provider admin → 200", async () => {
    const adminToken = tokenFor(ALICE, 9);
    // 先写一条
    await httpJson("POST", "/api/v1/billing/cost-logs",
      { user_id: ALICE, provider: "openai", model: "gpt-4o", prompt_tokens: 100, completion_tokens: 0 }, adminToken);
    const r = await httpJson("GET", "/api/v1/billing/cost-logs/aggregate?by=provider&period=all", undefined, adminToken);
    expect(r.status).toBe(200);
    expect(r.body.data.rows.length).toBeGreaterThan(0);
  });

  it("GET /by-provider 非 admin → 403", async () => {
    const token = tokenFor(ALICE, 0);
    const r = await httpJson("GET", "/api/v1/billing/cost-logs/by-provider", undefined, token);
    expect(r.status).toBe(403);
  });

  it("GET /by-provider admin → 200", async () => {
    const adminToken = tokenFor(ALICE, 9);
    const r = await httpJson("GET", "/api/v1/billing/cost-logs/by-provider", undefined, adminToken);
    expect(r.status).toBe(200);
  });
});

/* ====================================================== */
/*  集成测试（5）                                          */
/* ====================================================== */

describe("cost-log 集成: 3 user × 3 provider × 5 calls", () => {
  it("完整流程: 写日志 → 按 user 聚合 → 按 provider 聚合 → 报表", async () => {
    const adminToken = tokenFor(ALICE, 9);
    const users = [ALICE, BOB, CAROL];
    const providers: Array<{ provider: "openai" | "anthropic" | "deepseek"; model: string }> = [
      { provider: "openai", model: "gpt-4o" },
      { provider: "anthropic", model: "claude-3-5-sonnet" },
      { provider: "deepseek", model: "deepseek-chat" },
    ];
    let totalCalls = 0;
    let totalExpectedCents = 0;
    for (const u of users) {
      for (const p of providers) {
        for (let i = 0; i < 5; i++) {
          const promptTokens = 1000 + i * 100;
          const completionTokens = 200 + i * 50;
          const r = await httpJson(
            "POST",
            "/api/v1/billing/cost-logs",
            {
              user_id: u,
              project_id: i % 2 === 0 ? PROJ_P1 : PROJ_P2,
              workflow_id: `wf-${u.slice(-3)}-${i}`,
              provider: p.provider,
              model: p.model,
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              request_id: `req-${u.slice(-3)}-${i}-${p.provider}`,
            },
            adminToken
          );
          expect(r.status).toBe(201);
          totalCalls += 1;
          totalExpectedCents += r.body.data.costCents as number;
        }
      }
    }
    expect(totalCalls).toBe(45); // 3*3*5

    // 1) 按 user 聚合
    const userAgg = await httpJson(
      "GET",
      `/api/v1/billing/cost-logs/aggregate?by=user&user_id=${ALICE}&period=all`,
      undefined,
      adminToken
    );
    expect(userAgg.status).toBe(200);
    expect(userAgg.body.data.totalCalls).toBe(15); // 3 providers × 5
    expect(userAgg.body.data.totalCostCents).toBeGreaterThan(0);

    // 2) 按 provider 聚合（admin）
    const provAgg = await httpJson(
      "GET",
      "/api/v1/billing/cost-logs/aggregate?by=provider&period=all",
      undefined,
      adminToken
    );
    expect(provAgg.status).toBe(200);
    expect(provAgg.body.data.totalCalls).toBe(45);
    const rows = provAgg.body.data.rows as Array<{ key: string; costCents: number }>;
    const sumFromProvider = rows.reduce((s, r) => s + r.costCents, 0);
    // 注意：service.aggregate(by=provider) 会按 provider 重新分桶；
    // 总和应等于所有 record 之和
    expect(sumFromProvider).toBe(totalExpectedCents);

    // 3) 列表
    const list = await httpJson("GET", "/api/v1/billing/cost-logs?limit=10", undefined, adminToken);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(10);
  });

  it("service.recordCall + service.aggregate: 端到端", () => {
    costLogService.__reset();
    const records = [];
    for (let i = 0; i < 3; i++) {
      records.push(
        costLogService.recordCall({
          userId: ALICE,
          provider: "openai",
          model: "gpt-4o",
          promptTokens: 1000 * (i + 1),
          completionTokens: 500 * (i + 1),
        })
      );
    }
    expect(records).toHaveLength(3);
    const report = costLogService.aggregate({ by: "user", userId: ALICE, period: "all" });
    expect(report.totalCalls).toBe(3);
    // 1000+500, 2000+1000, 3000+1500 → 1500+3000+4500 = 9000 token
    expect(report.totalTokens).toBe(9000);
  });

  it("汇总 5 个 provider 价目表至少 10 个 model", () => {
    const all = ALL_PROVIDERS.flatMap((p) => listModels(p));
    expect(all.length).toBeGreaterThanOrEqual(10);
  });

  it("跨 provider 报表: 排序按 cost 降序", () => {
    costLogService.__reset();
    costLogService.recordCall({ userId: ALICE, provider: "openai", model: "gpt-4o", promptTokens: 1000, completionTokens: 1000 });
    costLogService.recordCall({ userId: ALICE, provider: "deepseek", model: "deepseek-chat", promptTokens: 1000, completionTokens: 1000 });
    costLogService.recordCall({ userId: ALICE, provider: "anthropic", model: "claude-3-5-sonnet", promptTokens: 1000, completionTokens: 1000 });
    const report = costLogService.aggregate({ by: "provider", period: "all" });
    expect(report.rows[0]!.costCents).toBeGreaterThanOrEqual(report.rows[1]!.costCents);
  });

  it("报表 sharePercent 合计接近 100", () => {
    costLogService.__reset();
    costLogService.recordCall({ userId: ALICE, provider: "openai", model: "gpt-4o", promptTokens: 100, completionTokens: 0 });
    costLogService.recordCall({ userId: ALICE, provider: "deepseek", model: "deepseek-chat", promptTokens: 100, completionTokens: 0 });
    const report = costLogService.aggregate({ by: "provider", period: "all" });
    const sum = report.rows.reduce((s, r) => s + r.sharePercent, 0);
    expect(Math.round(sum)).toBe(100);
  });
});
