/**
 * asset-service — 资产服务 API 客户端
 * ManhuaWorks · W3 工坊流程精修
 *
 * 后端：asset-service（通过 api-gateway :8080 /v1/assets 代理）
 * 鉴权：Bearer JWT（从 localStorage 读）
 *
 * 支持：图片 / 视频 / 音频 / 其他
 * 上传：multipart/form-data，带进度回调
 */

import axios, { type AxiosInstance, type AxiosProgressEvent } from 'axios'

/* ------------------------------------------------------------------ */
/*                            类型定义                                 */
/* ------------------------------------------------------------------ */

export type AssetType = 'image' | 'video' | 'audio' | 'other'

/** 资产条目 */
export interface AssetItem {
  id: string
  /** 原始文件名 */
  name: string
  /** 用户起的别名（可空） */
  alias?: string | null
  /** 类型 */
  type: AssetType
  /** MIME */
  mime: string
  /** 文件大小（bytes） */
  size: number
  /** 资源 URL（CDN / 本地） */
  url: string
  /** 缩略图 URL */
  thumbnailUrl?: string | null
  /** 时长（音视频，秒） */
  duration?: number | null
  /** 宽 × 高 */
  width?: number | null
  height?: number | null
  /** 标签 */
  tags?: string[]
  /** 所属项目 */
  projectId?: string | null
  /** 收藏 */
  favorite?: boolean
  /** 创建时间 (ISO) */
  createdAt: string
  /** 上传者 */
  uploaderId?: string
  /** 扩展元数据 */
  meta?: Record<string, unknown>
}

/** 列表分页 */
export interface AssetListResp {
  list: AssetItem[]
  total: number
  page: number
  pageSize: number
}

/** 过滤条件 */
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

/** 上传选项 */
export interface AssetUploadOptions {
  projectId?: string | null
  tags?: string[]
  alias?: string
  onProgress?: (loaded: number, total: number) => void
}

/** 上传进度（用于 useAssetShelf 上传队列） */
export interface UploadProgress {
  id: string
  filename: string
  loaded: number
  total: number
  /** 0-100 */
  progress: number
  status: 'uploading' | 'done' | 'error'
  error?: string
}

/* ------------------------------------------------------------------ */
/*                            客户端                                   */
/* ------------------------------------------------------------------ */

const BASE = '/v1/assets'

/** 从 localStorage 读 JWT */
function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

class AssetService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: BASE,
      timeout: 60000
    })
  }

  /** 列表 */
  async list(filter: AssetFilter = {}): Promise<AssetListResp> {
    try {
      const res = await this.client.get<{ data: AssetListResp }>('/', {
        params: this.cleanFilter(filter),
        headers: authHeaders()
      })
      return res.data.data
    } catch (err) {
      // 离线占位：返回空数据
      console.warn('[assetService.list] 失败，返回占位', err)
      return { list: [], total: 0, page: 1, pageSize: filter.pageSize ?? 24 }
    }
  }

  /** 详情 */
  async get(id: string): Promise<AssetItem | null> {
    try {
      const res = await this.client.get<{ data: AssetItem }>(`/${id}`, {
        headers: authHeaders()
      })
      return res.data.data
    } catch {
      return null
    }
  }

  /** 上传 */
  async upload(file: File, options: AssetUploadOptions = {}): Promise<AssetItem> {
    const form = new FormData()
    form.append('file', file)
    if (options.projectId) form.append('projectId', options.projectId)
    if (options.alias) form.append('alias', options.alias)
    if (options.tags && options.tags.length > 0) {
      form.append('tags', options.tags.join(','))
    }

    try {
      const res = await this.client.post<{ data: AssetItem }>('/', form, {
        headers: {
          ...authHeaders(),
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (e: AxiosProgressEvent) => {
          if (options.onProgress && e.total) {
            options.onProgress(e.loaded, e.total)
          }
        }
      })
      return res.data.data
    } catch (err) {
      // 离线模式：返回本地占位
      if (!navigator.onLine) {
        return this.localUpload(file, options)
      }
      throw err
    }
  }

  /** 删除 */
  async remove(id: string): Promise<void> {
    await this.client.delete(`/${id}`, { headers: authHeaders() })
  }

  /** 批量删除 */
  async removeMany(ids: string[]): Promise<void> {
    await this.client.post('/batch-delete', { ids }, { headers: authHeaders() })
  }

  /** 更新（重命名 / 改标签 / 收藏） */
  async update(id: string, patch: Partial<Pick<AssetItem, 'name' | 'alias' | 'tags' | 'favorite' | 'meta'>>): Promise<AssetItem> {
    const res = await this.client.patch<{ data: AssetItem }>(`/${id}`, patch, {
      headers: authHeaders()
    })
    return res.data.data
  }

  /** 获取所有标签（去重） */
  async listTags(): Promise<string[]> {
    try {
      const res = await this.client.get<{ data: string[] }>('/tags', {
        headers: authHeaders()
      })
      return res.data.data
    } catch {
      return []
    }
  }

  /** 离线占位上传（用于演示） */
  private localUpload(file: File, options: AssetUploadOptions): AssetItem {
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

  /** 从 MIME 推断类型 */
  private guessType(file: File): AssetType {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('audio/')) return 'audio'
    return 'other'
  }

  /** 清理 filter（去掉 undefined） */
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
