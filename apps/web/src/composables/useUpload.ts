/**
 * useUpload — 文件上传 composable
 *
 * 封装 asset-service 上传接口，供各编辑器统一调用。
 * 支持：单文件/多文件上传、进度追踪、离线降级、错误处理。
 *
 * 用法：
 *   const { uploadFile, uploadFiles, uploads, isUploading } = useUpload()
 *
 *   // 单文件
 *   const url = await uploadFile(file, { projectId: '...', kind: 'image' })
 *
 *   // 多文件
 *   const results = await uploadFiles(fileList, { projectId: '...' })
 */

import { ref, computed } from 'vue'
import { assetService, type AssetItem } from '@/api/asset-service-v2'

export interface UploadItem {
  id: string
  filename: string
  progress: number
  status: 'uploading' | 'done' | 'error'
  error?: string
  asset?: AssetItem
}

export interface UploadOptions {
  projectId?: string
  tags?: string[]
  kind?: 'image' | 'video' | 'audio' | 'character' | 'scene' | 'shot' | 'episode'
  alias?: string
}

export function useUpload() {
  const uploads = ref<UploadItem[]>([])
  const isUploading = computed(() => uploads.value.some(u => u.status === 'uploading'))

  /**
   * 上传单个文件，返回文件的服务器 URL。
   * 如果上传失败，降级返回本地 blob URL。
   */
  async function uploadFile(file: File, options: UploadOptions = {}): Promise<string> {
    const item: UploadItem = {
      id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      filename: file.name,
      progress: 0,
      status: 'uploading',
    }
    uploads.value.push(item)

    try {
      // 模拟进度（fetch API 不支持 upload progress，用阶段性更新）
      item.progress = 30
      const asset = await assetService.upload(file, {
        projectId: options.projectId,
        tags: options.tags,
        alias: options.alias,
        kind: options.kind,
      })
      item.progress = 100
      item.status = 'done'
      item.asset = asset
      return asset.url
    } catch (err) {
      item.status = 'error'
      item.error = (err as Error).message
      // 降级：返回本地 blob URL（离线/上传失败时仍可用）
      return URL.createObjectURL(file)
    }
  }

  /**
   * 批量上传文件，返回每个文件的 { file, url } 结果。
   */
  async function uploadFiles(
    files: File[] | FileList,
    options: UploadOptions = {},
  ): Promise<Array<{ file: File; url: string; asset?: AssetItem }>> {
    const fileArray = Array.from(files)
    const results: Array<{ file: File; url: string; asset?: AssetItem }> = []

    for (const file of fileArray) {
      const item: UploadItem = {
        id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        filename: file.name,
        progress: 0,
        status: 'uploading',
      }
      uploads.value.push(item)

      try {
        item.progress = 30
        const asset = await assetService.upload(file, {
          projectId: options.projectId,
          tags: options.tags,
          kind: options.kind,
        })
        item.progress = 100
        item.status = 'done'
        item.asset = asset
        results.push({ file, url: asset.url, asset })
      } catch (err) {
        item.status = 'error'
        item.error = (err as Error).message
        // 降级
        results.push({ file, url: URL.createObjectURL(file) })
      }
    }

    return results
  }

  /**
   * 从 input[type=file] 事件或拖拽事件中提取文件并上传。
   */
  async function handleFileInput(
    e: Event,
    options: UploadOptions = {},
  ): Promise<Array<{ file: File; url: string; asset?: AssetItem }>> {
    const input = e.target as HTMLInputElement
    if (!input.files?.length) return []
    const results = await uploadFiles(input.files, options)
    input.value = ''
    return results
  }

  /**
   * 从 DragEvent 中提取文件并上传。
   */
  async function handleDrop(
    e: DragEvent,
    options: UploadOptions = {},
  ): Promise<Array<{ file: File; url: string; asset?: AssetItem }>> {
    e.preventDefault()
    const files = e.dataTransfer?.files
    if (!files?.length) return []
    return uploadFiles(files, options)
  }

  /**
   * 清空上传记录。
   */
  function clearUploads() {
    uploads.value = []
  }

  return {
    uploads,
    isUploading,
    uploadFile,
    uploadFiles,
    handleFileInput,
    handleDrop,
    clearUploads,
  }
}
