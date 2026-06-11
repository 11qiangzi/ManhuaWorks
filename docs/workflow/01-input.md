# 阶段 1 — 输入（Input）

> **关键问题**：漫改从哪儿开始？  
> **耗时**：2-5 分钟（人工选择）/ 30 秒（用上次 preset）

---

## 4 类输入

| 输入 | 格式 | 数量建议 | 作用 |
|------|------|---------|------|
| **小说片段** | .txt / .md / 在线粘贴 | 200-3000 字/集 | 剧本来源 |
| **角色** | 参考图 + 名字 + 简介 | 1-8 个主角 | 角色一致性 |
| **场景** | 参考图 + 地点描述 | 2-6 个主场景 | 场景一致性 |
| **风格** | 预设名 or 参考图 | 1 个 | 画风基调 |

---

## 界面（WorkflowDesignerView 「Input」分组）

- **左上 1 节点**：「Text Source」 — 拖入 txt / 粘贴 / 选已有章节
- **左中 1 节点**：「Character Library」 — 来自 `apps/studio/src/views/` 创作者工作台的 5 个 view 之一
- **左下 1 节点**：「Scene Library」 — 同上
- **右侧 1 节点**：「Style Picker」 — 12 预设 + 自定义

（截图占位：实际接入时挂 `apps/studio/src/views/WorkflowDesignerView.vue` 的 panel 截图。）

---

## 设计师视角的"我需要做什么"

1. 把章节 txt 拖进 Text Source
2. 在 Character Library 选 1-8 个角色（首次需上传参考图；之后用 preset）
3. 在 Scene Library 选 2-6 个场景
4. Style Picker 选 1 个风格 preset
5. 点 "Run Decompose" → 进入阶段 2

---

## 关键设定

- **BYOK 模型**：每节点的模型选择走 Keychain，不上传业务数据
- **Preset 复用**：上次跑过的 (角色+场景+风格) 组合可保存为 Preset，下次一秒导入
- **多语言输入**：支持中/英/日/韩/西/法/德/俄/阿/越/泰/印尼 12 种原文

---

## 决策点

```
小说来源？
├── 自己上传 → 拖入 Text Source
├── 已有书库 → 选 preset
└── 一键试看 → 用 demo chapter（apps/demo/inputs/）

角色参考图？
├── 已有 → 从 Library 选
├── 需要生成 → 走角色创建 pipeline
└── 不重要 → 跳过（用 AI 自由发挥）
```

---

## 产出物

进入阶段 2 的数据包（JSON）：

```json
{
  "episode_id": "ep-001",
  "text": "...",
  "characters": ["char-001", "char-002"],
  "scenes": ["scene-001", "scene-002"],
  "style": "shoujo-pastel-v2",
  "lang": "zh-CN"
}
```

> 落到 `services/ai-orchestrator/jobs/{episode_id}/input.json`
