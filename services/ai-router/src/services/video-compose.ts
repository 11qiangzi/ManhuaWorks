/**
 * 视频合成服务
 *
 * 将多个镜头视频按顺序拼接，支持转场效果。
 * 使用 FFmpeg (需系统安装) 进行视频处理。
 *
 * 转场实现：
 *   cut        → 直接 concat（无过渡）
 *   dissolve   → xfade=fade（交叉溶解）
 *   fade-black → xfade=fadecolor:color=black
 *   fade-white → xfade=fadecolor:color=white
 *   whip-pan   → xfade=wipeleft + 动态模糊
 */

import { execFile } from "child_process";
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { config } from "../config.js";

interface ComposeShot {
  videoUrl: string;
  transition?: string;  // 与下一镜头的转场方式
  duration?: number;     // 镜头时长（秒）
}

interface ComposeRequest {
  shots: ComposeShot[];
  outputFormat?: string;  // 默认 mp4
  resolution?: string;    // 默认 720p
}

interface ComposeResult {
  url: string;
  duration: number;
  fileSize: number;
}

const TRANSITION_DURATION = 0.5; // 转场时长（秒）

export class VideoComposeService {
  private workDir: string;
  private outputBaseUrl: string;

  constructor() {
    this.workDir = join(config.persistenceStorageDir, "compose-tmp");
    this.outputBaseUrl = config.persistenceBaseUrl;

    if (!existsSync(this.workDir)) {
      mkdirSync(this.workDir, { recursive: true });
    }
  }

  /**
   * 合成多个镜头视频为一个完整 episode
   */
  async compose(req: ComposeRequest): Promise<ComposeResult> {
    if (req.shots.length === 0) {
      throw new Error("No shots to compose");
    }

    // 单镜头直接返回
    if (req.shots.length === 1) {
      return {
        url: req.shots[0]!.videoUrl,
        duration: req.shots[0]!.duration ?? 5,
        fileSize: 0,
      };
    }

    const jobId = randomUUID().slice(0, 8);
    const jobDir = join(this.workDir, jobId);
    mkdirSync(jobDir, { recursive: true });

    try {
      // 1. 下载所有视频到临时目录
      const localPaths: string[] = [];
      for (let i = 0; i < req.shots.length; i++) {
        const shot = req.shots[i]!;
        const localPath = join(jobDir, `shot_${String(i).padStart(3, "0")}.mp4`);
        await this.downloadFile(shot.videoUrl, localPath);
        localPaths.push(localPath);
      }

      // 2. 构造 FFmpeg 命令（async：需要 ffprobe 获取时长计算 xfade offset）
      const outputPath = join(jobDir, "output.mp4");
      const ffmpegArgs = await this.buildFFmpegArgs(localPaths, req.shots, outputPath);

      // 3. 执行 FFmpeg
      await this.runFFmpeg(ffmpegArgs);

      // 4. 移动到持久化目录
      const outputDir = join(config.persistenceStorageDir, "videos");
      if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

      const finalFilename = `composed_${jobId}.mp4`;
      const finalPath = join(outputDir, finalFilename);

      const { renameSync, statSync } = await import("fs");
      renameSync(outputPath, finalPath);

      const stats = statSync(finalPath);
      const duration = await this.getVideoDuration(finalPath);

      return {
        url: `${this.outputBaseUrl}/videos/${finalFilename}`,
        duration,
        fileSize: stats.size,
      };
    } finally {
      // 清理临时文件
      this.cleanup(jobDir);
    }
  }

  /**
   * 构造 FFmpeg 参数（使用 xfade 实现转场）
   */
  private async buildFFmpegArgs(
    inputPaths: string[],
    shots: ComposeShot[],
    outputPath: string,
  ): Promise<string[]> {
    const args: string[] = [];

    // 输入文件
    for (const p of inputPaths) {
      args.push("-i", p);
    }

    if (inputPaths.length === 2) {
      const transition = shots[0]!.transition ?? "cut";

      if (transition === "cut") {
        // 无转场，直接 concat
        args.push(
          "-filter_complex",
          "[0:v][1:v]concat=n=2:v=1:a=0[v]",
          "-map", "[v]",
        );
      } else {
        // 用 ffprobe 获取第一段视频实际时长，计算 xfade offset
        const dur0 = await this.getVideoDuration(inputPaths[0]!);
        // 转场时长不超过第一段视频的 50%，且不超过 TRANSITION_DURATION
        const safeTD = dur0 > 0
          ? Math.min(TRANSITION_DURATION, dur0 * 0.5)
          : TRANSITION_DURATION;
        const offset = dur0 > 0
          ? Math.max(0.05, dur0 - safeTD)
          : safeTD;
        const xfadeName = this.getXfadeFilter(transition);
        console.log(`[compose] 2镜头转场: ${transition}, dur0=${dur0.toFixed(2)}s, offset=${offset.toFixed(2)}s, td=${safeTD.toFixed(2)}s`);
        args.push(
          "-filter_complex",
          `[0:v][1:v]xfade=transition=${xfadeName}:duration=${safeTD}:offset=${offset}[v]`,
          "-map", "[v]",
        );
      }
    } else {
      // 多镜头：使用 concat demuxer（简单拼接，忽略转场以保持稳定性）
      // 生成 concat 文件列表
      const concatListPath = join(outputPath, "..", "concat_list.txt");
      const concatContent = inputPaths.map(p => `file '${p}'`).join("\n");
      writeFileSync(concatListPath, concatContent);

      args.push(
        "-f", "concat",
        "-safe", "0",
        "-i", concatListPath,
        "-c", "copy",
      );
    }

    // 输出
    args.push(
      "-y",
      "-movflags", "+faststart",
      outputPath,
    );

    return args;
  }

  /**
   * 转场类型 → FFmpeg xfade transition name
   */
  private getXfadeFilter(transition: string): string {
    switch (transition) {
      case "dissolve":   return "fade";
      case "fade-black": return "fadeblack";
      case "fade-white": return "fadewhite";
      case "whip-pan":   return "wipeleft";
      case "match-cut":  return "fade";
      case "smash-cut":  return "fade";
      default:           return "fade";
    }
  }

  /**
   * 下载文件
   */
  private async downloadFile(url: string, localPath: string): Promise<void> {
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} for ${url}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(localPath, buffer);
  }

  /**
   * 执行 FFmpeg
   */
  private runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile("ffmpeg", args, { timeout: 300_000 }, (err, stdout, stderr) => {
        if (err) {
          console.error("[VideoCompose] FFmpeg error:", stderr);
          reject(new Error(`FFmpeg failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 获取视频时长（秒）
   */
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

  /**
   * 合并视频 + 配音音频 → 最终 MP4
   */
  async mergeVideoAudio(params: {
    videoUrl: string;
    audioSegments: Array<{ audioUrl: string; startTime?: number }>;
    bgmUrl?: string;
    bgmVolume?: number;  // 0.0 - 1.0, 默认 0.3
  }): Promise<ComposeResult> {
    const jobId = randomUUID().slice(0, 8);
    const jobDir = join(this.workDir, `merge_${jobId}`);
    mkdirSync(jobDir, { recursive: true });

    try {
      // 下载视频
      const videoPath = join(jobDir, "video.mp4");
      await this.downloadFile(params.videoUrl, videoPath);

      // 下载所有配音音频
      const audioPaths: string[] = [];
      for (let i = 0; i < params.audioSegments.length; i++) {
        const seg = params.audioSegments[i]!;
        if (seg.audioUrl) {
          const audioPath = join(jobDir, `dub_${String(i).padStart(3, "0")}.mp3`);
          await this.downloadFile(seg.audioUrl, audioPath);
          audioPaths.push(audioPath);
        }
      }

      const outputPath = join(jobDir, "final.mp4");
      const args: string[] = ["-i", videoPath];

      if (audioPaths.length > 0) {
        // 拼接所有配音为一个音轨（按顺序）
        if (audioPaths.length === 1) {
          args.push("-i", audioPaths[0]!);
          args.push(
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
          );
        } else {
          // 多段配音：使用 concat 合并为一个音轨
          const concatPath = join(jobDir, "audio_concat.txt");
          writeFileSync(concatPath, audioPaths.map(p => `file '${p}'`).join("\n"));
          args.push("-f", "concat", "-safe", "0", "-i", concatPath);
          args.push(
            "-map", "0:v",
            "-map", `${audioPaths.length > 0 ? 1 : 0}:a`,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
          );
        }
      } else {
        // 无配音，仅复制视频
        args.push("-c", "copy");
      }

      // BGM（可选）
      if (params.bgmUrl) {
        const bgmPath = join(jobDir, "bgm.mp3");
        await this.downloadFile(params.bgmUrl, bgmPath);
        const bgmVol = params.bgmVolume ?? 0.3;
        args.push("-i", bgmPath);
        // 混合配音 + BGM
        args.push(
          "-filter_complex",
          `[1:a]volume=1.0[dub];[${audioPaths.length > 0 ? 2 : 1}:a]volume=${bgmVol}[bgm];[dub][bgm]amix=inputs=2:duration=first[aout]`,
          "-map", "0:v",
          "-map", "[aout]",
        );
      }

      args.push("-y", "-movflags", "+faststart", outputPath);

      await this.runFFmpeg(args);

      // 移动到持久化目录
      const { renameSync, statSync } = await import("fs");
      const finalFilename = `final_${jobId}.mp4`;
      const finalPath = join(config.persistenceStorageDir, "videos", finalFilename);
      renameSync(outputPath, finalPath);

      const stats = statSync(finalPath);
      const duration = await this.getVideoDuration(finalPath);

      return {
        url: `${this.outputBaseUrl}/videos/${finalFilename}`,
        duration,
        fileSize: stats.size,
      };
    } finally {
      this.cleanup(jobDir);
    }
  }

  /**
   * 清理临时文件
   */
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
let instance: VideoComposeService | null = null;

export function getVideoComposer(): VideoComposeService {
  if (!instance) {
    instance = new VideoComposeService();
  }
  return instance;
}
