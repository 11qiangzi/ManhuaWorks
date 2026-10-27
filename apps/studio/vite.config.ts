import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteCompression from 'vite-plugin-compression'
import { viteWebpPlugin } from '../../scripts/build/vite-plugin-webp'
import path from 'path'
import { BRAND } from './src/config/branding'

/**
 * studio · Vite 配置
 * 千机工坊 · 创作者工作台
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
    {
      // 派单 21B · 林染: Vite 原生 transformIndexHtml 注入动态 title + meta
      // (覆盖 apps/studio/index.html 里的 hardcode "千机工坊 - 创作者工作台")
      name: 'qianji-html-inject',
      transformIndexHtml(html) {
        return html
          .replace(/<title>.*?<\/title>/, `<title>${BRAND.nameCn} - 创作者工作台</title>`)
          .replace(
            '</head>',
            `<meta name="description" content="${BRAND.nameCn} - ${BRAND.tagline}">\n</head>`
          )
      },
    },
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
      '/v1/assets': {
        // asset-service（导出/资产）:8085
        target: 'http://localhost:8085',
        changeOrigin: true
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
        manualChunks(id) {
          if (id.includes('node_modules/vue/') || id.includes('node_modules/vue-router/') || id.includes('node_modules/pinia/') || id.includes('node_modules/@vue/')) {
            return 'vue-vendor';
          }
          if (id.includes('node_modules/axios/') || id.includes('node_modules/@vueuse/')) {
            return 'editor-vendor';
          }
        }
      }
    }
  }
})
