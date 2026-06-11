import { AppError, ErrorCodes } from './AppError'

/** 网络错误：离线、超时、DNS、连接重置等 */
export class NetworkError extends AppError {
  constructor(
    code:
      | typeof ErrorCodes.NETWORK_OFFLINE
      | typeof ErrorCodes.NETWORK_TIMEOUT
      | typeof ErrorCodes.NETWORK_DNS
      | typeof ErrorCodes.NETWORK_RESET
      | typeof ErrorCodes.CORS_BLOCKED
      | typeof ErrorCodes.SSL_ERROR
      | typeof ErrorCodes.WEBSOCKET_CLOSED
      | typeof ErrorCodes.WEBSOCKET_TIMEOUT = ErrorCodes.NETWORK_OFFLINE,
    message: string = '网络错误',
    options: ConstructorParameters<typeof AppError>[2] = {}
  ) {
    super(code, message, { severity: 'high', ...options })
    this.name = 'NetworkError'
  }

  static offline(): NetworkError {
    return new NetworkError(ErrorCodes.NETWORK_OFFLINE, '当前处于离线状态', {
      severity: 'high'
    })
  }

  static timeout(url?: string): NetworkError {
    return new NetworkError(ErrorCodes.NETWORK_TIMEOUT, '请求超时', {
      meta: { context: { url }, retryAfterMs: 1000 }
    })
  }

  static dns(host: string): NetworkError {
    return new NetworkError(
      ErrorCodes.NETWORK_DNS,
      `DNS 解析失败: ${host}`,
      { meta: { context: { host } } }
    )
  }

  static websocketClosed(reason?: string): NetworkError {
    return new NetworkError(
      ErrorCodes.WEBSOCKET_CLOSED,
      `WebSocket 已断开: ${reason ?? '未知原因'}`,
      { meta: { context: { reason } } }
    )
  }
}
