/**
 * ManhuaWorks · 全局 Vitest 配置 + 全局 Mock
 *
 * 设计目标：
 *  - 任何 worker（apps / services / e2e）跑 `pnpm test` 都能复用同一份配置
 *  - 测试**完全离线**——不连真实 DB / Redis / AI / WS
 *  - 提供统一的 mock providers（LLM / Image / Video / TTS） + Hono fetch 测试辅助
 *
 * 用法：
 *   import { test, expect, describe } from 'vitest'
 *   import { mockLLM, makeAppRequest } from '../setup/mock-providers'
 *
 * @author 陆流光
 * @updated 2026-06-08
 */

import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..')

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    root: path.resolve(__dirname, '..', '..'),
    include: [
      'tests/**/*.test.ts',
      'apps/studio/tests/**/*.test.ts',
      'apps/user-portal/src/**/__tests__/**/*.test.ts',
      'services/collab-service/src/**/__tests__/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: [
      path.resolve(__dirname, 'test-setup-global.ts'),
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
