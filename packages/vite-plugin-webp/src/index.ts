/**
 * vite-plugin-webp — 构建时 WebP 自动转换
 *
 * 功能：
 *  - 构建后在 dist/ 目录中找到所有 .png/.jpg/.jpeg
 *  - 用 sharp 转换为 .webp (quality 80)
 *  - 跳过已超 2MB 的图片 (避免转换时间过长)
 *  - 输出到同目录, 保留原文件
 *
 * 用法:
 *   import { viteWebpPlugin } from '@manhuaworks/vite-plugin-webp'
 *   plugins: [viteWebpPlugin()]
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

export interface WebpPluginOptions {
  /** 输出质量 (1-100), default 80 */
  quality?: number
  /** 最大源图体积 (bytes), 超过则跳过, default 2MB */
  maxSize?: number
  /** 匹配的图片扩展名, default ['.png','.jpg','.jpeg'] */
  extensions?: string[]
  /** 输出目录 (相对于 dist), default 'assets' */
  assetsDir?: string
  /** 静默模式, default false */
  silent?: boolean
}

export function viteWebpPlugin(opts: WebpPluginOptions = {}): Plugin {
  const {
    quality = 80,
    maxSize = 2_097_152,
    extensions = ['.png', '.jpg', '.jpeg'],
    assetsDir = 'assets',
    silent = false,
  } = opts

  let outDir = 'dist'
  let sharpModule: typeof import('sharp') | null = null

  return {
    name: 'vite-plugin-webp',
    enforce: 'post',

    configResolved(config) {
      outDir = config.build.outDir
    },

    async buildStart() {
      try {
        sharpModule = await import('sharp')
      } catch {
        if (!silent) {
          console.warn('[vite-plugin-webp] sharp 不可用, WebP 转换跳过。运行 `npm add -D sharp` 启用。')
        }
      }
    },

    async closeBundle() {
      if (!sharpModule) return

      const distDir = path.resolve(outDir, assetsDir)
      if (!fs.existsSync(distDir)) {
        if (!silent) console.log(`[vite-plugin-webp] 目录不存在: ${distDir}, 跳过`)
        return
      }

      const files = walkDir(distDir, extensions)
      if (files.length === 0) {
        if (!silent) console.log('[vite-plugin-webp] 未找到可转换图片')
        return
      }

      if (!silent) console.log(`[vite-plugin-webp] 开始 WebP 转换 (${files.length} 文件, quality=${quality})...`)

      let converted = 0
      let skipped = 0
      let totalSaved = 0

      for (const file of files) {
        const stat = fs.statSync(file)
        if (stat.size > maxSize) {
          skipped++
          continue
        }

        const webpPath = file.replace(/\.(png|jpe?g)$/i, '.webp')
        // 跳过已存在同名的 webp
        if (fs.existsSync(webpPath)) continue

        try {
          const inputBuffer = fs.readFileSync(file)
          const result = await sharpModule!.default(inputBuffer)
            .webp({ quality, lossless: quality >= 95 })
            .toBuffer()

          fs.writeFileSync(webpPath, result)
          const saved = inputBuffer.length - result.length
          totalSaved += saved
          converted++
        } catch (err) {
          if (!silent) console.warn(`[vite-plugin-webp] 转换失败: ${file}`, err instanceof Error ? err.message : err)
        }
      }

      if (!silent && converted > 0) {
        const savedKB = (totalSaved / 1024).toFixed(1)
        console.log(
          `[vite-plugin-webp] ✅ 转换完成: ${converted} 个 WebP, ${skipped} 跳过, 节省约 ${savedKB} KB`
        )
      }
    },
  }
}

function walkDir(dir: string, extensions: string[]): string[] {
  const results: string[] = []
  const lowerExts = extensions.map((e) => e.toLowerCase())

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (lowerExts.includes(ext)) {
          results.push(full)
        }
      }
    }
  }

  walk(dir)
  return results
}
