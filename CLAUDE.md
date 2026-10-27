# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

AI 驱动的漫改/动画创作 SaaS 平台，核心产品是「漫改工坊」——将小说文本转化为动画分镜视频。

**技术栈:** Vue 3 + TypeScript + Vite + TailwindCSS (前端) / Node.js 微服务 Express+Hono (后端) / pnpm workspace monorepo / Node ≥ 20.10.0 + pnpm 9.12.0

## 常用命令

```bash
# 全量开发（所有服务并行）
pnpm dev

# 单独启动
cd apps/web && pnpm dev               # 前端 :3000
cd services/ai-router && tsx watch src/index.ts  # AI路由 :8083
cd services/user-service && npx tsx src/index.ts # 用户服务 :8088（勿用 node .bin/tsx）

# 类型检查（Windows 须通过 vue-tsc CMD 调用）
cd apps/web && npx vue-tsc --noEmit

# 单包构建
cd apps/web && pnpm build             # vue-tsc -b && vite build
cd services/ai-router && pnpm build  # tsc -p tsconfig.json → dist/

# 测试
cd apps/web && pnpm test              # vitest run
cd services/user-service && pnpm test # vitest run

# Lint（自动修复）
cd apps/web && pnpm lint              # eslint ... --fix
pnpm lint:tokens                      # 自定义设计token检查器

# Docker（完整环境）
pnpm docker:build && pnpm docker:up   # infrastructure/docker-compose.yml
```

## 架构

### 服务端口与职责

| 服务 | 端口 | 框架 | 职责 |
|---|---|---|---|
| `apps/web` | 3000 | Vite + Vue 3 | 主站，开发时 Vite proxy 所有 API |
| `services/user-service` | 8088 | Express + JWT | 认证、2FA、TOTP |
| `services/ai-router` | 8083 | Hono | AI 网关(8提供商)、BYOK、FFmpeg 视频管线 |
| `services/ai-orchestrator` | 8087 | Hono | 工作流编排（路由前缀 `/v1/`） |
| `services/project-service` | 8089 | — | 项目/素材/场景/角色 CRUD |
| `services/billing-service` | 8090 | — | 订单/计费 |
| `services/collab-service` | 8091 | — | 团队协作 |

**运行前提:** 系统需安装 `ffmpeg`（`VideoComposeService` 直接 shell 调用）。

### Vite Dev Proxy（`apps/web/vite.config.ts`）

所有 `/api` 请求由细粒度子路径规则路由，**顺序敏感**（catch-all 在最后）：

| 前缀 | 目标 | 备注 |
|---|---|---|
| `/api/v1/auth` `/api/v1/users` `/api/v1/me` `/api/v1/account` `/api/v1/subscriptions` `/api/v1/quotas` `/api/v1/notifications` | user-service :8088 | — |
| `/api/v1/projects` `/api/v1/assets` `/api/v1/scenes` `/api/v1/characters` | project-service :8089 | — |
| `/api/v1/orders` `/api/v1/billing` | billing-service :8090 | — |
| `/api/v1/teams` | collab-service :8091 | — |
| `/api/v1/orchestrator` `/api/v1/craft-prompt` `/api/v1/generation` | ai-orchestrator :8087 | **rewrite:** 去掉 `/api` 前缀（Hono 从 `/v1/` 开始） |
| `/v1/ai` | ai-router :8083 | **rewrite:** `/v1/ai` → `/v1`；6分钟超时（Seedance 轮询） |
| `/persisted` `/v1/upload` `/v1/keys` | ai-router :8083 | 静态文件/上传/BYOK |
| `/api`（catch-all） | project-service :8089 | 兜底；新路由必须在此之前加显式规则 |

### 前端核心文件

- **漫改工坊编辑器**: `apps/web/src/views/create/StoryboardEditorView.vue`（~4400行，10步流水线）
- **AI API 客户端**: `apps/web/src/api/ai-router.ts`（baseURL `/v1/ai`）
- 其他 API 客户端: `byok.ts`、`orchestrator.ts`、`craft-prompt.ts`、`asset-service.ts`

**已废弃:** `apps/web/src/api/ai-generate.ts` — 所有 AI 调用改走 `@/api/ai-router`。

### 前端 API 客户端约定

所有 Axios 实例共享同一模式：
1. Request interceptor 注入 `Authorization: Bearer <token>`（读 `localStorage['mhw.access_token']`，fallback `localStorage['token']`）
2. Response interceptor on 401：清除 `localStorage` 的 `token`、`user`、`mhw.access_token` 三个 key
3. `unwrap<T>(res)` 同时处理两种响应体：`{ code: 0, data }` 信封（user-service风格）和裸 body（ai-router风格）

```ts
http.delete(...)        // 非 del
http.get(path, query, opts)   // query 是第二参，不是 config
```

**WebSocket 进度订阅**（`subscribeProgress` in ai-router.ts）：
URL 模式 `ws(s)://<host>/v1/ai/jobs/<jobId>/ws?token=<encoded_jwt>`，指数退避重试（1/2/4/8…上限30s）。

### Pinia Stores（`apps/web/src/stores/`）

| Store | 职责 |
|---|---|
| `auth.ts` | 登录/注册，使用 `@manhuaworks/api-client` 的 `tokenStore` |
| `generationStore.ts` | AI 任务生命周期（每3s轮询活跃任务）`queued→running→succeeded/failed/expired/cancelled` |
| `workflow.ts` | 批量生成工作流 |
| `characterStore.ts` / `sceneStore.ts` | 角色/场景库 |
| `referenceImageStore.ts` | 参考图管理 |

### 漫改工坊 10 步流水线

1. 项目设置 → 2. 上传小说 → 3. 角色设定 → 4. 场景设定
5. 分镜编排 → 6. 镜头视频 → 7. 合成视频 → 8. 画质提升
9. AI 配音 → 10. 合成导出

草稿持久化 sessionStorage 键：`mhw:draft:storyboard`、`mhw:storyboard:novel-text`

## 关键注意事项

### AI 图片生成（Seedream / 火山方舟）

- 模型: `doubao-seedream-4-5-251128`，最小尺寸 2048×2048
- **必须设 `watermark:false, stream:false`**
- **任何中文传入均触发 400 错误** — 所有字段须通过翻译映射转为英文视觉词
  - 角色职业: `CHAR_ROLE_MAP` + `translateRole()`
  - 场景氛围: `MOOD_TEXT_MAP`（envParts）/ `moodLightingMap`（光照）
  - 环境描述: `envKeywordMap` 关键词匹配，无命中时剥离 CJK 字符
- negative prompt 须含 `text, chinese, typography, watermark`
- 多视角生成: `referenceImages` 传通用 prompt 会强制复制构图 → 每个视角须写专属英文 prompt

### AI 视频生成（Seedance）

- 模型: `doubao-seedance-2-0-260128`
- 流程: `POST /v1/video` 创建任务 → 轮询 → `succeeded` 取 `video_url`（最长360s）
- `first_frame` / `last_frame` 与 `reference_image` **互斥**
- 链式衔接: Shot N 的 `lastFrameUrl` = Shot N+1 的 `firstFrame`

### FFmpeg 服务（`services/ai-router/src/services/video-compose.ts`）

- `POST /v1/enhance-video` — upscale/sharpen/both
- `POST /v1/compose` — 多镜头拼接，支持转场 `cut/dissolve/fade-black/fade-white/whip-pan`（xfade 0.5s）
- `POST /v1/merge-av` — 视频+配音合并
- xfade offset 需 ffprobe 计算，当前降级为 concat

### 认证

- `JWT_SECRET=dev-only-jwt-secret-32-chars`
- `trustInternalMiddleware` 设置 `user` 后，`authMiddleware` 须先检查 `c.get("user")`
- 唯一公开（无JWT）接口: `GET /v1/ai/ping`
- BYOK 密钥 AES-256-GCM 加密存入 `user-service` DB（`api_keys` 表：`keyEncrypted`, `keyIv`）

### Windows 环境

- `vue-tsc` / `vite` 需通过 `cmd.exe //c "xxx.CMD"` 调用
- Shell heredoc 可能破坏 regex → 用 base64 编码传递
- `user-service` 用 `npx tsx src/index.ts` 启动（勿用 `node .bin/tsx`）

### 素材库

- 图片过期处理：`img @error` 隐藏图片 + 显示 fallback "图片已过期"

## 已知待修复问题（优先级从高到低）

1. `videoLastFrameUrl` 已存储但未实际消费于链式衔接
2. 深度 watch 性能问题（每次改动序列化全量 state）
3. Provider 类型定义缺少 `anthropic` / `google` / `stability`（存量 TS 错误，位于 `ai-router.ts`, `byok.ts`）
