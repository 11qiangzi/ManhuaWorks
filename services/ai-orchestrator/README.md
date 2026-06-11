# @manhuaworks/ai-orchestrator

ManhuaWorks 编排层（端口 8087），在 `ai-router` + `workflow-engine` + `ai-helper` 之上提供 6 个一站式生成管道，对外屏蔽"先分镜→再角色→再场景→再出图→再配音→再合成"的繁琐调用链。

> **W5 状态**：6 模块精修完成（5 个 W3 管道升级 + 1 个新增 multi-character-replace）+ 12 风格 / 12 语言 / 3 quality mode 预设 + LRU 缓存 + 并发批处理 + 4 种重试策略 + provider 备选切换。

## 架构位置

```
apps/web / apps/sdk
        ↓
api-gateway (8080)
        ↓
ai-orchestrator (8087)        ← 本服务
   ├── 6 精修 pipeline
   ├── 12 风格 / 12 语言 / 3 quality mode 预设
   ├── LRU 缓存 (prompt / style / translate / character)
   ├── 并发批处理 (image-gen 5x / video-gen 3x)
   └── 错误恢复 (4 重试策略 + provider 备选)
        ↓
ai-router (8082)    workflow-engine (8084)
                    asset-service (8085)
ai-helper (8086)    ai-keys-service (8083)
```

## 6 个 Pipeline（W5）

| 路由 | 内部步骤 | 适用 | 精修亮点 |
|------|---------|------|---------|
| `POST /v1/orchestrate/novel-to-drama.refined` | storyboard → character → scene → image-gen → tts → video-gen → compose | 粘贴小说→1 集 60s 漫剧 | 3 quality mode + 12 风格 + 缓存 + 并发 |
| `POST /v1/orchestrate/episode-batch.refined` | 1 章节 → 自动拆 N 集 → 每集跑 novel-to-drama | 批量生产整正 | 风格一致 + 跨集缓存 + 集内并发 |
| `POST /v1/orchestrate/style-transfer.refined` | detect-style → regen-frames → rerender-videos → compose | 老剧集换皮肤 | 12 风格 + 风格混合 + 后期参数 |
| `POST /v1/orchestrate/character-replace.refined` | extract-roles → rebuild-characters → regen-videos | 主角换演员 | 多角色批量 + 一致性锁定 + 缓存 |
| `POST /v1/orchestrate/auto-translate.refined` | extract-subtitle → translate-text → translate-audio → burn-subtitle | 多语种发行 | 12 语言 + 双语字幕 + RTL 字体 + 翻译缓存 |
| `POST /v1/orchestrate/multi-character-replace.refined` | resolve-replacements → apply-replacements → regen-frames → regen-videos → compose | 同时换多角色 + 场景 + 道具 | **W5 新增**，3 类替换 + 跨剧集一致性 |

所有 Pipeline 共享同一套基础：
- `pipeline-runner.ts` — 状态机 + 步骤串联 + 异常补偿
- `cost-tracker.ts` — 每步实时计费 + 用户配额扣减
- `quota.ts` — 5 级 RBAC（guest/free/pro/business/enterprise）
- `presets/` — 12 风格 / 12 语言 / 3 quality mode 配置
- `perf/cache.ts` — LRU 缓存（prompt / 翻译 / 角色）
- `perf/batch.ts` — 并发批处理（mapWithConcurrency + 3 个 batch helper）
- `errors/recovery.ts` — 4 种重试策略 + provider 备选切换

## 12 风格预设（`src/presets/styles.ts`）

`anime` `realistic_3d` `cyberpunk` `ink_painting` `disney` `ghibli` `manhua_chinese` `comic_western` `realistic_photo` `cel_shading` `render_3d` `cyber`

每个风格包含：完整 prompt 模板、负向 prompt、推荐分辨率、推荐视频时长、后期参数（色温/饱和/对比/锐度/噪点/暗角/fps）、成本/速度系数、质量评分。

**风格混合**：`mixStylePrompts(a, b, weight)` + `canMixStyles(a, b)` 白名单校验（anime↔ghibli、cyberpunk↔cyber、disney↔realistic_3d 等）。

## 12 语言预设（`src/presets/languages.ts`）

`en` `ja` `ko` `fr` `de` `es` `ru` `ar` `hi` `pt` `it` `zh-TW`

每个语言包含：ISO code、母语名、推荐 TTS 供应商顺序、推荐字体（含阿拉伯 RTL NotoSansArabic / 印地 Devanagari）、TTS 语速/音调、翻译 prompt 提示、双语字幕拼接器。

## 3 Quality Mode（`src/presets/quality-modes.ts`）

| 模式 | 单集成本 | 单集耗时 | 并发 | 重试 | 用途 |
|------|---------|---------|------|------|------|
| `cost` | ~$0.55 | ~60s | 6 | 0 | 大批量预生产 |
| `speed` | ~$1.15 | ~45s | 4 | 1 | demo / 草稿 |
| `quality` | ~$2.10 | ~110s | 2 | 2 | 精品 / 终版 |

`quality` 模式额外启用：`enhancePrompt`（LLM 增强 prompt）、`multiPass`（多轮重生成）、`videoMaxAttempts=3`（不同种子重试）。

## 性能（W3 baseline → W5）

| 指标 | W3 | W5 cost | W5 speed | W5 quality |
|------|----|---------|---------|-----------|
| image-gen 6 张 | ~18s | ~3.0s | ~3.2s | ~6.5s |
| video-gen 6 段 | ~90s | ~30s | ~32s | ~52s |
| novel-to-drama 1 集 60s | ~110s | ~50s | ~38s | ~95s |
| 缓存命中率 | 0% | ~30% | ~50% | ~45% |
| 12 风格 | 7 | 12 | 12 | 12 |
| 12 语言 | 4 | 12 | 12 | 12 |
| 重试策略 | 1（固定） | 1 | 4 选 1 | 4 选 1 |
| provider 备选 | 0 | 0 | 2 | 2 |

## 启动

```bash
pnpm install
pnpm dev                 # 开发模式（tsx watch src/index.ts）
pnpm build               # 编译到 dist/
pnpm start               # 跑 dist/
pnpm typecheck           # 主代码 tsc --noEmit
pnpm typecheck:examples  # examples 目录 tsc --noEmit
pnpm example:refined     # 跑 examples/run-novel-to-drama.refined.ts（3 模式对比）
pnpm perf:bench          # 跑 examples/perf-bench.ts（6 模块 × 3 mode 全量基准）
```

## 路由

```
GET  /health
POST /v1/orchestrate/novel-to-drama.refined
POST /v1/orchestrate/episode-batch.refined
POST /v1/orchestrate/style-transfer.refined
POST /v1/orchestrate/character-replace.refined
POST /v1/orchestrate/auto-translate.refined
POST /v1/orchestrate/multi-character-replace.refined
GET  /v1/orchestrate/runs
GET  /v1/orchestrate/runs/:runId
POST /v1/orchestrate/runs/:runId/cancel
POST /v1/orchestrate/runs/:runId/resume
```

## 配置

通过环境变量覆盖，详见 `src/config.ts`：
```
PORT=8087
AI_ROUTER_URL=http://localhost:8082
WORKFLOW_ENGINE_URL=http://localhost:8084
AI_HELPER_URL=http://localhost:8086
ASSET_SERVICE_URL=http://localhost:8085
AI_KEYS_SERVICE_URL=http://localhost:8083
AUTH_MODE=api-key
AUTH_API_KEY=dev-ai-orchestrator-key
```

## 设计原则

- **编排 ≠ 工作流**：workflow-engine 负责单步骤的 DAG，orchestrator 负责跨工作流的串联
- **失败可恢复**：每个 runId 有完整快照，resume 时从失败节点继续
- **成本透明**：每步记录 cost/quota，run 结束返回详细账单
- **零外部依赖**：除 5 个 HTTP 客户端外，不直连 DB/Redis，全部走服务间调用
- **W5 精修原则**：复用 W3 pipeline，refined 版本用相同 step 名 + 新增 preset/cache/batch 装饰，不重写核心
