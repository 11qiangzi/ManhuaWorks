import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteCompression from 'vite-plugin-compression'
import { viteWebpPlugin } from '../../scripts/build/vite-plugin-webp'
import path from 'path'

/**
 * studio · Vite 配置
 * ManhuaWorks · 创作者工作台
 *
 * 端口：5175
 * API 代理：ai-orchestrator :8087
 */

const isProd = process.env.NODE_ENV === 'production'
const cdnBase = isProd ? (process.env.VITE_CDN_BASE || '/') : '/'

export default defineConfig({
  plugins: [
    vue(),
    viteCompression({ algorithm: 'gzip', ext: '.gz', threshold: 1024, deleteOriginFile: false }),
    viteCompression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024, deleteOriginFile: false }),
    viteWebpPlugin({ quality: 80, silent: false }),
  ],
  base: cdnBase,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@manhuaworks/api-client': path.resolve(__dirname, '../../packages/api-client/src'),
      '@manhuaworks/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@manhuaworks/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
    }
  },
  server: {
    port: 5175,
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      '/api': {
        // studio 用的 api-client 默认 baseURL='/api', 需重写到 project-service 实际路径 '/api/v1'
        target: 'http://localhost:8089',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1')
      },
      '/v1': {
        target: 'http://localhost:8087',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name]-[hash:8].js',
        chunkFileNames: 'js/[name]-[hash:8].js',
        assetFileNames: 'assets/[name]-[hash:8][extname]',
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'editor-vendor': ['axios', '@vueuse/core']
        }
      }
    }
  }
})
