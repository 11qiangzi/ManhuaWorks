/**
 * user-service — 用户信息服务 API 客户端
 * ManhuaWorks · W4 用户后台
 *
 * 后端：user-service（通过 api-gateway :8080 /v1/users 代理）
 * 鉴权：Bearer JWT（从 localStorage 读）
 */

import axios, { type AxiosInstance } from 'axios'

/* ------------------------------------------------------------------ */
/*                            类型定义                                 */
/* ------------------------------------------------------------------ */

/** 订阅等级 */
export type UserPlan = 'free' | 'basic' | 'pro' | 'enterprise'

/** 通知偏好 */
export interface NotificationPrefs {
  email: boolean
  sms: boolean
  inApp: boolean
  /** 关注的项目更新 */
  projectUpdates: boolean
  /** 团队动态 */
  teamActivity: boolean
  /** 营销推送 */
  marketing: boolean
}

/** 用户档案 */
export interface UserProfile {
  id: string
  /** 手机号 */
  phone?: string
  /** 邮箱 */
  email?: string
  /** 昵称 */
  nickname: string
  /** 头像 URL */
  avatar?: string | null
  /** 个人简介 */
  bio?: string
  /** 订阅等级 */
  plan: UserPlan
  /** 订阅到期（ISO） */
  planExpiresAt?: string | null
  /** 已用积分 / 总积分 */
  creditsUsed?: number
  creditsTotal?: number
  /** 通知偏好 */
  notifications?: NotificationPrefs
  /** 创建时间 */
  createdAt: string
}

/** 更新档案请求 */
export interface UpdateProfileReq {
  nickname?: string
  bio?: string
  avatar?: string
}

/** 更新通知偏好请求 */
export interface UpdateNotifReq {
  notifications: Partial<NotificationPrefs>
}

/* ------------------------------------------------------------------ */
/*                            客户端                                   */
/* ------------------------------------------------------------------ */

const BASE = '/v1/users'

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

class UserService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: BASE,
      timeout: 15000
    })
  }

  /** 获取当前用户档案 */
  async me(): Promise<UserProfile | null> {
    try {
      const res = await this.client.get<{ data: UserProfile }>('/me', {
        headers: authHeaders()
      })
      return res.data.data
    } catch {
      // 离线占位：读 localStorage
      try {
        const raw = localStorage.getItem('user')
        if (raw) {
          const u = JSON.parse(raw)
          return {
            id: u.id ?? 'u-dev',
            nickname: u.nickname ?? '创作者',
            phone: u.phone,
            email: u.email,
            avatar: u.avatar ?? null,
            plan: u.plan ?? 'pro',
            bio: u.bio ?? '',
            createdAt: u.createdAt ?? new Date().toISOString(),
            creditsUsed: u.creditsUsed ?? 0,
            creditsTotal: u.creditsTotal ?? 1000,
            notifications: u.notifications ?? {
              email: true,
              sms: false,
              inApp: true,
              projectUpdates: true,
              teamActivity: true,
              marketing: false
            }
          }
        }
      } catch { /* ignore */ }
      return null
    }
  }

  /** 更新档案 */
  async updateProfile(patch: UpdateProfileReq): Promise<UserProfile> {
    const res = await this.client.patch<{ data: UserProfile }>('/me', patch, {
      headers: authHeaders()
    })
    return res.data.data
  }

  /** 更新通知偏好 */
  async updateNotifications(patch: UpdateNotifReq): Promise<UserProfile> {
    const res = await this.client.patch<{ data: UserProfile }>('/me/notifications', patch, {
      headers: authHeaders()
    })
    return res.data.data
  }

  /** 上传头像（multipart） */
  async uploadAvatar(file: File): Promise<{ url: string }> {
    const form = new FormData()
    form.append('avatar', file)
    const res = await this.client.post<{ data: { url: string } }>('/me/avatar', form, {
      headers: {
        ...authHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    })
    return res.data.data
  }
}

export const userService = new UserService()

/* ------------------------------------------------------------------ */
/*                          工具函数                                    */
/* ------------------------------------------------------------------ */

/** 订阅等级展示元数据 */
export const PLAN_META: Record<UserPlan, { label: string; color: string; quota: string }> = {
  free: { label: '免费版', color: '#8a8f99', quota: '100 积分/月' },
  basic: { label: '基础版', color: '#2563eb', quota: '1000 积分/月' },
  pro: { label: '专业版', color: '#ff7a45', quota: '5000 积分/月' },
  enterprise: { label: '企业版', color: '#a8302b', quota: '不限量' }
}

/** BYOK Key 健康映射到 plan */
export function planFromKeyStatus(hasValidKey: boolean, currentPlan: UserPlan): UserPlan {
  if (currentPlan === 'enterprise') return 'enterprise'
  if (hasValidKey) return currentPlan === 'free' ? 'pro' : currentPlan
  return currentPlan
}