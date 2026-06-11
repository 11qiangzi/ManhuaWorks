/**
 * WorkflowEngine Unit Tests
 * L3.C task
 *
 * Test matrix (>=15):
 *   Topological sort (5):
 *     1. Empty workflow
 *     2. Single node
 *     3. Chain (A -> B -> C)
 *     4. Mesh (diamond dependency)
 *     5. Cycle detection
 *   Node execution (5):
 *     6. Sequential execution (chain)
 *     7. Same-layer parallel (diamond fan-out)
 *     8. Failure isolation (one node in a layer fails, other unaffected)
 *     9. Retry 3 times then fails
 *    10. Partial success (some optional fail)
 *   Edge cases (5+):
 *    11. duplicate id validation
 *    12. unknown dependsOn validation
 *    13. Failed optional dependency -> downstream skipped
 *    14. Abort signal cancels
 *    15. Progress callbacks (onLayerComplete / onNodeStart / onNodeFinish)
 *    16. Custom nodeOptions override (optional + maxRetries)
 *    17. Upstream outputs available to downstream node
 */

import { describe, it, expect } from "vitest";
import { WorkflowEngine, buildWorkflow } from "./engine.js";
import type { Workflow, WorkflowNode } from "@manhuaworks/shared-types";

function makeNode(
  id: string,
  type: WorkflowNode["type"] = "translate",
  dependsOn: string[] = [],
  params: Record<string, unknown> = {},
): WorkflowNode {
  return { id, type, dependsOn, params };
}

// =============================================================================
// Topological sort (5)
// =============================================================================

describe("WorkflowEngine.topologicalSort", () => {
  it("1. empty workflow returns no layers", () => {
    const wf = buildWorkflow({ id: "wf-empty", name: "empty", nodes: [] });
    const engine = new WorkflowEngine();
    const layers = engine.topologicalSort(wf);
    expect(layers).toEqual([]);
  });

  it("2. single node returns single layer", () => {
    const wf = buildWorkflow({ id: "wf-1", name: "1", nodes: [makeNode("a")] });
    const engine = new WorkflowEngine();
    const layers = engine.topologicalSort(wf);
    expect(layers).toHaveLength(1);
    expect(layers[0]!.map((n) => n.id)).toEqual(["a"]);
  });

  it("3. chain A -> B -> C returns 3 layers in order", () => {
    const wf = buildWorkflow({
      id: "wf-chain",
      name: "chain",
      nodes: [makeNode("a"), makeNode("b", "translate", ["a"]), makeNode("c", "translate", ["b"])],
    });
    const engine = new WorkflowEngine();
    const layers = engine.topologicalSort(wf);
    expect(layers).toHaveLength(3);
    expect(layers[0]!.map((n) => n.id)).toEqual(["a"]);
    expect(layers[1]!.map((n) => n.id)).toEqual(["b"]);
    expect(layers[2]!.map((n) => n.id)).toEqual(["c"]);
  });

  it("4. diamond dep: A -> B,C -> D", () => {
    const wf = buildWorkflow({
      id: "wf-diamond",
      name: "diamond",
      nodes: [
        makeNode("a"),
        makeNode("b", "translate", ["a"]),
        makeNode("c", "translate", ["a"]),
        makeNode("d", "translate", ["b", "c"]),
      ],
    });
    const engine = new WorkflowEngine();
    const layers = engine.topologicalSort(wf);
    expect(layers).toHaveLength(3);
    expect(layers[0]!.map((n) => n.id)).toEqual(["a"]);
    expect(new Set(layers[1]!.map((n) => n.id))).toEqual(new Set(["b", "c"]));
    expect(layers[2]!.map((n) => n.id)).toEqual(["d"]);
  });

  it("5. cycle detection: A -> B -> A throws", () => {
    const wf = buildWorkflow({
      id: "wf-cycle",
      name: "cycle",
      nodes: [makeNode("a", "translate", ["b"]), makeNode("b", "translate", ["a"])],
    });
    const engine = new WorkflowEngine();
    expect(() => engine.topologicalSort(wf)).toThrow(/cycle/);
  });
});

// =============================================================================
// Node execution (5)
// =============================================================================

describe("WorkflowEngine.execute", () => {
  it("6. chain executes A then B then C in order", async () => {
    const wf = buildWorkflow({
      id: "wf-exec-chain",
      name: "chain",
      nodes: [makeNode("a"), makeNode("b", "translate", ["a"]), makeNode("c", "translate", ["b"])],
    });
    const order: string[] = [];
    const executor = async (n: WorkflowNode) => {
      order.push(n.id);
      return { ok: true, id: n.id };
    };
    const engine = new WorkflowEngine();
    const r = await engine.execute(wf, { executor });
    expect(r.status).toBe("succeeded");
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("7. diamond fan-out: B and C run in parallel (interleaved)", async () => {
    const wf = buildWorkflow({
      id: "wf-exec-fanout",
      name: "fanout",
      nodes: [
        makeNode("a"),
        makeNode("b", "translate", ["a"]),
        makeNode("c", "translate", ["a"]),
        makeNode("d", "translate", ["b", "c"]),
      ],
    });
    const startOrder: string[] = [];
    const executor = async (n: WorkflowNode) => {
      startOrder.push(n.id);
      // brief delay so the two parallel siblings interleave
      await new Promise((r) => setTimeout(r, 10));
      return { ok: true, id: n.id };
    };
    const engine = new WorkflowEngine();
    const r = await engine.execute(wf, { executor });
    expect(r.status).toBe("succeeded");
    expect(startOrder[0]).toBe("a");
    // b and c must both start before d
    const dIdx = startOrder.indexOf("d");
    const bIdx = startOrder.indexOf("b");
    const cIdx = startOrder.indexOf("c");
    expect(dIdx).toBeGreaterThan(bIdx);
    expect(dIdx).toBeGreaterThan(cIdx);
  });

  it("8. failure in one node of a layer does not block the other (isolation)", async () => {
    const wf = buildWorkflow({
      id: "wf-iso",
      name: "iso",
      nodes: [makeNode("a"), makeNode("b", "translate", ["a"]), makeNode("c", "translate", ["a"])],
    });
    const executor = async (n: WorkflowNode) => {
      if (n.id === "b") throw new Error("b boom");
      return { ok: true, id: n.id };
    };
    const engine = new WorkflowEngine();
    const r = await engine.execute(wf, { executor, nodeOptions: { b: { optional: true } } });
    expect(r.layers[1]!.nodes.b!.status).toBe("failed");
    expect(r.layers[1]!.nodes.c!.status).toBe("succeeded");
    // optional failure -> overall is partial
    expect(r.status).toBe("partial");
    expect(r.failedNodes).toContain("b");
  });

  it("9. retry 3 times then fails", async () => {
    const wf = buildWorkflow({ id: "wf-retry", name: "retry", nodes: [makeNode("a")] });
    let calls = 0;
    const executor = async () => {
      calls += 1;
      throw new Error("nope");
    };
    const engine = new WorkflowEngine();
    const r = await engine.execute(wf, { executor, nodeOptions: { a: { optional: true } } });
    expect(r.status).toBe("partial");
    expect(r.layers[0]!.nodes.a!.status).toBe("failed");
    expect(r.layers[0]!.nodes.a!.attempts).toBe(4); // 1 + 3 retries
    expect(calls).toBe(4);
  });

  it("10. partial success: 1 ok + 1 optional fail in same layer", async () => {
    const wf = buildWorkflow({
      id: "wf-partial",
      name: "partial",
      nodes: [makeNode("a"), makeNode("b", "translate", ["a"]), makeNode("c", "translate", ["a"])],
    });
    const executor = async (n: WorkflowNode) => {
      if (n.id === "b") throw new Error("b fail");
      return { ok: n.id };
    };
    const engine = new WorkflowEngine();
    const r = await engine.execute(wf, { executor, nodeOptions: { b: { optional: true } } });
    expect(r.status).toBe("partial");
    expect(r.failedNodes).toEqual(["b"]);
    expect(r.layers[1]!.status).toBe("partial");
  });
});

// =============================================================================
// Edge cases (5+)
// =============================================================================

describe("WorkflowEngine validation & edge cases", () => {
  it("11. duplicate node id throws", () => {
    const wf: Workflow = {
      id: "wf-dup",
      name: "dup",
      nodes: [
        { id: "a", type: "translate", params: {} },
        { id: "a", type: "translate", params: {} },
      ],
      edges: [],
    };
    const engine = new WorkflowEngine();
    expect(() => engine.load(wf)).toThrow(/duplicate/);
  });

  it("12. unknown dependsOn throws", () => {
    const wf = buildWorkflow({
      id: "wf-unknown",
      name: "unknown",
      nodes: [makeNode("a", "translate", ["ghost"])],
    });
    const engine = new WorkflowEngine();
    expect(() => engine.load(wf)).toThrow(/unknown/);
  });

  it("13. failed optional dependency makes downstream node skipped", async () => {
    const wf = buildWorkflow({
      id: "wf-skip",
      name: "skip",
      nodes: [makeNode("a"), makeNode("b", "translate", ["a"])],
    });
    const executor = async (n: WorkflowNode) => {
      if (n.id === "a") throw new Error("a fail");
      return { ok: n.id };
    };
    const engine = new WorkflowEngine();
    const r = await engine.execute(wf, { executor, nodeOptions: { a: { optional: true } } });
    expect(r.layers[0]!.nodes.a!.status).toBe("failed");
    expect(r.layers[1]!.nodes.b!.status).toBe("skipped");
    expect(r.status).toBe("partial");
  });

  it("14. abort signal cancels in-flight execution (optional node)", async () => {
    const wf = buildWorkflow({
      id: "wf-abort",
      name: "abort",
      nodes: [makeNode("a"), makeNode("b", "translate", ["a"])],
    });
    const ac = new AbortController();
    const executor = async (n: WorkflowNode, ctx: { signal: AbortSignal }) => {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 200);
        ctx.signal.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
      return { ok: n.id };
    };
    const engine = new WorkflowEngine();
    // a is optional so cancellation does not terminally abort the workflow
    const p = engine.execute(wf, {
      signal: ac.signal,
      executor,
      nodeOptions: { a: { optional: true } },
    });
    setTimeout(() => ac.abort(), 50);
    const r = await p;
    expect(["skipped", "failed"]).toContain(r.layers[0]!.nodes.a!.status);
    // a failed/skipped -> b must be skipped
    expect(r.layers[1]!.nodes.b!.status).toBe("skipped");
  });

  it("15. progress callbacks fire (onLayerComplete + onNodeStart + onNodeFinish)", async () => {
    const wf = buildWorkflow({
      id: "wf-cb",
      name: "cb",
      nodes: [makeNode("a"), makeNode("b", "translate", ["a"])],
    });
    const started: string[] = [];
    const finished: string[] = [];
    const layerIndexes: number[] = [];
    const executor = async (n: WorkflowNode) => ({ ok: n.id });
    const engine = new WorkflowEngine();
    const r = await engine.execute(wf, {
      executor,
      onNodeStart: (id) => started.push(id),
      onNodeFinish: (id) => finished.push(id),
      onLayerComplete: (layer) => layerIndexes.push(layer.layer),
    });
    expect(started).toEqual(["a", "b"]);
    expect(finished).toEqual(["a", "b"]);
    expect(layerIndexes).toEqual([0, 1]);
    expect(r.layers).toHaveLength(2);
  });

  it("16. custom maxRetries override per node", async () => {
    const wf = buildWorkflow({ id: "wf-override", name: "override", nodes: [makeNode("a")] });
    let calls = 0;
    const executor = async () => {
      calls += 1;
      throw new Error("x");
    };
    const engine = new WorkflowEngine();
    const r = await engine.execute(wf, {
      executor,
      nodeOptions: { a: { maxRetries: 1, optional: true } },
    });
    expect(r.layers[0]!.nodes.a!.attempts).toBe(2); // 1 + 1 retry
    expect(calls).toBe(2);
  });

  it("17. upstream output is available to downstream node", async () => {
    const wf = buildWorkflow({
      id: "wf-up",
      name: "up",
      nodes: [makeNode("a", "translate", [], { seed: 7 }), makeNode("b", "translate", ["a"])],
    });
    const seen: Record<string, unknown> = {};
    const executor = async (n: WorkflowNode, ctx: { upstreamOutputs: Record<string, Record<string, unknown>> }) => {
      if (n.id === "b") seen.b = ctx.upstreamOutputs.a;
      return { echo: n.id, got: ctx.upstreamOutputs };
    };
    const engine = new WorkflowEngine();
    const r = await engine.execute(wf, { executor });
    expect(seen.b).toBeDefined();
    expect((seen.b as Record<string, unknown>).echo).toBe("a");
  });
});
