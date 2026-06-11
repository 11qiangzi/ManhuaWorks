# ai-router API 文档

> **Base URL**：`https://api.manhuaworks.com/v1/ai`
> **认证**：Bearer Token（用户 JWT / API Key）
> **内容类型**：`application/json`
> **作者**：陈远枢
> **更新日期**：2026-06-07

## 概述

ai-router 是 ManhuaWorks 的 AI 统一路由层。它接收业务侧请求，根据配置把任务分发给 4 家 AI 供应商（火山/阿里云/腾讯/智谱），并处理失败转移、缓存、限流等横切关注点。

**本文档面向**：
- 业务后端开发（project-service、studio 等）
- 第三方开发者（通过 API Key 调用）
- 内部测试工程师

---

## 通用规范

### 认证

```
Authorization: Bearer <jwt_token_or_api_key>
```

| Token 类型 | 适用场景 | 示例 |
|:--|:--|:--|
| JWT（用户登录） | 前端调用 | `eyJhbGciOiJIUzI1NiIs...` |
| API Key（开发者） | 脚本/集成 | `sk_live_abc123def456...` |

### 限流

| 套餐 | QPS 上限 | 月配额 |
|:--|:--|:--|
| 免费 | 5 | 100 次 |
| 基础 | 20 | 5,000 次 |
| 专业 | 50 | 50,000 次 |
| 企业 | 自定义 | 无限 |

超限返回 `429 Too Many Requests`，响应头包含 `Retry-After`。

### 错误码

| HTTP | 错误码 | 含义 |
|:--|:--|:--|
| 400 | `invalid_request` | 参数错误 |
| 401 | `unauthorized` | 认证失败 |
| 403 | `forbidden` | 权限不足 |
| 404 | `not_found` | 资源不存在 |
| 429 | `rate_limited` | 触发限流 |
| 500 | `internal_error` | 服务异常 |
| 502 | `upstream_error` | 供应商异常 |
| 503 | `all_providers_failed` | 4 家供应商全失败 |
| 504 | `timeout` | 任务超时 |

### 响应格式

成功：
```json
{
  "code": 0,
  "data": { ... },
  "request_id": "req_abc123",
  "timestamp": "2026-06-07T15:30:00Z"
}
```

失败：
```json
{
  "code": 400,
  "error": {
    "type": "invalid_request",
    "message": "prompt 不能为空",
    "field": "prompt"
  },
  "request_id": "req_abc123",
  "timestamp": "2026-06-07T15:30:00Z"
}
```

---

## 端点列表

| 方法 | 路径 | 说明 |
|:--|:--|:--|
| POST | `/v1/ai/image/generate` | 同步生图（单张） |
| POST | `/v1/ai/image/batch` | 批量生图（多张并发） |
| POST | `/v1/ai/video/generate` | 同步生视频（单段） |
| POST | `/v1/ai/tts/synthesize` | TTS 语音合成 |
| POST | `/v1/ai/ocr/recognize` | OCR 文字识别 |
| POST | `/v1/ai/text/generate` | LLM 文本生成 |
| GET | `/v1/ai/task/:task_id` | 查询任务状态 |
| GET | `/v1/ai/providers` | 列出可用供应商 |
| GET | `/v1/ai/usage` | 查询本月用量 |
| POST | `/v1/ai/cache/invalidate` | 清除缓存（管理员） |

---

## 1. 同步生图

**端点**：`POST /v1/ai/image/generate`

**说明**：生成单张图片，同步返回（最长等待 30 秒）。超时或单张图请用批量接口。

### 请求

```http
POST /v1/ai/image/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "废墟入口，黄昏光，雾气，cinematic, 8k",
  "negative_prompt": "模糊，扭曲，多手指",
  "model": "doubao-seedream-3.0",
  "width": 1024,
  "height": 1024,
  "seed": 42,
  "quality": "standard",
  "style": "anime",
  "reference_image_url": "https://cdn.mhwork.com/ref/char_lin_qi.png",
  "key_id": "sk_user_xxxxx"
}
```

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `prompt` | string | ✅ | 主提示词（英文/中文均可） |
| `negative_prompt` | string | ❌ | 反向提示词 |
| `model` | string | ❌ | 指定模型，默认走路由 |
| `width` | int | ❌ | 宽度，512-2048，默认 1024 |
| `height` | int | ❌ | 高度，512-2048，默认 1024 |
| `seed` | int | ❌ | 随机种子，固定后结果可复现 |
| `quality` | enum | ❌ | `standard` / `high` / `ultra` |
| `style` | enum | ❌ | `anime` / `realistic` / `3d` / `2d` |
| `reference_image_url` | string | ❌ | 参考图（角色一致性） |
| `key_id` | string | ❌ | 用自己的 API Key，绕过平台配额 |

### 响应

```json
{
  "code": 0,
  "data": {
    "task_id": "task_img_abc123",
    "image_url": "https://cdn.mhwork.com/outputs/2026/06/07/abc.png",
    "thumbnail_url": "https://cdn.mhwork.com/thumbs/abc.png",
    "width": 1024,
    "height": 1024,
    "provider": "volcano",
    "model_used": "doubao-seedream-3.0",
    "cost": 0.18,
    "elapsed_ms": 4521,
    "seed": 42
  },
  "request_id": "req_abc123"
}
```

### 错误示例

```json
{
  "code": 503,
  "error": {
    "type": "all_providers_failed",
    "message": "4 家供应商全部失败，请稍后重试",
    "details": {
      "volcano": "rate_limited",
      "aliyun": "upstream_timeout",
      "tencent": "insufficient_quota",
      "zhipu": "content_filtered"
    }
  },
  "request_id": "req_abc123"
}
```

---

## 2. 批量生图

**端点**：`POST /v1/ai/image/batch`

**说明**：一次提交多张图，后台并发执行，通过 WebSocket 或轮询获取结果。

### 请求

```http
POST /v1/ai/image/batch
{
  "tasks": [
    {
      "task_ref": "shot_01",
      "prompt": "...",
      "width": 1024,
      "height": 1024
    },
    {
      "task_ref": "shot_02",
      "prompt": "..."
    }
  ],
  "callback_url": "https://yourapp.com/webhook/ai",
  "webhook_secret": "whsec_xxxxx"
}
```

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `tasks` | array | ✅ | 1-20 个任务 |
| `tasks[].task_ref` | string | ✅ | 业务侧 ID，用于回调关联 |
| `callback_url` | string | ❌ | Webhook 接收地址 |
| `webhook_secret` | string | ❌ | 回调签名密钥 |

### 响应

```json
{
  "code": 0,
  "data": {
    "batch_id": "batch_xyz789",
    "task_count": 2,
    "estimated_cost": 0.36,
    "status": "queued"
  }
}
```

### Webhook 回调

```http
POST <your_callback_url>
Content-Type: application/json
X-Mhwork-Signature: sha256=...

{
  "event": "batch.completed",
  "batch_id": "batch_xyz789",
  "results": [
    {
      "task_ref": "shot_01",
      "status": "success",
      "image_url": "...",
      "cost": 0.18
    },
    {
      "task_ref": "shot_02",
      "status": "failed",
      "error": "content_filtered"
    }
  ]
}
```

---

## 3. 生视频

**端点**：`POST /v1/ai/video/generate`

**说明**：图生视频或文生视频。

### 请求

```json
{
  "prompt": "镜头缓慢推进，废墟中微风吹起尘土",
  "image_url": "https://cdn.mhwork.com/outputs/first_frame.png",
  "model": "seedance-1.0",
  "duration": 5,
  "resolution": "720p",
  "camera_motion": "slow_zoom_in",
  "key_id": "sk_user_xxxxx"
}
```

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `prompt` | string | ✅ | 视频动作描述 |
| `image_url` | string | ❌ | 首帧图（文生视频可省） |
| `model` | string | ❌ | `seedance-1.0` / `cogvideox-2` |
| `duration` | int | ❌ | 时长 3-10 秒，默认 5 |
| `resolution` | enum | ❌ | `480p` / `720p` / `1080p` |
| `camera_motion` | enum | ❌ | 运镜控制 |

### 响应

```json
{
  "code": 0,
  "data": {
    "task_id": "task_vid_abc123",
    "video_url": "https://cdn.mhwork.com/outputs/vid_abc.mp4",
    "thumbnail_url": "https://cdn.mhwork.com/thumbs/vid_abc.jpg",
    "duration": 5,
    "cost": 0.85,
    "elapsed_ms": 45230
  }
}
```

视频生成通常耗时 60-180 秒，超时设置见 `ai-keys-service` 配置。

---

## 4. TTS 语音合成

**端点**：`POST /v1/ai/tts/synthesize`

### 请求

```json
{
  "text": "三百年后，地球已是一片废墟。",
  "voice_id": "male_narrator_01",
  "speed": 1.0,
  "pitch": 0,
  "volume": 0,
  "format": "mp3",
  "sample_rate": 24000
}
```

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `text` | string | ✅ | 文本（最长 10000 字） |
| `voice_id` | string | ✅ | 声音 ID（见下表） |
| `speed` | float | ❌ | 0.5-2.0，默认 1.0 |
| `pitch` | int | ❌ | -12 ~ 12（半音） |
| `volume` | int | ❌ | -20 ~ 20（dB） |
| `format` | enum | ❌ | `mp3` / `wav` / `pcm` |
| `sample_rate` | int | ❌ | 16000 / 24000 / 48000 |

**预置声音 ID**：

| voice_id | 描述 | 性别 |
|:--|:--|:--|
| `male_young_01` | 青年男声 | 男 |
| `male_mature_01` | 成熟男声 | 男 |
| `male_narrator_01` | 磁性男声（旁白） | 男 |
| `female_young_01` | 少女声 | 女 |
| `female_mature_01` | 御姐声 | 女 |
| `child_01` | 童声 | - |
| `robot_01` | 电子音（系统/AI） | - |

### 响应

```json
{
  "code": 0,
  "data": {
    "audio_url": "https://cdn.mhwork.com/outputs/tts_abc.mp3",
    "duration_ms": 3200,
    "cost": 0.006
  }
}
```

---

## 5. OCR 文字识别

**端点**：`POST /v1/ai/ocr/recognize`

### 请求

```json
{
  "image_url": "https://cdn.mhwork.com/uploads/screenshot.png",
  "language": "zh-CN",
  "detect_orientation": true
}
```

### 响应

```json
{
  "code": 0,
  "data": {
    "text": "你好世界",
    "blocks": [
      {
        "text": "你好",
        "confidence": 0.98,
        "bbox": [10, 20, 80, 50]
      },
      {
        "text": "世界",
        "confidence": 0.96,
        "bbox": [90, 20, 160, 50]
      }
    ]
  }
}
```

---

## 6. LLM 文本生成

**端点**：`POST /v1/ai/text/generate`

### 请求

```json
{
  "messages": [
    {"role": "system", "content": "你是一个剧本拆分助手"},
    {"role": "user", "content": "请把以下小说拆成剧本..."}
  ],
  "model": "glm-4-plus",
  "temperature": 0.7,
  "max_tokens": 4000,
  "json_mode": true
}
```

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `messages` | array | ✅ | OpenAI 兼容格式 |
| `model` | string | ❌ | 默认 `glm-4-plus` |
| `temperature` | float | ❌ | 0-2，默认 0.7 |
| `max_tokens` | int | ❌ | 上限，默认 4000 |
| `json_mode` | bool | ❌ | 强制 JSON 输出 |

### 响应

```json
{
  "code": 0,
  "data": {
    "content": "{...JSON...}",
    "usage": {
      "prompt_tokens": 1200,
      "completion_tokens": 800,
      "total_tokens": 2000
    },
    "cost": 0.04
  }
}
```

---

## 7. 查询任务状态

**端点**：`GET /v1/ai/task/:task_id`

### 响应

```json
{
  "code": 0,
  "data": {
    "task_id": "task_img_abc123",
    "status": "success",
    "result": {
      "image_url": "..."
    },
    "cost": 0.18,
    "elapsed_ms": 4521,
    "created_at": "2026-06-07T15:30:00Z",
    "completed_at": "2026-06-07T15:30:04Z"
  }
}
```

`status` 枚举：`queued` / `running` / `success` / `failed` / `timeout`

---

## 8. 列出可用供应商

**端点**：`GET /v1/ai/providers`

### 响应

```json
{
  "code": 0,
  "data": {
    "providers": [
      {
        "id": "volcano",
        "name": "火山引擎",
        "models": ["doubao-seedream-3.0", "seedance-1.0"],
        "status": "healthy",
        "latency_ms": 4500
      }
    ]
  }
}
```

---

## 9. 查询本月用量

**端点**：`GET /v1/ai/usage?year=2026&month=6`

### 响应

```json
{
  "code": 0,
  "data": {
    "year": 2026,
    "month": 6,
    "by_type": {
      "image": {"count": 320, "cost": 57.6},
      "video": {"count": 45, "cost": 38.25},
      "tts": {"count": 1200, "cost": 0.24},
      "llm": {"count": 89, "cost": 3.56}
    },
    "total_cost": 99.65,
    "quota_limit": 150.0,
    "quota_used_percent": 66.4
  }
}
```

---

## 10. 完整调用示例

### curl

```bash
curl -X POST https://api.manhuaworks.com/v1/ai/image/generate \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "废墟入口，黄昏光，cinematic",
    "width": 1024,
    "height": 1024,
    "quality": "high"
  }'
```

### Node.js

```javascript
const response = await fetch('https://api.manhuaworks.com/v1/ai/image/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.MHWORK_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: '废墟入口，黄昏光，cinematic',
    width: 1024,
    height: 1024
  })
});
const data = await response.json();
console.log(data.data.image_url);
```

### Python

```python
import requests

response = requests.post(
    'https://api.manhuaworks.com/v1/ai/image/generate',
    headers={'Authorization': f'Bearer {API_KEY}'},
    json={
        'prompt': '废墟入口，黄昏光，cinematic',
        'width': 1024,
        'height': 1024
    }
)
print(response.json()['data']['image_url'])
```

---

## 11. Webhook 签名验证

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

---

## 12. SDK 下载

- Node.js: `npm install @mhwork/ai-sdk`
- Python: `pip install mhwork`
- Go: `go get github.com/manhuaworks/mhwork-go`

---

## 变更记录

| 版本 | 日期 | 作者 | 变更 |
|:--|:--|:--|:--|
| v0.1 | 2026-06-07 | 陈远枢 | 初稿 |
