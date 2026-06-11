/**
 * ManhuaWorks · api-client
 * auth module — login/register/refresh/logout/2FA/verifyEmail/forgot/reset/me
 */

import { tokenStore } from './token-store.js'
import type { HttpModule, AuthModule } from './types.js'
import type {
  LoginByCodeReq, LoginByPasswordReq, LoginResp, RefreshReq, RefreshResp,
  RegisterReq, SendCodeReq, SendCodeResp, UserDTO,
  VerifyEmailReq, ForgotPasswordReq, ResetPasswordReq, ChangePasswordReq,
  TwoFactorConfirmReq, TwoFactorEnableResp,
} from './types.js'

export function createAuth(http: HttpModule): AuthModule {
  function persistLogin(r: LoginResp | RefreshResp): void {
    if ('user' in r && r.user) {
      tokenStore.setUser(r.user)
    }
    if ('token' in r && r.token) {
      tokenStore.set(r.token)
    }
    if ('refresh_token' in r && r.refresh_token) {
      tokenStore.setRefresh(r.refresh_token)
    }
  }

  return {
    async loginByPassword(req: LoginByPasswordReq): Promise<LoginResp> {
      const r = await http.post<LoginResp>('/auth/login', req, { skipAuth: true })
      persistLogin(r)
      return r
    },

    async loginByCode(req: LoginByCodeReq): Promise<LoginResp> {
      const r = await http.post<LoginResp>('/auth/login-code', req, { skipAuth: true })
      persistLogin(r)
      return r
    },

    async register(req: RegisterReq): Promise<LoginResp> {
      const r = await http.post<LoginResp>('/auth/register', req, { skipAuth: true })
      persistLogin(r)
      return r
    },

    async refresh(req: RefreshReq): Promise<RefreshResp> {
      const r = await http.post<RefreshResp>('/auth/refresh', req, { skipAuth: true })
      persistLogin(r)
      return r
    },

    async logout(): Promise<void> {
      try { await http.post<void>('/auth/logout', {}) } finally {
        tokenStore.clearAll()
      }
    },

    async me(): Promise<UserDTO> {
      const u = await http.get<UserDTO>('/users/me')
      tokenStore.setUser(u)
      return u
    },

    async sendCode(req: SendCodeReq): Promise<SendCodeResp> {
      return await http.post<SendCodeResp>('/auth/send-code', req, { skipAuth: true })
    },

    async verifyEmail(token: string): Promise<void> {
      const body: VerifyEmailReq = { token }
      await http.post<void>('/auth/verify-email', body, { skipAuth: true })
    },

    async forgotPassword(req: ForgotPasswordReq): Promise<void> {
      await http.post<void>('/auth/forgot-password', req, { skipAuth: true })
    },

    async resetPassword(req: ResetPasswordReq): Promise<void> {
      await http.post<void>('/auth/reset-password', req, { skipAuth: true })
    },

    async changePassword(req: ChangePasswordReq): Promise<void> {
      await http.post<void>('/auth/change-password', req)
    },

    async enable2FA(): Promise<TwoFactorEnableResp> {
      return await http.post<TwoFactorEnableResp>('/auth/2fa/enable', {})
    },

    async confirm2FA(req: TwoFactorConfirmReq): Promise<void> {
      await http.post<void>('/auth/2fa/confirm', req)
    },

    async disable2FA(req: TwoFactorConfirmReq): Promise<void> {
      await http.post<void>('/auth/2fa/disable', req)
    },
  }
}
