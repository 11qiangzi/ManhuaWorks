/**
 * TTS（文字转语音）服务
 *
 * 支持多 provider：
 *   - edge-tts: 微软 Edge TTS（免费，中文语音质量高，8 种音色）
 *   - volcengine: 火山引擎 TTS（字节跳动/豆包语音，2 种音色）
 *   - openai: OpenAI TTS（tts-1 / tts-1-hd，6 种英文音色）
 *
 * 输出格式：MP3
 * 持久化：生成后自动下载到本地存储，返回永久 URL
 */

import { execFile } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { config } from "../config.js";

interface TtsRequest {
  text: string;
  voiceId: string;
  provider?: string;       // edge-tts | volcengine | openai
  speed?: number;          // 0.5 - 2.0, 默认 1.0
  pitch?: number;          // -50 到 +50, 默认 0
  format?: string;         // mp3 | wav, 默认 mp3
}

interface TtsResult {
  url: string;
  duration: number;        // 秒
  provider: string;
  voiceId: string;
}

/** 按 voiceId 自动推断 provider */
function inferProvider(voiceId: string): string {
  if (voiceId.startsWith("zh-CN-") || voiceId.startsWith("zh-TW-") || voiceId.startsWith("en-")) {
    return "edge-tts";
  }
  if (voiceId.startsWith("BV") || voiceId.startsWith("zh_female") || voiceId.startsWith("zh_male")) {
    return "volcengine";
  }
  if (["alloy", "echo", "fable", "onyx", "nova", "shimmer"].includes(voiceId)) {
    return "openai";
  }
  return "edge-tts"; // 默认
}

export class TtsService {
  private workDir: string;
  private outputDir: string;
  private outputBaseUrl: string;

  constructor() {
    this.workDir = join(config.persistenceStorageDir, "tts-tmp");
    this.outputDir = join(config.persistenceStorageDir, "audio");
    this.outputBaseUrl = config.persistenceBaseUrl;

    for (const dir of [this.workDir, this.outputDir]) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 生成语音 — 主入口
   */
  async synthesize(req: TtsRequest): Promise<TtsResult> {
    const provider = req.provider || inferProvider(req.voiceId);
    const jobId = randomUUID().slice(0, 8);
    const outputFile = join(this.outputDir, `tts_${jobId}.mp3`);

    switch (provider) {
      case "edge-tts":
        await this.synthesizeEdgeTts(req, outputFile);
        break;
      case "volcengine":
        await this.synthesizeVolcengine(req, outputFile);
        break;
      case "openai":
        await this.synthesizeOpenAI(req, outputFile);
        break;
      default:
        throw new Error(`Unknown TTS provider: ${provider}`);
    }

    // 获取音频时长
    const duration = await this.getAudioDuration(outputFile);
    const filename = `tts_${jobId}.mp3`;

    return {
      url: `${this.outputBaseUrl}/audio/${filename}`,
      duration,
      provider,
      voiceId: req.voiceId,
    };
  }

  /**
   * Edge TTS（微软，通过 edge-tts Python 包或 Node.js 实现）
   *
   * 优先使用 edge-tts-node（纯 Node.js 实现，无需 Python）
   * 回退到 edge-tts Python CLI
   */
  private async synthesizeEdgeTts(req: TtsRequest, outputFile: string): Promise<void> {
    const speed = req.speed ?? 1.0;
    const rate = speed >= 1 ? `+${Math.round((speed - 1) * 100)}%` : `${Math.round((speed - 1) * 100)}%`;

    // 尝试 edge-tts Python CLI
    try {
      await new Promise<void>((resolve, reject) => {
        const args = [
          "--voice", req.voiceId,
          "--rate", rate,
          "--write-media", outputFile,
          req.text,
        ];

        execFile("edge-tts", args, { timeout: 60_000 }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return;
    } catch {
      // Python CLI 不可用，尝试直接 HTTP 调用
    }

    // 回退：使用 WebSocket 直连 Edge TTS 服务
    await this.edgeTtsWebSocket(req, outputFile);
  }

  /**
   * Edge TTS WebSocket 直连实现（无需外部依赖）
   * 参考：https://github.com/rany2/edge-tts 协议
   */
  private async edgeTtsWebSocket(req: TtsRequest, outputFile: string): Promise<void> {
    const { WebSocket } = await import("ws").catch(() => {
      throw new Error(
        "edge-tts requires either the 'edge-tts' Python CLI or the 'ws' npm package. " +
        "Install with: pip install edge-tts  OR  npm install ws"
      );
    });

    const speed = req.speed ?? 1.0;
    const rate = speed >= 1 ? `+${Math.round((speed - 1) * 100)}%` : `${Math.round((speed - 1) * 100)}%`;

    // 生成唯一请求 ID
    const connId = randomUUID().replace(/-/g, "");
    const requestId = randomUUID().replace(/-/g, "");

    const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connId}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WSS_URL, {
        headers: {
          "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
          "User-Agent": "Mozilla/5.0",
        },
      });

      const audioChunks: Buffer[] = [];
      let audioStarted = false;

      ws.on("open", () => {
        // 发送配置
        const configMsg =
          `X-Timestamp:${new Date().toISOString()}\r\n` +
          `Content-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
        ws.send(configMsg);

        // 发送 SSML
        const ssml =
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>` +
          `<voice name='${req.voiceId}'>` +
          `<prosody rate='${rate}'>${this.escapeXml(req.text)}</prosody>` +
          `</voice></speak>`;

        const ssmlMsg =
          `X-RequestId:${requestId}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${new Date().toISOString()}\r\n` +
          `Path:ssml\r\n\r\n` +
          ssml;
        ws.send(ssmlMsg);
      });

      ws.on("message", (data: Buffer) => {
        const str = data.toString();

        // 二进制音频数据以 "Path:audio\r\n" 开头
        if (str.includes("Path:audio")) {
          const headerEnd = data.indexOf("\r\n\r\n");
          if (headerEnd >= 0) {
            const audioData = data.subarray(headerEnd + 4);
            audioChunks.push(audioData);
            audioStarted = true;
          }
        }

        // 完成标记
        if (str.includes("Path:turn.end")) {
          ws.close();
        }
      });

      ws.on("close", () => {
        if (audioChunks.length === 0) {
          reject(new Error("Edge TTS returned no audio data"));
          return;
        }
        const fullAudio = Buffer.concat(audioChunks);
        writeFileSync(outputFile, fullAudio);
        resolve();
      });

      ws.on("error", (err: Error) => {
        reject(new Error(`Edge TTS WebSocket error: ${err.message}`));
      });

      // 超时保护
      setTimeout(() => {
        ws.close();
        if (audioChunks.length > 0) {
          writeFileSync(outputFile, Buffer.concat(audioChunks));
          resolve();
        } else {
          reject(new Error("Edge TTS timeout"));
        }
      }, 60_000);
    });
  }

  /**
   * 火山引擎 TTS
   * API: POST https://openspeech.bytedance.com/api/v1/tts
   */
  private async synthesizeVolcengine(req: TtsRequest, outputFile: string): Promise<void> {
    const apiKey = process.env.VOLCENGINE_API_KEY;
    if (!apiKey) {
      throw new Error("VOLCENGINE_API_KEY not configured for TTS");
    }

    const speed = req.speed ?? 1.0;
    const speedRatio = Math.max(0.8, Math.min(2.0, speed));

    const res = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer;${apiKey}`,
        "Content-Type": "application/json",
        "X-Api-Resource-Id": req.voiceId,
        "X-Api-App-Key": process.env.VOLCENGINE_APP_KEY || "",
        "X-Api-Access-Key": process.env.VOLCENGINE_ACCESS_KEY || apiKey,
      },
      body: JSON.stringify({
        app: {
          appid: process.env.VOLCENGINE_APP_ID || "5385728695",
          token: "access_token",
          cluster: "volcano_tts",
        },
        user: { uid: "manhuaworks" },
        audio: {
          voice_type: req.voiceId,
          encoding: "mp3",
          speed_ratio: speedRatio,
          rate: 24000,
        },
        request: {
          reqid: randomUUID(),
          text: req.text,
          text_type: "plain",
          operation: "query",
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`Volcengine TTS failed: ${res.status}`);
    }

    const data = await res.json() as { data?: string; code?: number; message?: string };
    if (data.code && data.code !== 3000) {
      throw new Error(`Volcengine TTS error: ${data.message || data.code}`);
    }

    if (data.data) {
      // 返回 base64 编码的音频
      const audioBuffer = Buffer.from(data.data, "base64");
      writeFileSync(outputFile, audioBuffer);
    } else {
      throw new Error("Volcengine TTS returned no audio data");
    }
  }

  /**
   * OpenAI TTS
   * API: POST https://api.openai.com/v1/audio/speech
   */
  private async synthesizeOpenAI(req: TtsRequest, outputFile: string): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured for TTS");
    }

    const speed = req.speed ?? 1.0;

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: req.text,
        voice: req.voiceId,
        speed: Math.max(0.25, Math.min(4.0, speed)),
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`OpenAI TTS failed: ${res.status}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(outputFile, buffer);
  }

  /**
   * 获取音频时长
   */
  private getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      execFile(
        "ffprobe",
        ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
        { timeout: 10_000 },
        (err, stdout) => {
          resolve(err ? 0 : (parseFloat(stdout.trim()) || 0));
        },
      );
    });
  }

  /**
   * XML 转义（SSML 用）
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

// 单例
let instance: TtsService | null = null;

export function getTtsService(): TtsService {
  if (!instance) {
    instance = new TtsService();
  }
  return instance;
}
