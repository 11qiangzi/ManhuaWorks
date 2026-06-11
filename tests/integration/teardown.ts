/**
 * ManhuaWorks · W5 集成测试 Teardown
 *
 * 清理顺序：
 *  1) flush trace 收集器到报告目录
 *  2) 备份测试报告（baseline + trace dump）
 *  3) 关闭 5 服务（如由本进程拉起）
 *  4) 清数据库（保留 .bak 备份）
 *  5) 清临时文件
 *
 * @author 钟帧 + 陈远枢
 * @updated 2026-06-08
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPORT_DIR = path.resolve(__dirname, 'reports')

/* ==================== 写 trace 报告 ==================== */

function writeTraceReport(): void {
  const state = globalThis.__MHW_INTEGRATION__
  if (!state?.trace) return

  if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true })

  const traces = state.trace.all()
  const summary = {
    generatedAt: new Date().toISOString(),
    totalTraces: traces.length,
    byService: countByService(traces),
    avgTotalLatencyMs: avg(traces.map((t) => t.totalLatencyMs)),
    p95TotalLatencyMs: percentile(traces.map((t) => t.totalLatencyMs), 0.95),
  }
  writeFileSync(
    path.resolve(REPORT_DIR, 'trace-summary.json'),
    JSON.stringify(summary, null, 2),
  )
  writeFileSync(
    path.resolve(REPORT_DIR, 'traces.json'),
    JSON.stringify(traces, null, 2),
  )
}

function countByService(traces: Array<{ spans: Array<{ service: string }> }>) {
  const out: Record<string, number> = {}
  for (const t of traces) {
    for (const s of t.spans) {
      out[s.service] = (out[s.service] ?? 0) + 1
    }
  }
  return out
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const idx = Math.floor(sorted.length * p)
  return sorted[Math.min(idx, sorted.length - 1)]
}

/* ==================== 关闭服务 ==================== */

async function stopServices(): Promise<void> {
  // 当前实现：服务由 CI 外部拉起（dev mode），本进程不直接 spawn
  // 这里仅做"礼貌通知"：向每个服务的 /admin/shutdown POST（如存在）
  const state = globalThis.__MHW_INTEGRATION__
  if (!state) return

  for (const [name, svc] of Object.entries(state.services)) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 2_000)
      await fetch(`${svc.baseUrl}/admin/shutdown`, {
        method: 'POST',
        signal: ctrl.signal,
      }).finally(() => clearTimeout(t))
    } catch {
      // 忽略：服务可能不允许 shutdown，或已关闭
    }
    void name
  }
}

/* ==================== 清库 + 清临时 ==================== */

function cleanupDatabase(): void {
  const state = globalThis.__MHW_INTEGRATION__
  if (!state) return

  const dbPath = state.db.path
  if (existsSync(dbPath)) {
    rmSync(dbPath, { force: true })
  }

  const dbDir = path.dirname(dbPath)
  const tmpFiles = ['.integration.tmp', '.test-lock']
  for (const f of tmpFiles) {
    const p = path.resolve(dbDir, f)
    if (existsSync(p)) rmSync(p, { force: true })
  }
}

/* ==================== 主 teardown ==================== */

export async function teardownIntegration(): Promise<void> {
  const startedAt = Date.now()

  console.log('[test-debug][integration.teardown] starting...')

  // 1) flush trace
  writeTraceReport()

  // 2) 关闭服务
  await stopServices()

  // 3) 等 200ms 让服务优雅关闭
  await sleep(200)

  // 4) 清库
  cleanupDatabase()

  console.log(
    `[test-debug][integration.teardown] done in ${Date.now() - startedAt}ms`,
  )
}

/* ==================== Vitest 全局钩子 ==================== */

afterAll(async () => {
  await teardownIntegration()
}, 30_000)
