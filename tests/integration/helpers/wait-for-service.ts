/**
 * ManhuaWorks · 集成测试 helper
 *
 * wait-for-service：等待 5 服务（dev mode）就绪 + 健康检查
 *
 * 用法：
 *   import { waitForServices, waitForOne } from '../helpers/wait-for-service'
 *   await waitForServices(['ai-router','ai-keys',...], config)
 *
 * 复用 W4 mock-providers 中的 sleep，纯离线实现。
 *
 * @author 钟帧
 * @updated 2026-06-08
 */

import { setTimeout as sleep } from 'node:timers/promises'
import type { services as ServiceMap } from '../fixtures/config.json'

export type ServiceName = keyof typeof ServiceMap

export interface ServiceStatus {
  name: ServiceName
  baseUrl: string
  healthPath: string
  ready: boolean
  latencyMs: number
  attempts: number
  lastError?: string
}

/* ==================== 等待单个服务 ==================== */

/**
 * 轮询一个服务的 /health，直到返回 200 或超时
 * - 测试模式（COLLAB_DB_URL=memory://）下 dev 服务通常 2-5s 就绪
 * - 真实 dev mode 启动可能 5-15s
 */
export async function waitForOne(
  name: ServiceName,
  baseUrl: string,
  healthPath: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<ServiceStatus> {
  const { timeoutMs = 30_000, intervalMs = 500 } = opts
  const startedAt = Date.now()
  const deadline = startedAt + timeoutMs

  let attempts = 0
  let lastError: string | undefined

  while (Date.now() < deadline) {
    attempts += 1
    const t0 = Date.now()
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 2_000)
      const res = await fetch(`${baseUrl}${healthPath}`, {
        signal: ctrl.signal,
        method: 'GET',
      }).finally(() => clearTimeout(t))

      if (res.ok) {
        return {
          name,
          baseUrl,
          healthPath,
          ready: true,
          latencyMs: Date.now() - t0,
          attempts,
        }
      }
      lastError = `HTTP ${res.status}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }

    await sleep(intervalMs)
  }

  return {
    name,
    baseUrl,
    healthPath,
    ready: false,
    latencyMs: Date.now() - startedAt,
    attempts,
    lastError,
  }
}

/* ==================== 等待多个服务（并发） ==================== */

export async function waitForServices(
  services: Array<{ name: ServiceName; baseUrl: string; healthPath: string }>,
  opts: { timeoutMs?: number; intervalMs?: number; failFast?: boolean } = {},
): Promise<ServiceStatus[]> {
  const { failFast = true } = opts
  const results = await Promise.all(
    services.map((s) =>
      waitForOne(s.name, s.baseUrl, s.healthPath, opts),
    ),
  )

  if (failFast) {
    const notReady = results.filter((r) => !r.ready)
    if (notReady.length > 0) {
      const summary = notReady
        .map((r) => `  - ${r.name} @ ${r.baseUrl}${r.healthPath}: ${r.lastError ?? 'unknown'} (${r.attempts} tries)`)
        .join('\n')
      throw new Error(
        `[wait-for-service] ${notReady.length} service(s) not ready:\n${summary}`,
      )
    }
  }

  return results
}

/* ==================== 单次健康检查（不轮询） ==================== */

export async function ping(
  baseUrl: string,
  healthPath = '/health',
): Promise<{ ok: boolean; latencyMs: number; status?: number; error?: string }> {
  const t0 = Date.now()
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 3_000)
    const res = await fetch(`${baseUrl}${healthPath}`, {
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t))

    return {
      ok: res.ok,
      latencyMs: Date.now() - t0,
      status: res.status,
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
