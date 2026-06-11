/**
 * ManhuaWorks · 全局 Vitest 配置
 *
 * 设计目标：
 *  - tests/ 作为独立 pnpm workspace，拥有完整 vitest 工具链
 *  - 测试**完全离线**——不连真实 DB / Redis / AI / WS
 *  - 提供 4 个 mock AI provider + Hono fetch + WS mock 辅助
 *
 * 用法：
 *   cd tests && pnpm test
 *
 * @author 陆流光
 * @updated 2026-06-08
 */

import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..')

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    root,
    include: [
      'tests/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: [
      path.resolve(__dirname, 'global-setup.ts'),
    ],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // 单 fork：保证 mock 状态共享
      },
    },
    reporters: ['default'],
    alias: {
      '@': path.resolve(root, 'apps/user-portal/src'),
      '@collab': path.resolve(root, 'services/collab-service/src'),
      '@setup': path.resolve(__dirname),
      '@fixtures': path.resolve(root, 'tests/fixtures'),
    },
  },
})
