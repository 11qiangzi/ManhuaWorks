/**
 * work-service — 我的作品 API 客户端
 * ManhuaWorks · W4 用户后台
 *
 * 区别于 asset-service：作品是"完整可发布的成果"
 * （视频/动画/合集）—— 来自 project-service 的发布产物
 */

import axios, { type AxiosInstance } from 'axios'

/* ------------------------------------------------------------------ */
/*                            类型定义                                 */
/* ------------------------------------------------------------------ */

/** 作品类型 */
export type WorkType = 'video' | 'animation' | 'comic' | 'audiobook'

/** 作品可见性 */
export type WorkVisibility = 'public' | 'unlisted' | 'private'

/** 作品 */
export interface Work {
  id: string
  /** 作品标题 */
  title: string
  /** 关联项目 ID */
  projectId: string
  /** 缩略图 */
  thumbnail?: string | null
  /** 播放 URL */
  playUrl?: string | null
  /** 下载 URL（带签名） */
  downloadUrl?: string | null
  /** 时长（秒） */
  duration?: number
  /** 类型 */
  type: WorkType
  /** 可见性 */
  visibility: WorkVisibility
  /** 播放量 */
  views: number
  /** 点赞数 */
  likes: number
  /** 评论数 */
  comments?: number
  /** 创建时间 ISO */
  createdAt: string
  /** 发布时间 ISO */
  publishedAt?: string | null
  /** 标签 */
  tags?: string[]
  /** 描述 */
  description?: string
}

/** 列表 */
export interface WorkListResp {
  list: Work[]
  total: number
  page: number
  pageSize: number
}

/** 过滤 */
export interface WorkFilter {
  type?: WorkType | 'all'
  visibility?: WorkVisibility | 'all'
  projectId?: string
  keyword?: string
  page?: number
  pageSize?: number
  sortBy?: 'publishedAt' | 'createdAt' | 'views' | 'likes'
  sortDir?: 'asc' | 'desc'
}

/* ------------------------------------------------------------------ */
/*                            客户端                                   */
/* ------------------------------------------------------------------ */

const BASE = '/v1/works'

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

class WorkService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: BASE,
      timeout: 15000
    })
  }

  /** 列表 */
  async list(filter: WorkFilter = {}): Promise<WorkListResp> {
    try {
      const res = await this.client.get<{ data: WorkListResp }>('/', {
        params: this.cleanFilter(filter),
        headers: authHeaders()
      })
      return res.data.data
    } catch (err) {
      console.warn('[workService.list] 失败，返回占位', err)
      return { list: [], total: 0, page: 1, pageSize: filter.pageSize ?? 24 }
    }
  }

  /** 详情 */
  async get(id: string): Promise<Work | null> {
    try {
      const res = await this.client.get<{ data: Work }>(`/${id}`, {
        headers: authHeaders()
      })
      return res.data.data
    } catch {
      return null
    }
  }

  /** 更新可见性 */
  async updateVisibility(id: string, visibility: WorkVisibility): Promise<Work> {
    const res = await this.client.patch<{ data: Work }>(`/${id}`, { visibility }, {
      headers: authHeaders()
    })
    return res.data.data
  }

  /** 删除 */
  async remove(id: string): Promise<void> {
    await this.client.delete(`/${id}`, { headers: authHeaders() })
  }

  /** 分享链接（生成短链） */
  async getShareLink(id: string): Promise<{ url: string; expiresAt: string }> {
    try {
      const res = await this.client.post<{ data: { url: string; expiresAt: string } }>(`/${id}/share`, {}, {
        headers: authHeaders()
      })
      return res.data.data
    } catch {
      // 占位：直接返回当前 URL
      return {
        url: `${window.location.origin}/works/${id}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      }
    }
  }

  /** 清理 filter */
  private cleanFilter(filter: WorkFilter): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(filter)) {
      if (v === undefined || v === null) continue
      if (k === 'type' && v === 'all') continue
      if (k === 'visibility' && v === 'all') continue
      if (typeof v === 'string' && v.trim() === '') continue
      out[k] = v
    }
    return out
  }
}

export const workService = new WorkService()

/* ------------------------------------------------------------------ */
/*                          工具函数                                    */
/* ------------------------------------------------------------------ */

/** 类型元数据 */
export const TYPE_META: Record<WorkType, { label: string; icon: string; color: string }> = {
  video: { label: '视频', icon: '🎬', color: '#ff7a45' },
  animation: { label: '动画', icon: '🎞️', color: '#a8302b' },
  comic: { label: '漫画', icon: '📖', color: '#2563eb' },
  audiobook: { label: '有声', icon: '🎙️', color: '#10b981' }
}

/** 可见性元数据 */
export const VISIBILITY_META: Record<WorkVisibility, { label: string; icon: string }> = {
  public: { label: '公开', icon: '🌐' },
  unlisted: { label: '不公开', icon: '🔗' },
  private: { label: '私密', icon: '🔒' }
}

/** 时长格式化 */
export function formatDuration(s?: number): string {
  if (!s || s <= 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    return `${h}:${mm.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }
  return `${m}:${sec.toString().padStart(2, '0')}`
}

/** 数字格式化（1.2k / 3.4w） */
export function formatCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`
  if (n < 100000000) return `${(n / 10000).toFixed(1)}w`
  return `${(n / 100000000).toFixed(1)}亿`
}