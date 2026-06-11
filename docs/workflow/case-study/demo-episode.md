# Demo 案例：1 集 5 镜头 60s

> W3 交付的 demo 完整跑通记录。  
> 目的：让合作伙伴 5 分钟看到"一段小说进来，一段成片出去"。

---

## 0. 准备

- 输入文本：`apps/demo/demo-input/chapter-001.txt`（约 800 字，校园恋爱片段）
- 角色库：预置 2 个角色（女主 / 男主）
- 场景库：预置 2 个场景（教室 / 天台）
- 风格：shoujo-pastel-v2

---

## 1. 输入阶段（30s）

- 拖入 chapter-001.txt
- 选角色 [char-female-001, char-male-001]
- 选场景 [scene-classroom, scene-rooftop]
- 风格：shoujo-pastel-v2
- 点 "Run Decompose"

**产出**：`services/ai-orchestrator/jobs/demo-001/input.json`

---

## 2. 分解阶段（1min）

- Beat Splitter 拆出 5 个 beat
- Shot Composer 拆出 5 个 shot：

| Shot | Beat | Camera | 提示词（节选） | 时长 |
|------|------|--------|------------|------|
| s1 | 教室窗边 | medium | "girl looking out window, sunset light, soft focus" | 12s |
| s2 | 走廊 | wide | "school corridor, after class, students passing" | 10s |
| s3 | 天台 | full | "boy standing on rooftop, wind, backlight" | 14s |
| s4 | 对视 | close-up | "two faces close, eye contact, soft pink tone" | 16s |
| s5 | 远景 | wide | "rooftop silhouette, sunset, two figures" | 8s |

总时长：60s ✅

---

## 3. 生成阶段（约 12min，Standard 模式）

每镜头走 novel-to-drama pipeline：

| Shot | 模型 | 耗时 | 成本 |
|------|------|------|------|
| s1 | Flux-Dev + SVD-XT | 1min48s | ¥3 |
| s2 | Flux-Dev + SVD-XT | 1min52s | ¥3 |
| s3 | Flux-Dev + SVD-XT | 2min01s | ¥3 |
| s4 | Flux-Dev + SVD-XT | 2min15s | ¥3 |
| s5 | Flux-Dev + SVD-XT | 1min39s | ¥3 |
| **合计** | | **~12min** | **¥15** |

**一致性抽检**：5/5 通过（CLIP > 0.78 角色相似度）

---

## 4. 合成阶段（2min）

- 背景音：钢琴轻音乐（BGM 库 #piano-001）
- 旁白：中文 TTS（女声，温柔）
- 字幕：自动烧死，粉白配色（shoujo-pastel 风格）
- 转场：s1→s2 硬切，s2→s3 渐黑 0.5s，s3→s4 翻页 1.0s，s4→s5 模糊化入 1.0s
- QA：音画同步通过（漂移 23ms）

**产出**：`apps/demo/demo-output/demo-001_composed.mp4`

---

## 5. 导出阶段（30s）

一键 zip 出 3 套：

```
demo-001_export/
  ├── demo-001_zh-CN_9x16.mp4     (抖音版 1080×1920)
  ├── demo-001_zh-CN_16x9.mp4     (B 站版 1920×1080)
  ├── demo-001.zh-CN.srt
  ├── cover.jpg
  └── MANIFEST.json
```

---

## 6. 端到端

- **总耗时**：~16 分钟
- **总成本**：¥15
- **总产出**：1 集 60s 漫改 + 2 个平台版本 + 字幕 + 封面
- **人工介入**：0 次（preset 复用 + 全自动）

---

## 7. 文件链接

| 阶段 | 路径 |
|------|------|
| 输入文本 | `apps/demo/demo-input/chapter-001.txt` |
| 合成母带 | `apps/demo/demo-output/demo-001_composed.mp4` |
| 导出包 | `apps/demo/demo-output/demo-001_export.zip` |
| 日志 | `apps/demo/logs/demo-001.log` |
| 工作流面板 | `apps/studio/src/views/WorkflowDesignerView.vue` |
| 编排服务 | `services/ai-orchestrator/jobs/demo-001/` |

---

## 8. 推广用途

- 给客户演示"小说 → 漫改"端到端能力
- 投资人看板上"产品已完成端到端 demo"的核心证据
- 内部 baseline：所有新功能必须先在这个 demo 上不破回归
