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
import { getClient } from '@manhuaworks/api-client'
import type { HttpClient } from '@manhuaworks/api-client'

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
      console.warn('[assetService.list] 失败，返回占位')
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

  async upload(file: File, options: { projectId?: string; tags?: string[]; alias?: string } = {}): Promise<AssetItem> {
    const form = new FormData()
    form.append('file', file)
    if (options.projectId) form.append('projectId', options.projectId)
    if (options.alias) form.append('alias', options.alias)
    if (options.tags?.length) form.append('tags', options.tags.join(','))

    try {
      const res = await this.http.post<{ data: AssetItem }>(`${BASE}`, form)
      return res.data
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
