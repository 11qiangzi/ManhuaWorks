# ManhuaWorks collab-service

> 协作服务 - 协作者 / 评论 / 活动流 / 实时通知 / 在线状态 / WS 实时同步

- **端口**: `8091`
- **WS 路径**: `/ws` (JWT 鉴权, query `?token=<jwt>`)
- **数据**: Postgres `collab` 库 + Redis pub/sub
- **技术**: Express + ws + pg + ioredis + zod + TypeScript strict

## 目录

```
src/
├── app.ts                    # Express 应用工厂
├── index.ts                  # 进程入口 (HTTP + WS + 优雅关闭)
├── container.ts              # service 单例容器 (打破循环依赖)
├── config/
│   ├── env.ts                # zod 校验环境变量
│   ├── db.ts                 # pg 连接池
│   ├── redis.ts              # ioredis pub/sub/cmd 三连接
│   └── logger.ts             # pino
├── middleware/
│   ├── auth.ts               # JWT 鉴权 (Bearer)
│   └── error.ts              # AppError + 统一错误处理
├── models/                   # TS 类型 + 入参 DTO
├── repositories/             # 纯 SQL 数据访问
├── services/                 # 业务逻辑
│   ├── commentService.ts     # 评论 CRUD + @mention + 解决/重开
│   ├── presenceService.ts    # 在线/离线/心跳
│   ├── activityService.ts    # 活动流
│   ├── notificationService.ts# 站内通知 + 实时推送
│   └── realtimeService.ts    # WS + Redis pub/sub 跨进程广播
├── controllers/              # HTTP 控制器
├── routes/                   # 路由挂载
├── clients/                  # user-service / project-service 软依赖
└── ws/
    ├── server.ts             # WebSocketServer 挂载
    ├── handlers.ts           # 5 类入站消息 (typing/cursor/edit/comment/join)
    └── auth.ts               # WS 握手 JWT 校验
```

## 数据库

```bash
# 创建库
psql -U postgres -c "CREATE DATABASE collab;"

# 建表
psql "postgres://mhw:mhw_dev_password_2026@127.0.0.1:5432/collab" \
  -f db/init_collab.sql
```

5 张表：
- `comments` - 评论 + 解决状态 + @mention
- `presence_heartbeats` - 在线心跳审计抽样
- `activities` - 活动流
- `notifications` - 站内通知
- `realtime_sessions` - WS 会话记录

## 运行

```bash
# 安装依赖
npm install

# 开发
npm run dev   # tsx watch

# 构建
npm run build

# 启动
npm start

# 类型检查
npm run typecheck

# 测试
npm test

# WS 握手 smoke
npm run smoke:ws
```

## API 速览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET  | /health | 健康检查 (含 db/redis) |
| GET  | /api/v1/stats | WS 连接统计 |
| POST | /api/v1/comments | 创建评论 (含 @mention 解析) |
| GET  | /api/v1/comments?projectId=&targetType= | 列表 |
| GET  | /api/v1/comments/:id | 详情 |
| GET  | /api/v1/comments/:id/thread | 整条线程 |
| PATCH| /api/v1/comments/:id | 编辑 |
| POST | /api/v1/comments/:id/resolve | 解决 |
| POST | /api/v1/comments/:id/reopen | 重开 |
| DELETE| /api/v1/comments/:id | 删除 |
| POST | /api/v1/presence/heartbeat | 心跳 |
| POST | /api/v1/presence/join | 加入项目 (上线) |
| POST | /api/v1/presence/leave/:projectId | 离开项目 |
| GET  | /api/v1/presence/project/:id | 项目在线列表 |
| GET  | /api/v1/presence/me | 我的在线状态 |
| GET  | /api/v1/activities?projectId= | 活动流 |
| GET  | /api/v1/notifications | 通知列表 |
| GET  | /api/v1/notifications/unread-count | 未读数 |
| POST | /api/v1/notifications/:id/read | 标记已读 |
| POST | /api/v1/notifications/read-all | 全部已读 |
| POST | /api/v1/notifications/:id/archive | 归档 |

## WebSocket 协议

### 握手
```
ws://host:8091/ws?token=<jwt>[&clientId=<id>]
```
JWT 校验失败 → `401 Unauthorized`

### 握手成功 (服务端 -> 客户端)
```json
{ "type": "system", "event": "connected", "data": { "connId": "...", "userId": "...", "ts": 0 } }
```

### 5 类入站消息 (客户端 -> 服务端)
```json
{ "type": "ping" }
{ "type": "typing", "data": { "projectId": "uuid", "isTyping": true } }
{ "type": "cursor", "data": { "projectId": "uuid", "x": 100, "y": 200 } }
{ "type": "edit",   "data": { "projectId": "uuid", "targetType": "panel", "targetId": "uuid", "op": "update", "preview": "..." } }
{ "type": "join",   "data": { "projectId": "uuid" } }
{ "type": "leave",  "data": { "projectId": "uuid" } }
{ "type": "comment","data": { "projectId": "uuid", "targetType": "panel", "targetId": "uuid", "body": "@alice 看下" } }
```

### 5 类出站 (服务端 -> 客户端)
- `typing` (start/stop)
- `cursor` (move)
- `edit` (insert/update/delete/noop)
- `comment` (created/updated/resolved/reopened/deleted)
- `presence` (joined/left/heartbeat)
- `notification` (new)
- `mention` (new)
- `system` / `error`

### 心跳
- 客户端 30s 发 `ping`，服务端回 `pong`
- 服务端 30s 发 `ping` frame，60s 内无 `pong` 主动断开

## Redis pub/sub 通道

| 通道 | 用途 |
|---|---|
| `collab:project:<id>` | 项目维度广播 (typing/cursor/edit/comment/presence) |
| `collab:user:<id>`    | 用户维度 (通知 / mention) |
| `collab:global*`      | 兜底 (PSUBSCRIBE) |

跨进程时: 服务 A 写入 redis → 所有服务实例 SUBSCRIBE 收到 → 扇出到本进程内的 WebSocket 连接。

## @mention 解析

正则: `/@([a-zA-Z0-9_.\-]{1,32})/g`

文本 `@alice @bob_1 @中文` 会被解析为 `["alice", "bob_1"]`（中文/超长用户名会被忽略，避免误报）。

随后调用 user-service 解析 username -> user_id，失败的会被静默丢弃。

## 质量监理

```bash
npm run typecheck   # tsc 0 错
npm test            # vitest
```
