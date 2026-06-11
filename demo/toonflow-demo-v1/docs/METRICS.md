# METRICS — 性能数据

> 这次 demo 跑通这一把的全部性能/成本/产物数据。
> 数据来源：`outputs/metrics.json` + `logs/run-final.log`。

---

## 1. 端到端耗时

| 阶段 | 耗时 | 说明 |
|---|---|---|
| ffmpeg 拼 60s mp4 | 0.87s | 5 段 12s 渐变蓝，libx264 ultrafast |
| 加载小说文本 + 截 01-input | 0.08s | 191 字符 |
| bridge.start() 启动 | 0.04s | POST /v1/orchestrate/novel-to-drama |
| Pipeline 7 步推进（mock） | 14.11s | 7 步 × ~1.5s/step + 间隔 |
| waitForResult 拿到 done | 16.20s | 第 12 轮 poll 拿到 success |
| 截 02-running + 03-done | 0.09s | drawbox 生成 PNG |
| **总耗时** | **16.29s** | 全程 bridge 端到端 |

> mock 7 步推进的 1.5s/step 是为了 demo 演示清晰可观察；真实 pipeline 单步从 2s 到 60s 不等（image-gen 最慢）。

---

## 2. 进度回调次数

```
progress events = 13
```

明细（按日志时间线）：

| # | 状态 | 进度 | 节点 |
|---|---|---|---|
| 1 | running | 5% | storyboard |
| 2 | running | 5% | storyboard |
| 3 | running | 10% | storyboard |
| 4 | running | 20% | character |
| 5 | running | 25% | scene |
| 6 | running | 40% | image-gen |
| 7 | running | 50% | image-gen |
| 8 | running | 55% | tts |
| 9 | running | 70% | video-gen |
| 10 | composing | 93% | compose |
| 11 | composing | 99% | compose |
| 12 | done | 100% | compose |
| 13 | done | 100% | (final) |

> 13 次回调 = 12 次轮询 + 1 次终态确认。
> 真实场景下 5 状态 + 9 个百分比档 = 14 个理论事件点，13 实际回调是因为 step 间 transition 太快被合并。

---

## 3. 成本（mock）

| 步骤 | 模拟成本 | 真实成本（W3 上线后） |
|---|---|---|
| storyboard | $0.02 | $0.01 - $0.05（DeepSeek V3 / GPT-4o-mini） |
| character | $0.04 | $0.03 - $0.08（GPT-4o vision 角色抽取） |
| scene | $0.05 | $0.02 - $0.06（场景聚类） |
| image-gen | $0.12 | $0.08 - $0.20（5 张 SDXL / 火山豆包） |
| tts | $0.04 | $0.01 - $0.10（edge-tts 免费 / ElevenLabs） |
| video-gen | $0.12 | $0.30 - $1.50（5 段可灵 / runway） |
| compose | $0.03 | $0.02 - $0.05（ffmpeg 合成） |
| **合计** | **$0.42** | **$0.50 - $2.00 / 集** |

> mock 用了 by-provider=mock 全归一档，便于 demo 算账。真实场景 by-provider 会拆 image / tts / video / compose 4 类。

---

## 4. 产物文件大小

| 文件 | 大小 | 类型 | 校验 |
|---|---|---|---|
| `demo-episode-01.mp4` | 70.9 KB (72,581 B) | H.264 1280×720 60s | sha256: `52a75e4097780666291f3baa1fd7fe038fd35d1fec61e1c6ea280aabe3da7767` |
| `demo-episode-01.mp4.sha256` | 86 B | ASCII 校验和文件 | - |
| `metrics.json` | 697 B | JSON 性能数据 | - |
| `01-input.png` | 25.3 KB (25,961 B) | 1280×720 PNG | drawbox gradient + 0/5 进度条 |
| `02-running.png` | 31.5 KB (32,248 B) | 1280×720 PNG | drawbox gradient + 3/5 进度条 |
| `03-done.png` | 21.5 KB (22,041 B) | 1280×720 PNG | drawbox gradient + 5/5 进度条 |
| `run.log` | ~3 KB | 文本 | 46 行 |
| `run-final.log` | ~3 KB | 文本 | 46 行 |
| `mock-orch.log` | ~2 KB | 文本 | 22 行 |

**总产出**：~210 KB（含所有文件）

---

## 5. 桥接层关键指标

| 指标 | 值 | 来源 |
|---|---|---|
| HTTP 请求次数 | 12 次（1 POST + 11 GET） | `logs/run-final.log` 抓 `[orch-http]` |
| 平均 poll 间隔 | 1.5s | `pollIntervalMs: 1500` |
| Bridge.run 起 → 等到 done | 16.2s | metrics.json bridgeLatencyMs |
| Bridge 纯等待（pipeline 推完） | 14.1s | metrics.json totalLatencyMs |
| Bridge 自身开销 | ~2.1s | 启动 + mapper + 落盘 |
| 状态机收敛 | success → done | snap.status → ToonflowStatus |

---

## 6. 复现这些数据

```bash
# 重新跑一遍
cd D:\ManhuaWorks\demo\toonflow-demo-v1
bash setup.sh --bg
export ORCHESTRATOR_URL=http://127.0.0.1:18090
export MOCK_STEP_INTERVAL_MS=1000
node --import tsx run.ts

# 看新数据
cat outputs/metrics.json
```

期望 `metrics.json` 形态（不同 runId / jobId / 时间戳）：

```json
{
  "demoId": "toonflow-demo-v1",
  "pipelineName": "novel-to-drama",
  "workflowId": "wf-demo-001",
  "jobId": "<新 nanoid>",
  "runId": "run_<新 uuid 前 8 位>",
  "status": "done",
  "finalVideoUrl": "http://127.0.0.1:18090/output/demo-episode-01.mp4",
  "costUsd": 0.42,
  "totalLatencyMs": 14100,    // 上下 ±2s
  "bridgeLatencyMs": 16200,   // 上下 ±2s
  "shotCount": 5,
  "audioUrl": "http://127.0.0.1:8090/output/narration.mp3",
  "progressEvents": 13,
  "mp4Path": ".../demo-episode-01.mp4",
  "mp4SizeBytes": 72581,      // 完全一致（mock 拼法固定）
  "mp4Sha256": "52a75e4097780666291f3baa1fd7fe038fd35d1fec61e1c6ea280aabe3da7767",  // 完全一致
  "inputLength": 196,
  "timestamp": "<新 ISO 时间>"
}
```

> mp4SizeBytes / mp4Sha256 每次跑都一致（mock 拼法固定），其余字段每次都不同（jobId / runId / 时间戳）。

---

## 7. 跟真实 pipeline 的差异

| 维度 | demo (mock) | 真实 (W3 上线后) |
|---|---|---|
| 单集耗时 | 14-22s | 3-15 min（受 video-gen 主导） |
| 单集成本 | $0.42（恒定） | $0.50-$2.00（受 LLM/vision 选型影响） |
| 缓存命中 | N/A | 30-70%（相同文本片段可复跑） |
| 并发峰值 | 1（顺序 step） | 5-12（image-gen 5 张并发） |
| mp4 画质 | 纯色占位 | 真实 SDXL / 火山豆包 + 配音 |
| 失败率 | 0% | 5-15%（provider 限流 / 网络） |

> demo 价值：验证桥接层接口契约 + 端到端时序 + 状态机收敛，不替代真实生成质量评估。
