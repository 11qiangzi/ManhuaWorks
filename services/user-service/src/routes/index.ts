import { Router } from 'express';
import { validate } from '../middleware/validate';
// 鉴权: 统一使用 @manhuaworks/shared (谢擎标准)
import { requireAuth, requireRole } from '@manhuaworks/shared';
import { health } from '../controllers/healthController';
import * as auth from '../controllers/authController';
import * as user from '../controllers/userController';
import * as notification from '../controllers/notificationController';
import { Role } from '../models/user';
import { router as apiKeyRouter } from './api-key.routes';
import { router as userApiKeysRouter } from './user-api-keys.routes';
import { adminRouter } from './admin';
import { opsRouter } from './ops';
import { projectsRouter } from './projects-express';
import { quotasRouter } from './quotas-express';
import { subscriptionsRouter } from './subscriptions-express';
import { preferencesRouter } from './preferences';

export const router = Router();

/* health (无 auth) */
router.get('/health', health);

/* auth */
router.post('/auth/register',          validate(auth.Validators.RegisterBody),    auth.register);
router.post('/auth/login',             validate(auth.Validators.LoginBody),       auth.login);
router.post('/auth/refresh',           validate(auth.Validators.RefreshBody),     auth.refresh);
router.post('/auth/verify-email',      validate(auth.Validators.VerifyTokenBody), auth.verifyEmail);
router.post('/auth/forgot-password',   validate(auth.Validators.ForgotBody),      auth.forgot);
router.post('/auth/reset-password',    validate(auth.Validators.ResetBody),       auth.reset);
router.post('/auth/verify-2fa',        validate(auth.Validators.Verify2faBody),   auth.verify2fa);
// 邮箱验证码 (派单 14: 阿里云 DirectMail)
router.post('/auth/send-email-code',   validate(auth.SendEmailCodeBody),           auth.sendEmailCodeHandler);
router.post('/auth/register-by-email', validate(auth.RegisterByEmailBody),         auth.registerByEmailHandler);
// 手机验证码 (SMS)
router.post('/auth/send-code',         validate(auth.SendSmsCodeBody),             auth.sendSmsCodeHandler);
router.post('/auth/login-with-code',   validate(auth.LoginWithCodeBody),           auth.loginWithCodeHandler);

// 需登录
const authMw = requireAuth();
router.post('/auth/logout',    authMw, validate(auth.Validators.LogoutBody), auth.logout);
router.post('/auth/logout-all',authMw,                                  auth.logoutAll);

/* me */
router.get('/me',         authMw,                                user.getMe);
router.get('/users/me',   authMw,                                user.getMe);
router.patch('/me',       authMw, validate(user.Validators.UpdateMeBody),       user.updateMe);
router.post('/me/password',authMw, validate(user.Validators.ChangePasswordBody), user.changePassword);

/* me/2fa */
router.get('/me/2fa',           authMw, user.get2faStatus);
router.post('/me/2fa/enable',   authMw, user.start2fa);
router.post('/me/2fa/confirm',  authMw, validate(user.Validators.TotpTokenBody), user.confirm2fa);
router.post('/me/2fa/disable',  authMw, validate(user.Validators.TotpTokenBody), user.disable2fa);

/* users (admin) */
const adminMw = requireRole(Role.Admin);
router.get('/users',         authMw, adminMw, validate(user.Validators.ListQuery, 'query'), user.listUsers);
router.get('/users/:id',     authMw, user.getUserById);
router.patch('/users/:id',   authMw, adminMw, validate(user.Validators.AdminUpdateBody), user.adminUpdateUser);
router.delete('/users/:id',  authMw, requireRole(Role.SuperAdmin), user.adminDeleteUser);

/* admin */
router.use('/admin', adminRouter);

/* ops */
router.use('/ops', opsRouter);

/* user api-keys (BYOK) */
router.use('/user/api-keys', apiKeyRouter);
router.use('/api-keys', apiKeyRouter);

/* user byok-keys (派单 17: BYOK user_api_keys 表, 6 provider) */
router.use('/user/byok-keys', userApiKeysRouter);

/* projects — 派单 32B (原 Hono projects.ts 未挂载) */
router.use('/projects', projectsRouter);

/* quotas — 派单 32B (原 Hono quotas.ts 未挂载) */
router.use('/quotas', quotasRouter);

/* subscriptions — 派单 32B (原 Hono subscriptions.ts 未挂载) */
router.use('/subscriptions', subscriptionsRouter);

/* preferences — P2 A4: 用户编辑器模式偏好 */
router.use('/users/me/preferences', preferencesRouter);

/* notifications — 前端 NotificationBell 组件 */
router.get('/notifications',            authMw, notification.listNotifications);
router.patch('/notifications/:id/read', authMw, notification.markRead);
router.post('/notifications/read-all',  authMw, notification.markAllRead);
