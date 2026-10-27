/**
 * 视频画质提升服务
 *
 * 使用 FFmpeg 对合成视频进行超分辨率增强和锐化修复。
 *
 * 三种模式：
 *   upscale  → Lanczos 2x 超分辨率放大
 *   sharpen  → Unsharp Mask 锐化修复（消除涂抹感）
 *   both     → 先 2x 放大再锐化（推荐，大片级质感）
 *
 * 输出参数：
 *   - 编码：libx264 (H.264)
 *   - 质量：CRF 18（高质量，接近视觉无损）
 *   - 音频：AAC 192kbps
 *   - 容器：MP4 (faststart)
 */

import { execFile } from "child_process";
import { existsSync, mkdirSync, writeFileSync, renameSync, statSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { config } from "../config.js";

type EnhanceMethod = "upscale" | "sharpen" | "both";

interface EnhanceRequest {
  videoUrl: string;
  method?: EnhanceMethod;
}

interface EnhanceResult {
  url: string;
  duration: number;
  fileSize: number;
  method: EnhanceMethod;
}

export class VideoEnhanceService {
  private workDir: string;
  private outputBaseUrl: string;

  constructor() {
    this.workDir = join(config.persistenceStorageDir, "enhance-tmp");
    this.outputBaseUrl = config.persistenceBaseUrl;

    if (!existsSync(this.workDir)) {
      mkdirSync(this.workDir, { recursive: true });
    }
  }

  async enhance(req: EnhanceRequest): Promise<EnhanceResult> {
    const method: EnhanceMethod = req.method || "both";

    const jobId = randomUUID().slice(0, 8);
    const jobDir = join(this.workDir, jobId);
    mkdirSync(jobDir, { recursive: true });

    try {
      // 1. 下载原视频
      const inputPath = join(jobDir, "input.mp4");
      await this.downloadFile(req.videoUrl, inputPath);

      // 2. 构造 FFmpeg 参数
      const outputPath = join(jobDir, "output.mp4");
      const ffmpegArgs = this.buildArgs(inputPath, method, outputPath);

      // 3. 执行 FFmpeg
      await this.runFFmpeg(ffmpegArgs);

      // 4. 移动到持久化目录
      const outputDir = join(config.persistenceStorageDir, "videos");
      if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

      const finalFilename = `enhanced_${jobId}.mp4`;
      const finalPath = join(outputDir, finalFilename);
      renameSync(outputPath, finalPath);

      const stats = statSync(finalPath);
      const duration = await this.getVideoDuration(finalPath);

      return {
        url: `${this.outputBaseUrl}/videos/${finalFilename}`,
        duration,
        fileSize: stats.size,
        method,
      };
    } finally {
      this.cleanup(jobDir);
    }
  }

  /**
   * 构造 FFmpeg 参数
   */
  private buildArgs(inputPath: string, method: EnhanceMethod, outputPath: string): string[] {
    const args: string[] = ["-i", inputPath];

    // 构建视频滤镜
    let vf = "";
    switch (method) {
      case "upscale":
        // Lanczos 2x 超分辨率 — 高质量插值放大，保留边缘锐度
        vf = "scale=iw*2:ih*2:flags=lanczos";
        break;
      case "sharpen":
        // Unsharp Mask — 5x5 矩阵，亮度锐化 1.5，色度锐化 0.5
        // 参数: luma_msize_x:luma_msize_y:luma_amount:chroma_msize_x:chroma_msize_y:chroma_amount
        vf = "unsharp=5:5:1.5:5:5:0.5";
        break;
      case "both":
        // 先放大再锐化 — 放大后锐化能更好地恢复细节
        // 锐化强度略低于纯 sharpen 模式，避免放大后过度锐化产生白边
        vf = "scale=iw*2:ih*2:flags=lanczos,unsharp=5:5:1.2:5:5:0.3";
        break;
    }

    args.push(
      "-vf", vf,
      "-c:v", "libx264",
      "-preset", "medium",    // 编码速度/质量平衡
      "-crf", "18",           // 高质量（18-23 是视觉无损区间）
      "-pix_fmt", "yuv420p", // 兼容性最好的像素格式
      "-c:a", "aac",
      "-b:a", "192k",
      "-y",
      "-movflags", "+faststart",
      outputPath,
    );

    return args;
  }

  private async downloadFile(url: string, localPath: string): Promise<void> {
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} for ${url}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(localPath, buffer);
  }

  private runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile("ffmpeg", args, { timeout: 600_000 }, (err, _stdout, stderr) => {
        if (err) {
          console.error("[VideoEnhance] FFmpeg error:", stderr);
          reject(new Error(`FFmpeg enhance failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  private async getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      execFile(
        "ffprobe",
        ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
        { timeout: 10_000 },
        (err, stdout) => {
          if (err) {
            resolve(0);
          } else {
            resolve(parseFloat(stdout.trim()) || 0);
          }
        },
      );
    });
  }

  private cleanup(dir: string): void {
    try {
      const { readdirSync, unlinkSync, rmdirSync } = require("fs");
      const files = readdirSync(dir);
      for (const f of files) {
        unlinkSync(join(dir, f));
      }
      rmdirSync(dir);
    } catch {
      // 清理失败不影响主流程
    }
  }
}

// 单例
let instance: VideoEnhanceService | null = null;

export function getVideoEnhancer(): VideoEnhanceService {
  if (!instance) {
    instance = new VideoEnhanceService();
  }
  return instance;
}
