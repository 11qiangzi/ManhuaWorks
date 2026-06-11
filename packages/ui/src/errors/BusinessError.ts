import { AppError, ErrorCodes } from './AppError'

/** 业务错误：工作流、配额、生成失败、支付等 */
export class BusinessError extends AppError {
  constructor(
    code:
      | typeof ErrorCodes.RESOURCE_NOT_FOUND
      | typeof ErrorCodes.RESOURCE_CONFLICT
      | typeof ErrorCodes.QUOTA_EXCEEDED
      | typeof ErrorCodes.PAYMENT_REQUIRED
      | typeof ErrorCodes.WORKFLOW_INVALID
      | typeof ErrorCodes.WORKFLOW_TIMEOUT
      | typeof ErrorCodes.GENERATION_FAILED
      | typeof ErrorCodes.UPLOAD_FAILED
      | typeof ErrorCodes.RATE_LIMITED
      | string,
    message: string,
    options: ConstructorParameters<typeof AppError>[2] = {}
  ) {
    super(code, message, { severity: 'medium', ...options })
    this.name = 'BusinessError'
  }

  /** 工厂：资源不存在 */
  static resourceNotFound(resource: string, id?: string): BusinessError {
    return new BusinessError(
      ErrorCodes.RESOURCE_NOT_FOUND,
      `${resource} 不存在${id ? `: ${id}` : ''}`,
      { meta: { resourceId: id, context: { resource } } }
    )
  }

  /** 工厂：资源冲突 */
  static resourceConflict(resource: string, reason?: string): BusinessError {
    return new BusinessError(
      ErrorCodes.RESOURCE_CONFLICT,
      `${resource} 冲突${reason ? `: ${reason}` : ''}`,
      { meta: { context: { resource, reason } } }
    )
  }

  /** 工厂：配额用尽 */
  static quotaExceeded(quota: string, limit?: number): BusinessError {
    return new BusinessError(
      ErrorCodes.QUOTA_EXCEEDED,
      `配额已用尽: ${quota}${limit ? ` (上限 ${limit})` : ''}`,
      {
        severity: 'high',
        meta: { context: { quota, limit } }
      }
    )
  }

  /** 工厂：工作流失败 */
  static workflowInvalid(stage: string, reason?: string): BusinessError {
    return new BusinessError(
      ErrorCodes.WORKFLOW_INVALID,
      `工作流 ${stage} 失败${reason ? `: ${reason}` : ''}`,
      { meta: { context: { stage, reason } } }
    )
  }

  /** 工厂：生成失败（图片/视频/音频） */
  static generationFailed(model: string, reason?: string): BusinessError {
    return new BusinessError(
      ErrorCodes.GENERATION_FAILED,
      `${model} 生成失败${reason ? `: ${reason}` : ''}`,
      {
        severity: 'high',
        meta: { context: { model, reason }, retryAfterMs: 3000 }
      }
    )
  }

  /** 工厂：上传失败 */
  static uploadFailed(filename: string, reason?: string): BusinessError {
    return new BusinessError(
      ErrorCodes.UPLOAD_FAILED,
      `上传 ${filename} 失败${reason ? `: ${reason}` : ''}`,
      { meta: { context: { filename, reason } } }
    )
  }
}
