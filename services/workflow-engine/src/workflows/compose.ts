/**
 * 最终合成工作流（compose）
 * 流程：视频片段 + 音频 + 字幕 + BGM → FFmpeg 拼接
 *
 * DAG:
 *   [concat_videos] ─┐
 *   [burn_subtitles] ┼─→ [mix_audio] ─→ [final_encode]
 *   [select_bgm] ────┘
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { runDAG, type WorkflowNode, type DAGResult } from '../orchestrator/dag.js';
import { saveSnapshot } from '../orchestrator/checkpoint.js';
import { withRetry } from '../orchestrator/retry.js';
import { config } from '../config.js';
import { nanoid } from 'nanoid';

export interface ComposeInput {
  /** 视频片段 URL 列表（按顺序） */
  videoUrls: string[];
  /** 旁白音频 URL 列表（与视频对齐） */
  audioUrls?: string[];
  /** 字幕 SRT 文本 */
  subtitles?: string;
  /** BGM URL（可选） */
  bgmUrl?: string;
  /** BGM 音量 0-1 */
  bgmVolume?: number;
  /** 输出格式 */
  outputFormat?: 'mp4' | 'mov' | 'webm';
  /** 分辨率 */
  resolution?: '720p' | '1080p' | '4k';
}

export interface ComposeOutput {
  outputUrl: string;
  durationSec: number;
  size: { width: number; height: number };
  format: string;
}

const RES_MAP: Record<string, { w: number; h: number }> = {
  '720p': { w: 1280, h: 720 },
  '1080p': { w: 1920, h: 1080 },
  '4k': { w: 3840, h: 2160 },
};

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 120_000 });
  await fs.writeFile(dest, Buffer.from(res.data));
}

async function concatVideos(
  input: ComposeInput,
  _ctx: unknown
): Promise<{ localPaths: string[]; listFile: string; workDir: string }> {
  return withRetry(async () => {
    const workDir = path.join(config.ffmpeg.workDir, `compose-${nanoid(8)}`);
    await fs.mkdir(workDir, { recursive: true });
    const localPaths: string[] = [];
    for (let i = 0; i < input.videoUrls.length; i++) {
      const p = path.join(workDir, `seg-${i.toString().padStart(3, '0')}.mp4`);
      await downloadToFile(input.videoUrls[i]!, p);
      localPaths.push(p);
    }
    // 写 concat list
    const listFile = path.join(workDir, 'concat.txt');
    const content = localPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    await fs.writeFile(listFile, content, 'utf8');
    return { localPaths, listFile, workDir };
  });
}

async function selectBgm(
  input: ComposeInput,
  _ctx: unknown
): Promise<{ bgmLocal?: string }> {
  return withRetry(async () => {
    if (!input.bgmUrl) return { bgmLocal: undefined };
    // 同 workDir 上传后再来；这里先简化下载到 /tmp
    const dest = path.join('/tmp', `bgm-${nanoid(8)}.mp3`);
    await downloadToFile(input.bgmUrl, dest);
    return { bgmLocal: dest };
  });
}

async function burnSubtitles(
  input: ComposeInput,
  ctx: Record<string, unknown>
): Promise<{ srtFile: string | null }> {
  return withRetry(async () => {
    if (!input.subtitles) return { srtFile: null };
    const { workDir } = (ctx['concat_videos'] as { workDir: string });
    const srtFile = path.join(workDir, 'subs.srt');
    await fs.writeFile(srtFile, input.subtitles, 'utf8');
    return { srtFile };
  });
}

async function mixAudio(
  input: ComposeInput,
  ctx: Record<string, unknown>
): Promise<{ audioTracks: string[] }> {
  return withRetry(async () => {
    const audioTracks: string[] = [];
    if (input.audioUrls && input.audioUrls.length > 0) {
      for (let i = 0; i < input.audioUrls.length; i++) {
        const p = path.join('/tmp', `narration-${nanoid(8)}-${i}.mp3`);
        await downloadToFile(input.audioUrls[i]!, p);
        audioTracks.push(p);
      }
    }
    return { audioTracks };
  });
}

async function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.ffmpeg.binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function finalEncode(
  input: ComposeInput,
  ctx: Record<string, unknown>
): Promise<ComposeOutput> {
  return withRetry(async () => {
    const { listFile, workDir } = (ctx['concat_videos'] as { listFile: string; workDir: string });
    const { srtFile } = (ctx['burn_subtitles'] as { srtFile: string | null });
    const { bgmLocal } = (ctx['select_bgm'] as { bgmLocal: string | undefined });
    const { audioTracks } = (ctx['mix_audio'] as { audioTracks: string[] });

    const outFile = path.join(workDir, `final.${input.outputFormat ?? 'mp4'}`);
    const res = RES_MAP[input.resolution ?? '1080p']!;

    const args: string[] = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile];
    if (srtFile) {
      // 先不带字幕 concat 出中间文件
      const tmp = path.join(workDir, 'tmp-no-sub.mp4');
      await runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', tmp]);
      args.length = 0;
      args.push('-y', '-i', tmp);
    }
    // 加旁白
    for (const t of audioTracks) args.push('-i', t);
    // 加 BGM
    if (bgmLocal) args.push('-i', bgmLocal);

    // 滤镜图
    const filterParts: string[] = [];
    if (srtFile) {
      const srtEsc = srtFile.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
      filterParts.push(`subtitles='${srtEsc}':force_style='FontSize=20,FontName=Microsoft YaHei'`);
    }
    // 视频缩放
    filterParts.push(`scale=${res.w}:${res.h}:flags=lanczos`);

    args.push('-vf', filterParts.join(','));

    // 音频混合
    const aIdx = audioTracks.length + (bgmLocal ? 1 : 0) + 1; // 0=视频，后面是旁白×N + BGM
    if (audioTracks.length > 0 && bgmLocal) {
      // 旁白先混，再加 BGM
      const voiceMix = audioTracks.map((_, i) => `[${1 + i}:a]`).join('');
      args.push('-filter_complex', `${voiceMix}amix=inputs=${audioTracks.length}[v];[v][${aIdx}:a]amix=inputs=2:duration=first[a]`, '-map', '0:v', '-map', '[a]');
    } else if (audioTracks.length > 0) {
      const voiceMix = audioTracks.map((_, i) => `[${1 + i}:a]`).join('');
      args.push('-filter_complex', `${voiceMix}amix=inputs=${audioTracks.length}[a]`, '-map', '0:v', '-map', '[a]');
    } else if (bgmLocal) {
      args.push('-map', '0:v', '-map', `${aIdx}:a`);
    } else {
      args.push('-map', '0:v');
    }

    if (bgmLocal && input.bgmVolume !== undefined) {
      args.push('-af', `volume=${input.bgmVolume}`);
    }

    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'aac', '-b:a', '192k', '-shortest', outFile);

    await runFFmpeg(args);

    // 上传（demo：假设 S3 在 ai-router）
    const uploadRes = await axios.post(
      `${config.aiRouter.url}/v1/storage/upload`,
      { type: 'video' },
      { timeout: 30_000 }
    );
    const uploadUrl = (uploadRes.data as { uploadUrl?: string }).uploadUrl ?? `file://${outFile}`;

    // 估算时长（FFprobe 太重，简化：从输出文件大小粗估）
    const stat = await fs.stat(outFile);
    const durationSec = Math.max(1, Math.round(stat.size / (300 * 1024))); // 粗估

    return {
      outputUrl: uploadUrl,
      durationSec,
      size: { width: res.w, height: res.h },
      format: input.outputFormat ?? 'mp4',
    };
  });
}

export async function runComposeWorkflow(
  runId: string,
  input: ComposeInput
): Promise<DAGResult> {
  await saveSnapshot({
    runId,
    workflow: 'compose',
    status: 'running',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: {},
    inputs: input as unknown as Record<string, unknown>,
  });

  const nodes: WorkflowNode[] = [
    { id: 'concat_videos', name: '下载+拼接', run: async () => concatVideos(input, {}), timeoutMs: 300_000 },
    { id: 'select_bgm', name: '下载 BGM', run: async () => selectBgm(input, {}), timeoutMs: 120_000 },
    { id: 'burn_subtitles', name: '准备字幕', dependsOn: ['concat_videos'], run: async (ctx) => burnSubtitles(input, ctx as Record<string, unknown>), timeoutMs: 30_000 },
    { id: 'mix_audio', name: '下载旁白', run: async () => mixAudio(input, {}), timeoutMs: 120_000 },
    { id: 'final_encode', name: 'FFmpeg 合成', dependsOn: ['concat_videos', 'select_bgm', 'burn_subtitles', 'mix_audio'], run: async (ctx) => finalEncode(input, ctx as Record<string, unknown>), timeoutMs: 600_000 },
  ];

  const result = await runDAG(runId, nodes, { maxParallel: 3, failFast: true });
  await saveSnapshot({
    runId,
    workflow: 'compose',
    status: result.success ? 'success' : 'failed',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    nodes: result.statuses as never,
    inputs: input as unknown as Record<string, unknown>,
  });
  return result;
}
