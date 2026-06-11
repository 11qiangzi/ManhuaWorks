# @manhuaworks/ai-router

ManhuaWorks AI 模型路由引擎 - W2 交付物。

## 能力

- 4 家预置供应商：`minimax` / `deepseek` / `zhipu` / `volcengine`
- 统一接口：`chat` / `embeddings` / `image` / `video`
- 智能路由：成本优先 / 速度优先 / 质量优先 + 故障转移
- BYOK（用户自带 Key）：用户 Key 优先，平台 Key 兜底
- API Key 存储：PostgreSQL + AES-256-GCM 加密
- 请求级缓存：相同 prompt 30 分钟内复用
- 中间件：JWT 鉴权 / 用户级限流 / 调用日志
- 健康检查 + 连续失败 3 次自动切备用

## 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/v1/chat` | 聊天补全（OpenAI 兼容） |
| `POST` | `/v1/embeddings` | 文本向量化 |
| `POST` | `/v1/image` | 文生图 |
| `POST` | `/v1/video` | 文生视频 |
| `GET`  | `/health` | 健康检查（含 provider 状态） |

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | `8082` | HTTP 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `DATABASE_URL` | - | PostgreSQL 连接串 |
| `REDIS_URL` | - | Redis 连接串 |
| `JWT_SECRET` | - | JWT 校验密钥 |
| `ENCRYPTION_KEY` | - | 32 字节 hex（64 字符） |
| `CACHE_TTL_SECONDS` | `1800` | 请求缓存 TTL（秒） |
| `RATE_LIMIT_PER_MIN` | `60` | 用户级每分钟限流 |
| `FAILOVER_THRESHOLD` | `3` | 连续失败次数触发故障转移 |

## 启动

```bash
pnpm --filter @manhuaworks/ai-router dev      # 开发模式
pnpm --filter @manhuaworks/ai-router build    # 编译
pnpm --filter @manhuaworks/ai-router start    # 生产模式
```

## 端口

8082

## Provider 模型清单

| Provider | chat | embeddings | image | video |
|----------|------|------------|-------|-------|
| minimax | `M3`, `M2.7` | `M2.7` | `image-01` | - |
| deepseek | `v3`, `v4-pro` | - | - | - |
| zhipu | `glm-4`, `glm-4v` | `glm-4` | - | - |
| volcengine | `doubao-pro` | - | `doubao-seedream` | `doubao-seedance` |

## 请求示例

```bash
curl -X POST http://localhost:8082/v1/chat \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "M3",
    "messages": [{"role": "user", "content": "你好"}],
    "strategy": "cost"
  }'
```
