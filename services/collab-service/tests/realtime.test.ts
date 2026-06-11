/**
 * RealtimeService 单元测试 (不连真实 redis, 用桩)
 */
import { describe, it, expect, beforeEach } from "vitest";

// 直接 mock redis 模块，避免真实连接
import { vi } from "vitest";

vi.mock("../src/config/redis.js", () => {
  return {
    redisPub: { publish: vi.fn().mockResolvedValue(1) },
    redisSub: { on: vi.fn(), psubscribe: vi.fn().mockResolvedValue(1) },
    redisCmd: {
      hset: vi.fn().mockResolvedValue(1),
      hgetall: vi.fn().mockResolvedValue({}),
      expire: vi.fn().mockResolvedValue(1),
      sadd: vi.fn().mockResolvedValue(1),
      srem: vi.fn().mockResolvedValue(1),
      smembers: vi.fn().mockResolvedValue([]),
      del: vi.fn().mockResolvedValue(1),
      keys: vi.fn().mockResolvedValue([]),
      pipeline: vi.fn(() => ({ exec: vi.fn().mockResolvedValue([]) })),
    },
    REDIS_CHANNELS: {
      project: (id: string) => `collab:project:${id}`,
      user: (id: string) => `collab:user:${id}`,
      global: "collab:global",
    },
  };
});

import { RealtimeService } from "../src/services/realtimeService.js";

describe("RealtimeService", () => {
  let svc: RealtimeService;
  beforeEach(() => {
    svc = new RealtimeService();
  });

  it("注册连接, 索引可查", () => {
    const fakeSocket = { readyState: 1, OPEN: 1, send: vi.fn() } as never;
    const meta = svc.register({
      id: "c1",
      userId: "u1",
      projectId: "p1",
      clientId: "web",
      socket: fakeSocket,
      ip: null,
      userAgent: null,
    });
    expect(meta.id).toBe("c1");
    expect(svc.stats().connections).toBe(1);
    expect(svc.stats().projects).toBe(1);
    expect(svc.stats().users).toBe(1);
    expect(svc.listProjectConnections("p1").length).toBe(1);
  });

  it("注销连接, 索引清理", () => {
    const fakeSocket = { readyState: 1, OPEN: 1, send: vi.fn() } as never;
    svc.register({ id: "c1", userId: "u1", projectId: "p1", clientId: "web", socket: fakeSocket, ip: null, userAgent: null });
    svc.unregister("c1");
    expect(svc.stats().connections).toBe(0);
    expect(svc.stats().projects).toBe(0);
  });

  it("切换项目", () => {
    const fakeSocket = { readyState: 1, OPEN: 1, send: vi.fn() } as never;
    svc.register({ id: "c1", userId: "u1", projectId: "p1", clientId: "web", socket: fakeSocket, ip: null, userAgent: null });
    svc.setProject("c1", "p2");
    expect(svc.listProjectConnections("p1").length).toBe(0);
    expect(svc.listProjectConnections("p2").length).toBe(1);
  });

  it("broadcastToProject 调用 redisPub.publish", async () => {
    const { redisPub } = await import("../src/config/redis.js");
    svc.broadcastToProject("p1", { type: "test", event: "x", data: 1 });
    expect(redisPub.publish).toHaveBeenCalled();
  });
});
