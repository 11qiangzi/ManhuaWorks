/**
 * notification-service — 通知中心 API 客户端
 * 千机工坊 · 用户后台
 *
 * 后端：collab-service :8091（通过 vite proxy /api/v1/notifications）
 * 鉴权：Bearer JWT（从 localStorage 读 mhw.access_token 或 token）
 */

import axios, { type AxiosInstance } from 'axios'

/* ------------------------------------------------------------------ */
/*                            类型定义                                 */
/* ------------------------------------------------------------------ */

export type NotificationType = 'system' | 'project' | 'billing' | 'collab'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  /** ISO 时间 */
  createdAt: string
  read: boolean
  /** 关联链接（可选） */
  link?: string | null
  /** 附加数据 */
  meta?: Record<string, unknown>
}

export interface NotificationListRes {
  list: Notification[]
  /** 用于下一页的 cursor（ISO 时间戳），null 表示没有更多 */
  nextCursor: string | null
  total: number
}

export interface UnreadCountRes {
  count: number
}

/* ------------------------------------------------------------------ */
/*                            客户端                                   */
/* ------------------------------------------------------------------ */

const BASE = '/api/v1/notifications'

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('mhw.access_token') || localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

class NotificationService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: BASE,
      timeout: 15000
    })
  }

  /**
   * 获取通知列表（游标分页）
   * @param limit  每页数量，默认 20
   * @param before 游标（ISO 时间），取该时间之前的通知
   * @param type   按类型过滤
   */
  async list(
    limit = 20,
    before?: string | null,
    type?: NotificationType | null
  ): Promise<NotificationListRes> {
    const params: Record<string, string | number> = { limit }
    if (before) params.before = before
    if (type) params.type = type

    try {
      const res = await this.client.get<{ data: NotificationListRes }>('', {
        headers: authHeaders(),
        params
      })
      return res.data.data
    } catch {
      // 离线占位：返回空
      return { list: [], nextCursor: null, total: 0 }
    }
  }

  /** 获取未读数量 */
  async unreadCount(): Promise<number> {
    try {
      const res = await this.client.get<{ data: UnreadCountRes }>('/unread-count', {
        headers: authHeaders()
      })
      return res.data.data.count
    } catch {
      return 0
    }
  }

  /** 标记为已读 */
  async markRead(id: string): Promise<void> {
    try {
      await this.client.patch(`/${id}/read`, {}, { headers: authHeaders() })
    } catch {
      /* 静默失败，前端乐观更新 */
    }
  }

  /** 标记为未读 */
  async markUnread(id: string): Promise<void> {
    try {
      await this.client.patch(`/${id}/unread`, {}, { headers: authHeaders() })
    } catch {
      /* 静默失败 */
    }
  }

  /** 批量标记已读 */
  async markAllRead(): Promise<void> {
    try {
      await this.client.post('/mark-all-read', {}, { headers: authHeaders() })
    } catch {
      /* 静默失败 */
    }
  }
}

export const notificationService = new NotificationService()

/* ------------------------------------------------------------------ */
/*                          工具                                       */
/* ------------------------------------------------------------------ */

export const NOTIF_TYPE_META: Record<NotificationType, { label: string; icon: string; color: string }> = {
  system:  { label: '系统', icon: '🔧', color: '#6366f1' },
  project: { label: '项目', icon: '📁', color: '#10b981' },
  billing: { label: '账单', icon: '💳', color: '#f59e0b' },
  collab:  { label: '协作', icon: '👥', color: '#06b6d4' }
}
