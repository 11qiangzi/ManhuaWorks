# asset-service API 文档

> **Base URL**：`https://api.manhuaworks.com/v1/assets`
> **认证**：Bearer Token（用户 JWT / API Key）
> **内容类型**：`application/json` | `multipart/form-data`（仅上传）
> **作者**：陈远枢
> **更新日期**：2026-06-08
> **服务**：`asset-service` (端口 8085)

## 概述

asset-service 是 ManhuaWorks 的**数字资产仓库**。它统一管理所有用户上传和 AI 生成的资产（图片、视频、音频、字幕、文档），并提供版本管理、签名 URL、软删除、CDN 分发。

**本文档面向**：
- 创作者工作台（studio）前端开发
- 第三方开发者（通过 API Key 集成）
- 测试工程师（接口用例）

**配套文档**：
- 架构设计：`docs/architecture/W3_ASSET.md`
- 通用认证/限流：参考 `docs/api/ai-router.md`（同一网关）

---

## 通用规范

### 认证 & 限流

继承 `ai-router.md` 第 1-2 节说明。本服务额外限制：

| 套餐 | 上传 QPS | 上传月配额 | 单文件上限 |
|:--|:--|:--|:--|
| 免费 | 2 | 50 次 | 20 MB |
| 基础 | 5 | 500 次 | 100 MB |
| 专业 | 10 | 5,000 次 | 500 MB |
| 企业 | 自定义 | 无限 | 自定义 |

### 错误码（本服务特有）

| HTTP | 错误码 | 含义 |
|:--|:--|:--|
| 413 | `file_too_large` | 超过套餐单文件上限 |
| 415 | `unsupported_media_type` | 不支持的文件类型 |
| 409 | `checksum_mismatch` | 校验和不一致 |
| 507 | `quota_exceeded` | 存储配额已满 |

---

## 端点列表

| 方法 | 路径 | 说明 |
|:--|:--|:--|
| POST | `/v1/assets/uploads/init` | 初始化上传（预签名 URL）|
| POST | `/v1/assets/uploads/complete` | 完成上传（落库）|
| POST | `/v1/assets/uploads/multipart/init` | 大文件分片上传初始化 |
| POST | `/v1/assets/uploads/multipart/complete` | 分片上传完成合并 |
| GET | `/v1/assets` | 列出我的资产（分页/筛选）|
| GET | `/v1/assets/:id` | 资产详情 |
| PATCH | `/v1/assets/:id` | 改名/打标签/移到项目 |
| DELETE | `/v1/assets/:id` | 软删（30 天回收）|
| DELETE | `/v1/assets/:id/permanent` | 立即硬删（管理员）|
| POST | `/v1/assets/:id/restore` | 从回收站恢复 |
| GET | `/v1/assets/trash` | 列出回收站 |
| GET | `/v1/assets/:id/versions` | 列出所有版本 |
| POST | `/v1/assets/:id/versions` | 上传新版本 |
| POST | `/v1/assets/:id/rollback` | 回滚到指定版本 |
| GET | `/v1/assets/:id/diff` | 对比两个版本 |
| GET | `/v1/assets/:id/url` | 获取签名 URL |
| POST | `/v1/assets/batch` | 批量操作（删/移/打标）|
| GET | `/v1/assets/search` | 全文搜索资产 |
| GET | `/v1/assets/stats` | 资产统计（容量/分类）|

---

## 1. 初始化上传

**端点**：`POST /v1/assets/uploads/init`

**说明**：客户端申请预签名 URL，然后**直接 PUT 文件到对象存储**，不经过 asset-service。

### 请求

```http
POST /v1/assets/uploads/init
Authorization: Bearer <token>
Content-Type: application/json

{
  "filename": "镜头_L01_主角正面.png",
  "size_bytes": 1024000,
  "mime_type": "image/png",
  "category": "storyboard",
  "project_id": "proj_abc",
  "run_id": "run_xyz",
  "checksum": "sha256:abc123...",
  "tags": {
    "character_name": "林启",
    "scene_name": "废墟入口",
    "role": "hero",
    "episode_no": "1"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `filename` | string | ✅ | 原始文件名（用于显示）|
| `size_bytes` | int | ✅ | 文件大小（字节）|
| `mime_type` | string | ✅ | MIME 类型 |
| `category` | enum | ✅ | `character`/`scene`/`storyboard`/`episode`/`novel`/`bgm`/`srt` |
| `project_id` | uuid | ❌ | 所属项目 |
| `run_id` | uuid | ❌ | 所属工作流运行 |
| `checksum` | string | ❌ | 客户端预计算的 SHA-256（服务端再校验）|
| `tags` | object | ❌ | 标签键值对（见 §12）|

### 响应

```json
{
  "code": 0,
  "data": {
    "asset_id": "asset_abc123",
    "upload_url": "https://oss-cn-hangzhou.aliyuncs.com/mhwork-prod/users/u_xxx/uploads/2026/06/asset_abc123/v1.png?Signature=xxx&Expires=1717830000",
    "upload_expires_at": "2026-06-08T10:00:00Z",
    "max_size_bytes": 20971520,
    "method": "PUT",
    "headers": {
      "Content-Type": "image/png",
      "x-oss-meta-checksum": "sha256:abc123..."
    }
  }
}
```

**接下来**：客户端用 `PUT` 方法 + 上述 `headers` 直传 `upload_url`。

---

## 2. 完成上传

**端点**：`POST /v1/assets/uploads/complete`

### 请求

```http
POST /v1/assets/uploads/complete
Content-Type: application/json

{
  "asset_id": "asset_abc123",
  "etag": "\"abc123def456\"",
  "actual_checksum": "sha256:abc123..."
}
```

### 响应

```json
{
  "code": 0,
  "data": {
    "id": "asset_abc123",
    "user_id": "user_xxx",
    "project_id": "proj_abc",
    "run_id": "run_xyz",
    "asset_type": "image",
    "category": "storyboard",
    "name": "镜头_L01_主角正面.png",
    "mime_type": "image/png",
    "size_bytes": 1024000,
    "storage_key": "users/u_xxx/uploads/2026/06/asset_abc123/v1.png",
    "cdn_url": "https://cdn.mhwork.com/users/u_xxx/...?sig=xxx",
    "thumbnail_url": "https://cdn.mhwork.com/thumbs/asset_abc123.jpg",
    "checksum": "sha256:abc123...",
    "current_version": 1,
    "status": 1,
    "tags": {
      "character_name": "林启",
      "scene_name": "废墟入口",
      "role": "hero",
      "episode_no": "1"
    },
    "created_at": "2026-06-08T09:55:00Z",
    "updated_at": "2026-06-08T09:55:00Z"
  }
}
```

### 错误示例

```json
{
  "code": 409,
  "error": {
    "type": "checksum_mismatch",
    "message": "客户端声明 sha256:abc123，但实际为 sha256:def456",
    "expected": "sha256:abc123",
    "actual": "sha256:def456"
  }
}
```

---

## 3. 列出我的资产

**端点**：`GET /v1/assets`

### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `project_id` | uuid | ❌ | 按项目筛选 |
| `category` | string | ❌ | 按分类筛选（多选用逗号）|
| `asset_type` | string | ❌ | 按类型筛选（多选用逗号）|
| `tag.character_name` | string | ❌ | 按角色名筛选 |
| `tag.scene_name` | string | ❌ | 按场景名筛选 |
| `tag.episode_no` | string | ❌ | 按集数筛选 |
| `q` | string | ❌ | 名称模糊搜索 |
| `sort` | string | ❌ | `created_desc` / `created_asc` / `size_desc` / `name_asc`，默认 `created_desc` |
| `page` | int | ❌ | 页码（默认 1）|
| `page_size` | int | ❌ | 每页数量（1-200，默认 50）|

### 示例

```http
GET /v1/assets?project_id=proj_abc&category=storyboard,character&tag.episode_no=1&page=1&page_size=20
Authorization: Bearer <token>
```

### 响应

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "asset_abc",
        "name": "镜头_L01_主角正面.png",
        "asset_type": "image",
        "category": "storyboard",
        "thumbnail_url": "https://cdn.mhwork.com/thumbs/abc.jpg",
        "size_bytes": 1024000,
        "current_version": 3,
        "tags": { "character_name": "林启" },
        "created_at": "2026-06-08T09:55:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 47,
      "total_pages": 3,
      "has_next": true
    }
  }
}
```

---

## 4. 资产详情

**端点**：`GET /v1/assets/:id`

### 响应

```json
{
  "code": 0,
  "data": {
    "id": "asset_abc",
    "user_id": "user_xxx",
    "project_id": "proj_abc",
    "run_id": "run_xyz",
    "asset_type": "image",
    "category": "storyboard",
    "name": "镜头_L01_主角正面.png",
    "mime_type": "image/png",
    "size_bytes": 1024000,
    "storage_key": "users/u_xxx/.../v1.png",
    "checksum": "sha256:abc...",
    "current_version": 3,
    "status": 1,
    "tags": { "character_name": "林启", "role": "hero" },
    "metadata": {
      "prompt": "废墟入口，黄昏光，cinematic, 8k",
      "model": "doubao-seedream-3.0",
      "provider": "volcano",
      "seed": 12345,
      "width": 1024,
      "height": 1024
    },
    "urls": {
      "original": "https://cdn.mhwork.com/...?sig=xxx",
      "thumbnail": "https://cdn.mhwork.com/thumbs/abc.jpg",
      "preview": "https://cdn.mhwork.com/preview/abc.png"
    },
    "version_count": 3,
    "created_at": "2026-06-08T09:55:00Z",
    "updated_at": "2026-06-08T11:20:00Z"
  }
}
```

---

## 5. 修改资产

**端点**：`PATCH /v1/assets/:id`

### 请求

```json
{
  "name": "镜头L01-林启正面特写.png",
  "tags": {
    "character_name": "林启",
    "role": "hero",
    "emotion": "严肃"
  },
  "project_id": "proj_def"
}
```

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `name` | string | ❌ | 新名称 |
| `tags` | object | ❌ | 替换整个标签对象（不是合并）|
| `project_id` | uuid | ❌ | 移动到其他项目 |

### 响应

```json
{ "code": 0, "data": { "id": "asset_abc", "updated_at": "..." } }
```

---

## 6. 软删除与回收

### 6.1 软删除

```http
DELETE /v1/assets/:id
```

**响应**：
```json
{ "code": 0, "data": { "id": "asset_abc", "status": 2, "deleted_at": "..." } }
```

### 6.2 恢复

```http
POST /v1/assets/:id/restore
```

### 6.3 立即硬删（仅管理员）

```http
DELETE /v1/assets/:id/permanent
X-Admin-Token: <admin_token>
```

### 6.4 列出回收站

```http
GET /v1/assets/trash?page=1&page_size=50
```

---

## 7. 版本管理

### 7.1 列出所有版本

```http
GET /v1/assets/:id/versions
```

```json
{
  "code": 0,
  "data": {
    "versions": [
      {
        "version_no": 3,
        "size_bytes": 1152000,
        "checksum": "sha256:def...",
        "created_by": "user_xxx",
        "created_at": "2026-06-08T11:20:00Z",
        "metadata": { "prompt": "...", "seed": 67890 }
      },
      {
        "version_no": 2,
        "size_bytes": 1100000,
        "checksum": "sha256:...",
        "created_at": "2026-06-08T10:30:00Z"
      },
      {
        "version_no": 1,
        "size_bytes": 1024000,
        "checksum": "sha256:abc...",
        "created_at": "2026-06-08T09:55:00Z"
      }
    ]
  }
}
```

### 7.2 上传新版本

```http
POST /v1/assets/:id/versions
Content-Type: application/json

{
  "filename": "镜头_L01_主角正面_v2.png",
  "size_bytes": 1152000,
  "mime_type": "image/png",
  "metadata": {
    "prompt": "废墟入口，黄昏光，雾气，cinematic, 8k",
    "seed": 67890,
    "model": "doubao-seedream-3.0"
  }
}
```

**响应**：同 `uploads/init`，返回新版本的 `upload_url`，完成后用 `uploads/complete` 落库。

### 7.3 回滚到指定版本

```http
POST /v1/assets/:id/rollback
Content-Type: application/json

{ "to_version": 1 }
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "id": "asset_abc",
    "current_version": 1,
    "rolled_back_at": "2026-06-08T12:00:00Z"
  }
}
```

### 7.4 对比两个版本

```http
GET /v1/assets/:id/diff?from=1&to=3
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "asset_id": "asset_abc",
    "from_version": 1,
    "to_version": 3,
    "diff": {
      "metadata": {
        "prompt": {
          "from": "废墟入口，黄昏光",
          "to": "废墟入口，黄昏光，雾气，cinematic"
        },
        "seed": { "from": 12345, "to": 67890 }
      },
      "size_bytes": { "from": 1024000, "to": 1152000, "delta": 128000 },
      "checksum_changed": true
    }
  }
}
```

---

## 8. 签名 URL

**端点**：`GET /v1/assets/:id/url`

### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `expires_in` | int | ❌ | URL 有效期（秒），默认 3600，最大 604800（7 天）|
| `variant` | string | ❌ | `original` / `thumbnail` / `preview`，默认 `original` |

### 响应

```json
{
  "code": 0,
  "data": {
    "url": "https://cdn.mhwork.com/users/u_xxx/.../v3.png?sig=xxx&expires=1717830000",
    "expires_at": "2026-06-08T13:00:00Z",
    "variant": "original"
  }
}
```

---

## 9. 批量操作

**端点**：`POST /v1/assets/batch`

### 请求

```json
{
  "asset_ids": ["asset_abc", "asset_def", "asset_ghi"],
  "action": "move",
  "target_project_id": "proj_xyz"
}
```

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `asset_ids` | array | ✅ | 1-100 个资产 ID |
| `action` | enum | ✅ | `delete` / `restore` / `move` / `tag` |
| `target_project_id` | uuid | ❌ | `move` 时必填 |
| `tags` | object | ❌ | `tag` 时必填 |

### 响应

```json
{
  "code": 0,
  "data": {
    "succeeded": ["asset_abc", "asset_def"],
    "failed": [
      { "asset_id": "asset_ghi", "error": "permission_denied" }
    ],
    "succeeded_count": 2,
    "failed_count": 1
  }
}
```

---

## 10. 全文搜索

**端点**：`GET /v1/assets/search?q=废墟`

支持按资产名、标签值、metadata.prompt 模糊搜索。

```json
{
  "code": 0,
  "data": {
    "items": [ /* 同 list 格式 */ ],
    "total": 23,
    "took_ms": 87
  }
}
```

---

## 11. 资产统计

**端点**：`GET /v1/assets/stats`

### 响应

```json
{
  "code": 0,
  "data": {
    "total_assets": 347,
    "total_size_bytes": 5368709120,
    "by_category": {
      "character": { "count": 24, "size_bytes": 104857600 },
      "storyboard": { "count": 156, "size_bytes": 314572800 },
      "episode": { "count": 12, "size_bytes": 4294967296 },
      "bgm": { "count": 18, "size_bytes": 52428800 }
    },
    "by_type": {
      "image": 213,
      "video": 12,
      "audio": 18,
      "text": 104
    },
    "quota": {
      "used_bytes": 5368709120,
      "limit_bytes": 10737418240,
      "used_percent": 50.0
    }
  }
}
```

---

## 12. 标签规范

常用 `tag_key` 枚举：

| tag_key | 用途 | 示例 |
|:--|:--|:--|
| `character_name` | 角色名 | `林启` / `陈雪` |
| `scene_name` | 场景名 | `废墟入口` / `遗迹大厅` |
| `style` | 艺术风格 | `2D_90s_japanese_anime` |
| `role` | 角色身份 | `hero` / `villain` / `support` / `npc` |
| `episode_no` | 集数 | `1` ~ `N` |
| `emotion` | 情绪 | `严肃` / `紧张` / `温馨` |
| `shot_type` | 镜头类型 | `wide` / `medium` / `close_up` |
| `camera_motion` | 运镜 | `static` / `pan_left` / `zoom_in` |

---

## 13. 大文件分片上传

> 适用于 > 100 MB 的视频/3D 文件。

### 13.1 初始化分片

```http
POST /v1/assets/uploads/multipart/init
{
  "filename": "ep01.mp4",
  "size_bytes": 524288000,
  "mime_type": "video/mp4",
  "category": "episode",
  "part_size": 5242880
}
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "upload_id": "up_abc123",
    "asset_id": "asset_xyz",
    "part_size": 5242880,
    "part_count": 100,
    "part_urls": [
      "https://oss.../v1.mp4?partNumber=1&uploadId=up_abc123",
      "https://oss.../v1.mp4?partNumber=2&uploadId=up_abc123",
      "...",
      "https://oss.../v1.mp4?partNumber=100&uploadId=up_abc123"
    ]
  }
}
```

### 13.2 客户端并发 PUT 所有分片

### 13.3 完成合并

```http
POST /v1/assets/uploads/multipart/complete
{
  "upload_id": "up_abc123",
  "asset_id": "asset_xyz",
  "parts": [
    { "part_number": 1, "etag": "\"abc123\"" },
    { "part_number": 2, "etag": "\"def456\"" },
    "..."
  ]
}
```

**响应**：同普通 `uploads/complete`。

---

## 14. 完整调用示例

### 浏览器上传一张图片

```javascript
// 1. 申请上传 URL
const init = await fetch('/v1/assets/uploads/init', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filename: file.name, size_bytes: file.size, mime_type: file.type,
    category: 'storyboard', project_id: 'proj_abc',
    tags: { character_name: '林启', episode_no: '1' }
  })
}).then(r => r.json());

// 2. 直传到 OSS
await fetch(init.data.upload_url, {
  method: 'PUT',
  headers: init.data.headers,
  body: file,
  onUploadProgress: e => console.log(`${(e.loaded / e.total * 100).toFixed(1)}%`)
});

// 3. 通知服务端落库
const complete = await fetch('/v1/assets/uploads/complete', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    asset_id: init.data.asset_id,
    actual_checksum: 'sha256:abc...'
  })
}).then(r => r.json());

console.log(complete.data.cdn_url);
```

### Python 列出项目下所有角色立绘

```python
import requests

resp = requests.get(
    'https://api.manhuaworks.com/v1/assets',
    headers={'Authorization': f'Bearer {API_KEY}'},
    params={
        'project_id': 'proj_abc',
        'category': 'character',
        'sort': 'created_desc',
        'page_size': 100
    }
)
data = resp.json()['data']
for item in data['items']:
    print(f"{item['name']} - {item['tags'].get('character_name')}")
```

---

## 15. Webhook 事件

`asset-service` 会在以下情况发事件到 EventBus：

| 事件 | 触发时机 | 订阅方 |
|:--|:--|:--|
| `asset.created` | 上传完成 | workflow, ai-helper, billing |
| `asset.updated` | 改名/打标/移项目 | analytics |
| `asset.deleted` | 软删/硬删 | workflow, ai-helper |
| `asset.restored` | 恢复 | workflow |
| `asset.rolled_back` | 版本回滚 | analytics |

订阅示例见 `W3_ASSET.md` 第 10 节。

---

## 16. SDK

- **Node.js**：`@mhwork/asset-sdk`（含上传/列表/版本管理）
- **Python**：`mhwork`（含完整 CRUD + 异步分片上传）
- **Go**：`github.com/manhuaworks/mhwork-go`

---

## 17. 变更记录

| 版本 | 日期 | 作者 | 变更 |
|:--|:--|:--|:--|
| v0.1 | 2026-06-08 | 陈远枢 | 初稿（W3 任务 6）|
