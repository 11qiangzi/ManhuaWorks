# Workflow Engine · 漫改工作流引擎

> ManhuaWorks · W2 · 任务 5 · 漫改部 · 莫言画

把 **Toonflow** 桌面端的工作流拆解为可被 HTTP API 调用的微服务。本服务**不直接调 AI**，
而是在 ai-router / ai-keys / ffmpeg 之上做**业务编排**：

```
[Client] → /v1/workflow/*  →  [workflow-engine]  →  [ai-router / Redis / FFmpeg]
                                       ↓
                              [DAG + Queue + Retry + Checkpoint]
```

## ✨ 能力

- 7 个内置工作流（故事板/角色/场景/图像/语音/视频/合成）
- DAG 调度：并行 / 串行 / 条件分支
- BullMQ + Redis 任务队列
- 3 次指数退避重试（1s → 4s → 16s）
- 断点续跑（checkpoint 落 Redis）
- Hono HTTP 服务（端口 8084）
- TypeScript 5.7 + ESM

## 📁 目录结构

```
workflow-engine/
├── src/
│   ├── index.ts                  # Hono 入口（端口 8084）
│   ├── config.ts                 # 配置
│   ├── middleware/
│   │   └── auth.ts               # API Key / JWT 鉴权
│   ├── orchestrator/
│   │   ├── dag.ts                # DAG 调度（节点/边/状态）
│   │   ├── queue.ts              # BullMQ + Redis 队列
│   │   ├── retry.ts              # 3 次指数退避
│   │   └── checkpoint.ts         # 断点续跑
│   ├── workflows/
│   │   ├── storyboard.ts         # 小说 → 场景 → 镜头
│   │   ├── character.ts          # 角色设计 + 锁脸
│   │   ├── scene.ts              # 场景设计
│   │   ├── image-gen.ts          # 图像生成（ai-router）
│   │   ├── tts.ts                # 语音合成（4 家）
│   │   ├── video-gen.ts          # 视频生成（ai-router）
│   │   └── compose.ts            # FFmpeg 合成
│   └── assets/
│       ├── story-types.ts        # 12 套故事类型
│       ├── art-styles.ts         # 11 套艺术风格
│       └── prompts.ts            # 4 套视频 prompt 库
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

## 🚀 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式（热重载）
pnpm dev

# 生产构建
pnpm build && pnpm start
```

## 🔌 API 端点

| Method | Path | 说明 |
|--------|------|------|
| GET    | `/health` | 健康检查 |
| POST   | `/v1/workflow/storyboard` | 启动故事板工作流 |
| POST   | `/v1/workflow/character` | 启动角色设计工作流 |
| POST   | `/v1/workflow/scene` | 启动场景设计工作流 |
| POST   | `/v1/workflow/image-gen` | 启动图像生成工作流 |
| POST   | `/v1/workflow/tts` | 启动语音合成工作流 |
| POST   | `/v1/workflow/video-gen` | 启动视频生成工作流 |
| POST   | `/v1/workflow/compose` | 启动最终合成工作流 |
| GET    | `/v1/workflow/:runId` | 查询工作流状态 |
| POST   | `/v1/workflow/:runId/cancel` | 取消工作流 |
| POST   | `/v1/workflow/:runId/resume` | 断点续跑 |

## ⚙️ 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WORKFLOW_PORT` | `8084` | HTTP 端口 |
| `REDIS_URL` | `redis://localhost:6379` | Redis 连接 |
| `AI_ROUTER_URL` | `http://localhost:8082` | ai-router 地址 |
| `AUTH_MODE` | `api-key` | `api-key` / `jwt` / `none` |
| `AUTH_API_KEY` | _(必填)_ | API Key |
| `MAX_PARALLEL` | `4` | 单工作流最大并行节点 |
| `CHECKPOINT_TTL` | `86400` | checkpoint 保留秒数 |
