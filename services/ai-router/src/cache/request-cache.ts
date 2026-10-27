// 请求级缓存：相同 prompt 30 分钟内复用
// 优先使用 Redis；REDIS_URL 未配置时回退到内存 Map。

import { config } from "../config.js";
import type Redis from "ioredis";
import { createHash } from "node:crypto";

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheBackend {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  size(): Promise<number>;
}

class MemoryCache implements CacheBackend {
  private store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async size(): Promise<number> {
    return this.store.size;
  }
}

class RedisCache implements CacheBackend {
  constructor(private redis: Redis) {}

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CacheEntry<T>;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlSeconds * 1000 };
    await this.redis.set(key, JSON.stringify(entry), "EX", ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async size(): Promise<number> {
    return this.redis.dbsize();
  }
}

class RequestCache {
  private backend: CacheBackend;
  private redis: Redis | null = null;

  constructor() {
    if (config.redisUrl) {
      try {
        // 动态 import ioredis（启动失败时回退到内存）
        // 这里用 require 异步方式避免在编译时强依赖
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const IORedis = (globalThis as { __ioredis__?: typeof Redis }).__ioredis__;
        if (IORedis) {
          this.redis = new IORedis(config.redisUrl, { lazyConnect: true });
          this.backend = new RedisCache(this.redis);
          return;
        }
      } catch {
        // fallthrough
      }
    }
    this.backend = new MemoryCache();
  }

  /** 尝试用 ioredis 重新装配（外部 bootstrap 调用） */
  attachRedis(redis: Redis): void {
    this.redis = redis;
    this.backend = new RedisCache(redis);
  }

  /** 计算稳定的缓存 key */
  static keyFor(scope: string, payload: unknown): string {
    const json = JSON.stringify(payload, (_key, value) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce<Record<string, unknown>>((sorted, k) => {
            sorted[k] = (value as Record<string, unknown>)[k];
            return sorted;
          }, {});
      }
      return value;
    });
    const hash = createHash("sha256").update(`${scope}:${json}`).digest("hex");
    return `ai-router:cache:${scope}:${hash}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = await this.backend.get<T>(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      await this.backend.delete(key);
      return null;
    }
    return entry.value;
  }

  async set<T>(key: string, value: T, ttlSeconds: number = config.cacheTtlSeconds): Promise<void> {
    await this.backend.set(key, value, ttlSeconds);
  }

  async size(): Promise<number> {
    return this.backend.size();
  }
}

export const requestCache = new RequestCache();
export { RequestCache, MemoryCache, RedisCache };
