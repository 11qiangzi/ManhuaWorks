/**
 * vite-plugin-webp — 构建时 WebP 自动转换 (派单 47)
 *
 * 直接复制到 build 脚本目录，各 vite.config 用相对路径引用。
 * 避免 workspace package 链接问题。
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

export function viteWebpPlugin(opts: {
  quality?: number
  maxSize?: number
  silent?: boolean
  assetsDir?: string
} = {}): Plugin {
  const { quality = 80, maxSize = 2_097_152, silent = false, assetsDir = 'assets' } = opts
  let outDir = 'dist'
  let sharpModule: typeof import('sharp') | null = null

  return {
    name: 'vite-plugin-webp',
    enforce: 'post',
    configResolved(config) { outDir = config.build.outDir },
    async buildStart() {
      try { sharpModule = await import('sharp') }
      catch { if (!silent) console.warn('[vite-plugin-webp] sharp 不可用, 跳过 WebP') }
    },
    async closeBundle() {
      if (!sharpModule) return
      const distDir = path.resolve(outDir, assetsDir)
      if (!fs.existsSync(distDir)) return
      const files = walkDir(distDir, ['.png', '.jpg', '.jpeg'])
      if (!files.length) return
      if (!silent) console.log(`[vite-plugin-webp] WebP 转换 (${files.length} 文件)...`)
      let converted = 0
      let totalSaved = 0
      for (const file of files) {
        const stat = fs.statSync(file)
        if (stat.size > maxSize) continue
        const webpPath = file.replace(/\.(png|jpe?g)$/i, '.webp')
        if (fs.existsSync(webpPath)) continue
        try {
          const input = fs.readFileSync(file)
          const result = await sharpModule!.default(input).webp({ quality }).toBuffer()
          fs.writeFileSync(webpPath, result)
          totalSaved += input.length - result.length
          converted++
        } catch { /* skip failed files */ }
      }
      if (!silent && converted > 0) {
        console.log(`[vite-plugin-webp] ✅ ${converted} WebP, 节省 ${(totalSaved / 1024).toFixed(1)} KB`)
      }
    }
  }
}

function walkDir(dir: string, exts: string[]): string[] {
  const results: string[] = []
  const lower = exts.map(e => e.toLowerCase())
  function walk(cur: string) {
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.isFile() && lower.includes(path.extname(e.name).toLowerCase())) results.push(full)
    }
  }
  walk(dir)
  return results
}
