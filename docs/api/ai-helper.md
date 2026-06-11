# ai-helper API 文档

> **Base URL**：`https://api.manhuaworks.com/v1/helper`
> **认证**：Bearer Token（用户 JWT / API Key）
> **内容类型**：`application/json`
> **作者**：陈远枢
> **更新日期**：2026-06-08
> **服务**：`ai-helper` (端口 8086)

## 概述

ai-helper 是 ManhuaWorks 的**创作助理层**。它不直接生成最终成品，而是在创作者工作台中提供 6 类智能辅助——从灵感激发到细节打磨，让创作者"写得快、改得好、选得对"。

**6 大功能**：
1. 提示词优化（中文 → 高质量英文 prompt）
2. 灵感推荐（基于已写内容推下一步）
3. 角色一致性检查
4. 风格统一性分析
5. 违禁词扫描
6. 智能改名（作品/角色起名）

**配套文档**：`docs/architecture/W3_AI_HELPER.md`

---

## 通用规范

### 认证 & 限流

继承 `ai-router.md` 通用规范。**本服务特殊限流**：

| 套餐 | QPS | 月配额 |
|:--|:--|:--|
| 免费 | 3 | 200 次 |
| 基础 | 10 | 3,000 次 |
| 专业 | 30 | 30,000 次 |
| 企业 | 自定义 | 无限 |

### 缓存

相同输入 24 小时内直接返回缓存（Redis SHA-256 key），节省 LLM 成本。

### 错误码

继承 `ai-router.md` 通用错误码，本服务新增：

| HTTP | 错误码 | 含义 |
|:--|:--|:--|
| 422 | `low_quality_input` | 输入文本质量过低（< 5 字符 / 全是 emoji） |
| 422 | `content_too_long` | 超过模型上下文上限（100K 字符） |

---

## 端点列表

| 方法 | 路径 | 说明 |
|:--|:--|:--|
| POST | `/v1/helper/prompt/optimize` | 提示词优化（功能 1）|
| POST | `/v1/helper/inspiration/recommend` | 灵感推荐（功能 2）|
| POST | `/v1/helper/character/consistency` | 角色一致性检查（功能 3）|
| POST | `/v1/helper/style/uniformity` | 风格统一性分析（功能 4）|
| POST | `/v1/helper/word/filter` | 违禁词扫描（功能 5）|
| POST | `/v1/helper/naming/suggest` | 智能改名（功能 6）|
| GET | `/v1/helper/history` | 查询调用历史 |
| GET | `/v1/helper/templates` | 列出提示词模板库 |
| GET | `/v1/helper/health` | 健康检查 |

---

## 1. 提示词优化

**端点**：`POST /v1/helper/prompt/optimize`

**说明**：把用户的中文/英文草稿，改写为 AI 友好的高质量英文 prompt。

### 请求

```http
POST /v1/helper/prompt/optimize
Content-Type: application/json

{
  "draft": "废墟入口，黄昏光，有点雾，电影感",
  "target_model": "doubao-seedream-3.0",
  "target_type": "image",
  "style": "anime",
  "language": "auto",
  "negative_prompt": null,
  "context": {
    "character_name": "林启",
    "scene_name": "废墟入口",
    "shot_type": "wide",
    "previous_shot_prompt": "..."
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `draft` | string | ✅ | 用户草稿（5-2000 字符）|
| `target_model` | string | ✅ | 目标模型 ID（决定 prompt 风格）|
| `target_type` | enum | ✅ | `image` / `video` / `tts` / `llm` |
| `style` | enum | ❌ | `anime` / `realistic` / `3d` / `2d` / `cinematic` |
| `language` | enum | ❌ | `auto` / `en` / `zh` / `ja` |
| `negative_prompt` | string | ❌ | 反向提示词草稿 |
| `context` | object | ❌ | 上下文（角色/场景/镜头）|

### 响应

```json
{
  "code": 0,
  "data": {
    "optimized_prompt": "Ancient ruins entrance, wide shot, dusk golden hour lighting, atmospheric fog drifting through broken stone arches, cinematic composition, 8k, ultra-detailed, anime style with realistic lighting",
    "negative_prompt": "blur, distortion, deformed hands, extra fingers, low quality, watermark, signature",
    "quality_score": 0.92,
    "improvements": [
      "添加具体光线描述（'dusk golden hour lighting'）",
      "补充镜头类型（'wide shot'）",
      "添加质量关键词（'8k, ultra-detailed'）",
      "补全反向提示词标准模板"
    ],
    "model": "glm-4-plus",
    "cached": false,
    "elapsed_ms": 1240
  }
}
```

**质量评分**：0-1 之间的浮点数，> 0.8 为高质 prompt，< 0.5 触发人工审核提示。

---

## 2. 灵感推荐

**端点**：`POST /v1/helper/inspiration/recommend`

**说明**：基于已写的小说章节/剧本分镜，推荐下一步可能的情节走向、场景、镜头。

### 请求

```json
{
  "context_type": "novel_chapter",
  "context_text": "林启踏入废墟入口，远处传来低沉的嗡鸣声，像是某种古老的机械在运转。他握紧手中的刀，指节泛白...",
  "genre": "scifi",
  "current_stage": "rising_action",
  "recommend_count": 3,
  "creativity": 0.7
}
```

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `context_type` | enum | ✅ | `novel_chapter` / `storyboard` / `script` / `scene` |
| `context_text` | string | ✅ | 当前已写内容（100-20000 字符）|
| `genre` | enum | ❌ | `scifi` / `fantasy` / `romance` / `mystery` / `wuxia` |
| `current_stage` | enum | ❌ | 故事阶段：`setup` / `rising_action` / `climax` / `falling_action` / `resolution` |
| `recommend_count` | int | ❌ | 推荐数量（1-5，默认 3）|
| `creativity` | float | ❌ | 创造性（0-1，默认 0.7，越高越天马行空）|

### 响应

```json
{
  "code": 0,
  "data": {
    "recommendations": [
      {
        "type": "plot_twist",
        "title": "机械守卫苏醒",
        "description": "废墟中央的古代机械突然启动，对林启发起攻击，揭示这是某种防御系统",
        "rationale": "符合'rising_action'阶段的对抗升级需求",
        "confidence": 0.85
      },
      {
        "type": "character_reveal",
        "title": "林启的师父遗物",
        "description": "林启在废墟中发现师父当年留下的笔记，揭示此处与他的身世有关",
        "confidence": 0.78
      },
      {
        "type": "scene_suggestion",
        "title": "地下密室入口",
        "description": "废墟底部有一道暗门，通向更深层的遗迹，需要解开某种机关",
        "confidence": 0.72
      }
    ],
    "model": "glm-4-plus",
    "elapsed_ms": 2150
  }
}
```

---

## 3. 角色一致性检查

**端点**：`POST /v1/helper/character/consistency`

**说明**：检测一个角色在不同章节/分镜中的描述是否前后矛盾。

### 请求

```json
{
  "character_name": "林启",
  "appearances": [
    {
      "chapter": 1,
      "description": "黑色短发，身高 180cm，穿着考古队的旧夹克，左脸有一道疤"
    },
    {
      "chapter": 5,
      "description": "金发飘逸，身高 175cm，穿着银白色的机甲战斗服，面容干净"
    },
    {
      "chapter": 8,
      "description": "黑色短发，180cm，夹克破损但还在身上，左脸有疤"
    }
  ]
}
```

### 响应

```json
{
  "code": 0,
  "data": {
    "character_name": "林启",
    "consistency_score": 0.42,
    "conflicts": [
      {
        "type": "appearance_inconsistency",
        "severity": "high",
        "chapter_a": 1,
        "chapter_b": 5,
        "field": "hair_color",
        "description": "第1章为'黑色短发'，第5章为'金发飘逸'，明显矛盾",
        "suggestion": "统一为'黑色短发'，或解释为'第5章是梦境/回忆'"
      },
      {
        "type": "appearance_inconsistency",
        "severity": "medium",
        "chapter_a": 1,
        "chapter_b": 5,
        "field": "height",
        "description": "身高从 180cm 变为 175cm",
        "suggestion": "建议统一为 180cm"
      },
      {
        "type": "appearance_inconsistency",
        "severity": "low",
        "chapter_a": 1,
        "chapter_b": 5,
        "field": "clothing",
        "description": "服装风格完全不同（夹克 vs 机甲）",
        "suggestion": "确认第5章是战斗变身后的特殊状态"
      }
    ],
    "consistent_chapters": [1, 8],
    "model": "glm-4-plus",
    "elapsed_ms": 1880
  }
}
```

**一致性评分**：0-1 浮点数。> 0.8 为高一致，< 0.5 需用户确认。

---

## 4. 风格统一性分析

**端点**：`POST /v1/helper/style/uniformity`

**说明**：分析一个项目/集数下所有分镜的风格是否统一（笔触、色调、运镜节奏）。

### 请求

```json
{
  "project_id": "proj_abc",
  "episode_no": 1,
  "asset_ids": ["asset_001", "asset_002", "asset_003", "..."],
  "aspects": ["color_tone", "brushstroke", "camera_rhythm"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `project_id` | uuid | ✅ | 项目 ID |
| `episode_no` | int | ❌ | 集数（不传则分析整个项目）|
| `asset_ids` | array | ❌ | 指定分析哪些资产（默认全部分镜）|
| `aspects` | array | ❌ | 分析维度（默认全部）|

### 响应

```json
{
  "code": 0,
  "data": {
    "project_id": "proj_abc",
    "episode_no": 1,
    "uniformity_score": 0.74,
    "by_aspect": {
      "color_tone": {
        "score": 0.88,
        "comment": "整体冷色调统一，#1A2540 蓝灰为主",
        "outliers": ["asset_007 偏暖黄"]
      },
      "brushstroke": {
        "score": 0.72,
        "comment": "细描为主，#12 镜头出现粗线条特写",
        "outliers": ["asset_012"]
      },
      "camera_rhythm": {
        "score": 0.62,
        "comment": "运镜节奏较快但 #5 镜头突然静止 3 秒",
        "outliers": ["asset_005"]
      }
    },
    "suggestions": [
      "建议将 asset_007 调整为冷色调以保持一致性",
      "asset_005 可加 1 个快速摇镜衔接"
    ],
    "model": "doubao-seedream-3.0 + glm-4-plus",
    "elapsed_ms": 5230
  }
}
```

---

## 5. 违禁词扫描

**端点**：`POST /v1/helper/word/filter`

**说明**：扫描剧本/分镜文本中的违禁词（政治/色情/暴力/广告法/版权）。

### 请求

```json
{
  "text": "林启一刀砍向敌人，鲜血四溅。最厉害的产品，史上最低价...",
  "categories": ["violence", "advertising", "political", "adult"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `text` | string | ✅ | 待扫描文本（1-100000 字符）|
| `categories` | array | ❌ | 扫描类别（默认全部）|

### 响应

```json
{
  "code": 0,
  "data": {
    "total_words": 32,
    "violations": [
      {
        "word": "鲜血四溅",
        "category": "violence",
        "severity": "medium",
        "position": [4, 8],
        "suggestion": "建议改为'林启一刀击中，伤口渗出血迹'"
      },
      {
        "word": "最厉害",
        "category": "advertising",
        "severity": "high",
        "position": [12, 15],
        "suggestion": "违反《广告法》极限词，建议删除或改为'非常出色'"
      },
      {
        "word": "史上最低价",
        "category": "advertising",
        "severity": "high",
        "position": [16, 22],
        "suggestion": "极限词违规，必须删除"
      }
    ],
    "violation_count": 3,
    "by_severity": {
      "high": 2,
      "medium": 1,
      "low": 0
    },
    "passed": false,
    "elapsed_ms": 320
  }
}
```

**passed**：`true` 表示无违规可发布，`false` 必须修改后重新提交。

---

## 6. 智能改名

**端点**：`POST /v1/helper/naming/suggest`

**说明**：给作品名、角色名、场景名起名，基于已有内容自动生成多个候选。

### 请求

```json
{
  "name_type": "character",
  "context": "考古学助理，男，25岁，性格沉稳，在废墟遗迹中探索，发现自己是古代文明的后裔",
  "genre": "scifi",
  "style": "elegant",
  "name_count": 5,
  "existing_names": ["陈雪", "老魏"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `name_type` | enum | ✅ | `character` / `work` / `scene` / `item` |
| `context` | string | ✅ | 上下文描述（50-1000 字符）|
| `genre` | enum | ❌ | 题材 |
| `style` | enum | ❌ | `elegant` / `cool` / `cute` / `classical` / `modern` |
| `name_count` | int | ❌ | 候选数量（1-10，默认 5）|
| `existing_names` | array | ❌ | 已用名（避免重复）|

### 响应

```json
{
  "code": 0,
  "data": {
    "suggestions": [
      {
        "name": "林启",
        "pinyin": "Lín Qǐ",
        "meaning": "林：森林，象征自然与生命；启：开启，象征探索",
        "style_match": 0.95,
        "uniqueness": 0.78
      },
      {
        "name": "苏砚",
        "pinyin": "Sū Yàn",
        "meaning": "苏：苏醒；砚：笔墨，象征记录与发现",
        "style_match": 0.88,
        "uniqueness": 0.85
      },
      {
        "name": "叶承渊",
        "pinyin": "Yè Chéng Yuān",
        "meaning": "承：承担；渊：深渊，象征探索未知",
        "style_match": 0.82,
        "uniqueness": 0.90
      }
    ],
    "model": "glm-4-plus",
    "elapsed_ms": 1450
  }
}
```

---

## 7. 调用历史

**端点**：`GET /v1/helper/history`

### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|:--|:--|:--|:--|
| `feature` | enum | ❌ | `prompt_optimize` / `inspiration` / `consistency` / `style` / `filter` / `naming` |
| `from` | ISO8601 | ❌ | 起始时间 |
| `to` | ISO8601 | ❌ | 结束时间 |
| `page` | int | ❌ | 页码（默认 1）|
| `page_size` | int | ❌ | 每页数量（默认 50）|

### 响应

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "hlp_abc",
        "feature": "prompt_optimize",
        "input_hash": "sha256:...",
        "output_preview": "Ancient ruins entrance, wide shot...",
        "quality_score": 0.92,
        "cost": 0.012,
        "elapsed_ms": 1240,
        "cached": false,
        "created_at": "2026-06-08T10:30:00Z"
      }
    ],
    "pagination": { "page": 1, "page_size": 50, "total": 247 }
  }
}
```

---

## 8. 提示词模板库

**端点**：`GET /v1/helper/templates?category=character&style=anime`

### 响应

```json
{
  "code": 0,
  "data": {
    "templates": [
      {
        "id": "tpl_001",
        "name": "日式动漫-少年主角",
        "category": "character",
        "style": "anime",
        "template": "{hair_color} hair, {eye_color} eyes, {age} years old, anime style, detailed face, high quality",
        "variables": ["hair_color", "eye_color", "age"],
        "usage_count": 1247,
        "rating": 4.6
      }
    ]
  }
}
```

---

## 9. 健康检查

**端点**：`GET /v1/helper/health`

```json
{
  "code": 0,
  "data": {
    "status": "healthy",
    "version": "0.3.0",
    "uptime_seconds": 86420,
    "ai_router": "reachable",
    "redis": "reachable",
    "db": "reachable",
    "cache_hit_rate": 0.73
  }
}
```

---

## 10. 完整示例

### 工作流：用户改写 prompt

```javascript
// 用户在 Studio 编辑分镜 prompt
const userDraft = "废墟入口，黄昏光，有点雾";

// 调用 ai-helper 优化
const optimized = await fetch('/v1/helper/prompt/optimize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    draft: userDraft,
    target_model: 'doubao-seedream-3.0',
    target_type: 'image',
    style: 'anime',
    context: { character_name: '林启', scene_name: '废墟入口', shot_type: 'wide' }
  })
}).then(r => r.json());

// 直接用优化结果去生图
const image = await fetch('/v1/ai/image/generate', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: optimized.data.optimized_prompt,
    negative_prompt: optimized.data.negative_prompt,
    width: 1024, height: 1024
  })
}).then(r => r.json());
```

### Python 批量违禁词扫描

```python
import requests

script = """林启一刀砍向敌人，鲜血四溅..."""  # 剧本全文

resp = requests.post(
    'https://api.manhuaworks.com/v1/helper/word/filter',
    headers={'Authorization': f'Bearer {API_KEY}'},
    json={'text': script, 'categories': ['violence', 'advertising']}
)
result = resp.json()['data']

if not result['passed']:
    print(f"发现 {result['violation_count']} 处违规")
    for v in result['violations']:
        print(f"  [{v['severity']}] {v['word']} → {v['suggestion']}")
```

---

## 11. 成本与配额

| 功能 | 平均 LLM 成本 | 平均耗时 | 缓存命中 |
|:--|:--|:--|:--|
| 提示词优化 | ¥0.01-0.02 | 1-2s | 65% |
| 灵感推荐 | ¥0.02-0.04 | 2-3s | 40% |
| 角色一致性 | ¥0.03-0.05 | 2-4s | 30% |
| 风格统一性 | ¥0.05-0.10 | 5-8s | 20% |
| 违禁词扫描 | ¥0.001-0.003 | 0.3-0.5s | 80% |
| 智能改名 | ¥0.01-0.02 | 1-2s | 50% |

---

## 12. 变更记录

| 版本 | 日期 | 作者 | 变更 |
|:--|:--|:--|:--|
| v0.1 | 2026-06-08 | 陈远枢 | 初稿（W3 任务 6）|
