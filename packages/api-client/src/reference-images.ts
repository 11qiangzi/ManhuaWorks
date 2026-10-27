/**
 * ManhuaWorks · api-client
 * reference-images module — CRUD + batch + project summary
 */

import type {
  HttpModule,
  ReferenceImagesModule,
  ReferenceImageListOpts,
  ReferenceImageDTO,
  CreateReferenceImageReq,
  UpdateReferenceImageReq,
  BatchCreateReferenceImageReq,
  ProjectRefSummary,
  ID,
} from './types.js'

export function createReferenceImages(http: HttpModule): ReferenceImagesModule {
  return {
    /** 查询某实体的参考图列表 */
    async list(opts: ReferenceImageListOpts) {
      return await http.get<{ items: ReferenceImageDTO[]; total: number }>(
        '/reference-images',
        opts as unknown as Record<string, unknown>,
      )
    },

    /** 新建单条参考图 */
    async create(data: CreateReferenceImageReq) {
      return await http.post<ReferenceImageDTO>('/reference-images', data)
    },

    /** 更新参考图 */
    async update(id: ID, data: UpdateReferenceImageReq) {
      return await http.patch<ReferenceImageDTO>(
        `/reference-images/${encodeURIComponent(id)}`,
        data,
      )
    },

    /** 删除参考图 */
    async remove(id: ID) {
      await http.delete<void>(`/reference-images/${encodeURIComponent(id)}`)
    },

    /** 批量创建参考图 */
    async batchCreate(data: BatchCreateReferenceImageReq) {
      return await http.post<{ created: number; items: ReferenceImageDTO[] }>(
        '/reference-images/batch',
        data,
      )
    },

    /** 项目参考图摘要统计 */
    async getProjectSummary(projectId: ID) {
      return await http.get<ProjectRefSummary>(
        `/reference-images/project/${encodeURIComponent(projectId)}/summary`,
      )
    },
  }
}
