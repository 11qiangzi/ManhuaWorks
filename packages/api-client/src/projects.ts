/**
 * ManhuaWorks · api-client
 * projects module — CRUD + version + member + shot + tag + invite + 8 方法
 */

import type { HttpModule, ProjectsModule } from './types.js'
import type {
  CreateProjectReq, ProjectDTO, UpdateProjectReq, PageResp, ProjectMemberDTO,
  InviteMemberReq, ShotDTO, CreateShotReq, UpdateShotReq,
  TagDTO, ProjectVersionDTO, UserDTO, UserStatus, UpdateUserReq,
  ID, ProjectStatus,
} from './types.js'

export function createProjects(http: HttpModule): ProjectsModule {
  return {
    /* ---------------- Project CRUD ---------------- */
    async list(q: { page?: number; pageSize?: number; keyword?: string; status?: ProjectStatus } = {}) {
      return await http.get<PageResp<ProjectDTO>>('/projects', q as Record<string, unknown>)
    },
    async get(id: ID) {
      return await http.get<ProjectDTO>(`/projects/${encodeURIComponent(id)}`)
    },
    async create(req: CreateProjectReq) {
      return await http.post<ProjectDTO>('/projects', req)
    },
    async update(id: ID, patch: UpdateProjectReq) {
      return await http.patch<ProjectDTO>(`/projects/${encodeURIComponent(id)}`, patch)
    },
    async archive(id: ID) {
      await http.post<void>(`/projects/${encodeURIComponent(id)}/archive`, {})
    },
    async remove(id: ID) {
      await http.delete<void>(`/projects/${encodeURIComponent(id)}`)
    },

    /* ---------------- Member ---------------- */
    async listMembers(projectId: ID) {
      return await http.get<ProjectMemberDTO[]>(`/projects/${encodeURIComponent(projectId)}/members`)
    },
    async inviteMember(projectId: ID, req: InviteMemberReq) {
      return await http.post<ProjectMemberDTO>(`/projects/${encodeURIComponent(projectId)}/members`, req)
    },
    async removeMember(projectId: ID, userId: ID) {
      await http.delete<void>(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`)
    },

    /* ---------------- Shot ---------------- */
    async listShots(projectId: ID, q: { page?: number; pageSize?: number; status?: ShotDTO['status'] } = {}) {
      return await http.get<PageResp<ShotDTO>>(`/projects/${encodeURIComponent(projectId)}/shots`, q as Record<string, unknown>)
    },
    async createShot(projectId: ID, req: CreateShotReq) {
      return await http.post<ShotDTO>(`/projects/${encodeURIComponent(projectId)}/shots`, req)
    },
    async updateShot(projectId: ID, shotId: ID, patch: UpdateShotReq) {
      return await http.patch<ShotDTO>(`/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}`, patch)
    },
    async deleteShot(projectId: ID, shotId: ID) {
      await http.delete<void>(`/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}`)
    },

    /* ---------------- Tag ---------------- */
    async listTags(projectId: ID) {
      return await http.get<TagDTO[]>(`/projects/${encodeURIComponent(projectId)}/tags`)
    },

    /* ---------------- Version ---------------- */
    async listVersions(projectId: ID) {
      return await http.get<ProjectVersionDTO[]>(`/projects/${encodeURIComponent(projectId)}/versions`)
    },
    async publishVersion(projectId: ID, req: { version: string; message?: string }) {
      return await http.post<ProjectVersionDTO>(`/projects/${encodeURIComponent(projectId)}/versions`, req)
    },

    /* ---------------- 全局用户管理（admin-portal） ---------------- */
    async listUsers(q: { page?: number; pageSize?: number; keyword?: string; status?: UserStatus; role?: number }) {
      return await http.get<PageResp<UserDTO>>('/users', q as Record<string, unknown>)
    },
    async getUser(id: ID) {
      return await http.get<UserDTO>(`/users/${encodeURIComponent(id)}`)
    },
    async updateUser(id: ID, patch: UpdateUserReq) {
      return await http.patch<UserDTO>(`/users/${encodeURIComponent(id)}`, patch)
    },
    async disableUser(id: ID) {
      await http.post<void>(`/users/${encodeURIComponent(id)}/disable`, {})
    },
  }
}
