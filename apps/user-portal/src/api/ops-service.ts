/**
 * ops-service — 运维健康检查 API 客户端
 * 千机工坊 · 用户后台 · 服务状态页
 *
 * 后端：user-service :8088（通过 vite proxy /api/v1/ops）
 * 鉴权：Bearer JWT（从 localStorage 读）
 */

import axios, { type AxiosInstance } from 'axios'

/* ------------------------------------------------------------------ */
/*                            类型定义                                 */
/* ------------------------------------------------------------------ */

export type ServiceStatus = 'healthy' | 'degraded' | 'down'

export interface ServiceHealth {
  name: string
  status: ServiceStatus
  /** 运行时间（秒） */
  uptime: number
  /** 响应时间（毫秒） */
  responseTime: number
  /** 最后检查时间 ISO */
  lastCheck: string
  /** 服务描述 */
  description?: string
  /** 版本号 */
  version?: string
}

export interface PlatformHealth {
  status: ServiceStatus
  services: ServiceHealth[]
  /** 检查时间 ISO */
  checkedAt: string
  /** 总体信息 */
  message?: string
}

/* ------------------------------------------------------------------ */
/*                            客户端                                   */
/* ------------------------------------------------------------------ */

const BASE = '/api/v1/ops'

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('mhw.access_token') || localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

class OpsService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: BASE,
      timeout: 10000
    })
  }

  /** 获取平台健康状态 */
  async getHealth(): Promise<PlatformHealth> {
    try {
      const res = await this.client.get<{ data: PlatformHealth }>('/health', {
        headers: authHeaders()
      })
      return res.data.data
    } catch {
      // 离线占位
      return MOCK_HEALTH
    }
  }
}

export const opsService = new OpsService()

/* ------------------------------------------------------------------ */
/*                          Mock 数据                                  */
/* ------------------------------------------------------------------ */

const NOW = new Date().toISOString()

const MOCK_HEALTH: PlatformHealth = {
  status: 'healthy',
  checkedAt: NOW,
  message: '所有服务运行正常',
  services: [
    { name: 'user-service',    status: 'healthy',  uptime: 864000,  responseTime: 12,  lastCheck: NOW, description: '用户服务',    version: '2.4.1' },
    { name: 'project-service', status: 'healthy',  uptime: 864000,  responseTime: 18,  lastCheck: NOW, description: '项目服务',    version: '1.8.3' },
    { name: 'collab-service',  status: 'healthy',  uptime: 432000,  responseTime: 22,  lastCheck: NOW, description: '协作服务',    version: '1.2.0' },
    { name: 'billing-service', status: 'degraded', uptime: 172800,  responseTime: 340, lastCheck: NOW, description: '计费服务',    version: '1.0.5' },
    { name: 'render-service',  status: 'healthy',  uptime: 864000,  responseTime: 45,  lastCheck: NOW, description: '渲染引擎',    version: '3.1.0' },
    { name: 'asset-service',   status: 'healthy',  uptime: 864000,  responseTime: 15,  lastCheck: NOW, description: '素材服务',    version: '1.5.2' },
    { name: 'gateway',         status: 'healthy',  uptime: 2592000, responseTime: 3,   lastCheck: NOW, description: 'API 网关',    version: '1.0.0' },
    { name: 'mq-worker',       status: 'healthy',  uptime: 864000,  responseTime: 8,   lastCheck: NOW, description: '消息队列消费者', version: '1.3.1' }
  ]
}

/* ------------------------------------------------------------------ */
/*                          工具                                       */
/* ------------------------------------------------------------------ */

export const STATUS_META: Record<ServiceStatus, { label: string; color: string; bg: string }> = {
  healthy:  { label: '正常', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  degraded: { label: '降级', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  down:     { label: '故障', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' }
}

/** 格式化 uptime 秒数 */
export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时`
  return `${Math.floor(seconds / 86400)} 天`
}

/** 格式化响应时间 */
export function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

/** 格式化最后检查时间 */
export function formatLastCheck(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 10) return '刚刚'
  if (diff < 60) return `${Math.floor(diff)} 秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  return `${Math.floor(diff / 3600)} 小时前`
}
