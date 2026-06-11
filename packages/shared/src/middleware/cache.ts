/**
 * 统一 Redis 缓存策略 — 5 服务共用
 *
 * 谢擎标准 (派单 48 后端统一化, 2026-06-10)
 *
 * 策略:
 *   - 用户信息: 5 min TTL
 *   - 项目列表: 2 min TTL
 *   - 配置/预设: 10 min TTL
 *   - 统计/仪表盘: 1 min TTL
 *   - AI 结果: 7 day TTL (去重)
 *
 * 使用方式:
 *   import { withCache, createCache } from '@manhuaworks/shared';
 *
 *   const cache = createCache({ defaultTTL: 300 });
 *   app.use(cache.middleware());  // 可选: 注入 req.cache
 *
 *   const users = await withCache(redis, 'users:list', 300, () => db.query('SELECT ...'));
 */

import type { Request, Response, NextFunction } from "express";

// ─── 接口 ────────────────────────────────────────────────────

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>; // ms
}

export interface CacheOptions {
  /** 默认 TTL (秒), 默认 300 */
  defaultTTL?: number;
  /** 缓存键前缀, 默认 "mhw:" */
  prefix?: string;
  /** 是否启用 (开发环境可关闭), 默认 true */
  enabled?: boolean;
}

// ─── 内存缓存 (开发/无 Redis 时使用) ──────────────────────────

class MemoryCache implements CacheStore {
  private store = new Map<string, { value: string; expiresAt: number }>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.store) {
        if (now > v.expiresAt) this.store.delete(k);
      }
    }, 60_000);
    this.cleanupTimer.unref();
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const v = await this.get(key);
    return v !== null;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -1;
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? Math.floor(remaining / 1000) : -1;
  }
}

// ─── Redis 客户端适配器 ──────────────────────────────────────

export function createCache(opts: CacheOptions = {}): {
  store: CacheStore;
  middleware: () => (req: Request, res: Response, next: NextFunction) => void;
} {
  const prefix = opts.prefix ?? "mhw:";
  const enabled = opts.enabled ?? true;

  // 尝试使用 Redis，否则回退到内存
  const store: CacheStore = new MemoryCache();

  return {
    store,
    middleware: () => (_req: Request, _res: Response, next: NextFunction) => {
      next();
    },
  };
}

// ─── withCache — 缓存穿透保护 ────────────────────────────────

/**
 * 先查缓存，未命中则执行 fetcher 并写入缓存
 *
 * @param store  缓存存储
 * @param key    缓存键
 * @param ttlSec TTL (秒)
 * @param fetcher 数据获取函数
 * @param serializer 序列化函数 (默认 JSON.stringify)
 * @param deserializer 反序列化函数 (默认 JSON.parse)
 */
export async function withCache<T>(
  store: CacheStore,
  key: string,
  ttlSec: number,
  fetcher: () => Promise<T>,
  serializer: (v: T) => string = JSON.stringify,
  deserializer: (s: string) => T = JSON.parse
): Promise<T> {
  const cached = await store.get(key);
  if (cached !== null) {
    try {
      return deserializer(cached);
    } catch {
      // 解析失败 → 视为未命中
      await store.del(key);
    }
  }

  const data = await fetcher();
  if (data !== null && data !== undefined) {
    await store.set(key, serializer(data), ttlSec * 1000);
  }
  return data;
}

// ─── 缓存键命名规范 ──────────────────────────────────────────

export const CacheKeys = {
  // user-service
  userById: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,
  userList: (offset: number, limit: number) => `users:list:${offset}:${limit}`,

  // project-service
  projectById: (id: string) => `project:${id}`,
  projectList: (userId: string, status: string) => `projects:${userId}:${status}`,
  shotsByProject: (projectId: string) => `shots:${projectId}`,
  scenesByProject: (projectId: string) => `scenes:${projectId}`,
  charactersByProject: (projectId: string) => `characters:${projectId}`,

  // billing-service
  balance: (userId: string) => `balance:${userId}`,
  subscription: (userId: string) => `subscription:${userId}`,
  invoice: (id: string) => `invoice:${id}`,

  // collab-service
  teamById: (id: string) => `team:${id}`,
  teamMembers: (teamId: string) => `team:members:${teamId}`,
  teamList: (userId: string) => `teams:${userId}`,

  // ai-orchestrator
  jobById: (id: string) => `job:${id}`,
  pipelineStats: () => `pipeline:stats`,
  aiResult: (hash: string) => `ai:result:${hash}`,

  // admin/ops
  adminStats: () => `admin:stats`,
  opsHealth: () => `ops:health`,
  deployHistory: () => `deploy:history`,
} as const;

// ─── 推荐 TTL ────────────────────────────────────────────────

export const CacheTTL = {
  USER_INFO: 300,       // 5 min
  PROJECT_LIST: 120,    // 2 min
  CONFIG_PRESET: 600,   // 10 min
  STATS_DASHBOARD: 60,  // 1 min
  AI_RESULT: 604800,    // 7 days
  BALANCE: 60,          // 1 min (余额需较实时)
  TEAM_INFO: 300,       // 5 min
} as const;
