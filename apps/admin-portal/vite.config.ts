import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteCompression from 'vite-plugin-compression'
import { viteWebpPlugin } from '../../scripts/build/vite-plugin-webp'
import path from 'node:path'

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
    },
  },
  server: {
    port: 5174,
    host: '0.0.0.0',
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
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name]-[hash:8].js',
        chunkFileNames: 'js/[name]-[hash:8].js',
        assetFileNames: 'assets/[name]-[hash:8][extname]',
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia']
        }
      }
    }
  },
})
