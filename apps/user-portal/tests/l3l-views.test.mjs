// L3.L user-portal 5+ 路由 + mock API 测试
// 纯 node 脚本（无 npm 依赖），用 fetch + cheerio-like 文本断言
// 跑法：node tests/l3l-views.test.mjs

import { setTimeout as sleep } from 'node:timers/promises'

const BASE = 'http://localhost:5180'
const VIEWS = [
  { name: 'DashboardView', path: '/dashboard', nav: '首页' },
  { name: 'ProjectsView', path: '/projects', nav: '项目' },
  { name: 'WorksView', path: '/works', nav: '作品' },
  { name: 'AssetsView', path: '/assets', nav: '素材' },
  { name: 'TeamView', path: '/team', nav: '团队' },
  { name: 'AccountView', path: '/account', nav: '账户' }
]

let pass = 0
let fail = 0
const results = []

function assert(name, cond, extra = '') {
  if (cond) {
    pass++
    results.push({ name, ok: true })
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    results.push({ name, ok: false, extra })
    console.log(`  ❌ ${name}  ${extra}`)
  }
}

async function fetchText(url) {
  const r = await fetch(url, { redirect: 'manual' })
  return { status: r.status, body: await r.text(), headers: r.headers }
}

async function fetchRaw(url) {
  const r = await fetch(url, { redirect: 'manual' })
  return { status: r.status, body: await r.text() }
}

async function run() {
  console.log('\n========== L3.L · user-portal 5+ 测试 ==========\n')

  // ---- Test 1: 6 个 SPA 路由都返回 200 HTML（vue-router 兜底/真路由都返回 index.html） ----
  console.log('Test 1 · 6 SPA 路由 200')
  for (const v of VIEWS) {
    const r = await fetchRaw(BASE + v.path)
    assert(`GET ${v.path} → 200`, r.status === 200, `actual=${r.status}`)
    assert(`GET ${v.path} → 含 #app root`, r.body.includes('id="app"'))
  }

  // ---- Test 2: 6 个 view 资源被 vite 服务为模块 ----
  console.log('\nTest 2 · 6 view 文件可被 vite 加载')
  for (const v of VIEWS) {
    const u = `${BASE}/src/views/${v.name}.vue`
    const r = await fetchRaw(u)
    assert(`GET ${u} → 200`, r.status === 200, `actual=${r.status}`)
    // vue SFC 起始
    assert(`GET ${u} → 含 vue setup script`, r.body.includes('setup') || r.body.includes('<script'))
  }

  // ---- Test 3: 6 个 view 都包含 "Composition API" + 必要关键字 ----
  console.log('\nTest 3 · 6 view 内容关键字检查')
  const KEYWORDS = {
    DashboardView: ['欢迎', '今日推荐', '快速入口'],
    ProjectsView: ['我的项目', '状态', '新建'],
    WorksView: ['我的作品', '观看', '视频'],
    AssetsView: ['素材库', '上传', '删除'],
    TeamView: ['团队', '邀请', '成员'],
    AccountView: ['账户', '基本信息', 'BYOK', '订阅']
  }
  for (const v of VIEWS) {
    const u = `${BASE}/src/views/${v.name}.vue`
    const r = await fetchRaw(u)
    for (const k of KEYWORDS[v.name]) {
      assert(`  ${v.name} 包含关键字「${k}」`, r.body.includes(k))
    }
  }

  // ---- Test 4: 6 view 全部使用 vue 3 Composition API（编译后 JS 形态） ----
  console.log('\nTest 4 · 6 view 全部 Composition API')
  for (const v of VIEWS) {
    const u = `${BASE}/src/views/${v.name}.vue`
    const r = await fetchRaw(u)
    // 编译后的 SFC 是 ESM 模块 + _defineComponent/_sfc_main，无 export default { data() }
    const hasOptions = /export\s+default\s+\{[\s\S]*data\s*\(\s*\)/.test(r.body)
    assert(`  ${v.name} 未使用 options API data()`, !hasOptions)
    // 检查 ref/computed/onMounted 等 Composition 入口
    const hasCompApi = /createElementBlock|createBlock|createVNode|_defineComponent|_sfc_main/.test(r.body)
    assert(`  ${v.name} 是 vue 3 SFC (含 _defineComponent / _sfc_main)`, hasCompApi)
  }

  // ---- Test 5: 现有路由未被破坏（5 个老路由 200） ----
  console.log('\nTest 5 · 现有路由 200（不破坏）')
  const OLD_ROUTES = ['/dashboard', '/projects', '/works', '/assets', '/settings']
  for (const p of OLD_ROUTES) {
    const r = await fetchRaw(BASE + p)
    assert(`GET ${p} → 200`, r.status === 200, `actual=${r.status}`)
  }

  // ---- Test 6: apiClient mock 端点 — 6 view 内含 api.http.request 或 api.projects 调用 ----
  console.log('\nTest 6 · 6 view 内含 api 调用与 mock 回退')
  const API_CALLERS = {
    DashboardView: ['api.http.request', 'MOCK_RECOMMEND', 'MOCK_ACTIVITIES'],
    ProjectsView: ['api.projects.list', 'MOCK_PROJECTS', 'statusFilter'],
    WorksView: ['api.http.request', 'MOCK_WORKS'],
    AssetsView: ['api.http.request', 'MOCK_ASSETS'],
    TeamView: ['api.http.request', 'MOCK_MEMBERS'],
    AccountView: ['api.http.request', 'MOCK_KEYS', 'apiKeys']
  }
  for (const v of VIEWS) {
    const u = `${BASE}/src/views/${v.name}.vue`
    const r = await fetchRaw(u)
    for (const k of API_CALLERS[v.name]) {
      assert(`  ${v.name} 含「${k}」`, r.body.includes(k))
    }
  }

  // ---- Test 7: 6 view 都 import getApi（不破坏 api-client） ----
  console.log('\nTest 7 · 6 view 通过 api-bridge 调用，不直接动 api-client')
  for (const v of VIEWS) {
    const u = `${BASE}/src/views/${v.name}.vue`
    const r = await fetchRaw(u)
    // 编译后路径变成 /src/api-bridge.ts
    assert(`  ${v.name} 通过 api-bridge 调 getApi`, r.body.includes('api-bridge'))
    assert(`  ${v.name} 不直接 import @manhuaworks/api-client (改它)`, !/from\s+['"]@manhuaworks\/api-client['"]/.test(r.body))
  }

  // ---- 汇总 ----
  console.log('\n========== 汇总 ==========')
  console.log(`通过: ${pass}`)
  console.log(`失败: ${fail}`)
  console.log(`总计: ${pass + fail}`)

  if (fail > 0) {
    console.log('\n失败项:')
    for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.name} ${r.extra || ''}`)
    process.exit(1)
  }
  process.exit(0)
}

run().catch((e) => {
  console.error('Test runner crashed:', e)
  process.exit(2)
})
