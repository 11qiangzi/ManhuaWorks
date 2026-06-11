// vitest.config.ts
// 由于 pnpm workspace 隔离，api-client 包没有 vitest 依赖。
// 改用 JS 风格 + 直接 alias 到 tests 的 node_modules。
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../..')
const testsNodeModules = path.join(root, 'tests', 'node_modules')

/** @type {import('vitest/config').defineConfig.UserConfig} */
const config = {
  resolve: {
    alias: [
      { find: /^vitest$/, replacement: path.join(testsNodeModules, 'vitest') },
    ],
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
}

export default config
