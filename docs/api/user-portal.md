# user-portal API 文档

> **Base URL**：`https://api.manhuaworks.com/v1/user-portal`
> **认证**：Bearer Token（用户 JWT）
> **内容类型**：`application/json`
> **作者**：陆流光
> **更新日期**：2026-06-08
> **服务**：聚合网关（api-gateway 端口 8080 → user-service / project-service / asset-service / billing-service）

## 概述

user-portal 是面向**个人创作者**（C 端）的浏览器端 SPA（Vue 3 + Vite + Naive UI）。它不直连业务服务，全部走 **api-gateway** 统一鉴权、限流、审计。本文档是前端调后端的**唯一接口清单**。

**本文档面向**：
- user-portal 前端开发（强类型 SDK 生成依据）
- 联调测试工程师
- 集成测试脚本（vitest + msw）

**配套文档**：
- 架构：`docs/architecture/W4_USER_PORTAL.md`
- 通用规范：参考 `docs/api/ai-router.md`（认证/限流/错误码）
- 业务底座：`docs/api/user-service.md` / `project-service.md` / `asset-service.md`

---

## 通用规范

### 认证

所有请求必须带 `Authorization: Bearer <jwt>`。JWT 由 user-service 颁发，TTL 60 分钟，刷新通过 `POST /v1/auth/refresh` 静默换发（前端在拦截器 401 时自动调用）。

### 错误响应统一格式

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": { /* 可选 */ },
    "trace_id": "0HMD..."
  }
}
```

### 分页约定

列表类接口统一使用 `cursor` 游标分页（非 page 数字）：

| 参数 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `cursor` | string | 否 | 上一页响应里的 `next_cursor` |
| `limit` | int | 否 | 默认 20，最大 100 |
| `sort` | string | 否 | `-created_at` / `name` / `last_opened` |

响应：

```json
{
  "data": [...],
  "next_cursor": "eyJpZCI6IjEyMyJ9" | null,
  "has_more": true
}
```

### 限流（按套餐）

| 套餐 | 读 QPS | 写 QPS | 日上限 |
|:--|:--|:--|:--|
| 免费 | 5 | 1 | 1000 |
| 基础 | 20 | 5 | 10000 |
| 专业 | 50 | 20 | 100000 |
| 企业 | 自定义 | 自定义 | 无限 |

触发 429 时响应 `Retry-After` 头，前端需退避重试。

---

## 端点总览

| 模块 | 方法 | 路径 | 说明 |
|:--|:--|:--|:--|
| **认证** | POST | `/v1/auth/login` | 邮箱/手机号 + 密码登录 |
|  | POST | `/v1/auth/refresh` | 刷新 JWT |
|  | POST | `/v1/auth/logout` | 注销（清服务端 session） |
|  | POST | `/v1/auth/2fa/verify` | 二步验证确认 |
| **用户** | GET | `/v1/users/me` | 当前用户信息（含 Plan） |
|  | PATCH | `/v1/users/me` | 改昵称/头像/简介 |
|  | POST | `/v1/users/me/avatar` | 上传头像 |
|  | POST | `/v1/users/me/password` | 改密码 |
|  | GET | `/v1/users/me/usage` | 资源用量（云存/AI tokens/导出次数） |
|  | GET | `/v1/users/me/sessions` | 在线设备列表 |
|  | DELETE | `/v1/users/me/sessions/:id` | 踢出某设备 |
| **订阅** | GET | `/v1/billing/plans` | 套餐列表（含价格、特性） |
|  | GET | `/v1/billing/me/subscription` | 我的当前订阅 |
|  | POST | `/v1/billing/me/subscription` | 订阅/升级/降级 |
|  | DELETE | `/v1/billing/me/subscription` | 取消（到期后失效） |
|  | GET | `/v1/billing/me/invoices` | 账单历史 |
| **项目** | GET | `/v1/projects` | 我的项目列表 |
|  | POST | `/v1/projects` | 创建项目 |
|  | GET | `/v1/projects/:id` | 项目详情 |
|  | PATCH | `/v1/projects/:id` | 改项目名/简介/封面 |
|  | DELETE | `/v1/projects/:id` | 删除项目（30 天回收） |
|  | POST | `/v1/projects/:id/restore` | 从回收站恢复 |
|  | GET | `/v1/projects/trash` | 回收站 |
|  | GET | `/v1/projects/:id/stats` | 项目统计（资产数/协作者数/最后活动） |
| **作品** | GET | `/v1/works` | 作品列表（漫剧/短剧/有声书） |
|  | POST | `/v1/works` | 创建作品 |
|  | GET | `/v1/works/:id` | 作品详情 |
|  | PATCH | `/v1/works/:id` | 改作品名/类型/标签 |
|  | DELETE | `/v1/works/:id` | 删除作品 |
|  | POST | `/v1/works/:id/duplicate` | 复制为草稿 |
|  | GET | `/v1/works/:id/episodes` | 剧集列表 |
|  | POST | `/v1/works/:id/episodes` | 新建剧集 |
|  | GET | `/v1/works/:id/export` | 申请导出（异步任务） |
|  | GET | `/v1/works/:id/exports` | 导出历史 |
| **资产** | GET | `/v1/assets` | 资产库（我的） |
|  | GET | `/v1/assets/library` | 资产库聚合视图（按分类） |
|  | POST | `/v1/assets/uploads/init` | 申请上传 URL |
|  | POST | `/v1/assets/uploads/complete` | 完成上传落库 |
|  | DELETE | `/v1/assets/:id` | 软删 |
|  | POST | `/v1/assets/:id/restore` | 恢复 |
|  | GET | `/v1/assets/:id/url` | 取签名 URL |
| **协作** | GET | `/v1/collab/projects/:id/members` | 协作者列表 |
|  | POST | `/v1/collab/projects/:id/invitations` | 邀请协作者 |
|  | DELETE | `/v1/collab/projects/:id/members/:uid` | 移除协作者 |
|  | PATCH | `/v1/collab/projects/:id/members/:uid` | 改角色 |
| **通知** | GET | `/v1/notifications` | 通知列表 |
|  | PATCH | `/v1/notifications/:id/read` | 标已读 |
|  | PATCH | `/v1/notifications/read-all` | 全部已读 |
|  | GET | `/v1/notifications/unread-count` | 未读数 |
| **活动** | GET | `/v1/activities` | 活动流（动态/时间线） |
| **评论** | GET | `/v1/comments/targets/:type/:id` | 某目标的评论列表 |
|  | POST | `/v1/comments/targets/:type/:id` | 发表评论 |
|  | PATCH | `/v1/comments/:id` | 编辑自己的评论 |
|  | DELETE | `/v1/comments/:id` | 删自己的评论 |

---

## 1. 认证模块

### 1.1 登录

**端点**：`POST /v1/auth/login`

**请求**：
```json
{
  "account": "user@example.com",
  "password": "P@ssw0rd!",
  "remember_device": true
}
```

**响应 200**：
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "rt_8f3...",
  "expires_in": 3600,
  "user": {
    "id": "u_123",
    "email": "user@example.com",
    "display_name": "林启",
    "plan": "pro",
    "avatar_url": "https://cdn.../a.png",
    "2fa_enabled": false
  }
}
```

**错误**：
- 401 `invalid_credentials` 密码错
- 403 `2fa_required` 需要二次验证
- 429 `too_many_attempts` 5 分钟内 5 次错

**前端示例**：
```ts
import { useUserStore } from '@/stores/user'
const { login } = useUserStore()
await login('user@example.com', 'P@ssw0rd!')
```

### 1.2 刷新 Token

**端点**：`POST /v1/auth/refresh`

**请求**：
```json
{ "refresh_token": "rt_8f3..." }
```

**响应 200**：同登录，但 `user` 字段省略（前端已有）。

### 1.3 二步验证

**端点**：`POST /v1/auth/2fa/verify`

**请求**：
```json
{ "challenge_id": "chl_abc", "code": "123456" }
```

**响应 200**：返回正式 `access_token`。

---

## 2. 用户模块

### 2.1 获取当前用户

**端点**：`GET /v1/users/me`

**响应 200**：
```json
{
  "id": "u_123",
  "email": "user@example.com",
  "display_name": "林启",
  "avatar_url": "https://cdn.../a.png",
  "bio": "前考古助理 / 现科幻写手",
  "plan": "pro",
  "plan_expires_at": "2026-12-31T23:59:59+08:00",
  "created_at": "2025-08-12T10:30:00+08:00",
  "stats": {
    "projects": 18,
    "works": 7,
    "assets": 432,
    "collaborators": 12
  }
}
```

**前端 Pinia Store**：
```ts
export const useUserStore = defineStore('user', () => {
  const me = ref<User | null>(null)
  const fetchMe = async () => {
    me.value = await api.get('/v1/users/me')
  }
  return { me, fetchMe }
})
```

### 2.2 修改资料

**端点**：`PATCH /v1/users/me`

**请求**：
```json
{ "display_name": "林启", "bio": "前考古助理" }
```

**响应 200**：返回更新后的完整用户。

### 2.3 资源用量

**端点**：`GET /v1/users/me/usage`

**响应 200**：
```json
{
  "storage": { "used_mb": 2840, "limit_mb": 51200, "percent": 5.5 },
  "ai_tokens": { "used": 124000, "limit": 1000000, "percent": 12.4 },
  "exports": { "used": 4, "limit": 50 },
  "bandwidth_mb": { "used": 120, "limit": 10240 }
}
```

前端渲染 `<UsageBar :data="usage.ai_tokens" />` 时按 percent 变色（<70% 绿 / 70-90% 黄 / >90% 红）。

---

## 3. 订阅模块

### 3.1 套餐列表

**端点**：`GET /v1/billing/plans`

**响应 200**：
```json
{
  "data": [
    {
      "id": "free",
      "name": "免费版",
      "price_cny": 0,
      "features": {
        "storage_mb": 500,
        "ai_tokens_per_month": 50000,
        "exports_per_month": 3,
        "max_collaborators": 0
      }
    },
    {
      "id": "pro",
      "name": "专业版",
      "price_cny": 99,
      "features": {
        "storage_mb": 51200,
        "ai_tokens_per_month": 1000000,
        "exports_per_month": 50,
        "max_collaborators": 10
      },
      "highlight": true
    }
  ]
}
```

### 3.2 我的订阅

**端点**：`GET /v1/billing/me/subscription`

**响应 200**：
```json
{
  "plan_id": "pro",
  "plan_name": "专业版",
  "status": "active",
  "started_at": "2026-05-01T00:00:00+08:00",
  "expires_at": "2026-12-31T23:59:59+08:00",
  "auto_renew": true,
  "next_bill_amount_cny": 99
}
```

### 3.3 订阅/升级

**端点**：`POST /v1/billing/me/subscription`

**请求**：
```json
{ "plan_id": "enterprise", "payment_method": "alipay", "coupon_code": "WELCOME20" }
```

**响应 200**：返回支付跳转 URL 或新订阅对象。

---

## 4. 项目模块

### 4.1 列出项目

**端点**：`GET /v1/projects?cursor=&limit=20&sort=-last_opened`

**响应 200**：
```json
{
  "data": [
    {
      "id": "p_456",
      "name": "灰星 1500 章",
      "cover_url": "https://cdn.../c.png",
      "type": "novel",
      "asset_count": 1240,
      "member_count": 5,
      "last_opened_at": "2026-06-07T22:15:00+08:00",
      "created_at": "2025-09-01T08:00:00+08:00"
    }
  ],
  "next_cursor": "eyJpZCI6InBfNDU2In0",
  "has_more": true
}
```

### 4.2 创建项目

**端点**：`POST /v1/projects`

**请求**：
```json
{
  "name": "灰星 1500 章",
  "type": "novel",
  "template_id": "tpl_sci_fi",
  "cover_url": null
}
```

**响应 201**：
```json
{
  "id": "p_789",
  "name": "灰星 1500 章",
  "type": "novel",
  "owner_id": "u_123",
  "created_at": "2026-06-08T04:00:00+08:00"
}
```

### 4.3 项目详情

**端点**：`GET /v1/projects/:id`

**响应 200**：
```json
{
  "id": "p_456",
  "name": "灰星 1500 章",
  "type": "novel",
  "cover_url": "https://cdn.../c.png",
  "owner_id": "u_123",
  "members": [
    { "user_id": "u_123", "display_name": "林启", "role": "owner", "avatar_url": "..." }
  ],
  "asset_count": 1240,
  "stats": {
    "chapters": 30,
    "ai_runs": 87,
    "storage_mb": 2840
  }
}
```

---

## 5. 作品模块

### 5.1 作品列表

**端点**：`GET /v1/works?type=drama`

**响应 200**：
```json
{
  "data": [
    {
      "id": "w_001",
      "title": "灰星 第 1 集：苏眀在起点",
      "type": "drama",
      "cover_url": "https://cdn.../d.png",
      "duration_sec": 60,
      "status": "draft",
      "project_id": "p_456",
      "updated_at": "2026-06-08T03:30:00+08:00"
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

### 5.2 创建作品

**端点**：`POST /v1/works`

**请求**：
```json
{
  "title": "灰星 第 1 集",
  "type": "drama",
  "project_id": "p_456",
  "template_id": "tpl_60s_drama"
}
```

**响应 201**：返回完整作品对象。

### 5.3 剧集列表

**端点**：`GET /v1/works/:id/episodes`

**响应 200**：
```json
{
  "data": [
    {
      "id": "e_001",
      "title": "EP01 苏眀在起点",
      "index": 1,
      "duration_sec": 60,
      "status": "completed",
      "thumbnail_url": "https://cdn.../t.png"
    }
  ]
}
```

### 5.4 申请导出

**端点**：`POST /v1/works/:id/export`

**请求**：
```json
{ "format": "mp4", "resolution": "1080p", "watermark": false }
```

**响应 202**：
```json
{
  "task_id": "exp_abc",
  "estimated_sec": 45,
  "status": "queued"
}
```

前端订阅 SSE `GET /v1/works/:id/exports/stream`，收到 `{status:"done", url:"..."}` 后跳转下载。

---

## 6. 资产模块

### 6.1 资产库聚合视图

**端点**：`GET /v1/assets/library?group_by=type`

**响应 200**：
```json
{
  "groups": [
    { "type": "image", "count": 320, "used_mb": 1240 },
    { "type": "video", "count": 24, "used_mb": 1480 },
    { "type": "audio", "count": 89, "used_mb": 60 },
    { "type": "subtitle", "count": 30, "used_mb": 0.5 }
  ],
  "total": 463,
  "total_mb": 2780.5
}
```

### 6.2 申请上传

**端点**：`POST /v1/assets/uploads/init`

**请求**：
```json
{
  "filename": "scene_001.png",
  "size": 2048000,
  "content_type": "image/png",
  "checksum": "sha256:abc...",
  "project_id": "p_456"
}
```

**响应 200**：
```json
{
  "upload_url": "https://s3.../put?signature=...",
  "asset_id": "a_001",
  "expires_in": 600
}
```

**前端流程**：
```ts
const init = await api.post('/v1/assets/uploads/init', {...})
await axios.put(init.upload_url, file, {
  headers: { 'Content-Type': file.type }
})
await api.post('/v1/assets/uploads/complete', { asset_id: init.asset_id })
```

### 6.3 软删/恢复

**端点**：`DELETE /v1/assets/:id` → 30 天内可恢复。

**响应 204** 无 body。

**恢复**：`POST /v1/assets/:id/restore`

### 6.4 签名 URL

**端点**：`GET /v1/assets/:id/url`

**响应 200**：
```json
{ "url": "https://cdn.../signed?ts=...", "expires_in": 3600 }
```

---

## 7. 协作模块

### 7.1 协作者列表

**端点**：`GET /v1/collab/projects/:id/members`

**响应 200**：
```json
{
  "data": [
    { "user_id": "u_456", "display_name": "苏眀", "role": "editor", "joined_at": "..." }
  ]
}
```

### 7.2 邀请

**端点**：`POST /v1/collab/projects/:id/invitations`

**请求**：
```json
{ "email": "suming@example.com", "role": "editor", "message": "一起来搞事" }
```

**响应 201**：
```json
{
  "invitation_id": "inv_001",
  "expires_at": "2026-06-15T04:00:00+08:00"
}
```

### 7.3 移除/改角色

- `DELETE /v1/collab/projects/:id/members/:uid` → 204
- `PATCH /v1/collab/projects/:id/members/:uid` → 请求 `{ "role": "viewer" }`

---

## 8. 通知模块

### 8.1 通知列表

**端点**：`GET /v1/notifications?cursor=&unread_only=true`

**响应 200**：
```json
{
  "data": [
    {
      "id": "n_001",
      "type": "comment_mention",
      "title": "苏眀 在「灰星 EP01」提到你",
      "body": "@林启 这场戏的镜头角度你看看",
      "link": "/works/w_001?comment=c_123",
      "read": false,
      "created_at": "2026-06-08T03:45:00+08:00"
    }
  ],
  "unread_count": 5
}
```

### 8.2 标已读

- `PATCH /v1/notifications/:id/read` → 204
- `PATCH /v1/notifications/read-all` → 204

### 8.3 未读数

**端点**：`GET /v1/notifications/unread-count`

**响应 200**：`{ "count": 5 }`

---

## 9. 活动流

**端点**：`GET /v1/activities?project_id=p_456&limit=30`

**响应 200**：
```json
{
  "data": [
    {
      "id": "act_001",
      "actor": { "id": "u_456", "display_name": "苏眀" },
      "verb": "commented",
      "target": { "type": "episode", "id": "e_001", "title": "EP01" },
      "summary": "在镜头 12 留下评论",
      "created_at": "2026-06-08T03:45:00+08:00"
    }
  ]
}
```

verb 取值：`created` / `updated` / `commented` / `invited` / `joined` / `exported` / `uploaded`。

---

## 10. 评论模块

### 10.1 评论列表

**端点**：`GET /v1/comments/targets/:type/:id`

- `:type` 取值：`work` / `episode` / `asset` / `project`
- `:id` 为目标 ID

**响应 200**：
```json
{
  "data": [
    {
      "id": "c_001",
      "author": { "id": "u_456", "display_name": "苏眀", "avatar_url": "..." },
      "body": "@林启 这场戏的镜头角度你看看",
      "mentions": ["u_123"],
      "reactions": { "👍": 3, "🎬": 1 },
      "thread_id": "c_001",
      "replies_count": 2,
      "created_at": "2026-06-08T03:45:00+08:00"
    }
  ]
}
```

### 10.2 发表评论

**端点**：`POST /v1/comments/targets/:type/:id`

**请求**：
```json
{
  "body": "@林启 这场戏的镜头角度你看看",
  "mentions": ["u_123"],
  "parent_id": null,
  "position": { "x": 0.42, "y": 0.68 }  // 可选，资产批注坐标
}
```

**响应 201**：返回新评论对象。

---

## 错误码速查

| HTTP | 错误码 | 含义 | 前端处理 |
|:--|:--|:--|:--|
| 400 | `validation_failed` | 字段校验失败 | 表单回显错误 |
| 401 | `token_expired` | JWT 过期 | 自动 refresh 后重试 |
| 401 | `invalid_token` | 伪造/篡改 | 跳转登录 |
| 403 | `plan_limit` | 套餐配额不足 | 弹升级弹窗 |
| 403 | `forbidden` | 无权限 | Toast 提示 |
| 404 | `not_found` | 资源不存在 | 友好空态 |
| 409 | `conflict` | 资源冲突（如重名） | 提示用户改名 |
| 413 | `file_too_large` | 文件超限 | Toast |
| 422 | `business_rule` | 业务规则不满足 | 提示具体原因 |
| 429 | `rate_limited` | 触发限流 | 退避 |
| 500 | `internal_error` | 服务器内部错 | 通用错误页 |
| 503 | `service_unavailable` | 依赖服务宕机 | 重试 + 提示 |

---

## 前端 SDK 约定

```ts
// src/api/index.ts
import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 30000,
})

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  (r) => r.data,
  async (err) => {
    if (err.response?.status === 401 && err.response.data.error.code === 'token_expired') {
      await refresh()
      return api(err.config)
    }
    throw normalizeError(err)
  }
)
```

所有接口由 `openapi-typescript` 从本文件生成，确保前后端强类型一致。
