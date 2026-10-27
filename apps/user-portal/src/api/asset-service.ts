/**
 * asset-service — 素材库 API 客户端
 * 千机工坊 · W4 用户后台
 *
 * 与 W3 studio 资产货架的区别：
 * 1. 多了"角色 / 场景"两个分类（用户后台管理所有素材）
 * 2. 支持"按标签 + 按分类 + 按上传者"多重筛选
 * 3. 支持批量操作
 */

import axios, { type AxiosInstance } from 'axios'

/* ------------------------------------------------------------------ */
/*                            类型定义                                 */
/* ------------------------------------------------------------------ */

/** 素材分类 */
export type AssetCategory = 'image' | 'video' | 'audio' | 'character' | 'scene'

/** 素材 */
export interface LibraryItem {
  id: string
  /** 名称 */
  name: string
  /** 分类 */
  category: AssetCategory
  /** 缩略图 URL */
  thumbnail?: string | null
  /** 文件 URL */
  url?: string | null
  /** 文件大小 bytes */
  size?: number
  /** 时长（音视频） */
  duration?: number
  /** 维度 */
  width?: number
  height?: number
  /** 标签 */
  tags: string[]
  /** 角色 / 场景 描述（仅 character/scene 分类） */
  description?: string
  /** 关联项目数（被引用次数） */
  usedCount: number
  /** 收藏 */
  favorite: boolean
  /** 创建时间 */
  createdAt: string
  /** 上传者 */
  uploader?: string
}

/** 列表响应 */
export interface LibraryListResp {
  list: LibraryItem[]
  total: number
  page: number
  pageSize: number
}

/** 过滤 */
export interface LibraryFilter {
  category?: AssetCategory | 'all'
  tags?: string[]
  favorite?: boolean
  keyword?: string
  page?: number
  pageSize?: number
  sortBy?: 'createdAt' | 'name' | 'usedCount' | 'size'
  sortDir?: 'asc' | 'desc'
}

/* ------------------------------------------------------------------ */
/*                            客户端                                   */
/* ------------------------------------------------------------------ */

const BASE = '/v1/library'

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

class AssetLibraryService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: BASE,
      timeout: 30000
    })
  }

  /** 列表 */
  async list(filter: LibraryFilter = {}): Promise<LibraryListResp> {
    try {
      const res = await this.client.get<{ data: LibraryListResp }>('/', {
        params: this.cleanFilter(filter),
        headers: authHeaders()
      })
      return res.data.data
    } catch {
      return { list: [], total: 0, page: 1, pageSize: filter.pageSize ?? 24 }
    }
  }

  /** 详情 */
  async get(id: string): Promise<LibraryItem | null> {
    try {
      const res = await this.client.get<{ data: LibraryItem }>(`/${id}`, {
        headers: authHeaders()
      })
      return res.data.data
    } catch {
      return null
    }
  }

  /** 上传（multipart） */
  async upload(file: File, meta: { category?: AssetCategory; tags?: string[]; alias?: string } = {}): Promise<LibraryItem> {
    const form = new FormData()
    form.append('file', file)
    if (meta.category) form.append('category', meta.category)
    if (meta.alias) form.append('alias', meta.alias)
    if (meta.tags && meta.tags.length > 0) form.append('tags', meta.tags.join(','))
    const res = await this.client.post<{ data: LibraryItem }>('/', form, {
      headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' }
    })
    return res.data.data
  }

  /** 删除 */
  async remove(id: string): Promise<void> {
    await this.client.delete(`/${id}`, { headers: authHeaders() })
  }

  /** 批量删除 */
  async removeMany(ids: string[]): Promise<void> {
    await this.client.post('/batch-delete', { ids }, { headers: authHeaders() })
  }

  /** 更新 */
  async update(id: string, patch: Partial<Pick<LibraryItem, 'name' | 'tags' | 'favorite' | 'description' | 'category'>>): Promise<LibraryItem> {
    const res = await this.client.patch<{ data: LibraryItem }>(`/${id}`, patch, {
      headers: authHeaders()
    })
    return res.data.data
  }

  /** 收藏切换 */
  async toggleFavorite(id: string): Promise<LibraryItem> {
    const res = await this.client.post<{ data: LibraryItem }>(`/${id}/favorite`, {}, {
      headers: authHeaders()
    })
    return res.data.data
  }

  /** 获取所有标签 */
  async listTags(category?: AssetCategory): Promise<string[]> {
    try {
      const res = await this.client.get<{ data: string[] }>('/tags', {
        params: category ? { category } : undefined,
        headers: authHeaders()
      })
      return res.data.data
    } catch {
      return []
    }
  }

  /** 清理 filter */
  private cleanFilter(filter: LibraryFilter): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(filter)) {
      if (v === undefined || v === null) continue
      if (k === 'category' && v === 'all') continue
      if (Array.isArray(v) && v.length === 0) continue
      if (typeof v === 'string' && v.trim() === '') continue
      out[k] = v
    }
    if (filter.tags && filter.tags.length > 0) {
      out.tags = filter.tags.join(',')
    }
    return out
  }
}

export const assetLibraryService = new AssetLibraryService()

/* ------------------------------------------------------------------ */
/*                          工具函数                                    */
/* ------------------------------------------------------------------ */

/** 分类元数据 */
export const CATEGORY_META: Record<AssetCategory, { label: string; icon: string; color: string }> = {
  image: { label: '图片', icon: '🖼', color: '#ff7a45' },
  video: { label: '视频', icon: '🎬', color: '#a8302b' },
  audio: { label: '音频', icon: '🎵', color: '#10b981' },
  character: { label: '角色', icon: '👤', color: '#2563eb' },
  scene: { label: '场景', icon: '🌆', color: '#9333ea' }
}

/** 从 MIME 推断分类 */
export function inferCategoryFromMime(mime: string): AssetCategory {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'image'
}

/** 文件大小格式化 */
export function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}