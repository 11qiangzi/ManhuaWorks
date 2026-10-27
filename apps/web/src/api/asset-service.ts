/**
 * asset-service 导出 API（已合并至 asset-service-v2）
 *
 * @deprecated 请直接使用 asset-service-v2.ts 的 `assetService` 实例。
 * 此文件保留为向后兼容的薄封装层，后续将移除。
 */
import { assetService } from './asset-service-v2'

/** 单集资产 zip */
export async function exportEpisodeZip(
  episodeAssetIds: string[],
  opts?: { filePrefix?: string; includeThumbs?: boolean },
) {
  return assetService.exportEpisodeZip(episodeAssetIds, opts)
}

/** 整季资产 zip */
export async function exportSeasonZip(
  projectId: string,
  opts?: { seasonNo?: number; filePrefix?: string },
) {
  return assetService.exportSeasonZip(projectId, opts)
}

/** 字幕 SRT */
export async function exportSrt(
  assetIds: string[],
  opts?: { withSpeaker?: boolean },
) {
  return assetService.exportSrt(assetIds, opts)
}

/** 触发浏览器下载 Blob */
export function downloadBlob(blob: Blob, filename: string): void {
  assetService.downloadBlob(blob, filename)
}

/** 触发浏览器下载纯文本 */
export function downloadText(text: string, filename: string, mime = 'text/plain'): void {
  assetService.downloadText(text, filename, mime)
}
