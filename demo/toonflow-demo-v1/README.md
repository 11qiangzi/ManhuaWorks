# toonflow-demo-v1

> **W5 任务 4：Toonflow demo v1** —— 端到端演示
>
> 200 字小说片段 → 陆流光 toonflow-bridge → mock ai-orchestrator → 60s mp4
>
> 跑通证据：`outputs/demo-episode-01.mp4` + sha256 + 3 时刻截图 + metrics.json

---

## 🎬 跑通的 1 集

| 项 | 值 |
|---|---|
| **剧本** | `inputs/demo-novel.txt`（191 个非空白字符，科幻短篇「启明号 · 重返地球」） |
| **桥接层** | `@manhuaworks/toonflow-bridge` v0.1.0（陆流光 W5 交付） |
| **目标服务** | mock ai-orchestrator（严格按 bridge 客户端契约实现，替代真 8087） |
| **完成态** | `status=done`，5 shots，cost=$0.42，bridge 耗时 16.2s |
| **成品** | `outputs/demo-episode-01.mp4`（1280×720 H.264，60.00s，70.9 KB） |
| **校验和** | `outputs/demo-episode-01.mp4.sha256`（sha256 = `52a75e4…7767`） |

---

## 🔁 桥接流程（5 步）

```
  200 字小说片段                    ToonflowWorkflow
  ┌──────────────┐                 ┌───────────────────────┐
  │ demo-novel   │  ── inputs ──▶  │ 7 节点：              │
  │   .txt       │                 │  input_text           │
  └──────────────┘                 │  generate_storyboard  │
                                   │  image_diffusion      │
                                   │  tts                  │
                                   │  video_animate        │
                                   │  compose              │
                                   │  output_mp4           │
                                   └───────────┬───────────┘
                                               │
                ┌──────────────────────────────┘
                ▼
  ┌────────────────────────────────────────────────────┐
  │ 1. bridge.start()                                  │
  │    POST /v1/orchestrate/novel-to-drama             │
  │    → 拿到 jobId + runId                            │
  │                                                    │
  │ 2. 订阅 onProgress（每 1.5s 一次）                  │
  │    GET /v1/orchestrate/runs/:runId                 │
  │    → 17 轮进度（pending → running → composing → done）│
  │                                                    │
  │ 3. waitForResult() 等终态                          │
  │    → status=success                                │
  │    → finalVideoUrl = …/demo-episode-01.mp4         │
  │                                                    │
  │ 4. mapper 折叠                                     │
  │    novelToToonflow() 把 RunSnapshot + output 折叠  │
  │    成 ToonflowJobResult（5 shots / audio / cost）  │
  │                                                    │
  │ 5. 落盘 + sha256 + metrics.json                    │
  └────────────────────────────────────────────────────┘
```

---

## 📦 产出物

| 路径 | 说明 | 大小 |
|---|---|---|
| `outputs/demo-episode-01.mp4` | 真 60s 漫剧（5 段色彩演示，H.264 1280×720） | 70.9 KB |
| `outputs/demo-episode-01.mp4.sha256` | sha256 校验和文件 | 86 B |
| `outputs/metrics.json` | 完整性能数据（耗时 / 成本 / shot 数 / sha256） | ~700 B |
| `outputs/screenshots/01-input.png` | 截图：输入已加载（深空蓝 + 0/5 进度） | 25.3 KB |
| `outputs/screenshots/02-running.png` | 截图：WS 进度推送中（中蓝 + 3/5 进度） | 31.5 KB |
| `outputs/screenshots/03-done.png` | 截图：完成（亮蓝 + 5/5 进度） | 21.5 KB |
| `logs/run-final.log` | 完整执行日志（46 行，16s 跑完） | ~3 KB |
| `logs/run.log` | 简易版执行日志 | ~3 KB |
| `logs/mock-orch.log` | mock 端日志（按 step 推 7 阶段） | ~2 KB |
| `docs/REPLAY.md` | 回放说明（装环境 + 跑 + 预期） | - |
| `docs/METRICS.md` | 性能数据详解 | - |
| `docs/SCREENSHOT-GUIDE.md` | 3 时刻截屏指南 | - |

---

## ⚙️ 设计取舍

### 为什么用 mock ai-orchestrator？

W3 真实 ai-orchestrator 跑在 8087 端口，但需要 ai-keys / asset / workflow-engine 等其它 W3/W4 服务做依赖。**5 服务全起需要 30+ 分钟**，W5 demo 阶段不必要。

桥接层（陆流光交付）只关心**一个 HTTP 契约**：
- `POST /v1/orchestrate/novel-to-drama`
- `GET /v1/orchestrate/runs/:runId`
- `POST /v1/orchestrate/runs/:runId/cancel`

mock 严格按这 3 个端点实现，进度推进按 1.5s/step，7 步全跑完。**桥接层一行没改，全用陆流光代码**。

### 真实 5 服务怎么起？

见 `docs/REPLAY.md`「附录 A：真实服务启动」。把 `ORCHESTRATOR_URL` 指向 8087 即可，run.ts 一行不用改。

### 数据 mock 范围

| 步骤 | mock？ | 真实接入方式 |
|---|---|---|
| 7 步 pipeline 推进 | ✅ mock（按时序） | ai-orchestrator 真跑会调各 AI provider |
| `imageUrls` / `videoUrls` / `audioUrl` | ✅ mock URL 字符串 | 真跑会从 asset-service 取 OSS URL |
| 60s mp4 | ✅ mock（ffmpeg 拼 5 段色彩） | 真跑 compose 步骤会 ffmpeg 拼接 |

mock mp4 是 5 段 12s 渐变蓝（1280×720 H.264），ffprobe 验证 `Duration: 00:01:00.00`，符合 60s 规格。

---

## 🚀 一键跑

```bash
# 1. 起 mock（后台）
bash setup.sh --bg

# 2. 跑 demo
npm start
# 或 node --import tsx run.ts

# 3. 看产物
ls -la outputs/
# outputs/demo-episode-01.mp4          (70.9 KB)
# outputs/demo-episode-01.mp4.sha256
# outputs/metrics.json
# outputs/screenshots/01-input.png
# outputs/screenshots/02-running.png
# outputs/screenshots/03-done.png
```

回放详细步骤见 [`docs/REPLAY.md`](./docs/REPLAY.md)。

---

## 📊 性能数据（demo 跑通这一把）

| 指标 | 值 |
|---|---|
| Bridge 端到端耗时 | 16.2s |
| Pipeline 7 步推进 | 14.1s（mock） |
| Progress 回调次数 | 13 次 |
| Cost (mock 累加) | $0.42 |
| 5 shots / 1 audio | ✓ |
| 最终 mp4 大小 | 70.9 KB |
| mp4 时长 | 60.00s |
| mp4 分辨率 | 1280×720 |
| mp4 编码 | H.264 Constrained Baseline |
| mp4 sha256 | `52a75e4097780666291f3baa1fd7fe038fd35d1fec61e1c6ea280aabe3da7767` |

详见 [`docs/METRICS.md`](./docs/METRICS.md)。

---

## 🧠 关键决策记录

1. **不复用 toonflow-bridge 的 example 脚本**——它调 8087 真服务，demo 阶段 mock 即可。直接 import `ToonflowBridge` 写 run.ts 更清晰
2. **mp4 不用 drawtext**——fontconfig 没装，ffmpeg 烧字幕会报错；改用「色带 + 进度条块」做截图，零字体依赖
3. **端口用 18090 不用 8090**——8090 在本机有 Wondershare 残留进程占着（返回 501），18090 干净
4. **demo 不推 WS 回调**——`pushToToonflow: false`，因为没有真 Toonflow 端服务；只走 onProgress 回调

---

**完成时间**：2026-06-08 09:20
**W5 任务 4**：✅
