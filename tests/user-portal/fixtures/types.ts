/**
 * user-portal 类型定义 stubs
 *
 * 这些类型与 `apps/user-portal/src/types/*.ts` 中的真实类型保持一致
 * （在 W4 任务 1 完成后会与真实类型同步）
 */

export type Plan = 'free' | 'basic' | 'pro' | 'enterprise'

export interface User {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  bio?: string
  plan: Plan
  plan_expires_at: string | null
  created_at: string
  stats?: {
    projects: number
    works: number
    assets: number
    collaborators: number
  }
}

export interface Usage {
  storage: { used_mb: number; limit_mb: number; percent: number }
  ai_tokens: { used: number; limit: number; percent: number }
  exports: { used: number; limit: number }
  bandwidth_mb: { used: number; limit: number }
}

export interface Project {
  id: string
  name: string
  cover_url: string | null
  type: 'novel' | 'drama' | 'audiobook' | 'manga'
  asset_count: number
  member_count: number
  last_opened_at: string
  created_at: string
}

export interface Work {
  id: string
  title: string
  type: 'drama' | 'manga' | 'audiobook' | 'novel'
  cover_url: string | null
  duration_sec: number
  status: 'draft' | 'in_progress' | 'completed' | 'published'
  project_id: string
  updated_at: string
}

export interface Asset {
  id: string
  filename: string
  type: 'image' | 'video' | 'audio' | 'subtitle' | 'document'
  size_mb: number
  url: string
  thumbnail_url: string | null
  project_id: string | null
  created_at: string
}

export interface LibraryGroup {
  type: Asset['type']
  count: number
  used_mb: number
}

export interface LibraryView {
  groups: LibraryGroup[]
  total: number
  total_mb: number
}

export interface Member {
  user_id: string
  display_name: string
  avatar_url: string | null
  role: 'owner' | 'admin' | 'editor' | 'commenter' | 'viewer'
  email: string
  joined_at: string
  last_active_at: string
}

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  icon?: string
  link?: string
  read: boolean
  actor?: { id: string; display_name: string; avatar_url: string | null }
  created_at: string
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
  trace_id?: string
}
