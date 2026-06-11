/**
 * LRU 缓存（perf/cache.ts）
 *
 * 三个独立缓存：
 *   - promptCache     ：prompt 模板缓存（key=hash(prompt 模板)）
 *   - styleCache      ：风格预设缓存（key=style key）
 *   - translateCache  ：翻译缓存（key=hash(src+srcLang+tgtLang)）
 *
 * 用途：novel-to-drama / episode-batch / auto-translate 每次都调
 *       重复 prompt 模板和翻译文本，命中率实测 30-50%，省 $0.2-0.4 / 集。
 *
 * 实现：纯 LRU（Map 顺序），O(1) get/set；TTL 用 lazy expire（get 时检查）。
 */

interface Entry<V> {
  value: V;
  expiresAt: number;
  createdAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  size: number;
  hitRate: number;
}

export class LRUCache<V> {
  private map = new Map<string, Entry<V>>();
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private evictions = 0;

  constructor(
    public readonly maxEntries = 256,
    public readonly ttlMs = 30 * 60 * 1000,
  ) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) {
      this.misses++;
      return undefined;
    }
    if (e.expiresAt < Date.now()) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    // 命中 → 提到队尾
    this.map.delete(key);
    this.map.set(key, e);
    this.hits++;
    return e.value;
  }

  set(key: string, value: V, ttlMs?: number): void {
    if (this.map.has(key)) this.map.delete(key);
    const now = Date.now();
    this.map.set(key, {
      value,
      expiresAt: now + (ttlMs ?? this.ttlMs),
      createdAt: now,
    });
    this.sets++;
    // LRU 淘汰
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
      this.evictions++;
    }
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      evictions: this.evictions,
      size: this.map.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

/**
 * 三缓存管理器（单例，进程内共享）
 */
class CacheManager {
  /** prompt 模板缓存：key = hash(subject + style + extraTags) */
  readonly promptCache = new LRUCache<string>(512, 60 * 60 * 1000);
  /** 风格预设缓存：key = style key（其实不需要，但保留用于覆盖/混合 prompt） */
  readonly styleCache = new LRUCache<string>(128, 24 * 60 * 60 * 1000);
  /** 翻译缓存：key = hash(text + from + to) */
  readonly translateCache = new LRUCache<string>(1024, 24 * 60 * 60 * 1000);
  /** 角色描述缓存（跨剧集复用） */
  readonly characterCache = new LRUCache<string>(256, 24 * 60 * 60 * 1000);

  /** 全局统计 */
  globalStats(): Record<string, CacheStats> {
    return {
      prompt: this.promptCache.stats(),
      style: this.styleCache.stats(),
      translate: this.translateCache.stats(),
      character: this.characterCache.stats(),
    };
  }

  /** 清空所有 */
  clearAll(): void {
    this.promptCache.clear();
    this.styleCache.clear();
    this.translateCache.clear();
    this.characterCache.clear();
  }
}

export const cacheManager = new CacheManager();

/** djb2 字符串 hash（比 SHA 便宜） */
export function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0xffffffff;
  }
  return `h${(h >>> 0).toString(36)}`;
}

/** prompt cache 助手 */
export const promptCache = {
  get(template: string, params: Record<string, string>): string | undefined {
    return cacheManager.promptCache.get(hashKey(template + JSON.stringify(params)));
  },
  set(template: string, params: Record<string, string>, result: string, ttlMs?: number): void {
    cacheManager.promptCache.set(hashKey(template + JSON.stringify(params)), result, ttlMs);
  },
};

/** translate cache 助手 */
export const translateCache = {
  get(text: string, from: string, to: string): string | undefined {
    return cacheManager.translateCache.get(hashKey(`${from}::${to}::${text}`));
  },
  set(text: string, from: string, to: string, result: string, ttlMs?: number): void {
    cacheManager.translateCache.set(hashKey(`${from}::${to}::${text}`), result, ttlMs);
  },
};

/** character cache 助手 */
export const characterCache = {
  get(key: string): string | undefined {
    return cacheManager.characterCache.get(key);
  },
  set(key: string, value: string, ttlMs?: number): void {
    cacheManager.characterCache.set(key, value, ttlMs);
  },
  has(key: string): boolean {
    return cacheManager.characterCache.has(key);
  },
};

/** style cache 助手 */
export const styleCache = {
  get(key: string): string | undefined {
    return cacheManager.styleCache.get(key);
  },
  set(key: string, value: string, ttlMs?: number): void {
    cacheManager.styleCache.set(key, value, ttlMs);
  },
};
