# 阶段 3 — 生成（Generate）

> **关键问题**：镜头 prompt 怎么变成图/视频？  
> **耗时**：5-30 分钟（单集 30-60 镜头，瓶颈在本阶段）  
> **核心**：6 个 pipeline × 3 档质量

---

## 6 个 Pipeline

| # | 名称 | 适用场景 | 输入 | 输出 |
|---|------|---------|------|------|
| 1 | **novel-to-drama** | 小说→漫改（主力） | 章节 txt | 完整漫改集 |
| 2 | **character-replace** | 已有画面换角色 | 视频/图 | 替换后视频 |
| 3 | **style-transfer** | 已生成画面换画风 | 视频/图 | 风格化视频 |
| 4 | **auto-translate** | 字幕/配音多语言 | 视频+字幕 | 多语言版 |
| 5 | **episode-batch** | 一本书出 N 集 | 整本 txt | N 集包 |
| 6 | **multi-character-replace** | 多角色批量换 | 视频+角色表 | 多角色版 |

---

## Pipeline 1：novel-to-drama（主力）

```
shots.json
  └─ [per shot] Prompt Optimizer (LLM)
       └─ Image Generator (SDXL / Flux)
            └─ Consistency Check (CLIP + 角色向量)
                 └─ Motion Generator (AnimateDiff / SVD)
                      └─ Upscaler (Real-ESRGAN)
```

每镜头 6 步，3 档质量对应不同模型选择。

---

## Pipeline 2：character-replace

```
原视频 + 目标角色参考图
  └─ Face/Body Replacer (IP-Adapter + ControlNet)
       └─ 时序一致性插帧
            └─ 边缘羽化
                 └─ 合成
```

**典型用例**：把 demo 里的临时角色换成正式 IP 角色。

---

## Pipeline 3：style-transfer

```
原视频
  └─ 风格迁移 (StyleShot / IP-Adapter)
       └─ 关键帧锁定
            └─ 帧间传播
                 └─ 后处理（防抖）
```

12 种预设风格（详见 04-compose.md），可叠加自定义。

---

## Pipeline 4：auto-translate

```
原视频 + 原始字幕
  └─ ASR 校验 / 翻译 (LLM)
       └─ TTS 配音 (12 语言)
            └─ 口型同步 (Wav2Lip / VideoReTalking)
                 └─ 新字幕烧录
```

**关键能力**：保留原声背景音 + 替换对白。

---

## Pipeline 5：episode-batch

```
整本书 txt
  └─ 章节切分 (规则 + LLM)
       └─ [并发 N] novel-to-drama pipeline
            └─ 集间一致性检查
                 └─ 集封面生成
                      └─ 打包
```

**并发数**：默认 3（避免限流），可调。

---

## Pipeline 6：multi-character-replace

```
视频 + 角色表 (k:v 多对)
  └─ [per 角色] character-replace
       └─ 区域冲突解决 (z-order 排序)
            └─ 一次合成
```

**用例**：同人/二创多角色替换。

---

## 3 档质量模式

| 模式 | 图像模型 | 视频模型 | 单镜头耗时 | 单集成本 | 用途 |
|------|---------|---------|----------|---------|------|
| **Draft** | SDXL-Turbo | AnimateDiff-Light | ~30s | ¥0.5 | 内部审 |
| **Standard** | Flux-Dev | SVD-XT | ~2min | ¥3 | B 端 |
| **Cinematic** | Flux-Pro + Upscale | CogVideoX-5B | ~6min | ¥10 | S 级 |

切换在 WorkflowDesignerView 「Quality Gate」节点。

---

## 失败恢复

- 单 shot 失败 → 重试 3 次 → 跳过 + 标红 → 进 QA 池
- 整 pipeline 失败 → 保留已生成产物 → 重跑从断点续
- 关键决策：见 [faq.md §5](./faq.md)

---

## 节点画布

12 类节点中本阶段占用 **7 类**：

- `Prompt Optimizer`
- `Image Generator` (Draft/Standard/Cinematic 三选)
- `Consistency Check`
- `Motion Generator`
- `Upscaler`
- `Quality Gate`
- `Failover Handler`

---

## 产出物

- `services/ai-orchestrator/jobs/{episode_id}/frames/` — 原始帧
- `services/ai-orchestrator/jobs/{episode_id}/clips/` — 镜头视频
- `services/ai-orchestrator/jobs/{episode_id}/manifest.json` — 元数据

详细决策树见 [diagram/pipeline-detail.mmd](./diagram/pipeline-detail.mmd)
