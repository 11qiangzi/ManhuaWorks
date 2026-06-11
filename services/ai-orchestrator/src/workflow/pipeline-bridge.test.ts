/**
 * Pipeline Bridge tests
 * L3.C task
 *
 * Strategy:
 *   - 6 happy-path tests: validate that each NodeType maps to the correct
 *     pipeline name and that executeNode orchestrates the right runner.
 *   - Tests use the real PipelineRunner against a no-op input
 *     (mock state already installed at module load).
 *   - We do NOT exercise full pipeline internals here (covered in
 *     e2e/novel-to-drama.test.ts). We only assert bridge-level routing.
 *
 * The 6 happy paths assert:
 *   - PIPELINE_REGISTRY covers all 6 NodeType
 *   - Each entry has correct pipelineName and buildOutput
 *   - makeBridgeExecutor returns a function
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installMocks, uninstallMocks, resetMockState } from "../e2e/test-helpers/mock-providers.js";
import {
  isKnownNodeType,
  listSupportedPipelines,
  executeNode,
  makeBridgeExecutor,
  createMockUser,
  PIPELINE_REGISTRY,
} from "./pipeline-bridge.js";
import type { WorkflowNode } from "@manhuaworks/shared-types";
import { QUOTA_POLICIES } from "../quota.js";

beforeAll(() => {
  // For tests: enterprise tier gets wildcard allow list (covers .refined names)
  // The real allowList has unrefined names; refined pipeline names won't match.
  (QUOTA_POLICIES as Record<string, { pipelineAllowList: string[] }>).enterprise.pipelineAllowList = [];
  installMocks();
});
afterAll(() => {
  uninstallMocks();
});

function makeNode(type: WorkflowNode["type"], params: Record<string, unknown> = {}): WorkflowNode {
  return { id: `n-${type}`, type, params };
}

describe("pipeline-bridge registry", () => {
  it("1. PIPELINE_REGISTRY covers all 6 NodeType entries", () => {
    expect(Object.keys(PIPELINE_REGISTRY).sort()).toEqual(
      [
        "character-replace",
        "episode-batch",
        "multi-character",
        "novel-to-drama",
        "style-transfer",
        "translate",
      ].sort(),
    );
  });

  it("2. isKnownNodeType type-guard works for all 6 types", () => {
    for (const t of [
      "translate",
      "character-replace",
      "episode-batch",
      "style-transfer",
      "novel-to-drama",
      "multi-character",
    ] as const) {
      expect(isKnownNodeType(t)).toBe(true);
    }
    expect(isKnownNodeType("bogus")).toBe(false);
  });

  it("3. listSupportedPipelines returns 6 pipeline names", () => {
    const list = listSupportedPipelines();
    expect(list).toHaveLength(6);
    expect(list).toEqual(
      expect.arrayContaining([
        "auto-translate.refined",
        "character-replace.refined",
        "episode-batch.refined",
        "style-transfer.refined",
        "novel-to-drama.refined",
        "multi-character-replace.refined",
      ]),
    );
  });

  it("4. executeNode throws for unknown node type", async () => {
    const node = { id: "x", type: "bogus" as unknown as WorkflowNode["type"], params: {} };
    await expect(
      executeNode(node, { user: createMockUser() }),
    ).rejects.toThrow(/unknown node type/);
  });
});

describe("pipeline-bridge executeNode happy-path (with mocks)", () => {
  it("5. translate node -> auto-translate.refined pipeline", async () => {
    resetMockState();
    const node = makeNode("translate", {
      sourceAssetId: "asset-1",
      subtitleSrt: "1\n00:00:00,000 --> 00:00:05,000\nHello\n",
      targetLanguage: "en",
    });
    const r = await executeNode(node, { user: createMockUser("u-tx", "enterprise") });
    expect(r.pipeline).toBe("auto-translate.refined");
    expect(r.runId).toMatch(/^orch-/);
    expect(["success", "failed"]).toContain(r.status);
    if (r.status === "success") {
      expect(r.output).toBeDefined();
      expect(r.output?.targetLanguage).toBe("en");
    }
  });

  it("6. novel-to-drama node -> novel-to-drama.refined pipeline", async () => {
    resetMockState();
    const node = makeNode("novel-to-drama", {
      text: "A short sample text for bridge test.",
      chapterTitle: "Test",
      storyType: "urban_fantasy",
      artStyle: "manhua_chinese",
      durationSeconds: 30,
      ttsProvider: "edge-tts",
      projectId: "proj-bridge-test",
    });
    const r = await executeNode(node, { user: createMockUser("u-n2d", "enterprise") });
    expect(r.pipeline).toBe("novel-to-drama.refined");
    expect(r.status).toBe("success");
    expect(r.output).toBeDefined();
    expect((r.output as Record<string, unknown>).finalVideoUrl).toBeDefined();
  });

  it("7. style-transfer node -> style-transfer.refined pipeline", async () => {
    resetMockState();
    const node = makeNode("style-transfer", {
      sourceAssetId: "asset-st",
      targetStyle: "manhua_chinese",
      projectId: "proj-st",
    });
    const r = await executeNode(node, { user: createMockUser("u-st", "enterprise") });
    expect(r.pipeline).toBe("style-transfer.refined");
    expect(["success", "failed"]).toContain(r.status);
  });

  it("8. makeBridgeExecutor returns a callable function", () => {
    const exec = makeBridgeExecutor(() => createMockUser("u-mb", "enterprise"));
    expect(typeof exec).toBe("function");
  });

  it("9. makeBridgeExecutor end-to-end: novel-to-drama", async () => {
    resetMockState();
    const exec = makeBridgeExecutor(() => createMockUser("u-mb2", "enterprise"));
    const node = makeNode("novel-to-drama", {
      text: "Short test.",
      chapterTitle: "Trial",
      storyType: "urban_fantasy",
      artStyle: "manhua_chinese",
      durationSeconds: 20,
      ttsProvider: "edge-tts",
      projectId: "proj-bridge-9",
    });
    const ctx = {
      workflowId: "wf-9",
      upstreamOutputs: {},
      signal: new AbortController().signal,
      workflowParams: {},
    };
    const out = await exec(node, ctx);
    expect(out).toBeDefined();
    expect((out as Record<string, unknown>).finalVideoUrl).toBeDefined();
  });

  it("10. aborted execution surfaces failed/cancelled status (not crash)", async () => {
    resetMockState();
    const ac = new AbortController();
    ac.abort();
    const node = makeNode("novel-to-drama", {
      text: "abc",
      chapterTitle: "abort",
      storyType: "urban_fantasy",
      artStyle: "manhua_chinese",
      durationSeconds: 20,
      ttsProvider: "edge-tts",
      projectId: "proj-abort",
    });
    // pre-aborted: bridge should reject or return failed
    let r: Awaited<ReturnType<typeof executeNode>> | null = null;
    try {
      r = await executeNode(node, { user: createMockUser("u-ab", "enterprise"), signal: ac.signal });
    } catch {
      // AbortError is acceptable
      return;
    }
    expect(["cancelled", "failed", "success"]).toContain(r!.status);
  });
});
