# 分镜 P2–P4 代码层验证报告（#94 · 离线）

> ⚠️ 环境限制：本 WorkBuddy 沙箱**无外网出口**（已验证 Google / Cloudflare 1.1.1.1 / apihub.agnes-ai.com 均 TCP 超时），无法在此实跑 Agnes。以下为对 `StoryboardEditorView.vue` 中 P2–P4（含 P0/P1/P6）提示词构建逻辑的**静态验证**，确认各项已正确接入分镜生成链路。实跑出图/视频确认一致性需在老板**本地有网机器**执行（见文末命令）。

## 验证对象
- 文件：`apps/web/src/views/create/StoryboardEditorView.vue`
- 核心函数：`buildContentArray()`（1741 起）+ 配套 block 构造器
- 配套：`vue-tsc` 已验证该文件 **0 类型错误**

---

## P0 速度感知（解决"慢镜头感"）
- `applyCamSpeed()`（1075）：`normal` 不加任何缓词；仅 `slow-motion` 才用 `slowly`；`static/handheld/steadicam` 自带运动质感不加前缀。避免整片慢动作。✅

## P1 全局制作规范（抑制跨镜头风格/色调漂移）
- `generateGlobalDirective()`（1683）：基于 风格+场景+角色+世界观 用 DeepSeek 生成贯穿全剧规范 JSON（styleLock/colorTone/mood/constraints/ambientSound）。
- `formatGlobalDirective()`（1667）→ 每个镜头 prompt 开头复用 `gdAnchor`（1929）。✅

## P2 分镜脚本重构（景别 × 运镜 × 转场 + 8 要素）
`buildContentArray` 旧格式分支（1786+）逐项注入：
- 景别：`shotTypeMap`（1041）+ 镜头角度 `cameraAngleMap`（1084）/ 中文 `viewAngleMap`（1840）✅
- 运镜：`camMoveMap`（1051）+ 多段 `cameraActions` → `buildCameraDescription`（1826）✅
- 转场：`transitionMap`（1113）注入（1878）✅
- 8 要素补充：微表情（1852）、站位（1857）、空间锚点（1862）、对白双引号包裹（1867，Seedance 口型同步）、旁白/音效（1872）、节奏 `pacingMap`（1876）、动作速度 `actionSpeedMap`（1877）✅
- 镜头差异化指令（景别/角度/运镜）提取并提到高权重前部（1911–1932），让每个镜头"不一样"✅

## P3 参考图策略（大头照 + 全身照，禁三视图/多视图）
- `REFERENCE_VIEW_ORDER = ['front-upper','front-full']`（1627）、`MAX_REF_IMAGES_PER_SHOT = 5`（1629）✅
- 按景别动态选主参考图：宽镜头→全身照优先，其他→大头照优先（1994–1998）✅
- **Headshot Bookend**：大头照重复放参考数组末尾，给面部信号最大权重（2021–2030）✅
- **人脸关键镜**（特写/近景）跳过场景图，防场景图抢注意力导致人脸漂移（2032–2046）✅
- 图片模式三重锁定：`SAME EXACT PERSON` → `EXACT IDENTICAL FACE FEATURES` → `HEADSHOT reference`（1940–1964），首尾各强调一次（1963）✅

## P4 约束词块 + 提示词压缩
- `buildConstraintBlock()`（1635）：无字幕 / 无水印 / 风格锁定 / 防双胞胎，每镜头固定注入（1966）✅
- `compressNarrative()`（1649）：超长原文压到 ~4500 字，优先保留含对白引号的句子，规避 v4-pro 长 prompt 超时 ✅

## P6 文戏/武戏分模式
- 视频：`buildActionModeBlock()`（1731）→ 武戏运镜跟随动作节奏/攻防切机位/主体焦点，文戏静置呼吸（1969）✅
- 图片：武戏动态姿势/紧张构图/肢体张力，文戏静态平稳/亲密构图/表演呼吸（1972–1978）✅

---

## 结论
- **代码层**：P0–P6 全部正确接入分镜生成链路，`StoryboardEditorView.vue` 类型 0 错误（vue-tsc 已验证）。
- **待老板本地实跑**：用 Agnes 出图/视频，确认①连续 ≥3 镜头同一角色面部一致（无千镜一面/双胞胎）②成片无字幕水印 ③运镜自然。

## 本地实跑命令（在有网开发机 git bash 执行）
```bash
# 最轻量：直接验 Agnes 余额 + 生成 1 张测试图，打印 HTTP 状态码与图片 URL
cd D:/ManhuaWorks && node scripts/agnes_smoke.mjs

# 或起全套服务后在 UI 跑一次完整分镜生成：
bash start-all.sh
```
把 `agnes_smoke.mjs` 的输出（尤其 `HTTP 200` + `image URLs`）或 UI 生成结果/截图发我，我据此确认 P2–P4 一致性效果与遗留 blocker。
