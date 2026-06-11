// 运行时 smoke（用纯 ESM，避免 .ts 解析问题）
// 验证 import + 模块加载都正常
import * as apiClient from '../src/index.js' with { 'resolution-mode': 'import' }

// 1) 导出存在
const required = [
  'createApiClient', 'ApiError', 'tokenStore', 'ErrorCode',
  'NetworkError', 'AuthError', 'ValidationError', 'BusinessError', 'isApiError',
]
for (const k of required) {
  if (!(k in apiClient)) {
    console.error('MISSING EXPORT:', k)
    process.exit(1)
  }
}
console.log('OK: all exports present:', required.length)

// 2) ErrorCode ≥30
const codes = Object.values(apiClient.ErrorCode)
if (codes.length < 30) { console.error('ErrorCode <30:', codes.length); process.exit(1) }
console.log('OK: ErrorCode count =', codes.length)

// 3) tokenStore 基本功能
apiClient.tokenStore.set('a')
if (apiClient.tokenStore.get() !== 'a') { console.error('token set/get fail'); process.exit(1) }
apiClient.tokenStore.setRefresh('r')
if (apiClient.tokenStore.getRefresh() !== 'r') { console.error('refresh set/get fail'); process.exit(1) }
if (!apiClient.tokenStore.isAuthenticated()) { console.error('isAuthenticated fail'); process.exit(1) }
apiClient.tokenStore.clearAll()
if (apiClient.tokenStore.get() !== null) { console.error('clearAll fail'); process.exit(1) }
console.log('OK: tokenStore CRUD')

// 4) ApiError base
const e = new apiClient.ApiError({ code: 'X', message: 'm', status: 400 })
if (e.code !== 'X' || e.status !== 400 || e.category !== 'validation') { console.error('ApiError fail'); process.exit(1) }
console.log('OK: ApiError base')

// 5) 子类
if (!(new apiClient.NetworkError('N', 'x') instanceof apiClient.NetworkError)) { console.error('NetworkError fail'); process.exit(1) }
if (!(new apiClient.AuthError('A', 'x') instanceof apiClient.AuthError)) { console.error('AuthError fail'); process.exit(1) }
if (!(new apiClient.ValidationError('V', 'x') instanceof apiClient.ValidationError)) { console.error('ValidationError fail'); process.exit(1) }
console.log('OK: subclasses')

// 6) createApiClient 形状
const api = apiClient.createApiClient({ baseURL: 'http://x' })
for (const k of ['http', 'auth', 'users', 'projects', 'billing', 'collab']) {
  if (!(k in api)) { console.error('ApiBundle missing', k); process.exit(1) }
}
console.log('OK: ApiBundle shape')

// 7) createApiClient 在 mock fetch 下完整跑通 login + me + 422
const fetchImpl = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : String(input)
  const method = (init.method ?? 'GET').toUpperCase()
  const path = new URL(url, 'http://x').pathname
  if (method === 'POST' && path === '/auth/login') {
    return new Response(JSON.stringify({ user: { id: 'u1', email: 'a@b.com', display_name: 'A', role: 0, status: 1, created_at: '2026-01-01' }, token: 'a1', refresh_token: 'r1', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (method === 'GET' && path === '/users/me') {
    return new Response(JSON.stringify({ id: 'u1', email: 'a@b.com', display_name: 'A', role: 0, status: 1, created_at: '2026-01-01' }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return new Response('{"code":"NOT_FOUND"}', { status: 404 })
}
const api2 = apiClient.createApiClient({ baseURL: 'http://x', fetchImpl })
const lr = await api2.auth.loginByPassword({ email: 'a@b.com', password: 'pw' })
if (lr.token !== 'a1') { console.error('login fail'); process.exit(1) }
if (apiClient.tokenStore.get() !== 'a1') { console.error('login persist fail'); process.exit(1) }
const me = await api2.users.me()
if (me.id !== 'u1') { console.error('me fail'); process.exit(1) }
console.log('OK: login + me end-to-end')

console.log('--- ALL SMOKE PASSED ---')
