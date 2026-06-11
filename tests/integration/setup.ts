/**
 * ManhuaWorks · W5 集成测试 Setup
 *
 * 启动顺序：
 *  1) 注入测试环境变量（5 服务 dev mode）
 *  2) 等待 5 服务 health 通过（30s 超时）
 *  3) 准备测试数据库（SQLite in-memory + schema migration）
 *  4) 注入 demo fixture + 测试凭据
 *  5) 启动 trace collector
 *
 * 复用：
 *  - W4 vitest.config.ts 的 alias + setupFiles（@setup/@fixtures）
 *  - W4 mock-providers 的 sleep + nanoid
 *
 * @author 钟帧 + 陈远枢
 * @updated 2026-06-08
 */

import { setTimeout as sleep } from 'node:timers/promises'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { waitForServices } from './helpers/wait-for-service'
import { TraceCollector } from './helpers/trace-collector'
import config from './fixtures/config.json' with { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_DIR = path.resolve(__dirname, '.test-db')

/* ==================== 全局状态 ==================== */

declare global {
  // eslint-disable-next-line no-var
  var __MHW_INTEGRATION__: {
    startedAt: number
    services: Record<string, { baseUrl: string; healthPath: string; port: number }>
    db: { path: string; backup: string | null }
    trace: TraceCollector
    fixtures: { novel200: string; novel1000: string }
  } | undefined
}

/* ==================== 服务端口表 ==================== */

function buildServiceMap() {
  return {
    'ai-router': config.services['ai-router'],
    'ai-keys': config.services['ai-keys'],
    'workflow-engine': config.services['workflow-engine'],
    'asset-service': config.services['asset-service'],
    'ai-orchestrator': config.services['ai-orchestrator'],
  }
}

/* ==================== 数据库准备 ==================== */

function prepareDatabase(): { path: string; backup: string | null } {
  const dbPath = path.resolve(__dirname, config.database.path)
  const dbDir = path.dirname(dbPath)
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  let backup: string | null = null
  if (config.database.backupBeforeRun && existsSync(dbPath)) {
    backup = `${dbPath}.bak.${Date.now()}`
    const buf = require('node:fs').readFileSync(dbPath)
    require('node:fs').writeFileSync(backup, buf)
  }

  // 测试用 in-memory sqlite（W4 mock 风格）
  if (existsSync(dbPath) && config.database.cleanupAfterRun) {
    rmSync(dbPath, { force: true })
  }

  return { path: dbPath, backup }
}

/* ==================== 主 setup ==================== */

export async function setupIntegration(): Promise<NonNullable<typeof globalThis.__MHW_INTEGRATION__>> {
  const startedAt = Date.now()

  console.log('[test-debug][integration.setup] starting 5 services...')

  // 1) 环境变量（dev mode + 测试凭据）
  process.env.NODE_ENV = 'development' // dev mode
  process.env.MHW_INTEGRATION_TEST = '1'
  process.env.MHW_DB_URL = 'memory://integration-test'
  process.env.MHW_LOG_LEVEL = 'warn'
  process.env.MHW_TEST_USER_TOKEN = config.credentials.testUser.token

  // 2) 准备 DB
  const db = prepareDatabase()

  // 3) 等待 5 服务就绪
  const serviceMap = buildServiceMap()
  const serviceList = Object.entries(serviceMap).map(([name, s]) => ({
    name: name as keyof typeof serviceMap,
    baseUrl: s.baseUrl,
    healthPath: s.healthPath,
  }))

  const statuses = await waitForServices(serviceList, {
    timeoutMs: config.timing.serviceStartTimeoutMs,
    intervalMs: config.timing.serviceHealthIntervalMs,
    failFast: false, // dev mode 可能某些服务暂时挂，先记录
  })

  const ready = statuses.filter((s) => s.ready)
  console.log(
    `[test-debug][integration.setup] ${ready.length}/${statuses.length} services ready in ${Date.now() - startedAt}ms`,
  )

  if (ready.length === 0) {
    console.warn(
      '[test-debug][integration.setup] WARNING: no service is ready, tests will run in mock-only mode',
    )
  }

  // 4) 准备 fixtures
  const fixtures = {
    novel200: path.resolve(__dirname, config.fixtures.novel200),
    novel1000: path.resolve(__dirname, config.fixtures.novel1000),
  }

  // 5) trace collector
  const trace = new TraceCollector()

  // 6) 全局注入
  const state = {
    startedAt,
    services: serviceMap,
    db,
    trace,
    fixtures,
  }
  globalThis.__MHW_INTEGRATION__ = state

  return state
}

/* ==================== Vitest 全局钩子 ==================== */

let setupPromise: Promise<NonNullable<typeof globalThis.__MHW_INTEGRATION__>> | null = null

export function ensureSetup() {
  if (!setupPromise) {
    setupPromise = setupIntegration()
  }
  return setupPromise
}

// beforeAll（vitest 全局钩子）—— 在所有测试文件跑前起服务
beforeAll(async () => {
  await ensureSetup()
  // 给 dev mode 一点额外时间预热
  await sleep(500)
}, 60_000)
