// 静态服务 dist/，带 SPA 回退；对 /api /v1 /persisted 返回 404 以模拟"后端未起"
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('apps/web/dist')
const PORT = 4173
const HOST = '127.0.0.1'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.gz': 'application/gzip',
  '.br': 'application/x-brotli',
  '.wasm': 'application/wasm',
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  // 模拟后端未运行：API 路径直接 404
  if (urlPath.startsWith('/api/') || urlPath.startsWith('/v1/') || urlPath.startsWith('/persisted')) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    return res.end('{"error":"backend-not-running(e2e-smoke)"}')
  }
  const filePath = path.join(ROOT, urlPath)
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403)
    return res.end('forbidden')
  }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      const ext = path.extname(filePath)
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
      fs.createReadStream(filePath).pipe(res)
    } else {
      fs.readFile(path.join(ROOT, 'index.html'), (e2, data) => {
        if (e2) { res.writeHead(404); return res.end('not found') }
        res.writeHead(200, { 'Content-Type': MIME['.html'] })
        res.end(data)
      })
    }
  })
})

server.listen(PORT, HOST, () => console.log(`[serve-dist] serving ${ROOT} at http://${HOST}:${PORT}`))
