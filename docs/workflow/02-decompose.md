# 阶段 2 — 分解（Decompose）

> **关键问题**：一段小说怎么变成 5 个镜头？  
> **耗时**：1-3 分钟  
> **核心**：章节→分镜→镜头 三层拆解

---

## 三层拆解

```
章节（Chapter, 200-3000 字）
  └─ 分镜（Beat, 1-3 句一段, 8-15 个/章节）
       └─ 镜头（Shot, 一个画面, 4-8 个/分镜）
```

| 层 | 颗粒度 | 工具 | 产出 |
|----|------|-----|------|
| 章节 | 1 集 | 输入 | 原始文本 |
| 分镜 | 1-3 句 | Beat Splitter（LLM） | beat_id + 摘要 |
| 镜头 | 单画面 | Shot Composer（LLM） | shot_id + 提示词 + 时长 |

---

## 算法路径

1. **Beat Splitter**（用 cheap LLM，gpt-4o-mini 级）
   - 输入：章节 txt
   - 输出：8-15 个 beat（含时间锚点）
2. **Shot Composer**（同模型）
   - 输入：单个 beat
   - 输出：4-8 个 shot（含运镜：远/中/近/特写/俯/仰）
3. **角色/场景匹配**（向量化检索）
   - 用 beat 文本对角色库/场景库做 embedding 相似度
   - 阈值 > 0.78 才锁定，否则标 "AI 自由发挥"

---

## 节点画布上的对应

W5 WorkflowDesignerView 12 类节点中，与本阶段相关的：

- `Beat Splitter` (1)
- `Shot Composer` (1)
- `Character Matcher` (1)
- `Scene Matcher` (1)
- `Embed Index` (1)

合计 5 个节点可拖拽组成本阶段流程。

---

## 设计师视角的"我需要做什么"

- 几乎**全自动**。看完分镜表，点 "Approve & Generate"
- 觉得某 beat 拆得不对？点该 beat → 改一行提示词 → 重新拆
- 觉得某 shot 角色匹配错？手动换角色

---

## 决策点

```
分镜数量？
├── 太少（<6）→ 提示"建议扩写"
├── 适中（8-15）→ 默认进入下一阶段
└── 太多（>20）→ 提示"建议合并"

角色匹配？
├── 全部锁定（>0.78）→ 一致性 100%
├── 部分自由（<0.78）→ 标黄，设计师可改
└── 全部自由 → 警告"风格可能漂移"
```

---

## 产出物

```json
{
  "episode_id": "ep-001",
  "shots": [
    {
      "shot_id": "s1",
      "beat_id": "b1",
      "prompt": "wide shot, sunset rooftop, girl standing...",
      "camera": "wide",
      "duration_s": 4,
      "characters": ["char-001"],
      "scene": "scene-001"
    }
  ]
}
```

> 落到 `services/ai-orchestrator/jobs/{episode_id}/shots.json`  
> 通常 1 集 ≈ 30-60 个 shot
