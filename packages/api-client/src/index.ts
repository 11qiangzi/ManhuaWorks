/**
 * ManhuaWorks · api-client
 * 统一入口：re-export 全部 + createApiClient + useApi composable
 */

export * from './errors.js'
export * from './types.js'
export { tokenStore } from './token-store.js'
export type { TokenStore } from './token-store.js'
export { useApi, getClient } from './use-api.js'

import { createHttp } from './http.js'
import { createAuth } from './auth.js'
import { createProjects } from './projects.js'
import { createBilling } from './billing.js'
import { createCollabRest, createCollabSocket } from './collab.js'
import type { ApiBundle, CreateApiClientOptions, AuthModule, ProjectsModule, BillingModule, CollabModule, HttpModule, UsersModule } from './types.js'

export function createApiClient(opts: CreateApiClientOptions = {}): ApiBundle {
  const runtime = createHttp(opts)
  const http: HttpModule = runtime.http
  const auth: AuthModule = createAuth(http)
  const projects: ProjectsModule = createProjects(http)
  const billing: BillingModule = createBilling(http)
  const restCollab: Omit<CollabModule, 'socket'> = createCollabRest(http)
  const socketFactory = createCollabSocket(opts)
  const collab: CollabModule = { ...restCollab, socket: socketFactory }

  const users: UsersModule = auth

  return { http, auth, users, projects, billing, collab }
}
