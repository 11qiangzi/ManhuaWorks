# @manhuaworks/ai-helper

ManhuaWorks 漫改部 **AI 辅助工作流服务** —— 提供 8 个面向"漫改剧本生产"的高频 AI 能力：

- 智能分镜推荐（粘贴小说 → 自动建议分镜）
- 智能角色提取（提取角色 + 生成锁脸 prompt）
- 智能场景分类（内/外/夜/日 + 光影建议）
- 对话润色（改口语化 + 加情绪标签）
- 剧情续写（基于前 N 集推下一集大纲）
- 标题生成（基于内容生成 N 个候选）
- 多语翻译（英/日/韩/西，支持字幕导出）
- 剧情问题检测（逻辑漏洞/重复桥段/前后矛盾）

服务不直接持有 LLM，统一通过 **ai-router**（8082）调用，自身是无状态编排层。

- **端口**：8086
- **类型**：pnpm workspace 服务（`@manhuaworks/ai-helper`）
- **依赖**：`@manhuaworks/shared-types`（workspace 共享类型）
- **运行**：Hono + @hono/node-server
- **健康检查**：`GET /health`
- **鉴权**：`api-key` / `jwt` / `none`（与 workflow-engine 保持一致）

---

## 目录结构

```
services/ai-helper/
├── package.json
├── tsconfig.json
├── Dockerfile
├── .gitignore
├── README.md
└── src/
    ├── index.ts                 # 入口（路由装配）
    ├── config.ts                # 配置中心
    ├── llm-client.ts            # 共享 ai-router 调用 + JSON 解析
    ├── middleware/
    │   └── auth.ts              # 鉴权中间件
    ├── prompts/
    │   └── system.ts            # 系统 prompt 库（4 故事类型 + 11 艺术风格）
    └── features/
        ├── suggest-storyboard.ts
        ├── suggest-character.ts
        ├── suggest-scene.ts
        ├── polish-dialogue.ts
        ├── continue-plot.ts
        ├── generate-title.ts
        ├── translate.ts
        └── detect-issue.ts
```

---

## 快速开始

### 本地开发

```bash
# 在 workspace 根目录
pnpm install
pnpm --filter @manhuaworks/ai-helper dev
```

启动后默认监听 `http://0.0.0.0:8086`。

### 生产构建

```bash
pnpm --filter @manhuaworks/ai-helper build
pnpm --filter @manhuaworks/ai-helper start
```

### Docker

```bash
docker build -f services/ai-helper/Dockerfile -t manhuaworks/ai-helper:0.1.0 .
docker run --rm -p 8086:8086 \
  -e AI_ROUTER_URL=http://host.docker.internal:8082 \
  -e AUTH_API_KEY=your-key \
  manhuaworks/ai-helper:0.1.0
```

---

## 配置

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `HELPER_PORT` / `PORT` | `8086` | HTTP 端口 |
| `NODE_ENV` | `development` | 运行环境 |
| `AI_ROUTER_URL` | `http://localhost:8082` | ai-router 地址 |
| `AI_ROUTER_TIMEOUT_MS` | `120000` | 单次 chat 超时 |
| `AI_HELPER_DEFAULT_MODEL` | `gpt-4o-mini` | 默认模型 id |
| `AI_HELPER_TEMPERATURE` | `0.7` | 默认 temperature |
| `AUTH_MODE` | `api-key` | `api-key` / `jwt` / `none` |
| `AUTH_API_KEY` | `dev-ai-helper-key` | API Key（dev 模式） |
| `AUTH_JWT_SECRET` | `dev-jwt-secret-change-me` | JWT HS256 密钥 |
| `AI_HELPER_MAX_INPUT_CHARS` | `200000` | 单请求最大输入字符 |
| `AI_HELPER_MAX_EPISODES` | `10` | 续写时最大前置集数 |

---

## API 列表

所有 `/v1/helper/*` 接口均需鉴权（Header `X-API-Key` 或 `Authorization: Bearer <jwt>`）。
`/v1/helper/prompts` 是公开元信息端点，便于前端一次性拉取 prompt 库。

### 1. 元信息（公开）

```http
GET /v1/helper/prompts
```

返回 `{ storyTypes: [...], artStyles: [...] }`，前端下拉/选择用。

### 2. 智能分镜推荐

```http
POST /v1/helper/suggest-storyboard
Content-Type: application/json
X-API-Key: <key>

{
  "text": "林启站在废墟前，回忆起三天前的爆炸声……（小说原文）",
  "storyType": "xianxia",
  "artStyle": "manhwa-webtoon",
  "panelCount": 8,
  "skipImagePrompt": false
}
```

返回 `{ storyType, artStyle, panelCount, panels: [{ index, panelDesc, camera, action, dialogue?, sfx?, imagePrompt }] }`。

### 3. 智能角色提取

```http
POST /v1/helper/suggest-character

{
  "text": "（小说原文）",
  "storyType": "romance",
  "artStyle": "shojo",
  "maxCharacters": 8
}
```

返回 `{ characters: [{ name, role, appearance, personality[], faceLockPrompt, outfitPrompt, firstAppearanceHint? }] }`。

### 4. 智能场景分类

```http
POST /v1/helper/suggest-scene

{
  "text": "夜色中的雨巷，霓虹灯倒映在积水里",
  "storyType": "urban-suspense",
  "artStyle": "cyberpunk"
}
```

返回 `{ scene: { location, timeOfDay, weather, mood[], lighting, colorPalette[], imagePrompt, rationale } }`。

### 5. 对话润色

```http
POST /v1/helper/polish-dialogue

{
  "text": "林启：你不应该来这里。\n她：我偏要来。",
  "storyType": "xianxia",
  "intensity": "medium",
  "addNarration": false
}
```

返回 `{ lines: [{ speaker, text, emotion, intensity, narration?, original? }] }`。

### 6. 剧情续写

```http
POST /v1/helper/continue-plot

{
  "episodes": [
    { "episode": 1, "title": "废墟", "summary": "林启在灰星苏醒……", "keyEvents": ["看到徽章", "遭遇灰兽"] }
  ],
  "storyType": "xianxia",
  "artStyle": "manhwa-webtoon",
  "mainThread": "徽章的秘密",
  "targetDurationMin": 3
}
```

返回 `{ episode: { episode, title, logline, acts: [PlotBeat], cliffhanger, keyShots[], characterArcs[] }, recap }`。

### 7. 标题生成

```http
POST /v1/helper/generate-title

{
  "summary": "一个考古助理意外触发了 5 万年前的文明遗产",
  "storyType": "isekai-fantasy",
  "count": 5,
  "maxLength": 10,
  "keywords": ["灰星", "遗产"]
}
```

返回 `{ titles: [{ text, angle, hookScore, targetAudience, rationale }] }`。

### 8. 多语翻译

```http
POST /v1/helper/translate

{
  "text": "林启说：我们没有退路了。",
  "source": "zh",
  "targets": ["en", "ja"],
  "mode": "subtitle",
  "subtitleExport": true,
  "subtitleMaxChars": 42
}
```

返回 `{ translations: [{ lang, text, srt?, cues? }] }`。

### 9. 剧情问题检测

```http
POST /v1/helper/detect-issue

{
  "text": "（剧情文本）",
  "storyType": "romance",
  "categories": ["logic", "repeat", "contradiction"],
  "characterSheet": [{ "name": "林启", "role": "主角", "traits": ["冷静", "谨慎"] }]
}
```

返回 `{ issues: [{ category, severity, location, description, suggestion }], healthScore }`。

---

## 与 ai-router 的关系

- 文本生成统一走 `POST {AI_ROUTER_URL}/v1/chat/completions`（OpenAI 兼容 chat 接口）
- 在请求 Header 注入 `X-Task-Tag`（如 `helper:suggest-storyboard`）便于成本归因
- 默认 temperature 0.7，**问题检测/翻译** feature 在内部覆盖为 0.2~0.4 以提高稳定性

---

## 故事类型 + 艺术风格

`src/prompts/system.ts` 维护两个内置库：

- **4 套故事类型**：`romance`（现代言情）、`xianxia`（仙侠修真）、`urban-suspense`（都市悬疑）、`isekai-fantasy`（异世界奇幻）
- **11 套艺术风格**：`shonen`、`shojo`、`manhwa-webtoon`、`seinen`、`chinese-manhua`、`pixel-art`、`comic-western`、`watercolor`、`cyberpunk`、`ink-painting`、`chibi`

每套都包含：
- 系统 prompt 片段（影响 LLM 输出的"创作基因"）
- 视觉关键词（直接拼接到 image prompt）

`buildSystemPrompt(storyTypeId, artStyleId)` 一行调用即可拼出完整 system prompt。

---

## 错误处理

| 状态码 | 含义 |
| --- | --- |
| `400` | Zod 校验失败（请求体字段错） |
| `401` | 鉴权失败（缺 / 错凭证） |
| `500` | 服务内部异常（含 ai-router 调用失败） |
| `502` | ai-router 返回空内容（罕见） |

错误响应统一为 JSON：
```json
{ "error": "bad_request" | "unauthorized" | "internal", "message": "...", "issues": [...] }
```

---

## 版本

`0.1.0` —— W3 任务 3 交付。
