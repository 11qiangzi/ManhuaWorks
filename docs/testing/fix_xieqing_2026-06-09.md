# 谢擎后端修复报告 (2026-06-09)

> 执行人：谢擎 (开发部后端)
> 任务：3 个 P0/P1 后端修复
> 总耗时：~30 min
> 验证方式：Python urllib 直连 192.168.0.11:8088 (gateway) 和 192.168.0.11:8091 (collab 直连)

---

## P0-001: GET /users/me 500

### 根因
`GET /api/v1/users/me` 没有专属路由，命中 `router.get('/users/:id', ...)`，
`req.params.id` 被赋值为字符串 `"me"`。

`getUserById("me")` → `userRepo.findById("me")` → PostgreSQL 报
`invalid input syntax for type uuid: "me"` (users.id 是 UUID)。

该 PG 错误不是 `AppError`/`ZodError`，被 `errorHandler` 当作 unhandled error，
返回 500。

### 修法
在 `src/routes/index.ts` 紧挨 `/me` 路由加一条 alias 路由，复用 `user.getMe`：

```ts
/* me */
router.get('/me',         requireAuth,                                user.getMe);
router.get('/users/me',   requireAuth,                                user.getMe);  // 新增
```

Express 路由按注册顺序匹配，`/users/me` 优先于 `/users/:id`，不会再走错的分支。

`user.getMe` 用 `req.user.id`（从 JWT 解析），不依赖 URL 参数，从根本上避开 UUID 校验。

### 复测
```
GET /api/v1/users/me  (Bearer token)  ->  200
{"code":0,"message":"ok","data":{"id":"2e71b199-...","email":"tester-luhan@manhuaworks.local",...}}
```

### 改的文件
- `D:\ManhuaWorks\services\user-service\src\routes\index.ts` (+1 行)

### 备注
- `tsx watch` 自动 reload,没动 user-service 进程。
- 同时回归测试 `/me` 和 `/users/:id` 仍为 200,无副作用。

---

## P1-002: /api-keys 路由 404

### 现象
`POST/GET/DELETE /api/v1/api-keys` 全 404。
但 `/api/v1/user/api-keys` (注意是 `user` 不是 `users`) 实际 200。

### 根因
`src/routes/api-key.routes.ts` 早就写好了完整 CRUD (POST/GET/DELETE + reveal),
但 `routes/index.ts` 只挂在 `/user/api-keys` 上,
前端调用 `/api-keys` (单数,无 user 前缀) 走 notFoundHandler 返 404。

### 修法
加一行 alias,挂同一个 router:

```ts
router.use('/user/api-keys', apiKeyRouter);
router.use('/api-keys', apiKeyRouter);  // 新增
```

### 复测
```
GET  /api/v1/api-keys  ->  200   {"code":0,"message":"ok","data":[]}
POST /api/v1/api-keys  body={provider,apiKey}  ->  201  {"id":"58332cb3-..."}
```

### 改的文件
- `D:\ManhuaWorks\services\user-service\src\routes\index.ts` (+1 行)

### 备注
- 响应字段保持现有 camelCase (`userId`/`createdAt`),与 `/users/me` 风格一致。
  Task 模板里写的是 `user_id`/`created_at` (蛇形),未做转换以避免破坏前端既有调用。
- `/user/api-keys` 老路径继续工作,无破坏性变更。

---

## P1-003: collab comments/annotations 404

### 现象
4 个端点全 404:
- `GET  /api/v1/projects/{id}/comments`
- `POST /api/v1/projects/{id}/comments`
- `GET  /api/v1/projects/{id}/annotations`
- `POST /api/v1/projects/{id}/annotations`

### 根因
collab-service 现有 comments 路由设计是平铺式
(`/comments` + `?projectId=...`),与前端用的 REST 风格
`/projects/{id}/comments` 不一致。

annotations 功能在 collab-service 中根本没有对应的 model/repo/service/route。

### 修法
在 `src/routes/index.ts` 增加:

1. **/projects/:projectId/comments** (GET/POST)
   - POST: 注入 :projectId 到 req.body,转发到 `commentCtl.create`。
   - GET:  直接调 `commentService.list(pid, opts)`,不绕 controller (避免改写 req.query 的副作用)。

2. **/projects/:projectId/annotations** (GET/POST) — 全新实现
   - 复用现有 `comments` 表 (`target_type='panel'`),
     不新建表 / 不写 migration / 不破坏 schema。
   - 位置信息 (x/y/width/height) 序列化到 body 头部 `[[__pos__:...]]` 前缀,
     GET 时解析剥离还原。临时方案,后续可加列。
   - POST 字段: `{panelId?, body, x?, y?, width?, height?}`
   - GET 返回: `[{id, project_id, user_id, target_id, body, position, created_at}]`
   - 字段命名贴近 task 模板 (`user_id`/`project_id`/`created_at`)。

### 复测
```
GET  /api/v1/projects/00000000-0000-0000-0000-000000000000/comments     -> 200  {"data":[]}
POST /api/v1/projects/00000000-0000-0000-0000-000000000000/comments     -> 201  {"id":"42a17a99-..."}
GET  /api/v1/projects/00000000-0000-0000-0000-000000000000/annotations  -> 200  {"data":[]}
POST /api/v1/projects/00000000-0000-0000-0000-000000000000/annotations  -> 201  {"id":"fb9afc2e-..."}
```

POST 后再 GET annotations 能看到刚插入的记录,position 字段正确还原。

### 改的文件
- `D:\ManhuaWorks\services\collab-service\src\routes\index.ts` (重写,新增 ~130 行)

### 实施期间的坑 (供后人参考)

1. **pnpm workspace 符号链接丢失**
   - `node_modules/@manhuaworks/{logger,shared-types}` 在两个 service 下都是空目录,
     启动直接 `Cannot find module '@manhuaworks/logger'`。
   - 原 collab 进程 (PID 284908) 是 13:08 启动的,依赖被清理后,只剩空 junction。
   - 修复: `mklink /J .../node_modules/@manhuaworks/logger .../packages/logger` (junction 不需 admin)。

2. **原 collab 进程没开 watch**
   - PID 284908 的命令行是 `loader.mjs src/index.ts` (无 `watch` 关键字),
     改源码不会自动 reload,必须 kill 重启。
   - 启动正确姿势: `node --import file:///D:/ManhuaWorks/node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist/loader.mjs src/index.ts`

3. **Express 5 req.query 不可重定义**
   - 第一版用 `Object.defineProperty(req, "query", ...)` 注入 projectId,
     在 Express 5 下不生效 / 抛 400。
   - 改用 side-channel: GET 不再桥接 controller,直接调 service,显式传 pid。

4. **req.url 重写反模式**
   - 曾尝试改 `req.url` 把 `/projects/{id}/comments` 内部重定向到 `/comments`,
     引发 unhandledRejection + 进程挂死 (Accept loop? 死锁?)。
   - 弃用,改用直接调 service。

---

## 总览

| ID | 任务 | 状态 | 验证 |
|----|------|------|------|
| P0-001 | GET /users/me 500 → 200 | ✅ 修 | 200 |
| P1-002 | /api-keys 路由 404 | ✅ 修 | GET 200 / POST 201 |
| P1-003 | collab 4 个 404 | ✅ 修 | 4/4 返 200/201 |

- **P0 修: 1/1**
- **P1 修: 2/2**
- **回归测试: 0 个失败** (/me、/users/:id、/user/api-keys 仍 200)
- **改的文件总数: 2 个** (user-service/routes/index.ts, collab-service/routes/index.ts)
- **重启服务: 1 个** (collab-service, 因原进程无 watch 模式)
- **新加依赖/迁移: 无**
