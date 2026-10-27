import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteCompression from 'vite-plugin-compression'
import path from 'node:path'
import { BRAND } from './src/config/branding'

const isProd = process.env.NODE_ENV === 'production'
const cdnBase = isProd ? (process.env.VITE_CDN_BASE || '/') : '/'

export default defineConfig({
  plugins: [
    vue(),
    viteCompression({ algorithm: 'gzip', ext: '.gz', threshold: 1024, deleteOriginFile: false }),
    viteCompression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024, deleteOriginFile: false }),
    {
      name: 'qianji-html-inject',
      transformIndexHtml(html) {
        return html
          .replace(/<title>.*?<\/title>/, `<title>${BRAND.nameCn} - 开发者平台</title>`)
          .replace(
            '</head>',
            `<meta name="description" content="${BRAND.nameCn} 开发者平台 - API 文档、密钥管理与在线调试">\n</head>`
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
    },
  },
  server: {
    port: 5178,
    host: '0.0.0.0',
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8088',
        changeOrigin: true,
      },
      '/v1': {
        target: 'http://localhost:8088',
        changeOrigin: true,
        rewrite: (p) => '/api' + p,
      },
    },
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
        },
      },
    },
  },
})
