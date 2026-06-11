/**
 * loading.test.ts - Loading 系统测试
 * 覆盖：14 类 loading、useAsyncState、withLoading
 */
import { describe, it, expect, vi } from 'vitest'
import { useLoading } from '../src/composables/useLoading'
import { useAsyncState } from '../src/composables/useAsyncState'
import { NetworkError } from '../src/errors'

describe('useLoading - 14 types of loading', () => {
  it('starts and stops a loading entry', () => {
    const loading = useLoading()
    loading.start('button', 'submitBtn')
    expect(loading.isLoading('submitBtn')).toBe(true)
    loading.stop('submitBtn')
    expect(loading.isLoading('submitBtn')).toBe(false)
  })

  it('covers all 14 loading types', () => {
    const loading = useLoading()
    const types = [
      'page',
      'section',
      'table',
      'button',
      'form',
      'inline',
      'modal',
      'drawer',
      'skeleton',
      'infinite',
      'pull-refresh',
      'upload',
      'progress',
      'indeterminate'
    ] as const
    expect(types).toHaveLength(14)
    for (const t of types) {
      loading.start(t, `key-${t}`)
      expect(loading.states[`key-${t}`].type).toBe(t)
    }
  })

  it('isAnyLoading reflects active state', () => {
    const loading = useLoading()
    expect(loading.isAnyLoading.value).toBe(false)
    loading.start('button', 'a')
    expect(loading.isAnyLoading.value).toBe(true)
    loading.stop('a')
    expect(loading.isAnyLoading.value).toBe(false)
  })

  it('activeKeys lists currently active keys', () => {
    const loading = useLoading()
    loading.start('button', 'a')
    loading.start('page', 'b')
    expect(loading.activeKeys.value).toEqual(expect.arrayContaining(['a', 'b']))
    loading.stop('a')
    expect(loading.activeKeys.value).toEqual(['b'])
  })

  it('setProgress() clamps 0-100', () => {
    const loading = useLoading()
    loading.start('progress', 'p1')
    loading.setProgress('p1', 50)
    expect(loading.states['p1'].progress).toBe(50)
    loading.setProgress('p1', 150)
    expect(loading.states['p1'].progress).toBe(100)
    loading.setProgress('p1', -10)
    expect(loading.states['p1'].progress).toBe(0)
  })

  it('setMessage() updates message', () => {
    const loading = useLoading()
    loading.start('upload', 'u1', { message: 'starting' })
    loading.setMessage('u1', 'uploading...')
    expect(loading.states['u1'].message).toBe('uploading...')
  })

  it('setError() attaches error to entry', () => {
    const loading = useLoading()
    loading.start('button', 'a')
    const err = NetworkError.offline()
    loading.setError('a', err)
    expect(loading.states['a'].error).toBe(err)
  })

  it('withLoading() wraps async fn and stops on success', async () => {
    const loading = useLoading()
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await loading.withLoading('button', 'a', fn)
    expect(result).toBe('ok')
    expect(loading.isLoading('a')).toBe(false)
  })

  it('withLoading() captures error and rethrows', async () => {
    const loading = useLoading()
    const fn = vi.fn().mockRejectedValue(new Error('boom'))
    const onError = vi.fn()
    await expect(
      loading.withLoading('button', 'a', fn, { onError })
    ).rejects.toThrow('boom')
    expect(onError).toHaveBeenCalled()
    expect(loading.states['a'].active).toBe(false)
    expect(loading.states['a'].finishedAt).toBeGreaterThan(0)
  })

  it('clear() removes all entries', () => {
    const loading = useLoading()
    loading.start('button', 'a')
    loading.start('page', 'b')
    loading.clear()
    expect(Object.keys(loading.states)).toHaveLength(0)
  })
})

describe('useAsyncState', () => {
  it('executes fn immediately and exposes data', async () => {
    const state = useAsyncState(async () => 'hello', { immediate: true })
    // 等待 microtask
    await new Promise((r) => setTimeout(r, 10))
    expect(state.data.value).toBe('hello')
    expect(state.isLoading.value).toBe(false)
    expect(state.isReady.value).toBe(true)
  })

  it('captures error and populates error.value', async () => {
    const state = useAsyncState(
      async () => {
        throw new Error('failed')
      },
      { immediate: true }
    )
    await new Promise((r) => setTimeout(r, 10))
    expect(state.error.value).toBeInstanceOf(Error)
    expect(state.isLoading.value).toBe(false)
  })

  it('retries on retryable errors', async () => {
    let attempts = 0
    const state = useAsyncState(
      async () => {
        attempts++
        if (attempts < 3) throw NetworkError.timeout()
        return 'ok'
      },
      { immediate: true, retry: 3, retryDelay: 1 }
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(attempts).toBeGreaterThanOrEqual(3)
    expect(state.data.value).toBe('ok')
  })

  it('does not retry on non-retryable errors', async () => {
    let attempts = 0
    const state = useAsyncState(
      async () => {
        attempts++
        throw new Error('permanent')
      },
      { immediate: true, retry: 3, retryDelay: 1 }
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(attempts).toBe(1)
  })

  it('cancel() prevents further work', async () => {
    const state = useAsyncState(
      async () => {
        await new Promise((r) => setTimeout(r, 100))
        return 'late'
      },
      { immediate: false }
    )
    state.execute()
    state.cancel()
    await new Promise((r) => setTimeout(r, 10))
    expect(state.isLoading.value).toBe(false)
  })

  it('does not auto-execute when immediate: false', () => {
    const state = useAsyncState(async () => 'x', { immediate: false })
    expect(state.isLoading.value).toBe(false)
    expect(state.isReady.value).toBe(false)
  })
})
