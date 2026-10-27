import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteCompression from 'vite-plugin-compression'
import { viteWebpPlugin } from '../../scripts/build/vite-plugin-webp'
import path from 'path'
import fs from 'node:fs'
import { BRAND } from './src/config/branding'

/** BUG-RT-01 修: SPA middleware 兜底 */
function spaApiFallback() {
  return {
    name: 'spa-api-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()
        // 跳过真实文件 / vite 内部 / vite proxy / websocket
        if (req.url.startsWith('/@') || req.url.startsWith('/node_modules') ||
            req.url.startsWith('/__') || req.url.includes('.')) return next()
        // 跳 /api/* /v1/* (这些是真 API, 不返 HTML)
        if (req.url.startsWith('/api/') || req.url.startsWith('/v1/')) return next()
        // 其他路径: 强制 SPA fallback (BUG-RT-01: 拦 /api-keys)
        const accept = req.headers.accept || ''
        if (accept.includes('text/html') || !accept) {
          const html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8')
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
          return
        }
        next()
      })
    }
  }
}

/**
 * user-portal · Vite 配置
 * 千机工坊 · W4 用户后台
 *
 * 端口:5180
 * API 代理:localhost:8089 (project-service)
 * /v1/xxx → /api/v1/xxx (后端 express 用 /api/v1 前缀)
 */

const isProd = process.env.NODE_ENV === 'production'
const cdnBase = isProd ? (process.env.VITE_CDN_BASE || '/') : '/'

export default defineConfig({
  plugins: [
    vue(),
    spaApiFallback(),
    viteCompression({ algorithm: 'gzip', ext: '.gz', threshold: 1024, deleteOriginFile: false }),
    viteCompression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024, deleteOriginFile: false }),
    viteWebpPlugin({ quality: 80, silent: false }),
    {
      // 派单 21B · 林染: Vite 原生 transformIndexHtml 注入动态 title + meta
      // (覆盖 apps/user-portal/index.html 里的 hardcode "千机工坊 - 用户中心")
      name: 'qianji-html-inject',
      transformIndexHtml(html) {
        return html
          .replace(/<title>.*?<\/title>/, `<title>${BRAND.nameCn} - 用户中心</title>`)
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
      '@dev-portal': path.resolve(__dirname, '../dev-portal/src'),
    }
  },
  // BUG-RT-01 修: SPA 模式 (vite 5 默认就是这个, 但显式声明)
  appType: 'spa',
  server: {
    port: 5180,
    host: '0.0.0.0',
    strictPort: true,
        proxy: {
      '/api/v1/auth': {
        target: 'http://localhost:8088',
        changeOrigin: true
      },
      '/api/v1/users': {
        target: 'http://localhost:8088',
        changeOrigin: true
      },
      '/api/v1/user': {
        target: 'http://localhost:8088',
        changeOrigin: true
      },
      '/api/v1/account': {
        target: 'http://localhost:8088',
        changeOrigin: true
      },
      '/v1/auth': {
        target: 'http://localhost:8088',
        changeOrigin: true,
        rewrite: (path) => '/api' + path
      },
      '/v1/users': {
        target: 'http://localhost:8088',
        changeOrigin: true,
        rewrite: (path) => '/api' + path
      },
      '/v1/user': {
        target: 'http://localhost:8088',
        changeOrigin: true,
        rewrite: (path) => '/api' + path
      },
      '/v1/account': {
        target: 'http://localhost:8088',
        changeOrigin: true,
        rewrite: (path) => '/api' + path
      },
      '/api/v1/billing': {
        target: 'http://localhost:8090',
        changeOrigin: true
      },
      '/v1/billing': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        rewrite: (path) => '/api' + path
      },
      '/api/v1/notifications': {
        target: 'http://localhost:8091',
        changeOrigin: true
      },
      '/api/v1/ops': {
        target: 'http://localhost:8088',
        changeOrigin: true
      },
      '/v1': {
        target: 'http://localhost:8089',
        changeOrigin: true,
        rewrite: (path) => '/api' + path
      },
      '/api': {
        target: 'http://localhost:8089',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
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
