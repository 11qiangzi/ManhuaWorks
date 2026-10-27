// 以用户视角做 UI 全流程冒烟：逐路由截图 + 捕获 console 报错 / 失败请求
// 运行：node scripts/ui-e2e.mjs  （需先起 scripts/serve-dist.mjs）
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:4173'
const OUT = 'e2e-screenshots'
fs.mkdirSync(OUT, { recursive: true })

const routes = {
  public: ['/', '/login', '/pricing', '/showcase', '/help'],
  protected: [
    '/dashboard', '/create/animation', '/create/novel',
    '/projects', '/projects/new', '/materials', '/works',
    '/settings/byok', '/characters', '/scenes', '/export', '/workflow',
  ],
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const log = []
const failed = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push(`[console.${m.type()}] ${m.text()}`) })
page.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`))
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.url()} :: HTTP ${r.status()}`) })
page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText || 'reqfail'}`))

async function visit(p, needsToken) {
  const before = log.length
  const beforeF = failed.length
  if (needsToken) {
    await page.goto(BASE + '/', { waitUntil: 'load' }).catch(() => {})
    await page.evaluate(() => localStorage.setItem('mhw.access_token', 'e2e-fake-token'))
  }
  await page.goto(BASE + p, { waitUntil: 'load', timeout: 20000 }).catch((e) => log.push(`[goto ${p}] ${e.message}`))
  await page.waitForTimeout(2500)
  const title = await page.title()
  const bodyText = (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ').slice(0, 240)
  const shot = (p === '/' ? '_root' : p.replace(/[\/:]/g, '_'))
  await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: false })
  const errs = log.slice(before)
  const fld = failed.slice(beforeF)
  console.log(`\n=== ${p} (token=${needsToken ? 'Y' : 'N'}) ===`)
  console.log(`title: ${title}`)
  console.log(`body: ${bodyText}`)
  console.log(`console err/warn: ${errs.length}`)
  errs.slice(0, 6).forEach((e) => console.log('   ' + e))
  console.log(`failed/4xx reqs: ${fld.length}`)
  fld.slice(0, 6).forEach((f) => console.log('   ' + f))
  return { p, needsToken, title, errs: errs.length, failedReqs: fld.length }
}

const summary = []
for (const p of routes.public) summary.push(await visit(p, false))
// 重置 token 后再访问受保护页
for (const p of routes.protected) summary.push(await visit(p, true))

await browser.close()
const json = { base: BASE, total: summary.length, routes: summary }
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(json, null, 2))
console.log('\nDONE. Screenshots + summary.json in', OUT)
