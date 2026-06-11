# workflow-engine API 文档

> **Base URL**：`https://api.manhuaworks.com/v1/workflow`
> **作者**：陈远枢
> **更新日期**：2026-06-07

## 概述

workflow-engine 是 ManhuaWorks 的 **任务编排引擎**，负责把"小说文本 → 一集漫剧"拆成 7 个步骤，按依赖关系调度执行，并提供断点续传、失败重试、实时进度推送能力。

---

## 端点列表

| 方法 | 路径 | 权限 | 说明 |
|:--|:--|:--|:--|
| POST | `/v1/workflow/runs` | 用户 | 创建工作流运行 |
| GET | `/v1/workflow/runs` | 用户 | 列出我的运行 |
| GET | `/v1/workflow/runs/:id` | 用户 | 查看运行详情 |
| POST | `/v1/workflow/runs/:id/pause` | 用户 | 暂停运行 |
| POST | `/v1/workflow/runs/:id/resume` | 用户 | 恢复运行 |
| POST | `/v1/workflow/runs/:id/cancel` | 用户 | 取消运行 |
| POST | `/v1/workflow/runs/:id/retry` | 用户 | 重试失败步骤 |
| GET | `/v1/workflow/runs/:id/steps` | 用户 | 列出步骤详情 |
| POST | `/v1/workflow/runs/:id/steps/:step/retry` | 用户 | 重试单个步骤 |
| POST | `/v1/workflow/runs/:id/steps/:step/skip` | 用户 | 跳过某步骤 |
| WS | `/v1/workflow/ws/:run_id` | 用户 | 实时进度推送 |
| GET | `/v1/workflow/templates` | 用户 | 列出工作流模板 |
| POST | `/v1/workflow/admin/runs/:id/restart` | 管理员 | 强制重启 |

---

## 1. 创建工作流运行

**端点**：`POST /v1/workflow/runs`

### 请求

```http
POST /v1/workflow/runs
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "template_id": "tpl_standard_episode",
  "project_id": "proj_abc123",
  "episode_no": 1,
  "input": {
    "novel_text": "第一章 灰星\n\n林启踏上废墟的第一个穹顶...",
    "target_duration_seconds": 300,
    "style": "2D_90s_japanese_anime",
    "aspect_ratio": "9:16",
    "voice_language": "zh-CN"
  },
  "config": {
    "quality": "high",
    "concurrency": 5,
    "auto_pause_on_error": false
  },
  "webhook": {
    "url": "https://yourapp.com/webhook/workflow",
    "secret": "whsec_xxxxx",
    "events": ["completed", "failed", "step_failed"]
  }
}
```

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `template_id` | string | ✅ | 工作流模板 ID |
| `project_id` | string | ✅ | 所属项目 ID |
| `episode_no` | int | ✅ | 第几集 |
| `input.novel_text` | string | ✅ | 原始小说文本 |
| `input.target_duration_seconds` | int | ❌ | 目标时长，默认 300 |
| `input.style` | enum | ✅ | 艺术风格（见下表） |
| `input.aspect_ratio` | enum | ❌ | `9:16` / `16:9` / `1:1`，默认 `9:16` |
| `input.voice_language` | enum | ❌ | `zh-CN` / `en-US` / `ja-JP` |
| `config.quality` | enum | ❌ | `draft` / `standard` / `high` / `ultra` |
| `config.concurrency` | int | ❌ | 步骤内并发数 1-10 |
| `config.auto_pause_on_error` | bool | ❌ | 单步失败时是否自动暂停 |
| `webhook` | object | ❌ | 完成后回调 |

**可用模板**：

| template_id | 描述 | 步骤数 | 典型耗时 | 典型成本 |
|:--|:--|:--|:--|:--|
| `tpl_quick_episode` | 快速版（5 步，跳过细节） | 5 | 3 分钟 | ¥3 |
| `tpl_standard_episode` | 标准版（7 步） | 7 | 8 分钟 | ¥6 |
| `tpl_premium_episode` | 高质量版（7 步+ 多次重生成） | 7 | 15 分钟 | ¥12 |
| `tpl_text_to_storyboard` | 只到分镜（4 步） | 4 | 1 分钟 | ¥0.3 |

**艺术风格枚举**（与 assets/art-skills 对齐）：

```
2D_90s_japanese_anime    2D_chinese_guofeng
2D_flat_design           2D_mature_urban_romance
3D_anime_render          3D_chinese_traditional
3D_clay_stopmotion       3D_guofeng_cyber
realpeople_ancient_chinese
realpeople_modern_city
realpeople_urban_modern
```

### 响应

```json
{
  "code": 0,
  "data": {
    "run_id": "wf_abc123def456",
    "status": "queued",
    "template_id": "tpl_standard_episode",
    "project_id": "proj_abc123",
    "episode_no": 1,
    "estimated_cost": 6.0,
    "estimated_seconds": 480,
    "created_at": "2026-06-07T15:30:00Z",
    "ws_url": "wss://api.manhuaworks.com/v1/workflow/ws/wf_abc123def456"
  }
}
```

---

## 2. 列出我的运行

**端点**：`GET /v1/workflow/runs?status=running&page=1&page_size=20`

### 响应

```json
{
  "code": 0,
  "data": {
    "total": 45,
    "page": 1,
    "page_size": 20,
    "runs": [
      {
        "run_id": "wf_abc123def456",
        "status": "running",
        "current_step": 5,
        "current_step_name": "图像生成",
        "progress_percent": 65,
        "project_id": "proj_abc123",
        "episode_no": 1,
        "cost_so_far": 4.32,
        "created_at": "2026-06-07T15:30:00Z"
      }
    ]
  }
}
```

---

## 3. 查看运行详情

**端点**：`GET /v1/workflow/runs/:id`

### 响应

```json
{
  "code": 0,
  "data": {
    "run_id": "wf_abc123def456",
    "status": "running",
    "template_id": "tpl_standard_episode",
    "project_id": "proj_abc123",
    "episode_no": 1,
    "input": { ... },
    "config": { ... },
    "current_step": 5,
    "current_step_name": "图像生成",
    "progress_percent": 65,
    "cost_so_far": 4.32,
    "steps": [
      {
        "step_no": 1,
        "name": "剧本拆分",
        "status": "completed",
        "started_at": "...",
        "completed_at": "...",
        "duration_ms": 45230,
        "cost": 0.05
      },
      {
        "step_no": 2,
        "name": "角色提取",
        "status": "completed",
        ...
      },
      {
        "step_no": 5,
        "name": "图像生成",
        "status": "running",
        "progress_percent": 70,
        "current_subtask": "镜头 7/10",
        "started_at": "...",
        "cost_so_far": 0.56
      }
    ],
    "output": null,
    "created_at": "2026-06-07T15:30:00Z",
    "started_at": "2026-06-07T15:30:05Z",
    "completed_at": null
  }
}
```

---

## 4. 暂停 / 恢复 / 取消

### 暂停

**端点**：`POST /v1/workflow/runs/:id/pause`

```json
{
  "code": 0,
  "data": {
    "run_id": "wf_abc123def456",
    "status": "paused",
    "paused_at_step": 5
  }
}
```

> 正在执行的步骤会跑完才暂停；后续步骤排队不执行。

### 恢复

**端点**：`POST /v1/workflow/runs/:id/resume`

```json
{
  "code": 0,
  "data": {
    "run_id": "wf_abc123def456",
    "status": "running",
    "resumed_at_step": 6
  }
}
```

### 取消

**端点**：`POST /v1/workflow/runs/:id/cancel`

```json
{
  "code": 0,
  "data": {
    "run_id": "wf_abc123def456",
    "status": "cancelled",
    "cancelled_at": "2026-06-07T15:45:00Z",
    "refund_amount": 2.34
  }
}
```

> 取消后**已发生的成本不退**（供应商已收钱），未执行步骤的成本会退还到用户配额。

---

## 5. 重试

### 重试整体

**端点**：`POST /v1/workflow/runs/:id/retry`

```json
{
  "from_step": 5
}
```

> 从指定步骤开始重跑，已完成的步骤**不重跑**（节省时间和成本）。

### 重试单步

**端点**：`POST /v1/workflow/runs/:id/steps/:step/retry`

```json
{
  "code": 0,
  "data": {
    "run_id": "wf_abc123def456",
    "step_no": 5,
    "status": "running"
  }
}
```

---

## 6. 跳过某步骤

**端点**：`POST /v1/workflow/runs/:id/steps/:step/skip`

```json
{
  "reason": "用户已有角色参考图"
}
```

> 仅对可跳过的步骤开放（如 S2 角色提取、S3 场景设计）。

---

## 7. 步骤详情

**端点**：`GET /v1/workflow/runs/:id/steps`

### 响应

```json
{
  "code": 0,
  "data": {
    "run_id": "wf_abc123def456",
    "steps": [
      {
        "step_no": 1,
        "name": "剧本拆分",
        "status": "completed",
        "started_at": "2026-06-07T15:30:05Z",
        "completed_at": "2026-06-07T15:30:50Z",
        "duration_ms": 45230,
        "cost": 0.05,
        "output": {
          "scenes_count": 8,
          "dialogues_count": 23,
          "url": "https://cdn.mhwork.com/.../step1_output.json"
        }
      }
    ]
  }
}
```

---

## 8. WebSocket 实时进度

**连接**：`wss://api.manhuaworks.com/v1/workflow/ws/:run_id`

**认证**：在 URL 中带 token `?token=<jwt>` 或用 Sec-WebSocket-Protocol 头

### 客户端示例

```javascript
const ws = new WebSocket(
  `wss://api.manhuaworks.com/v1/workflow/ws/wf_abc123def456?token=${JWT}`
);

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(msg);
};
```

### 服务端推送

**进度更新**：
```json
{
  "type": "progress",
  "run_id": "wf_abc123def456",
  "step": 5,
  "step_name": "图像生成",
  "percent": 65,
  "current": "镜头 7/10",
  "cost_so_far": 0.56,
  "elapsed_ms": 45230,
  "eta_seconds": 23
}
```

**单步完成**：
```json
{
  "type": "step_completed",
  "run_id": "wf_abc123def456",
  "step": 5,
  "step_name": "图像生成",
  "duration_ms": 123456,
  "cost": 0.80,
  "output": { "image_count": 10 }
}
```

**单步失败**：
```json
{
  "type": "step_failed",
  "run_id": "wf_abc123def456",
  "step": 6,
  "step_name": "视频生成",
  "error": "all_providers_failed",
  "message": "4 家供应商全失败，已自动重试 2 次",
  "auto_retry_count": 2
}
```

**整体完成**：
```json
{
  "type": "completed",
  "run_id": "wf_abc123def456",
  "total_cost": 6.23,
  "total_duration_ms": 480000,
  "output": {
    "video_url": "https://cdn.mhwork.com/.../ep01.mp4",
    "thumbnail_url": "https://cdn.mhwork.com/.../ep01.jpg",
    "duration_seconds": 312
  }
}
```

**整体失败**：
```json
{
  "type": "failed",
  "run_id": "wf_abc123def456",
  "failed_step": 6,
  "error": "max_retry_exceeded"
}
```

---

## 9. 模板列表

**端点**：`GET /v1/workflow/templates`

### 响应

```json
{
  "code": 0,
  "data": {
    "templates": [
      {
        "id": "tpl_quick_episode",
        "name": "快速版（5 步）",
        "description": "跳过细节优化，3 分钟出片",
        "step_count": 5,
        "estimated_seconds": 180,
        "estimated_cost": 3.0,
        "steps": ["剧本拆分", "分镜脚本", "图像生成", "视频生成", "字幕配音"]
      },
      {
        "id": "tpl_standard_episode",
        "name": "标准版（7 步）",
        "description": "全流程，质量与速度平衡",
        "step_count": 7,
        "estimated_seconds": 480,
        "estimated_cost": 6.0,
        "steps": ["剧本拆分", "角色提取", "场景设计", "分镜脚本", "图像生成", "视频生成", "字幕配音"]
      }
    ]
  }
}
```

---

## 10. Webhook 回调

工作流完成后，会向 `webhook.url` 发送 POST 请求。

### 签名

```
X-Mhwork-Signature: sha256=<hmac_sha256(payload, webhook.secret)>
```

### Payload

```json
{
  "event": "workflow.completed",
  "run_id": "wf_abc123def456",
  "project_id": "proj_abc123",
  "episode_no": 1,
  "status": "completed",
  "total_cost": 6.23,
  "output": {
    "video_url": "https://cdn.mhwork.com/.../ep01.mp4"
  },
  "timestamp": "2026-06-07T15:38:00Z"
}
```

**事件类型**：
- `workflow.started`
- `workflow.step_completed`
- `workflow.step_failed`
- `workflow.completed`
- `workflow.failed`
- `workflow.paused`
- `workflow.resumed`
- `workflow.cancelled`

---

## 11. 状态码 & 错误码

| HTTP | 错误码 | 含义 |
|:--|:--|:--|
| 400 | `invalid_input` | 输入参数错误 |
| 400 | `episode_too_long` | 文本超过 100 万字 |
| 401 | `unauthorized` | 未登录 |
| 403 | `forbidden` | 无权操作此运行 |
| 404 | `run_not_found` | 运行不存在 |
| 409 | `run_already_completed` | 状态冲突（如已完成还暂停） |
| 429 | `quota_exceeded` | 配额用完 |
| 500 | `internal_error` | 服务异常 |
| 503 | `queue_full` | 队列已满，请稍后重试 |

---

## 12. 完整示例

### Node.js

```javascript
// 1. 创建工作流
const run = await fetch('https://api.manhuaworks.com/v1/workflow/runs', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${JWT}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    template_id: 'tpl_standard_episode',
    project_id: 'proj_abc123',
    episode_no: 1,
    input: {
      novel_text: '...',
      style: '2D_90s_japanese_anime',
      aspect_ratio: '9:16'
    }
  })
}).then(r => r.json());

// 2. 监听 WebSocket
const ws = new WebSocket(`${run.data.ws_url}?token=${JWT}`);
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'completed') {
    console.log('视频完成:', msg.output.video_url);
  }
};
```

### Python

```python
import requests
import websocket

# 创建
run = requests.post(
    'https://api.manhuaworks.com/v1/workflow/runs',
    headers={'Authorization': f'Bearer {JWT}'},
    json={
        'template_id': 'tpl_standard_episode',
        'project_id': 'proj_abc123',
        'episode_no': 1,
        'input': {
            'novel_text': '...',
            'style': '2D_90s_japanese_anime'
        }
    }
).json()

# WebSocket
ws = websocket.WebSocketApp(
    f"{run['data']['ws_url']}?token={JWT}",
    on_message=lambda ws, msg: print(msg)
)
ws.run_forever()
```

---

## 变更记录

| 版本 | 日期 | 作者 | 变更 |
|:--|:--|:--|:--|
| v0.1 | 2026-06-07 | 陈远枢 | 初稿 |
