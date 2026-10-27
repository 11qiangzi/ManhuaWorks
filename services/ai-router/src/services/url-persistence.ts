/**
 * URL 持久化服务
 *
 * 火山引擎 TOS / Seedream / Seedance 返回的图片视频 URL 有效期约 24 小时。
 * 本服务在生成结果返回给前端之前，将文件下载到本地/自有存储，替换为永久 URL。
 *
 * 存储后端：
 *   - 本地文件系统（开发环境）
 *   - S3/OSS（生产环境，通过环境变量配置）
 *   - Cloudflare R2（S3 兼容）
 */

import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, extname } from "path";
import { pipeline } from "stream/promises";
import { randomUUID } from "crypto";
import { config } from "../config.js";

interface PersistResult {
  /** 永久 URL（可直接访问） */
  permanentUrl: string;
  /** 本地文件路径（如果存储到本地） */
  localPath?: string;
}

export class UrlPersistenceService {
  private storageDir: string;
  private baseUrl: string;
  private enabled: boolean;

  constructor() {
    this.storageDir = config.persistenceStorageDir;
    this.baseUrl = config.persistenceBaseUrl;
    this.enabled = config.persistenceEnabled;

    if (this.enabled) {
      // 确保存储目录存在
      if (!existsSync(this.storageDir)) {
        mkdirSync(this.storageDir, { recursive: true });
      }
      // 子目录
      for (const sub of ["images", "videos", "keyframes"]) {
        const dir = join(this.storageDir, sub);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * 持久化临时 URL — 主入口
   * 下载文件到本地存储，返回永久 URL
   *
   * @param tempUrl - 临时 URL（火山引擎 TOS 等）
   * @param type - 资源类型（决定子目录）
   * @returns 永久 URL，如果禁用或失败则返回原始 URL
   */
  async persist(tempUrl: string, type: "image" | "video" | "keyframe"): Promise<string> {
    if (!this.enabled) return tempUrl;

    try {
      const result = await this.downloadAndStore(tempUrl, type);
      return result.permanentUrl;
    } catch (err) {
      console.error(`[UrlPersistence] Failed to persist ${type} from ${tempUrl}:`, err);
      // 降级：返回原始临时 URL
      return tempUrl;
    }
  }

  /**
   * 批量持久化（图片数组）
   */
  async persistMany(tempUrls: string[], type: "image" | "video" | "keyframe"): Promise<string[]> {
    if (!this.enabled) return tempUrls;
    return Promise.all(tempUrls.map((url) => this.persist(url, type)));
  }

  /**
   * 下载文件并存储到本地
   * 对下载做有限重试：agnes 在负载高时返回的是 platform-outputs 远程 URL，
   * 偶尔首拉会 503/超时，重试通常即可成功，从而避免把不可靠的远程 URL 透传给前端。
   */
  private async downloadAndStore(tempUrl: string, type: "image" | "video" | "keyframe"): Promise<PersistResult> {
    // 下载文件（带重试）
    let response: Response | null = null;
    let lastDownloadErr: unknown = null;
    const MAX_DL_RETRIES = 3;
    for (let i = 0; i <= MAX_DL_RETRIES; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1500 * i));
      try {
        response = await fetch(tempUrl, { signal: AbortSignal.timeout(60_000) });
        if (response.ok) break;
        lastDownloadErr = new Error(`Download failed: ${response.status} ${response.statusText}`);
      } catch (e) {
        lastDownloadErr = e;
        response = null;
      }
    }
    if (!response || !response.ok) {
      throw lastDownloadErr instanceof Error
        ? lastDownloadErr
        : new Error(`Download failed for ${tempUrl}`);
    }

    // 确定文件扩展名
    const contentType = response.headers.get("content-type") || "";
    const ext = this.getExtension(tempUrl, contentType, type);

    // 生成本地文件名
    const subDir = type === "video" ? "videos" : type === "keyframe" ? "keyframes" : "images";
    const filename = `${Date.now()}_${randomUUID().slice(0, 8)}${ext}`;
    const localPath = join(this.storageDir, subDir, filename);

    // 写入文件
    if (response.body) {
      const writer = createWriteStream(localPath);
      await pipeline(response.body as any, writer);
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(localPath, buffer);
    }

    // 构造永久 URL
    const permanentUrl = `${this.baseUrl}/${subDir}/${filename}`;

    return { permanentUrl, localPath };
  }

  /**
   * 从 URL 或 Content-Type 推断文件扩展名
   */
  private getExtension(url: string, contentType: string, type: string): string {
    // 从 URL 路径推断
    try {
      const urlExt = extname(new URL(url).pathname);
      if (urlExt && urlExt.length <= 5) return urlExt;
    } catch {}

    // 从 Content-Type 推断
    if (contentType.includes("png")) return ".png";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
    if (contentType.includes("webp")) return ".webp";
    if (contentType.includes("mp4")) return ".mp4";
    if (contentType.includes("video")) return ".mp4";

    // 默认
    return type === "video" ? ".mp4" : ".png";
  }
}

// 单例
let instance: UrlPersistenceService | null = null;

export function getUrlPersistence(): UrlPersistenceService {
  if (!instance) {
    instance = new UrlPersistenceService();
  }
  return instance;
}
