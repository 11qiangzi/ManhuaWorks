// =============================================================================
// asset-service.ts — asset-service 导出 API
// P4-3: 导出中心真实集成
//
// 端点:
//   POST /v1/assets/export/episode   单集 zip
//   POST /v1/assets/export/season    整季 zip
//   POST /v1/assets/export/srt       字幕 srt
// =============================================================================

import { tokenStore } from '@manhuaworks/api-client'

const BASE =
  (import.meta.env?.VITE_ASSET_URL as string | undefined) ?? ''

function authHeaders(): Record<string, string> {
  const token = tokenStore.get()
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

/* ---------- helpers ---------- */

/**
 * POST 请求，返回 Blob（用于 zip 下载）
 */
async function postBlob(path: string, body: unknown): Promise<{ blob: Blob; filename: string }> {
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`asset-service ${path} failed: ${resp.status} ${text}`)
  }
  const blob = await resp.blob()
  // 从 Content-Disposition 提取文件名
  const cd = resp.headers.get('Content-Disposition') ?? ''
  const match = cd.match(/filename="?([^";\n]+)"?/)
  const filename = match?.[1] ?? `export-${Date.now()}.zip`
  return { blob, filename }
}

/**
 * POST 请求，返回纯文本（用于 srt）
 */
async function postText(path: string, body: unknown): Promise<{ text: string; filename: string }> {
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`asset-service ${path} failed: ${resp.status} ${text}`)
  }
  const text = await resp.text()
  const cd = resp.headers.get('Content-Disposition') ?? ''
  const match = cd.match(/filename="?([^";\n]+)"?/)
  const filename = match?.[1] ?? `subtitles-${Date.now()}.srt`
  return { text, filename }
}

/* ---------- 浏览器下载 ---------- */

/**
 * 触发浏览器下载 Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 触发浏览器下载纯文本
 */
export function downloadText(text: string, filename: string, mime = 'text/plain'): void {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename)
}

/* ---------- 导出端点 ---------- */

/** 单集资产 zip */
export async function exportEpisodeZip(
  episodeAssetIds: string[],
  opts?: { filePrefix?: string; includeThumbs?: boolean },
) {
  return postBlob('/v1/assets/export/episode', {
    episodeAssetIds,
    filePrefix: opts?.filePrefix ?? 'episode',
    includeThumbs: opts?.includeThumbs ?? true,
  })
}

/** 整季资产 zip */
export async function exportSeasonZip(
  projectId: string,
  opts?: { seasonNo?: number; filePrefix?: string },
) {
  return postBlob('/v1/assets/export/season', {
    projectId,
    seasonNo: opts?.seasonNo,
    filePrefix: opts?.filePrefix ?? 'season',
  })
}

/** 字幕 SRT */
export async function exportSrt(
  assetIds: string[],
  opts?: { withSpeaker?: boolean },
) {
  return postText('/v1/assets/export/srt', {
    assetIds,
    withSpeaker: opts?.withSpeaker ?? true,
  })
}
