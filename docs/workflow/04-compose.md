# 阶段 4 — 合成（Compose）

> **关键问题**：零散镜头怎么变成可看的连续视频？  
> **耗时**：2-5 分钟  
> **核心**：音频 + 字幕 + 转场 + 风格 + 语言

---

## 合成栈

```
[镜头视频] + [音频轨] + [字幕轨] + [转场]
              ↓
        最终成片
```

---

## 1. 音频（Audio）

| 轨道 | 来源 | 时长控制 |
|------|------|---------|
| 背景音乐 | BGM 库（30+ 风格） | 总时长 ±2s |
| 旁白 | TTS（12 语言） | 按分镜 |
| 对白 | TTS / 原音替换 | 按 beat |
| 环境音 | 音效库 | 按 scene |

12 语言 TTS 引擎：见 [03-generate.md §Pipeline 4](./03-generate.md)

---

## 2. 字幕（Subtitle）

- 自动从原文/对白生成
- 支持：烧死 / 软字幕（外挂 .srt）
- 样式：12 套预设（位置/字体/描边/阴影）
- 自动断句（按 18 字/行 中日韩，按 42 字符 西文）

---

## 3. 转场（Transition）

镜头之间默认转场规则：

| 上→下镜头 | 默认转场 | 可改 |
|----------|---------|------|
| 同场景 | 硬切 / 0.2s 闪白 | ✅ |
| 异场景 | 0.5s 渐黑 | ✅ |
| 时间跳跃 | 1.0s 翻页 | ✅ |
| 回忆/想象 | 1.0s 模糊化入 | ✅ |

设计师可在 WorkflowDesignerView 「Transition」节点覆盖。

---

## 4. 12 风格预设

漫改最常用画风（按 W5 已交付预设库）：

1. **shoujo-pastel** — 少女漫粉彩
2. **shonen-ink** — 少年漫墨线
3. **seinen-grit** — 青年漫粗粝
4. **webtoon-clean** — 韩式条漫
5. **manhua-xianxia** — 国漫仙侠
6. **watercolor-soft** — 水彩柔光
7. **lineart-mono** — 黑白线稿
8. **cinema-anamorphic** — 电影宽幅
9. **ghibli-warm** — 吉卜力暖色
10. **cyberpunk-neon** — 赛博朋克霓虹
11. **retro-90s** — 90 年代复古
12. **noir-bw** — 黑白 noir

切换在「Style Picker」节点（与阶段 1 联动，但可在合成阶段后置覆盖）。

---

## 5. 12 语言字幕/配音

| 语种 | TTS | 字幕 | 口型同步 |
|------|-----|------|---------|
| 中（简/繁） | ✅ | ✅ | ✅ |
| 英 | ✅ | ✅ | ✅ |
| 日 | ✅ | ✅ | ✅ |
| 韩 | ✅ | ✅ | ✅ |
| 西/法/德/俄/阿/越/泰/印尼 | ✅ | ✅ | ⚠️ 弱 |

⚠️ = 口型同步质量一般，可手动校准。

---

## 6. QA 抽检

合成前自动跑：

- 时长对齐（总时长 ≈ 预期 ±5%）
- 音画同步（音轨漂移 < 100ms）
- 字幕断句（无超长行）
- 转场冲突（无重叠）

任意一项不过 → 回阶段 3 重跑或人工介入。

---

## 节点画布

12 类节点中本阶段占用 **3 类**：

- `Audio Mixer`
- `Subtitle Burner`
- `Transition Engine`

---

## 产出物

- `services/ai-orchestrator/jobs/{episode_id}/composed.mp4` — 合成后母带
- `services/ai-orchestrator/jobs/{episode_id}/subtitles.srt` — 软字幕
- `services/ai-orchestrator/jobs/{episode_id}/chapters.json` — 章节标记
