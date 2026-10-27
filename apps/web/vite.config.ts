import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteCompression from 'vite-plugin-compression'
import { viteWebpPlugin } from '../../scripts/build/vite-plugin-webp'
import path from 'path'
import { BRAND } from './src/config/branding'

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
      // (覆盖 apps/web/index.html 里的 hardcode "千机工坊 - 创作者友好的漫改 SaaS")
      name: 'qianji-html-inject',
      transformIndexHtml(html) {
        return html
          .replace(/<title>.*?<\/title>/, `<title>${BRAND.nameCn} - 一站式 AI 内容工坊</title>`)
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
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      // BUG-30-003 修复 · 2026-06-15 林染:
      // web 站原来只用 '/api → 8088' 一个粗粒度代理, 导致 /api/v1/projects 和 /api/v1/assets
      // 被转到 user-service (8088) → 401/404。
      // 按子路径分流, 精确转发:
      //   /api/v1/auth/*  /api/v1/users/*  /api/v1/user/*  /api/v1/account/*  /api/v1/me/*  → 8088 user-service
      //   /api/v1/subscriptions/*  /api/v1/quotas/*  → 8088 user-service
      //   /api/v1/projects/*  /api/v1/assets/*  /api/v1/scenes/*  /api/v1/characters/*  → 8089 project-service
      //   /api/v1/orders/*  /api/v1/billing/*  → 8090 billing-service
      //   /api/v1/teams/*  → 8091 collab-service
      //   兜底 /api/* → 8089 (与 user-portal 保持一致)
      '/api/v1/auth': { target: 'http://localhost:8088', changeOrigin: true },
      '/api/v1/users': { target: 'http://localhost:8088', changeOrigin: true },
      '/api/v1/user': { target: 'http://localhost:8088', changeOrigin: true },
      '/api/v1/account': { target: 'http://localhost:8088', changeOrigin: true },
      '/api/v1/me': { target: 'http://localhost:8088', changeOrigin: true },
      '/api/v1/subscriptions': { target: 'http://localhost:8088', changeOrigin: true },
      '/api/v1/quotas': { target: 'http://localhost:8088', changeOrigin: true },
      '/api/v1/teams': { target: 'http://localhost:8091', changeOrigin: true },
      '/api/v1/projects': { target: 'http://localhost:8089', changeOrigin: true },
      '/api/v1/assets': { target: 'http://localhost:8089', changeOrigin: true },
      '/api/v1/scenes': { target: 'http://localhost:8089', changeOrigin: true },
      '/api/v1/characters': { target: 'http://localhost:8089', changeOrigin: true },
      '/api/v1/orders': { target: 'http://localhost:8090', changeOrigin: true },
      '/api/v1/billing': { target: 'http://localhost:8090', changeOrigin: true },
      // 通知服务 — user-service 8088
      '/api/v1/notifications': { target: 'http://localhost:8088', changeOrigin: true },
      // AI 编排服务 — ai-orchestrator 8087 (Hono 路由前缀 /v1/*，需 rewrite 去掉 /api)
      '/api/v1/orchestrator': {
        target: 'http://localhost:8087',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, ''),
      },
      '/api/v1/craft-prompt': {
        target: 'http://localhost:8087',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, ''),
      },
      '/api/v1/reference-images': {
        target: 'http://localhost:8087',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, ''),
      },
      '/api/v1/generation': {
        target: 'http://localhost:8087',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, ''),
      },
      // AI 路由代理 — 前端直连 ai-router（前端 BASE=/v1/ai，后端路由=/v1/*，需去掉 /ai）
      '/v1/ai': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/v1\/ai/, '/v1'),
        timeout: 360_000, // 6 分钟，适配 Seedance 异步轮询
      },
      // 持久化媒体文件代理 — ai-router 提供的 TTS/合成/增强视频等静态文件
      '/persisted': {
        target: 'http://localhost:8083',
        changeOrigin: true,
      },
      // 音频上传端点
      '/v1/upload': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/v1\/upload/, '/v1/upload'),
      },
      // BYOK 密钥管理
      '/v1/keys': {
        target: 'http://localhost:8083',
        changeOrigin: true,
      },
      '/api': { target: 'http://localhost:8089', changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // P0 CDN缓存: 静态资源文件名带 hash，配合 CDN 长缓存
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // 入口 chunk 文件名含 hash → CDN immutable 缓存
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
