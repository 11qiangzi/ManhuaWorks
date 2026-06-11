/**
 * Vitest 全局 setup
 *
 * 每个测试文件运行前执行一次：
 *  - 注入 NODE_ENV=test
 *  - 给 collab-service 注入 in-memory 模式标识
 *  - 静默已知 noisy logger
 */

import { vi, beforeEach, afterEach } from 'vitest'

// 1) 强制 test 环境
process.env.NODE_ENV = 'test'
process.env.COLLAB_AUTH_MODE = 'none' // 测试期开放鉴权中间件
process.env.COLLAB_DB_URL = 'memory://test'
process.env.COLLAB_REALTIME_HEARTBEAT_MS = '300'

// 2) console 静默
const origLog = console.log
console.log = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].startsWith('[test-debug]')) {
    origLog(...args)
  }
}
console.info = () => {}
console.warn = () => {}

// 3) 测试模式标记
;(globalThis as Record<string, unknown>).__MHW_TEST__ = true

// 4) 全局钩子
beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
})
