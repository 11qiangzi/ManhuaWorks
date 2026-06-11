# collab-service API 文档

> **Base URL**：`https://api.manhuaworks.com/v1/collab`
> **认证**：Bearer Token（用户 JWT / 服务间 mTLS）
> **WebSocket**：`wss://ws.manhuaworks.com/v1/collab/realtime?token=...`
> **内容类型**：`application/json`
> **作者**：陆流光
> **更新日期**：2026-06-08
> **服务**：`collab-service` (端口 8087)

## 概述

collab-service 是 ManhuaWorks 的**实时协作引擎**。它解决 4 类问题：
1. **协作者管理**（邀请/角色/移除）
2. **评论系统**（线程、@ 提及、反应）
3. **活动流**（项目时间线/动态）
4. **通知系统**（站内/邮件/移动推送）
5. **实时同步**（CRDT 在线协同、Yjs awareness）

**本文档面向**：
- 创作者工作台 + 用户后台前端
- 后端服务间调用（项目服务通过 gRPC 同步协作者）
- 集成测试（vitest + WebSocket mock）

**配套文档**：
- 架构：`docs/architecture/W4_COLLAB.md`
- CRDT 实现：`docs/architecture/CRDT.md`
- 通用规范：参考 `docs/api/ai-router.md`

---

## 通用规范

### 认证

- 用户调用：JWT（user-service 颁发）
- 服务间调用：mTLS + 服务名（如 `project-service` 调 `addMember`）

### 实时通道

所有"在线状态"类操作通过 WebSocket 推送。客户端连接后**必须**先发 `hello` 帧声明身份，再订阅房间。

#### 帧协议

| 方向 | 类型 | 含义 |
|:--|:--|:--|
| C→S | `hello` | `{ token, rooms: [roomId,...] }` |
| C→S | `subscribe` | `{ room: "project:p_456" }` |
| C→S | `unsubscribe` | `{ room: "project:p_456" }` |
| C→S | `awareness` | Yjs awareness 状态（光标/选区） |
| C→S | `crdt_update` | Yjs 二进制 update |
| C→S | `ping` | 心跳（30s 一次） |
| S→C | `welcome` | `{ user_id, server_ts }` |
| S→C | `presence` | `{ room, users: [...] }` |
| S→C | `crdt_update` | 来自其他人的 Yjs update |
| S→C | `awareness` | 其他人的 awareness |
| S→C | `event` | 业务事件（评论/活动/通知） |
| S→C | `pong` | 心跳响应 |
| S→C | `error` | `{ code, message }` |

#### 重连策略

- 指数退避：1s → 2s → 4s → 8s → 16s → 30s（封顶）
- 重连后必须重新 `subscribe` 并发送本地未确认的 CRDT state vector

### 限流

| 操作 | 限流 | 备注 |
|:--|:--|:--|
| 发评论 | 10/min/user | 防止刷屏 |
| 邀请协作者 | 20/day/user | 防垃圾邀请 |
| 实时通道 | 1 连接/user | 多 tab 复用同一连接 |

---

## 端点总览

| 模块 | 方法 | 路径 | 说明 |
|:--|:--|:--|:--|
| **协作者** | GET | `/v1/collab/projects/:pid/members` | 成员列表 |
|  | POST | `/v1/collab/projects/:pid/members` | 直接添加（已是平台用户） |
|  | PATCH | `/v1/collab/projects/:pid/members/:uid` | 改角色 |
|  | DELETE | `/v1/collab/projects/:pid/members/:uid` | 移除 |
|  | GET | `/v1/collab/projects/:pid/invitations` | 邀请列表 |
|  | POST | `/v1/collab/projects/:pid/invitations` | 邀请（发邮件） |
|  | DELETE | `/v1/collab/invitations/:id` | 撤销邀请 |
|  | POST | `/v1/collab/invitations/:id/accept` | 接受邀请（公开入口，需 token） |
| **评论** | GET | `/v1/collab/comments/targets/:type/:id` | 列表（游标） |
|  | POST | `/v1/collab/comments/targets/:type/:id` | 发表评论 |
|  | GET | `/v1/collab/comments/:id` | 单条 |
|  | PATCH | `/v1/collab/comments/:id` | 编辑（限作者，5 分钟内） |
|  | DELETE | `/v1/collab/comments/:id` | 软删 |
|  | POST | `/v1/collab/comments/:id/reactions` | 加 reaction |
|  | DELETE | `/v1/collab/comments/:id/reactions/:emoji` | 取消 reaction |
|  | POST | `/v1/collab/comments/:id/replies` | 楼中楼回复 |
| **活动** | GET | `/v1/collab/activities` | 活动流（按项目/用户/时间筛选） |
|  | GET | `/v1/collab/activities/:id` | 单条详情 |
| **通知** | GET | `/v1/collab/notifications` | 通知列表 |
|  | PATCH | `/v1/collab/notifications/:id/read` | 标已读 |
|  | PATCH | `/v1/collab/notifications/read-all` | 全部已读 |
|  | DELETE | `/v1/collab/notifications/:id` | 删除通知 |
|  | GET | `/v1/collab/notifications/unread-count` | 未读数 |
|  | POST | `/v1/collab/notifications/push-token` | 注册移动推送 token |
| **WebSocket** | WS | `/v1/collab/realtime` | 实时通道 |
| **健康** | GET | `/healthz` | 存活 |
|  | GET | `/readyz` | 就绪（DB/Redis 连通） |

---

## 1. 协作者模块

### 1.1 成员列表

**端点**：`GET /v1/collab/projects/:pid/members`

**响应 200**：
```json
{
  "data": [
    {
      "user_id": "u_123",
      "display_name": "林启",
      "avatar_url": "https://cdn.../a.png",
      "email": "linqi@example.com",
      "role": "owner",
      "joined_at": "2025-09-01T08:00:00+08:00",
      "last_active_at": "2026-06-08T03:30:00+08:00"
    },
    {
      "user_id": "u_456",
      "display_name": "苏眀",
      "avatar_url": "https://cdn.../b.png",
      "email": "suming@example.com",
      "role": "editor",
      "joined_at": "2025-09-15T10:00:00+08:00",
      "last_active_at": "2026-06-08T03:45:00+08:00"
    }
  ]
}
```

### 1.2 邀请协作者

**端点**：`POST /v1/collab/projects/:pid/invitations`

**请求**：
```json
{
  "email": "newbie@example.com",
  "role": "editor",
  "message": "一起把灰星搞成漫剧"
}
```

**响应 201**：
```json
{
  "invitation_id": "inv_abc",
  "email": "newbie@example.com",
  "role": "editor",
  "invited_by": "u_123",
  "invite_url": "https://manhuaworks.com/invitations/inv_abc?token=...",
  "expires_at": "2026-06-15T04:00:00+08:00",
  "email_sent": true
}
```

**副作用**：
- 邮件推送（通过 ai-helper 模板）
- 给被邀请者发站内通知
- 活动流记一条 `invited`

**错误**：
- 409 `already_member` 已是成员
- 409 `pending_invitation_exists` 已有未处理邀请
- 422 `plan_limit_reached` 当前套餐不允许更多协作者

### 1.3 接受邀请

**端点**：`POST /v1/collab/invitations/:id/accept`

**说明**：此端点**不需 JWT**，通过邀请 URL 中的 token 鉴权（防泄露）。

**请求**：
```json
{ "token": "inv_token_xyz" }
```

**响应 200**：
```json
{
  "project_id": "p_456",
  "role": "editor",
  "user_id": "u_789",
  "redirect_to": "/projects/p_456"
}
```

### 1.4 改角色

**端点**：`PATCH /v1/collab/projects/:pid/members/:uid`

**请求**：
```json
{ "role": "viewer" }
```

**角色枚举**：
- `owner` 项目所有者（不可改）
- `editor` 可编辑资产/作品
- `commenter` 只能评论
- `viewer` 只读

**响应 200**：返回更新后的成员对象。

### 1.5 移除协作者

**端点**：`DELETE /v1/collab/projects/:pid/members/:uid`

**响应 204**

**副作用**：
- 该用户 WebSocket 收到 `event` 帧 `{type:"removed", project_id:"p_456"}` 立即断线
- 活动流记一条 `removed`

---

## 2. 评论模块

### 2.1 列表

**端点**：`GET /v1/collab/comments/targets/:type/:id?cursor=&limit=20`

- `:type` 取值：`work` / `episode` / `asset` / `project` / `shot`
- `:id` 目标 ID

**响应 200**：
```json
{
  "data": [
    {
      "id": "c_001",
      "parent_id": null,
      "thread_id": "c_001",
      "target": { "type": "shot", "id": "sh_042" },
      "author": {
        "id": "u_456",
        "display_name": "苏眀",
        "avatar_url": "https://cdn.../b.png",
        "role": "editor"
      },
      "body": "@林启 这场戏的镜头角度你看看",
      "mentions": ["u_123"],
      "position": { "x": 0.42, "y": 0.68, "frame": 12 },
      "reactions": {
        "👍": [{ "user_id": "u_123", "at": "..." }],
        "🎬": [{ "user_id": "u_789", "at": "..." }]
      },
      "replies_count": 2,
      "is_resolved": false,
      "created_at": "2026-06-08T03:45:00+08:00",
      "updated_at": "2026-06-08T03:45:00+08:00",
      "edited": false
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

### 2.2 发表评论

**端点**：`POST /v1/collab/comments/targets/:type/:id`

**请求**：
```json
{
  "body": "@林启 这场戏的镜头角度你看看",
  "mentions": ["u_123"],
  "parent_id": null,
  "position": { "x": 0.42, "y": 0.68, "frame": 12 }
}
```

**响应 201**：返回新评论对象。

**副作用**：
- 给被 @ 用户发通知
- 活动流记一条 `commented`
- 实时通道推 `event` 帧给房间内所有在线协作者

**校验**：
- `body` 1-2000 字符
- `mentions` 数组 ≤ 10 人
- `parent_id` 必须属于同一 `target`（thread 隔离）

### 2.3 编辑评论

**端点**：`PATCH /v1/collab/comments/:id`

**约束**：
- 只能作者本人改
- 发表后 **5 分钟内**才能改（防篡改历史）
- `body` 改后 `edited=true`，`updated_at` 刷新

**请求**：
```json
{ "body": "@林启 这场戏的镜头角度再商量" }
```

**响应 200**：返回更新后的评论。

### 2.4 删除评论

**端点**：`DELETE /v1/collab/comments/:id`

**说明**：软删（30 天保留期内可恢复），物理删除后台定时清理。

**响应 204**

### 2.5 Reaction

**端点**：`POST /v1/collab/comments/:id/reactions`

**请求**：
```json
{ "emoji": "👍" }
```

**响应 200**：
```json
{
  "reactions": {
    "👍": 3,
    "🎬": 1
  }
}
```

**取消**：`DELETE /v1/collab/comments/:id/reactions/:emoji`

### 2.6 楼中楼回复

**端点**：`POST /v1/collab/comments/:id/replies`

**请求**：
```json
{ "body": "我也觉得可以再压一点", "mentions": [] }
```

**响应 201**：返回新评论对象，`parent_id` 自动设为 `:id`。

---

## 3. 活动模块

### 3.1 活动流

**端点**：`GET /v1/collab/activities`

**Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `project_id` | string | 否 | 限定项目 |
| `user_id` | string | 否 | 限定用户 |
| `verbs` | string[] | 否 | 动词过滤，如 `commented,uploaded` |
| `target_type` | string | 否 | 目标类型 |
| `since` | ISO 8601 | 否 | 增量同步起点 |
| `cursor` | string | 否 | 游标 |
| `limit` | int | 否 | 默认 30，最大 100 |

**响应 200**：
```json
{
  "data": [
    {
      "id": "act_001",
      "project_id": "p_456",
      "actor": { "id": "u_456", "display_name": "苏眀", "avatar_url": "..." },
      "verb": "commented",
      "target": { "type": "episode", "id": "e_001", "title": "EP01" },
      "summary": "在镜头 12 留下评论",
      "metadata": { "comment_id": "c_001" },
      "created_at": "2026-06-08T03:45:00+08:00"
    },
    {
      "id": "act_002",
      "project_id": "p_456",
      "actor": { "id": "u_123", "display_name": "林启", "avatar_url": "..." },
      "verb": "uploaded",
      "target": { "type": "asset", "id": "a_001", "title": "scene_001.png" },
      "summary": "上传了 1 个资产",
      "created_at": "2026-06-08T03:30:00+08:00"
    }
  ],
  "next_cursor": "eyJpZCI6ImFjdF8wMDIifQ"
}
```

**verb 枚举**：

| verb | 触发时机 |
|:--|:--|
| `created` | 创建项目/作品/剧集 |
| `updated` | 改名/改属性 |
| `deleted` | 软删 |
| `restored` | 从回收站恢复 |
| `commented` | 发表评论 |
| `replied` | 回复评论 |
| `resolved` | 标记评论已解决 |
| `uploaded` | 上传资产 |
| `versioned` | 上传新版本 |
| `invited` | 邀请协作者 |
| `joined` | 接受邀请 |
| `removed` | 移除协作者 |
| `role_changed` | 改角色 |
| `exported` | 导出作品 |
| `subscribed` | 订阅套餐 |
| `plan_changed` | 套餐变更 |

---

## 4. 通知模块

### 4.1 通知列表

**端点**：`GET /v1/collab/notifications`

**Query**：`cursor` / `limit` / `unread_only=true` / `types=comment_mention,invitation_accepted`

**响应 200**：
```json
{
  "data": [
    {
      "id": "n_001",
      "type": "comment_mention",
      "priority": "high",
      "title": "苏眀 在「灰星 EP01」提到你",
      "body": "@林启 这场戏的镜头角度你看看",
      "icon": "💬",
      "link": "/works/w_001?comment=c_123",
      "deep_link": "manhuaworks://comment/c_123",
      "read": false,
      "actor": { "id": "u_456", "display_name": "苏眀", "avatar_url": "..." },
      "metadata": { "project_id": "p_456", "comment_id": "c_123" },
      "created_at": "2026-06-08T03:45:00+08:00",
      "expires_at": null
    }
  ],
  "unread_count": 5
}
```

**type 枚举**：

| type | 触发 | 优先级 |
|:--|:--|:--|
| `comment_mention` | 被 @ | high |
| `comment_reply` | 收到回复 | normal |
| `invitation_received` | 被邀请 | high |
| `invitation_accepted` | 邀请被接受 | normal |
| `member_joined` | 新成员加入 | low |
| `member_removed` | 被移除 | high |
| `role_changed` | 角色变化 | normal |
| `asset_uploaded` | 协作者上传资产 | low |
| `comment_resolved` | 评论被标记解决 | low |
| `export_completed` | 导出完成 | normal |
| `export_failed` | 导出失败 | high |
| `plan_limit_warning` | 配额快满 | high |
| `plan_exceeded` | 配额超限 | high |
| `system` | 系统公告 | normal |

### 4.2 推送渠道

通知支持多渠道分发（按用户偏好）：

```json
{
  "channels": ["in_app", "email", "push", "sms"],
  "quiet_hours": { "start": "23:00", "end": "08:00", "tz": "Asia/Shanghai" }
}
```

- `in_app` 站内（默认全开）
- `email` 邮件（高频通知默认关）
- `push` 移动推送（需先 `POST /push-token` 注册）
- `sms` 短信（仅 critical 事件）

### 4.3 注册推送 Token

**端点**：`POST /v1/collab/notifications/push-token`

**请求**：
```json
{
  "platform": "ios" | "android" | "web",
  "token": "fcm_token_abc",
  "device_id": "dev_001"
}
```

**响应 204**

### 4.4 标已读

- `PATCH /v1/collab/notifications/:id/read` → 204
- `PATCH /v1/collab/notifications/read-all` → 204
- `DELETE /v1/collab/notifications/:id` → 204（删除单条）

### 4.5 未读数

**端点**：`GET /v1/collab/notifications/unread-count`

**响应 200**：
```json
{
  "count": 5,
  "by_type": {
    "comment_mention": 2,
    "invitation_received": 1,
    "export_completed": 2
  }
}
```

---

## 5. WebSocket 实时通道

### 5.1 连接

**URL**：`wss://ws.manhuaworks.com/v1/collab/realtime?token=<jwt>`

**子协议**：`manhuaworks.collab.v1`

### 5.2 Hello 握手

**C→S**：
```json
{
  "type": "hello",
  "token": "eyJhbGciOi...",
  "client": { "app": "user-portal", "version": "1.4.0", "tab_id": "t_001" },
  "rooms": ["project:p_456", "user:u_123"]
}
```

**S→C**：
```json
{
  "type": "welcome",
  "user_id": "u_123",
  "server_ts": 1717845600000,
  "session_id": "s_xyz"
}
```

### 5.3 订阅房间

**房间命名**：
- `project:{project_id}` 项目房间（项目内全员）
- `asset:{asset_id}` 资产协作（协同编辑时）
- `user:{user_id}` 个人通知频道

**C→S**：
```json
{ "type": "subscribe", "room": "project:p_456" }
```

**S→C**：
```json
{ "type": "subscribed", "room": "project:p_456", "members": 5 }
```

### 5.4 Presence（在线状态）

**S→C 推送**（房间内人员变化时）：
```json
{
  "type": "presence",
  "room": "project:p_456",
  "users": [
    { "user_id": "u_123", "display_name": "林启", "tab_id": "t_001", "color": "#FF6B35" }
  ]
}
```

颜色用于在多人光标上区分。

### 5.5 CRDT 同步（Yjs）

**C→S**：
```json
{
  "type": "awareness",
  "room": "asset:a_001",
  "state": { "cursor": { "x": 0.42, "y": 0.68 }, "selection": [...] }
}
```

或：
```json
{
  "type": "crdt_update",
  "room": "asset:a_001",
  "update": "<base64 Yjs update>",
  "origin": "t_001"
}
```

**S→C**（来自其他人）：
```json
{
  "type": "awareness",
  "from": "u_456",
  "tab_id": "t_002",
  "state": { "cursor": { "x": 0.55, "y": 0.12 } }
}
```

```json
{
  "type": "crdt_update",
  "from": "u_456",
  "tab_id": "t_002",
  "update": "<base64>",
  "origin": "t_002"
}
```

### 5.6 业务事件推送

评论/活动/通知事件通过 `event` 帧推：

```json
{
  "type": "event",
  "room": "project:p_456",
  "event": {
    "kind": "comment_created",
    "data": { /* 评论对象同 API 响应 */ }
  }
}
```

**event.kind 枚举**：
- `comment_created` / `comment_updated` / `comment_deleted` / `comment_resolved`
- `member_joined` / `member_removed` / `role_changed`
- `activity_created`
- `notification_received`（仅推个人 `user:{uid}` 房间）
- `asset_updated`（多人编辑同一资产时）

### 5.7 心跳

**C→S**（每 30s）：
```json
{ "type": "ping", "ts": 1717845600000 }
```

**S→C**：
```json
{ "type": "pong", "ts": 1717845600000, "server_ts": 1717845600010 }
```

60s 没收到 ping 服务端主动断开。

### 5.8 错误帧

```json
{ "type": "error", "code": "subscribe_failed", "message": "Forbidden" }
```

**错误码**：
- `auth_failed` token 无效
- `forbidden` 无权订阅该房间
- `rate_limited` 触发限流
- `protocol_error` 帧格式错
- `internal_error` 服务异常

---

## 6. 错误码

| HTTP | 错误码 | 含义 |
|:--|:--|:--|
| 400 | `validation_failed` | 字段错 |
| 401 | `token_expired` | JWT 过期 |
| 403 | `forbidden` | 无权操作 |
| 403 | `plan_limit` | 套餐限制 |
| 404 | `not_found` | 资源不存在 |
| 409 | `already_member` | 已是成员 |
| 409 | `pending_invitation_exists` | 邀请待处理 |
| 409 | `edit_window_expired` | 5 分钟编辑窗口过 |
| 422 | `business_rule` | 业务规则不满足 |
| 429 | `rate_limited` | 触发限流 |

---

## 7. 内部 gRPC 接口（服务间）

collab-service 暴露 gRPC 给其他服务调用（如 project-service 创建项目时初始化 owner）：

```protobuf
service CollabInternal {
  rpc AddMember(AddMemberRequest) returns (AddMemberResponse);
  rpc RemoveMember(RemoveMemberRequest) returns (RemoveMemberResponse);
  rpc GetMembers(GetMembersRequest) returns (GetMembersResponse);
  rpc RecordActivity(RecordActivityRequest) returns (RecordActivityResponse);
  rpc SendNotification(SendNotificationRequest) returns (SendNotificationResponse);
}
```

---

## 8. 数据库 schema（关键表）

```sql
-- 协作者
CREATE TABLE project_members (
  project_id   UUID NOT NULL,
  user_id      UUID NOT NULL,
  role         VARCHAR(16) NOT NULL,  -- owner/editor/commenter/viewer
  joined_at    TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ,
  PRIMARY KEY (project_id, user_id)
);

-- 邀请
CREATE TABLE invitations (
  id            UUID PRIMARY KEY,
  project_id    UUID NOT NULL,
  email         VARCHAR(255) NOT NULL,
  role          VARCHAR(16) NOT NULL,
  token_hash    VARCHAR(64) NOT NULL,
  invited_by    UUID NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  accepted_at   TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL
);

-- 评论
CREATE TABLE comments (
  id          UUID PRIMARY KEY,
  target_type VARCHAR(16) NOT NULL,
  target_id   UUID NOT NULL,
  parent_id   UUID,
  thread_id   UUID NOT NULL,
  author_id   UUID NOT NULL,
  body        TEXT NOT NULL,
  mentions    UUID[],
  position    JSONB,
  reactions   JSONB DEFAULT '{}',
  is_resolved BOOLEAN DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_comments_target ON comments(target_type, target_id, created_at DESC);

-- 活动
CREATE TABLE activities (
  id          UUID PRIMARY KEY,
  project_id  UUID NOT NULL,
  actor_id    UUID NOT NULL,
  verb        VARCHAR(32) NOT NULL,
  target_type VARCHAR(16),
  target_id   UUID,
  summary     TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_activities_project ON activities(project_id, created_at DESC);

-- 通知
CREATE TABLE notifications (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL,
  type       VARCHAR(32) NOT NULL,
  priority   VARCHAR(16) DEFAULT 'normal',
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  metadata   JSONB,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at, created_at DESC);
```

---

## 9. 部署 & SLO

- **副本**：3 副本（k8s deployment）
- **WebSocket 节点**：独立 StatefulSet，Redis pub/sub 跨节点广播
- **SLO**：P99 < 200ms（CRDT 同步端到端），可用性 99.95%
- **容量**：单节点支持 50k 并发连接
