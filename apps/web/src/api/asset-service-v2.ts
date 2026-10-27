/**
 * asset-service — 资产服务 API 客户端 (派单 47 重构)
 *
 * 从直接 import axios → 使用统一 @manhuaworks/api-client
 * 收益: JWT 自动注入 / 401 自动刷新 / 重试 / 超时 / 统一错误格式
 *
 * 用法不变:
 *   import { assetService } from '@/api/asset-service'
 *   const data = await assetService.list({ page: 1 })
 */
import { getClient, tokenStore } from '@manhuaworks/api-client'

export type AssetType = 'image' | 'video' | 'audio' | 'other'

export interface AssetItem {
  id: string
  name: string
  alias?: string | null
  type: AssetType
  mime: string
  size: number
  url: string
  thumbnailUrl?: string | null
  duration?: number | null
  width?: number | null
  height?: number | null
  tags?: string[]
  projectId?: string | null
  favorite?: boolean
  createdAt: string
  uploaderId?: string
  meta?: Record<string, unknown>
}

export interface AssetListResp {
  list: AssetItem[]
  total: number
  page: number
  pageSize: number
}

export interface AssetFilter {
  projectId?: string | null
  type?: AssetType | 'all'
  tags?: string[]
  keyword?: string
  favorite?: boolean
  page?: number
  pageSize?: number
  sortBy?: 'createdAt' | 'name' | 'size'
  sortDir?: 'asc' | 'desc'
}

export interface UploadProgress {
  id: string
  filename: string
  loaded: number
  total: number
  progress: number
  status: 'uploading' | 'done' | 'error'
  error?: string
}

const BASE = '/v1/assets'

class AssetService {
  private get http() {
    return getClient().http
  }

  async list(filter: AssetFilter = {}): Promise<AssetListResp> {
    try {
      const query = this.cleanFilter(filter) as Record<string, unknown>
      const res = await this.http.get<{ data: AssetListResp }>(`${BASE}`, query)
      return res.data
    } catch {
      return { list: [], total: 0, page: 1, pageSize: filter.pageSize ?? 24 }
    }
  }

  async get(id: string): Promise<AssetItem | null> {
    try {
      const res = await this.http.get<{ data: AssetItem }>(`${BASE}/${id}`)
      return res.data
    } catch {
      return null
    }
  }

  async upload(file: File, options: { projectId?: string; tags?: string[]; alias?: string; kind?: string } = {}): Promise<AssetItem> {
    const form = new FormData()
    form.append('file', file)

    // 后端期望 meta JSON 字段格式
    const meta: Record<string, unknown> = {}
    if (options.projectId) meta.projectId = options.projectId
    if (options.alias) meta.name = options.alias
    if (options.tags?.length) meta.tags = options.tags
    if (options.kind) meta.kind = options.kind

    if (Object.keys(meta).length > 0) {
      form.append('meta', JSON.stringify(meta))
    }

    try {
      const res = await this.http.post<{ uploaded: boolean; asset: AssetItem }>(`${BASE}/upload`, form)
      // 兼容两种返回格式: { uploaded, asset } 或 { data }
      if (res.asset) return res.asset
      if ((res as any).data) return (res as any).data
      return res as any
    } catch (err) {
      if (!navigator.onLine) {
        return this.localUpload(file, options)
      }
      throw err
    }
  }

  async remove(id: string): Promise<void> {
    await this.http.delete(`${BASE}/${id}`)
  }

  async removeMany(ids: string[]): Promise<void> {
    await this.http.post(`${BASE}/batch-delete`, { ids })
  }

  async update(id: string, patch: Partial<Pick<AssetItem, 'name' | 'alias' | 'tags' | 'favorite' | 'meta'>>): Promise<AssetItem> {
    const res = await this.http.patch<{ data: AssetItem }>(`${BASE}/${id}`, patch)
    return res.data
  }

  async listTags(): Promise<string[]> {
    try {
      const res = await this.http.get<{ data: string[] }>(`${BASE}/tags`)
      return res.data
    } catch {
      return []
    }
  }

  /* ==================================================================
   *  导出方法（合并自 asset-service v1）
   * ================================================================== */

  /** 单集资产 zip 导出 */
  async exportEpisodeZip(
    episodeAssetIds: string[],
    opts?: { filePrefix?: string; includeThumbs?: boolean },
  ) {
    return this.postBlob('/v1/assets/export/episode', {
      episodeAssetIds,
      filePrefix: opts?.filePrefix ?? 'episode',
      includeThumbs: opts?.includeThumbs ?? true,
    })
  }

  /** 整季资产 zip 导出 */
  async exportSeasonZip(
    projectId: string,
    opts?: { seasonNo?: number; filePrefix?: string },
  ) {
    return this.postBlob('/v1/assets/export/season', {
      projectId,
      seasonNo: opts?.seasonNo,
      filePrefix: opts?.filePrefix ?? 'season',
    })
  }

  /** 字幕 SRT 导出 */
  async exportSrt(
    assetIds: string[],
    opts?: { withSpeaker?: boolean },
  ) {
    return this.postText('/v1/assets/export/srt', {
      assetIds,
      withSpeaker: opts?.withSpeaker ?? true,
    })
  }

  /**
   * 触发浏览器下载 Blob
   */
  downloadBlob(blob: Blob, filename: string): void {
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
  downloadText(text: string, filename: string, mime = 'text/plain'): void {
    this.downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename)
  }

  /* ==================================================================
   *  内部辅助方法
   * ================================================================== */

  /** POST 请求，返回 Blob（zip 下载用） */
  private async postBlob(path: string, body: unknown): Promise<{ blob: Blob; filename: string }> {
    const token = tokenStore.get()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const resp = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`asset-service ${path} failed: ${resp.status} ${text}`)
    }
    const blob = await resp.blob()
    const cd = resp.headers.get('Content-Disposition') ?? ''
    const match = cd.match(/filename="?([^";\n]+)"?/)
    const filename = match?.[1] ?? `export-${Date.now()}.zip`
    return { blob, filename }
  }

  /** POST 请求，返回纯文本（srt 用） */
  private async postText(path: string, body: unknown): Promise<{ text: string; filename: string }> {
    const token = tokenStore.get()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const resp = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers,
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

  private localUpload(file: File, options: { projectId?: string; tags?: string[]; alias?: string }): AssetItem {
    const url = URL.createObjectURL(file)
    const type = this.guessType(file)
    return {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      alias: options.alias ?? null,
      type,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      url,
      thumbnailUrl: type === 'image' ? url : null,
      tags: options.tags ?? [],
      projectId: options.projectId ?? null,
      favorite: false,
      createdAt: new Date().toISOString()
    }
  }

  private guessType(file: File): AssetType {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('audio/')) return 'audio'
    return 'other'
  }

  private cleanFilter(filter: AssetFilter): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== null) {
        if (Array.isArray(v) && v.length === 0) continue
        if (k === 'type' && v === 'all') continue
        out[k] = v
      }
    }
    if (filter.tags && filter.tags.length > 0) {
      out.tags = filter.tags.join(',')
    }
    return out
  }
}

export const assetService = new AssetService()
