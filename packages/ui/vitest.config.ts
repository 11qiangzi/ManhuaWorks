import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: [
      'tests/error.test.ts',
      'tests/loading.test.ts',
      'tests/toast.test.ts',
      'tests/notification.test.ts'
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    reporters: ['default']
  }
})
