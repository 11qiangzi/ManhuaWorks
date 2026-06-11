/**
 * project-service — 项目服务 API 客户端
 * ManhuaWorks · W4 用户后台
 *
 * 后端：project-service（通过 api-gateway :8080 /v1/projects 代理）
 * 鉴权：Bearer JWT
 *
 * 支持：
 * - 我的项目（CRUD）
 * - 状态筛选（draft / active / archived / published）
 * - 状态机（自动 / 手动）
 */

import axios, { type AxiosInstance } from 'axios'
import { tokenStore } from '@manhuaworks/api-client'

/* ------------------------------------------------------------------ */
/*                            类型定义                                 */
/* ------------------------------------------------------------------ */

/** 项目状态 */
export type ProjectStatus = 'draft' | 'active' | 'archived' | 'published'

/** 项目 */
export interface Project {
  id: string
  /** 项目名 */
  name: string
  /** 项目简介 */
  description?: string
  /** 封面图（emoji 或 URL） */
  cover?: string | null
  /** 状态 */
  status: ProjectStatus
  /** 标签 */
  tags?: string[]
  /** 关联作品数 */
  workCount?: number
  /** 关联素材数 */
  assetCount?: number
  /** 所属团队 ID（可空：个人项目） */
  teamId?: string | null
  /** 创建时间 ISO */
  createdAt: string
  /** 最后更新时间 ISO */
  updatedAt: string
}

/** 列表响应 */
export interface ProjectListResp {
  list: Project[]
  total: number
  page: number
  pageSize: number
}

/** 过滤 */
export interface ProjectFilter {
  status?: ProjectStatus | 'all'
  keyword?: string
  tag?: string
  page?: number
  pageSize?: number
  sortBy?: 'updatedAt' | 'createdAt' | 'name'
  sortDir?: 'asc' | 'desc'
}

/** 创建请求 */
export interface CreateProjectReq {
  title: string
  description?: string
  cover?: string
  tags?: string[]
  /** 模板 ID（可空：从空项目开始） */
  templateId?: string
}

/** 更新请求 */
export interface UpdateProjectReq {
  name?: string
  description?: string
  cover?: string
  tags?: string[]
  status?: ProjectStatus
}

/* ------------------------------------------------------------------ */
/*                            客户端                                   */
/* ------------------------------------------------------------------ */

const BASE = '/api/v1/projects'

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  const token = tokenStore.get()
  if (token) h.Authorization = `Bearer ${token}`
  // 后端 project-service 要求 x-mhw-user-id header
  const u = tokenStore.getUser<{ id?: string }>()
  if (u?.id) h['x-mhw-user-id'] = u.id
  return h
}

class ProjectService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: BASE,
      timeout: 15000
    })
  }

  /** 列表 */
  async list(filter: ProjectFilter = {}): Promise<ProjectListResp> {
    try {
      const res = await this.client.get<{ data: { items?: Project[]; list?: Project[]; total?: number; count?: number; page?: number; pageSize?: number } }>('/', {
        params: this.cleanFilter(filter),
        headers: authHeaders()
      })
      const d = res.data.data
      const itemsRaw = d.items ?? d.list ?? []
      // 后端 snake + 数字 status -> 前端 camel + 字符串 status
      const statusMap: Record<number, ProjectStatus> = { 0: 'draft', 1: 'active', 2: 'published', 3: 'archived' }
      const items: Project[] = itemsRaw.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        name: ((r.title as string) ?? (r.name as string) ?? ''),
        description: (r.description as string) ?? undefined,
        cover: ((r.cover_url as string) ?? (r.cover as string) ?? null),
        status: statusMap[Number(r.status)] ?? 'draft',
        tags: ((r.tags as string[]) ?? []),
        workCount: Number((r.work_count as number) ?? (r.workCount as number) ?? 0),
        assetCount: Number((r.asset_count as number) ?? (r.assetCount as number) ?? 0),
        teamId: ((r.team_id as string) ?? (r.teamId as string) ?? null),
        createdAt: String((r.created_at as string) ?? (r.createdAt as string) ?? new Date().toISOString()),
        updatedAt: String((r.updated_at as string) ?? (r.updatedAt as string) ?? new Date().toISOString()),
      }))
      return {
        list: items,
        total: d.total ?? d.count ?? items.length,
        page: d.page ?? 1,
        pageSize: d.pageSize ?? filter.pageSize ?? 20
      }
    } catch (err) {
      console.warn('[projectService.list] 失败，返回占位', err)
      return { list: [], total: 0, page: 1, pageSize: filter.pageSize ?? 20 }
    }
  }

  /** 详情 */
  async get(id: string): Promise<Project | null> {
    try {
      const res = await this.client.get<{ data: Project }>(`/${id}`, {
        headers: authHeaders()
      })
      return res.data.data
    } catch {
      return null
    }
  }

  /** 创建 */
  async create(req: CreateProjectReq): Promise<Project> {
    // 兼容: 前端叫 title (后端真实字段)
    const body: Record<string, unknown> = { title: (req as { title?: string; name?: string }).title ?? (req as { name?: string }).name }
    if (req.description) body.description = req.description
    if (req.cover) body.cover = req.cover
    if (req.tags) body.tags = req.tags
    if (req.templateId) body.templateId = req.templateId
    const res = await this.client.post<{ data: Project }>('/', body, {
      headers: authHeaders()
    })
    return res.data.data
  }

  /** 更新 */
  async update(id: string, patch: UpdateProjectReq): Promise<Project> {
    const res = await this.client.patch<{ data: Project }>(`/${id}`, patch, {
      headers: authHeaders()
    })
    return res.data.data
  }

  /** 删除 */
  async remove(id: string): Promise<void> {
    await this.client.delete(`/${id}`, { headers: authHeaders() })
  }

  /** 归档 */
  async archive(id: string): Promise<Project> {
    return this.update(id, { status: 'archived' })
  }

  /** 取消归档 */
  async unarchive(id: string): Promise<Project> {
    return this.update(id, { status: 'active' })
  }

  /** 清理 filter */
  private cleanFilter(filter: ProjectFilter): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(filter)) {
      if (v === undefined || v === null) continue
      if (k === 'status' && v === 'all') continue
      if (typeof v === 'string' && v.trim() === '') continue
      out[k] = v
    }
    return out
  }
}

export const projectService = new ProjectService()

/* ------------------------------------------------------------------ */
/*                          工具函数                                    */
/* ------------------------------------------------------------------ */

/** 状态展示元数据 */
export const STATUS_META: Record<ProjectStatus, { label: string; color: string; icon: string }> = {
  draft: { label: '草稿', color: '#8a8f99', icon: '📝' },
  active: { label: '进行中', color: '#ff7a45', icon: '🔥' },
  archived: { label: '已归档', color: '#6b7280', icon: '📦' },
  published: { label: '已发布', color: '#10b981', icon: '✨' }
}

/** 状态颜色变量映射 */
export function statusVarColor(status: ProjectStatus): string {
  switch (status) {
    case 'draft': return '--text-secondary'
    case 'active': return '--accent'
    case 'archived': return '--border-strong'
    case 'published': return '--success'
    default: return '--text-secondary'
  }
}