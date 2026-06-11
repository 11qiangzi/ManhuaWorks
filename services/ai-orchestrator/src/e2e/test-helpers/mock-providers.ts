/**
 * Mock 4 个 AI provider + ai-router 路由
 *
 * 目的：让 e2e 测试和 examples 在没有真实外网/真 API key 的情况下也能跑通整条链路。
 *
 * 设计：
 *   - mockAiRouter   → 模拟 ai-router 路由选择 + 4 个 provider 的响应
 *   - mockWorkflow   → 模拟 workflow-engine 7 个工作流的输出（shotboard/character/scene/image/tts/video/compose）
 *   - mockAsset      → 模拟 asset-service 落库 + URL 返回
 *   - mockByok       → 模拟 ai-keys-service 配额 + 用量记账
 *
 * 用法：
 *   import { mockProviders, installMocks, uninstallMocks } from './mock-providers.js';
 *   installMocks();
 *   await runNovelToDrama(input);   // 走 mock
 *   uninstallMocks();
 *
 * 可重入：每次 install 会保存原模块，uninstall 恢复。
 * 可重复：每次 install 会重置 fixture 状态。
 */

import { nanoid } from "nanoid";

import type { ProviderId } from "../../clients/ai-router.js";
import type {
  StoryboardInput,
  CharacterInput,
  SceneInput,
  ImageGenInput,
  TTSInput,
  VideoGenInput,
  ComposeInput,
  WorkflowResult,
} from "../../clients/workflow.js";
import type {
  CreateAssetRequest,
  AssetSummary,
  AssetKind,
} from "../../clients/asset.js";
import type { QuotaInfo, KeySummary } from "../../clients/byok.js";

// ---------------- 类型 ----------------

export interface MockFixture {
  /** 60s 漫剧的固定输出（保证 e2e 稳定） */
  novelText: string;
  shots: Array<{
    shotId: string;
    sceneId: string;
    shotType: string;
    cameraMove: string;
    description: string;
    dialogue?: string;
  }>;
  characters: Array<{ id: string; name: string; appearance: string; voiceTone: string }>;
  scenes: Array<{ shotId: string; location: string; description: string; characters: string[]; mood: string }>;
  imageUrls: string[];
  videoUrls: string[];
  audioUrl: string;
  finalVideoUrl: string;
  thumbnailUrl: string;
  subtitleText: string;
}

export interface MockOptions {
  /** 是否让 image-gen 第一次失败（用于测试重试） */
  failImageFirstAttempt?: boolean;
  /** 是否让 compose 失败 */
  failCompose?: boolean;
  /** 自定义 provider 路由：按 step 名强制 provider */
  routeOverride?: Partial<Record<string, ProviderId>>;
  /** 总成本倍数（用于模拟 BYOK vs platform 价格差异） */
  costMultiplier?: number;
  /** 网络延迟（ms） */
  latencyMs?: number;
}

// ---------------- 默认 fixture ----------------

function defaultFixture(): MockFixture {
  const shots = [
    { shotId: "s1", sceneId: "sc1", shotType: "wide", cameraMove: "static", description: "夜色中的便利店亮着冷白光", dialogue: "灯下有个人。" },
    { shotId: "s2", sceneId: "sc1", shotType: "medium", cameraMove: "push-in", description: "林夏攥着辞职信推门", dialogue: "我辞职。" },
    { shotId: "s3", sceneId: "sc1", shotType: "close-up", cameraMove: "static", description: "男人抬头", dialogue: "哦？为什么？" },
    { shotId: "s4", sceneId: "sc2", shotType: "over-shoulder", cameraMove: "pan", description: "林夏躲闪目光", dialogue: "我受够了。" },
    { shotId: "s5", sceneId: "sc2", shotType: "two-shot", cameraMove: "static", description: "两人对峙", dialogue: "那就走。" },
    { shotId: "s6", sceneId: "sc3", shotType: "wide", cameraMove: "pull-back", description: "林夏转身离去", dialogue: "再见。" },
  ];
  return {
    novelText: "",
    shots,
    characters: [
      { id: "c1", name: "林夏", appearance: "23 岁，长发披肩，穿着米白风衣", voiceTone: "略带哽咽" },
      { id: "c2", name: "黑风衣男人", appearance: "30 岁，棱角分明，眼神冷漠", voiceTone: "低沉沙哑" },
    ],
    scenes: shots.map((s) => ({
      shotId: s.shotId,
      location: s.shotId === "s1" ? "便利店门口" : s.shotId === "s6" ? "街道" : "便利店内",
      description: s.description,
      characters: ["c1", "c2"],
      mood: s.shotId === "s3" ? "紧张" : "压抑",
    })),
    imageUrls: shots.map((_, i) => `https://mock.local/img/frame-${i + 1}.png`),
    videoUrls: shots.map((_, i) => `https://mock.local/vid/clip-${i + 1}.mp4`),
    audioUrl: "https://mock.local/aud/dialogue.mp3",
    finalVideoUrl: "https://mock.local/out/episode-001.mp4",
    thumbnailUrl: "https://mock.local/out/episode-001-thumb.jpg",
    subtitleText: shots.map((s) => s.dialogue ?? "").filter(Boolean).join("\n"),
  };
}

// ---------------- 内部状态 ----------------

let installed = false;
let fixture: MockFixture = defaultFixture();
let options: MockOptions = {};
const callCounter = { imageGen: 0, videoGen: 0 };
const storedAssets: AssetSummary[] = [];
const usageLog: Array<{ userId: string; providerId: ProviderId; costUsd: number; runId: string; ts: number }> = [];

// ---------------- Fixture 控制 ----------------

export function setFixture(f: Partial<MockFixture>): void {
  fixture = { ...fixture, ...f };
}

export function setMockOptions(o: MockOptions): void {
  options = o;
  callCounter.imageGen = 0;
  callCounter.videoGen = 0;
}

export function getUsageLog(): readonly (typeof usageLog[number])[] {
  return usageLog;
}

export function getStoredAssets(): readonly AssetSummary[] {
  return storedAssets;
}

export function resetMockState(): void {
  fixture = defaultFixture();
  options = {};
  callCounter.imageGen = 0;
  callCounter.videoGen = 0;
  storedAssets.length = 0;
  usageLog.length = 0;
}

// ---------------- 路由逻辑 ----------------

function routeProvider(step: string, fallback: ProviderId): ProviderId {
  return options.routeOverride?.[step] ?? fallback;
}

async function mockDelay(): Promise<void> {
  const ms = options.latencyMs ?? 5;
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

function calcCost(step: string, baseCost: number): number {
  return baseCost * (options.costMultiplier ?? 1);
}

// ---------------- Mock 实现 ----------------

function makeWorkflowMock() {
  return {
    storyboard: async (input: StoryboardInput): Promise<WorkflowResult> => {
      await mockDelay();
      return {
        runId: `wf-storyboard-${nanoid(8)}`,
        kind: "storyboard",
        success: true,
        outputs: {
          runId: `wf-storyboard-${nanoid(8)}`,
          shots: fixture.shots,
          text: input.text.slice(0, 1500),
        },
      };
    },
    character: async (input: CharacterInput): Promise<WorkflowResult> => {
      await mockDelay();
      return {
        runId: `wf-character-${nanoid(8)}`,
        kind: "character",
        success: true,
        outputs: {
          runId: `wf-character-${nanoid(8)}`,
          characters: fixture.characters,
          artStyle: input.artStyle,
        },
      };
    },
    scene: async (input: SceneInput): Promise<WorkflowResult> => {
      await mockDelay();
      const found = fixture.scenes.find((s) => s.shotId === input.shot.shotId);
      return {
        runId: `wf-scene-${nanoid(8)}`,
        kind: "scene",
        success: true,
        outputs: {
          runId: `wf-scene-${nanoid(8)}`,
          sceneDesign: found ?? {
            location: "未知",
            description: input.shot.description,
            characters: [],
            mood: "中性",
          },
        },
      };
    },
    imageGen: async (input: ImageGenInput): Promise<WorkflowResult> => {
      await mockDelay();
      const counter = callCounter.imageGen++;
      if (options.failImageFirstAttempt && counter === 0) {
        throw new Error("mock: image-gen transient failure");
      }
      // 每次 image-gen 调用对应一个 shot；按 attempt 顺序轮询 urls
      const callIdx = options.failImageFirstAttempt && counter === 0 ? 0 : counter;
      const url = fixture.imageUrls[callIdx % fixture.imageUrls.length] ?? fixture.imageUrls[0]!;
      return {
        runId: `wf-image-${nanoid(8)}`,
        kind: "image-gen",
        success: true,
        outputs: {
          runId: `wf-image-${nanoid(8)}`,
          urls: [url],
        },
      };
    },
    tts: async (input: TTSInput): Promise<WorkflowResult> => {
      await mockDelay();
      return {
        runId: `wf-tts-${nanoid(8)}`,
        kind: "tts",
        success: true,
        outputs: {
          runId: `wf-tts-${nanoid(8)}`,
          audioUrl: fixture.audioUrl,
          provider: input.provider,
          text: input.text,
        },
      };
    },
    videoGen: async (input: VideoGenInput): Promise<WorkflowResult> => {
      await mockDelay();
      const counter = callCounter.videoGen++;
      const callIdx = counter;
      const url = fixture.videoUrls[callIdx % fixture.videoUrls.length] ?? fixture.videoUrls[0]!;
      return {
        runId: `wf-video-${nanoid(8)}`,
        kind: "video-gen",
        success: true,
        outputs: {
          runId: `wf-video-${nanoid(8)}`,
          url,
          durationSeconds: input.durationSeconds ?? 10,
        },
      };
    },
    compose: async (input: ComposeInput): Promise<WorkflowResult> => {
      await mockDelay();
      if (options.failCompose) {
        throw new Error("mock: compose ffmpeg failed");
      }
      return {
        runId: `wf-compose-${nanoid(8)}`,
        kind: "compose",
        success: true,
        outputs: {
          runId: `wf-compose-${nanoid(8)}`,
          finalVideoUrl: fixture.finalVideoUrl,
          thumbnailUrl: fixture.thumbnailUrl,
          durationSeconds: 60,
          subtitleBurnedIn: true,
          videoUrls: input.videoUrls,
          audioUrls: input.audioUrls ?? [],
        },
      };
    },
    getStatus: async (runId: string): Promise<{ runId: string; status: string; [k: string]: unknown }> => ({
      runId,
      status: "success",
      mocked: true,
    }),
    cancel: async (runId: string): Promise<{ runId: string; cancelled: boolean }> => ({
      runId,
      cancelled: true,
    }),
    resume: async (runId: string): Promise<{ runId: string; resumed: boolean; result: WorkflowResult }> => ({
      runId,
      resumed: true,
      result: { runId, kind: "storyboard", success: true, outputs: {} },
    }),
    health: async (): Promise<unknown> => ({ status: "ok", mocked: true }),
  };
}

function makeAssetMock() {
  return {
    create: async (req: CreateAssetRequest): Promise<{ ok: true; asset: AssetSummary }> => {
      await mockDelay();
      const asset: AssetSummary = {
        id: `asset-${nanoid(10)}`,
        kind: req.kind,
        projectId: req.projectId,
        userId: req.userId ?? "mock-user",
        url: typeof req.payload.url === "string" ? req.payload.url : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      storedAssets.push(asset);
      return { ok: true, asset };
    },
    get: async (id: string): Promise<AssetSummary> => {
      const a = storedAssets.find((x) => x.id === id);
      if (!a) throw new Error(`mock asset not found: ${id}`);
      return a;
    },
    listByProject: async (projectId: string, kind?: AssetKind): Promise<{ count: number; assets: AssetSummary[] }> => {
      const list = storedAssets.filter(
        (a) => a.projectId === projectId && (!kind || a.kind === kind),
      );
      return { count: list.length, assets: list };
    },
    health: async (): Promise<unknown> => ({ status: "ok", mocked: true }),
  };
}

function makeByokMock() {
  return {
    listByok: async (userId: string): Promise<{ count: number; keys: KeySummary[] }> => ({
      count: 0,
      keys: [],
    }),
    quota: async (userId: string): Promise<QuotaInfo> => ({
      userId,
      tier: "pro",
      monthlyQuotaUsd: 50,
      monthlyUsedUsd: 0,
      monthlyRemainingUsd: 50,
      resetAt: Date.now() + 30 * 24 * 3600 * 1000,
    }),
    recordUsage: async (
      userId: string,
      providerId: string,
      costUsd: number,
      runId: string,
    ): Promise<{ ok: true }> => {
      usageLog.push({ userId, providerId: providerId as ProviderId, costUsd, runId, ts: Date.now() });
      return { ok: true };
    },
    health: async (): Promise<unknown> => ({ status: "ok", mocked: true }),
  };
}

function makeAiRouterMock() {
  return {
    chat: async (req: { strategy?: string; [k: string]: unknown }): Promise<unknown> => {
      await mockDelay();
      return {
        id: `chat-${nanoid(8)}`,
        model: "mock-gpt-4",
        provider: routeProvider("chat", "deepseek"),
        content: "{\"mock\": true}",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        cost: calcCost("chat", 0.01),
        latencyMs: 50,
        usedByok: false,
      };
    },
    image: async (req: { strategy?: string; [k: string]: unknown }): Promise<unknown> => {
      await mockDelay();
      return {
        model: "mock-sdxl",
        provider: routeProvider("image-gen", "volcengine"),
        urls: ["https://mock.local/img/from-router.png"],
        cost: calcCost("image", 0.04),
        latencyMs: 200,
        usedByok: false,
      };
    },
    video: async (req: { strategy?: string; [k: string]: unknown }): Promise<unknown> => {
      await mockDelay();
      return {
        model: "mock-animatediff",
        provider: routeProvider("video-gen", "volcengine"),
        url: "https://mock.local/vid/from-router.mp4",
        cost: calcCost("video", 0.5),
        latencyMs: 2000,
        usedByok: false,
      };
    },
    health: async (): Promise<unknown> => ({ status: "ok", mocked: true }),
  };
}

// ---------------- 模块替换（fetch 拦截） ----------------

/**
 * 简化方案：劫持全局 fetch
 * - workflow client / asset client / byok client / ai-router client 都通过 fetch 调远端
 * - 我们劫持 fetch，对特定 URL 模式返回 mock JSON
 * - 不修改任何业务模块代码，所有 import 自动走 mock
 * - 优点：ESM 友好、零侵入、可重入
 */
export function installMocks(): void {
  if (installed) return;
  installed = true;
  resetMockState();

  // 存原 fetch
  if (!(globalThis as unknown as { __origFetch?: typeof fetch }).__origFetch) {
    (globalThis as unknown as { __origFetch: typeof fetch }).__origFetch = globalThis.fetch;
  }
  const origFetch = (globalThis as unknown as { __origFetch: typeof fetch }).__origFetch!;

  const mockWorkflow = makeWorkflowMock();
  const mockAsset = makeAssetMock();
  const mockByok = makeByokMock();
  const mockAiRouter = makeAiRouterMock();

  async function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const method = (init?.method ?? "GET").toUpperCase();

    // ---- workflow-engine ----
    if (url.includes("/v1/workflow/storyboard")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as StoryboardInput;
      const r = await mockWorkflow.storyboard(body);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/v1/workflow/character")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as CharacterInput;
      const r = await mockWorkflow.character(body);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/v1/workflow/scene")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as SceneInput;
      const r = await mockWorkflow.scene(body);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/v1/workflow/image-gen")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as ImageGenInput;
      try {
        const r = await mockWorkflow.imageGen(body);
        return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { "content-type": "application/json" } });
      }
    }
    if (url.includes("/v1/workflow/tts")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as TTSInput;
      const r = await mockWorkflow.tts(body);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/v1/workflow/video-gen")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as VideoGenInput;
      const r = await mockWorkflow.videoGen(body);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/v1/workflow/compose")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as ComposeInput;
      try {
        const r = await mockWorkflow.compose(body);
        return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { "content-type": "application/json" } });
      }
    }
    if (/\/v1\/workflow\/[^/]+$/.test(url) && method === "GET") {
      const m = url.match(/\/v1\/workflow\/([^/]+)$/);
      const r = await mockWorkflow.getStatus(m![1]!);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (/\/v1\/workflow\/[^/]+\/cancel$/.test(url)) {
      const m = url.match(/\/v1\/workflow\/([^/]+)\/cancel$/);
      const r = await mockWorkflow.cancel(m![1]!);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (/\/v1\/workflow\/[^/]+\/resume$/.test(url)) {
      const m = url.match(/\/v1\/workflow\/([^/]+)\/resume$/);
      const r = await mockWorkflow.resume(m![1]!);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/v1/workflow/health") || url.includes("/workflow/health")) {
      const r = await mockWorkflow.health();
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }

    // ---- asset-service ----
    if (url.includes("/v1/assets") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as CreateAssetRequest;
      const r = await mockAsset.create(body);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (/\/v1\/assets\/[^?]+$/.test(url) && method === "GET") {
      const m = url.match(/\/v1\/assets\/([^?]+)$/);
      try {
        const r = await mockAsset.get(m![1]!);
        return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
      } catch {
        return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "content-type": "application/json" } });
      }
    }
    if (url.includes("/v1/assets?") && method === "GET") {
      const u = new URL(url);
      const projectId = u.searchParams.get("projectId") ?? "";
      const kind = u.searchParams.get("kind") ?? undefined;
      const r = await mockAsset.listByProject(projectId, kind as AssetKind | undefined);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/asset/health")) {
      const r = await mockAsset.health();
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }

    // ---- ai-keys-service (BYOK) ----
    if (url.includes("/v1/keys?") && method === "GET") {
      const u = new URL(url);
      const userId = u.searchParams.get("ownerUserId") ?? "unknown";
      const r = await mockByok.listByok(userId);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/v1/keys/quota") && method === "GET") {
      const u = new URL(url);
      const userId = u.searchParams.get("userId") ?? "unknown";
      const r = await mockByok.quota(userId);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/v1/keys/usage") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { userId: string; providerId: string; costUsd: number; runId: string };
      const r = await mockByok.recordUsage(body.userId, body.providerId, body.costUsd, body.runId);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/ai-keys/health")) {
      const r = await mockByok.health();
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }

    // ---- ai-router ----
    if (url.endsWith("/v1/chat") || url.includes("/v1/chat?")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { strategy?: string };
      const r = await mockAiRouter.chat(body);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/v1/image") || url.includes("/v1/image?")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { strategy?: string };
      const r = await mockAiRouter.image(body);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/v1/video") || url.includes("/v1/video?")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { strategy?: string };
      const r = await mockAiRouter.video(body);
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/ai-router/health")) {
      const r = await mockAiRouter.health();
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }

    // 其余放行到真实 fetch（避免误伤）
    return origFetch(input, init);
  }

  globalThis.fetch = mockFetch as typeof fetch;

}

export function uninstallMocks(): void {
  if (!installed) return;
  installed = false;
  const orig = (globalThis as unknown as { __origFetch?: typeof fetch }).__origFetch;
  if (orig) globalThis.fetch = orig;
}

/** 内部访问：让 test-helpers 拿到 mock 客户端做断言（不走 fetch） */
export const mockProviders = {
  workflow: makeWorkflowMock,
  asset: makeAssetMock,
  byok: makeByokMock,
  aiRouter: makeAiRouterMock,
} as const;
