/**
 * ManhuaWorks · api-client
 * 全量 DTO / 接口 / 枚举类型
 *
 * 所有下游 store 用到的类型都从这文件 re-export 或定义。
 */

/* ============================================================== *
 *  Common
 * ============================================================== */
export type ID = string
export type ISODate = string

export interface PageResp<T> {
  list: T[]
  total: number
  page: number
  page_size: number
}

export interface CursorPageResp<T> {
  list: T[]
  next_cursor?: string
  has_more: boolean
}

export interface ApiRequestOptions {
  signal?: AbortSignal
  query?: Record<string, unknown>
  headers?: Record<string, string>
  timeoutMs?: number
  /** 跳过 401 自动刷新（用于 refresh 自身） */
  skipAuth?: boolean
  /** 跳过 401 抛错（用于被动探活） */
  swallow401?: boolean
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/* ============================================================== *
 *  User
 * ============================================================== */
export type UserStatus = 0 | 1   // 0=禁用 1=正常

export interface UserDTO {
  id: ID
  email: string
  phone?: string
  display_name: string
  avatar_url?: string
  role: number             // 0=普通 5=admin 9=super
  status: UserStatus
  plan?: Plan
  two_factor_enabled?: boolean
  email_verified?: boolean
  created_at: ISODate
  updated_at?: ISODate
  last_login_at?: ISODate
}

export interface UserProfileDTO extends UserDTO {
  bio?: string
  company?: string
  location?: string
  social_links?: Record<string, string>
  preferences?: Record<string, unknown>
}

export interface LoginByPasswordReq {
  email: string
  password: string
}
export interface LoginByCodeReq {
  phone: string
  code: string
  display_name?: string
}
export interface RegisterReq {
  email: string
  password: string
  display_name: string
}
export interface LoginResp {
  user: UserDTO
  token: string
  refresh_token: string
  expires_in: number
  two_factor_required?: boolean
}
export interface RefreshReq {
  refresh_token: string
}
export interface RefreshResp {
  token: string
  refresh_token: string
  expires_in: number
}
export interface SendCodeReq {
  phone: string
}
export interface SendCodeResp {
  sent: boolean
  cooldown_sec?: number
  mock_code?: string
}
export interface VerifyEmailReq {
  token: string
}
export interface ForgotPasswordReq {
  email: string
}
export interface ResetPasswordReq {
  token: string
  new_password: string
}
export interface ChangePasswordReq {
  old_password: string
  new_password: string
}
export interface TwoFactorEnableResp {
  secret: string
  otpauth_url: string
  qr_code_url?: string
}
export interface TwoFactorConfirmReq {
  code: string
}
export interface UpdateUserReq {
  display_name?: string
  avatar_url?: string
  phone?: string
  role?: number
  status?: UserStatus
}

/* ============================================================== *
 *  Project / Version / Shot / Tag / Member
 * ============================================================== */
export type ProjectVisibility = 'private' | 'team' | 'public'
export type ProjectStatus = 'active' | 'archived' | 'deleted'

export interface ProjectDTO {
  id: ID
  name: string
  description?: string
  cover_url?: string
  owner_id: ID
  status: ProjectStatus
  visibility: ProjectVisibility
  shot_count: number
  member_count: number
  created_at: ISODate
  updated_at: ISODate
}

export interface CreateProjectReq {
  name: string
  description?: string
  cover_url?: string
  visibility?: ProjectVisibility
}

export interface UpdateProjectReq {
  name?: string
  description?: string
  cover_url?: string
  visibility?: ProjectVisibility
  status?: ProjectStatus
}

export interface ProjectMemberDTO {
  user_id: ID
  display_name: string
  email: string
  avatar_url?: string
  role: 'owner' | 'editor' | 'viewer'
  joined_at: ISODate
}

export interface InviteMemberReq {
  email: string
  role: 'editor' | 'viewer'
}

export interface ShotDTO {
  id: ID
  project_id: ID
  name: string
  description?: string
  status: 'draft' | 'wip' | 'review' | 'done' | 'archived'
  order_index: number
  thumbnail_url?: string
  duration_ms?: number
  created_at: ISODate
  updated_at: ISODate
}

export interface CreateShotReq {
  name: string
  description?: string
  order_index?: number
}
export interface UpdateShotReq {
  name?: string
  description?: string
  status?: ShotDTO['status']
  order_index?: number
  thumbnail_url?: string
  duration_ms?: number
}

export interface TagDTO {
  id: ID
  name: string
  color: string
  count: number
}

export interface ProjectVersionDTO {
  id: ID
  project_id: ID
  version: string
  message?: string
  author_id: ID
  created_at: ISODate
}

/* ============================================================== *
 *  Plan / Subscription / Order / Invoice / Refund
 * ============================================================== */
export type Plan = 'free' | 'pro' | 'enterprise'

export interface PlanDTO {
  id: ID
  code: Plan
  name: string
  price_monthly: number
  price_yearly: number
  currency: string
  features: string[]
  credits_per_month: number
  active: boolean
}

export type SubscriptionCycle = 'monthly' | 'yearly'
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'pending'

export interface SubscriptionDTO {
  id: ID
  user_id: ID
  plan: Plan
  cycle: SubscriptionCycle
  status: SubscriptionStatus
  started_at: ISODate
  expires_at: ISODate
  cancel_at_period_end: boolean
  auto_renew: boolean
}

export interface SubscribeReq {
  plan: Plan
  cycle: SubscriptionCycle
  payment_method: string
}

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled'
export interface OrderDTO {
  id: ID
  user_id: ID
  plan: Plan
  cycle: SubscriptionCycle
  amount: number
  currency: string
  status: OrderStatus
  payment_method?: string
  created_at: ISODate
  paid_at?: ISODate
}

export interface CreateOrderReq {
  plan: Plan
  cycle: SubscriptionCycle
  quantity?: number
  coupon_code?: string
}
export interface PayOrderReq {
  method: string
  return_url?: string
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void'
export interface InvoiceDTO {
  id: ID
  order_id: ID
  number: string
  amount: number
  tax: number
  currency: string
  status: InvoiceStatus
  issued_at: ISODate
  pdf_url?: string
}

export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'completed'
export interface RefundDTO {
  id: ID
  order_id: ID
  amount: number
  reason: string
  status: RefundStatus
  created_at: ISODate
  resolved_at?: ISODate
}
export interface RefundReq {
  order_id: ID
  amount: number
  reason: string
}

export interface QuotaDTO {
  plan: Plan
  credits_used: number
  credits_total: number
  reset_at: ISODate
  cycle: SubscriptionCycle
}

/* ============================================================== *
 *  Collab · Comments / Presence / Notifications / Activities
 * ============================================================== */
export type CommentTargetType = 'project' | 'shot' | 'version' | 'thread'
export type CommentStatus = 'open' | 'resolved' | 'reopen'

export interface CommentDTO {
  id: ID
  project_id: ID
  target_type: CommentTargetType
  target_id: ID
  parent_id?: ID
  author_id: ID
  author_name: string
  author_avatar?: string
  body: string
  status: CommentStatus
  created_at: ISODate
  updated_at: ISODate
  replies?: CommentDTO[]
}

export interface CreateCommentReq {
  project_id: ID
  target_type: CommentTargetType
  target_id: ID
  body: string
  parent_id?: ID
}

export interface PresenceDTO {
  user_id: ID
  display_name: string
  avatar_url?: string
  color: string
  target_type?: CommentTargetType
  target_id?: ID
  cursor?: { x: number; y: number; frame?: number }
  last_seen_at: ISODate
}

export type NotificationType = 'comment' | 'mention' | 'invite' | 'order' | 'system'
export interface NotificationDTO {
  id: ID
  type: NotificationType
  title: string
  body: string
  link?: string
  read: boolean
  created_at: ISODate
}

export interface ListNotificationsReq {
  unread_only?: boolean
  type?: NotificationType
  page?: number
  pageSize?: number
}

export type ActivityType =
  | 'project.create' | 'project.update' | 'project.archive' | 'project.delete'
  | 'shot.create' | 'shot.update' | 'shot.delete'
  | 'comment.create' | 'comment.resolve' | 'comment.reopen'
  | 'member.invite' | 'member.join' | 'member.leave'
  | 'version.publish'
  | 'order.create' | 'order.pay' | 'order.refund'
  | 'login' | 'logout'

export interface ActivityDTO {
  id: ID
  type: ActivityType
  user_id: ID
  user_name: string
  project_id?: ID
  resource_type?: string
  resource_id?: ID
  payload?: Record<string, unknown>
  created_at: ISODate
}

export interface ListActivitiesReq {
  project_id?: ID
  user_id?: ID
  type?: ActivityType
  page?: number
  pageSize?: number
}

/* ============================================================== *
 *  Audit
 * ============================================================== */
export interface AuditLogDTO {
  id: ID
  actor_id: ID
  actor_name?: string
  action: string
  resource: string
  resource_id?: ID
  payload?: Record<string, unknown>
  ip?: string
  ua?: string
  created_at: ISODate
}

export interface AuditLogQuery {
  actor_id?: ID
  action?: string
  resource?: string
  from?: ISODate
  to?: ISODate
  page?: number
  pageSize?: number
}

/* ============================================================== *
 *  WebSocket · 实时协作消息
 * ============================================================== */
export type CollabMessageType =
  | 'typing'
  | 'cursor'
  | 'edit'
  | 'comment'
  | 'join'

export interface CollabEnvelope<T = unknown> {
  type: CollabMessageType
  project_id: ID
  user_id: ID
  ts: number
  data: T
}

export interface TypingPayload {
  target_type: CommentTargetType
  target_id: ID
  state: 'start' | 'stop'
}
export interface CursorPayload {
  target_type: CommentTargetType
  target_id: ID
  x: number
  y: number
  frame?: number
}
export interface EditPayload {
  target_type: CommentTargetType
  target_id: ID
  op: 'insert' | 'update' | 'delete'
  path: string
  value?: unknown
  version: number
}
export interface CommentPayload {
  comment: CommentDTO
  verb: 'create' | 'resolve' | 'reopen' | 'delete'
}
export interface JoinPayload {
  target_type?: CommentTargetType
  target_id?: ID
  presence: PresenceDTO
}

export type CollabHandler<T = unknown> = (env: CollabEnvelope<T>) => void

/* ============================================================== *
 *  ApiBundle · createApiClient 返回值
 * ============================================================== */
export interface AuthModule {
  loginByPassword: (req: LoginByPasswordReq) => Promise<LoginResp>
  loginByCode: (req: LoginByCodeReq) => Promise<LoginResp>
  register: (req: RegisterReq) => Promise<LoginResp>
  refresh: (req: RefreshReq) => Promise<RefreshResp>
  logout: () => Promise<void>
  me: () => Promise<UserDTO>
  sendCode: (req: SendCodeReq) => Promise<SendCodeResp>
  verifyEmail: (token: string) => Promise<void>
  forgotPassword: (req: ForgotPasswordReq) => Promise<void>
  resetPassword: (req: ResetPasswordReq) => Promise<void>
  changePassword: (req: ChangePasswordReq) => Promise<void>
  enable2FA: () => Promise<TwoFactorEnableResp>
  confirm2FA: (req: TwoFactorConfirmReq) => Promise<void>
  disable2FA: (req: TwoFactorConfirmReq) => Promise<void>
}

export interface UsersModule extends AuthModule {}

export interface ProjectsModule {
  list: (q?: { page?: number; pageSize?: number; keyword?: string; status?: ProjectStatus }) => Promise<PageResp<ProjectDTO>>
  get: (id: ID) => Promise<ProjectDTO>
  create: (req: CreateProjectReq) => Promise<ProjectDTO>
  update: (id: ID, patch: UpdateProjectReq) => Promise<ProjectDTO>
  archive: (id: ID) => Promise<void>
  remove: (id: ID) => Promise<void>
  listMembers: (projectId: ID) => Promise<ProjectMemberDTO[]>
  inviteMember: (projectId: ID, req: InviteMemberReq) => Promise<ProjectMemberDTO>
  removeMember: (projectId: ID, userId: ID) => Promise<void>
  listShots: (projectId: ID, q?: { page?: number; pageSize?: number; status?: ShotDTO['status'] }) => Promise<PageResp<ShotDTO>>
  createShot: (projectId: ID, req: CreateShotReq) => Promise<ShotDTO>
  updateShot: (projectId: ID, shotId: ID, patch: UpdateShotReq) => Promise<ShotDTO>
  deleteShot: (projectId: ID, shotId: ID) => Promise<void>
  listTags: (projectId: ID) => Promise<TagDTO[]>
  listVersions: (projectId: ID) => Promise<ProjectVersionDTO[]>
  publishVersion: (projectId: ID, req: { version: string; message?: string }) => Promise<ProjectVersionDTO>
  /** admin 全局用户管理（admin-portal 用） */
  listUsers: (q: { page?: number; pageSize?: number; keyword?: string; status?: UserStatus; role?: number }) => Promise<PageResp<UserDTO>>
  getUser: (id: ID) => Promise<UserDTO>
  updateUser: (id: ID, patch: UpdateUserReq) => Promise<UserDTO>
  disableUser: (id: ID) => Promise<void>
}

export interface BillingModule {
  listPlans: () => Promise<PlanDTO[]>
  getPlan: (code: Plan) => Promise<PlanDTO>
  getMySubscription: () => Promise<SubscriptionDTO | null>
  subscribe: (plan: Plan, cycle: SubscriptionCycle, paymentMethod?: string) => Promise<SubscriptionDTO>
  cancelSubscription: (id: ID, immediate?: boolean) => Promise<SubscriptionDTO>
  listOrders: (q?: { status?: OrderStatus; page?: number; pageSize?: number }) => Promise<PageResp<OrderDTO>>
  createOrder: (req: CreateOrderReq) => Promise<OrderDTO>
  payOrder: (id: ID, method: string) => Promise<OrderDTO>
  listInvoices: (q?: { page?: number; pageSize?: number }) => Promise<PageResp<InvoiceDTO>>
  listRefunds: (q?: { page?: number; pageSize?: number; status?: RefundStatus }) => Promise<PageResp<RefundDTO>>
  requestRefund: (req: RefundReq) => Promise<RefundDTO>
  getMyQuota: () => Promise<QuotaDTO>
}

export interface CollabModule {
  listComments: (q: { project_id: ID; target_type?: CommentTargetType; target_id?: ID; page?: number; pageSize?: number }) => Promise<PageResp<CommentDTO>>
  createComment: (req: CreateCommentReq) => Promise<CommentDTO>
  resolveComment: (id: ID) => Promise<CommentDTO>
  reopenComment: (id: ID) => Promise<CommentDTO>
  deleteComment: (id: ID) => Promise<void>
  listNotifications: (q?: ListNotificationsReq) => Promise<PageResp<NotificationDTO>>
  unreadCount: () => Promise<{ count: number }>
  markRead: (id: ID) => Promise<void>
  markAllRead: () => Promise<void>
  archiveNotification: (id: ID) => Promise<void>
  listActivities: (q?: ListActivitiesReq) => Promise<PageResp<ActivityDTO>>
  listProjectPresence: (projectId: ID) => Promise<PresenceDTO[]>
  join: (projectId: ID, target?: { target_type: CommentTargetType; target_id: ID }) => Promise<PresenceDTO>
  leave: (projectId: ID) => Promise<void>
  socket: (projectId: ID) => CollabSocket
}

export interface CollabSocket {
  readonly projectId: ID
  readonly state: 'idle' | 'connecting' | 'open' | 'closing' | 'closed'
  on<T = unknown>(type: CollabMessageType, handler: CollabHandler<T>): () => void
  send<T = unknown>(type: CollabMessageType, data: T): void
  close(): void
  /** 主动触发一次重连（清空 backoff） */
  reconnect(): void
}

export interface HttpModule {
  get: <T = unknown>(path: string, query?: Record<string, unknown>, opts?: ApiRequestOptions) => Promise<T>
  post: <T = unknown>(path: string, body?: unknown, opts?: ApiRequestOptions) => Promise<T>
  put: <T = unknown>(path: string, body?: unknown, opts?: ApiRequestOptions) => Promise<T>
  patch: <T = unknown>(path: string, body?: unknown, opts?: ApiRequestOptions) => Promise<T>
  delete: <T = unknown>(path: string, opts?: ApiRequestOptions) => Promise<T>
  request: <T = unknown>(method: HttpMethod, path: string, opts?: ApiRequestOptions) => Promise<T>
}

export interface ApiBundle {
  http: HttpModule
  auth: AuthModule
  users: UsersModule
  projects: ProjectsModule
  billing: BillingModule
  collab: CollabModule
}

export interface CreateApiClientOptions {
  baseURL?: string
  wsBaseURL?: string
  onAuthLost?: () => void
  /** 业务层注入的 refresh 实现（拿到新 access token，返回 null 即失败） */
  refreshHandler?: () => Promise<string | null>
  /** fetch 实现（用于测试注入） */
  fetchImpl?: typeof fetch
  /** WebSocket 实现（用于测试注入） */
  WebSocketImpl?: typeof WebSocket
  /** 默认超时（ms） */
  timeoutMs?: number
  /** 重试次数（含首次，最多 3 次） */
  maxRetries?: number
}
