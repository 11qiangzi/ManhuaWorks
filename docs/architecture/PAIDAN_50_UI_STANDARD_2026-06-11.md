# 派单 50: UI 标准化整合报告

> 派单: #50 | 日期: 2026-06-11 | 状态: ✅ 完成
> 组长: 虾总助 | 执行: 林染 + 陆流光 + 赵千影
> 依据: ad-designer (v1) + ad-creative (v1.1.0) 双技能全面研读

---

## 一、执行摘要

基于 ad-designer (12550 bytes) 和 ad-creative (13579 bytes) 两个技能文件的完整研读，提取了以下核心设计资产并完成标准化:

| # | 负责 | 交付物 | 路径 | 大小 |
|---|------|--------|------|------|
| 1 | 林染 | UI 组件库标准 | `docs/design/UI_STANDARD_2026-06-11.md` | 10,690 bytes |
| 2 | 陆流光 | 设计模板标准 | `docs/design/DESIGN_TEMPLATES_2026-06-11.md` | 10,373 bytes |
| 3 | 赵千影 | Mockup 规范 | `docs/design/MOCKUP_STANDARD_2026-06-11.md` | 15,548 bytes |
| **合计** | | | | **36,611 bytes** |

---

## 二、技能研读总结

### ad-designer (12550 bytes)
提取了 5 步工作流 + 7 项自检体系:
- **Brand Bible 6 字段**: primary color, accent, font style, imagery, layout pattern, tone
- **Prompt 8 字段**: subject → setting → mood → composition → lighting → color → style → avoid
- **4 种比例**: 1:1 (1080×1080) / 9:16 (1080×1920) / 16:9 (1920×1080) / 4:5 (1080×1350)
- **Draft-first**: 1K 草稿 → self-review → 迭代 (≤3 次) → 4K 终稿
- **Self-Review 7 项**: 文案准确 / 无幻觉 logo / 比例正确 / 色彩对齐 / 质量过关

### ad-creative (13579 bytes)
提取了平台规范 + 角度策略 + 写作标准:
- **5 平台 Specs**: Google RSA / Meta / LinkedIn / TikTok / Twitter (字符限制)
- **8 种角度**: 痛点 / 结果 / 社交证明 / 好奇 / 对比 / 紧迫 / 身份 / 反常识
- **写作铁律**: 具体 > 模糊, 动词 > 名词, 数字 > 形容词, 变体不雷同
- **迭代流程**: 拉数据 → 分析赢家 → 生成新变体 → 验证规范 → 交付
- **常见错误**: RSA 标题无法独立理解 / 忽视字符限制 / 所有变体一个样

---

## 三、UI 组件库 (林染 · 5 核心组件)

完整规范: [UI_STANDARD_2026-06-11.md](./design/UI_STANDARD_2026-06-11.md)

| 组件 | 变体数 | 状态覆盖 | 关键设计规则 |
|------|--------|---------|-------------|
| **Button** | 4 (primary/secondary/ghost/danger) | 5 态 (default/hover/focus/disabled/loading) | CTA ≤12 字, 动词开头, 不用模糊词 |
| **Input** | 6 态 (+ hover/focus/error/success) | 6 态 | 字符限制从 platform specs 反推 (60/500/15) |
| **Card** | 4 (default/horizontal/compact/media) | 3 态 (default/hover/selected) | 标题 ≤25 字, 描述 ≤80 字, 16:9 hero |
| **Modal** | 5 尺寸 (sm/md/lg/xl/full) | — | Esc/遮罩/focus trap/body lock |
| **Toast** | 4 (success/error/warning/info) | 4 变体 | ≤25 字, 3s/4s/5s 时长, 最多 3 条堆叠 |

**设计 Token 体系** (CSS 变量):
- 品牌色: 10 级梯度 (50→900)
- 语义色: success/warning/danger/info
- 字体: sans (Inter/PingFang SC) + mono (JetBrains)
- 间距: 4px 倍数从 space-1 到 space-16
- 阴影: 4 级 (xs/sm/md/lg/xl)
- 圆角: 4px/6px/8px/12px

**QA 自检**: 从 ad-designer Self-Review 移植 7 项检查 (文案/视觉/尺寸/状态/色彩/无障碍/整体)

**五站适配**: web(官网) → admin(后台) → studio(创作) → ops(运营) → user-portal(用户端)

---

## 四、设计模板 (陆流光 · 3 大类)

完整规范: [DESIGN_TEMPLATES_2026-06-11.md](./design/DESIGN_TEMPLATES_2026-06-11.md)

### 4.1 Banner 横幅 (3 变体)

| 变体 | 构图 | 视觉重心 | 适用场景 |
|------|------|---------|---------|
| Banner-A: 产品 Hero | 黄金分割, 文案右 1/3 | 图 60% + 文 40% | 品牌推广 |
| Banner-B: 文案主导 | 居中, 大标题文字 | 文 70% + 图 30% | 促销/活动 |
| Banner-C: 社交证明 | Logo 墙 + 数据 + CTA | 信任元素 | 获客转化 |

**尺寸**: 4 种比例全支持 (1:1 / 9:16 / 16:9 / 4:5)
**文案**: 标题 ≤30 字, 描述 ≤50 字, CTA ≤12 字

### 4.2 落地页 (3 变体)

| 变体 | 结构 | 关键元素 |
|------|------|---------|
| LP-A: 产品注册 | Hero → 社交证明 → 功能 → CTA | Form inline + objection handling |
| LP-B: Lead Magnet | Hero → Form+Bullets → Trust Bar | 双向布局 (表单+价值点) |
| LP-C: 电商促销 | Hero → 紧迫感 → 评价 → FAQ | 倒计时/进度条/划线价 |

**铁律**: 兑现广告承诺 / 品牌一致 / F 型阅读 / 移动优先

### 4.3 海报 (3 变体)

| 变体 | 构图 | 特点 |
|------|------|------|
| Poster-A: 活动宣传 | 全幅出血 + 信息卡片 | 日期/地点/嘉宾 |
| Poster-B: 产品发布 | 对称, 产品居中 + 三栏亮点 | 视觉冲击力 |
| Poster-C: 品牌形象 | 大面积留白 + 一句话主张 | 极简 editorial |

**Banner vs Poster 核心差异**: 交互(可点击 vs 纯看)、信息密度(低 vs 中高)、生命周期(短 vs 长)

### 4.4 统一的品牌视觉语言 (6 字段)

```yaml
primary: "深海军蓝 #1A2E5A" → 主按钮/标题
accent: "暖琥珀 #F5A623" → CTA/高亮
bg: "暖米白 #FAF7F2" → 卡片/大底色
font: "bold geometric sans-serif" → 标题; "clean sans-serif" → 正文
imagery: "暖调 editorial photography" → 温暖/自信/亲和
layout: "minimal, whitespace-heavy" → 留白 > 填充
```

---

## 五、Mockup 规范 (赵千影 · 10 张)

完整规范: [MOCKUP_STANDARD_2026-06-11.md](./design/MOCKUP_STANDARD_2026-06-11.md)

### 5.1 Admin 站 6 张

| ID | 名称 | 布局 | 核心元素 |
|----|------|------|---------|
| M1 | 登录页 | 居中对称 | Logo + 表单 + 品牌氛围 |
| M2 | 仪表板 | 4 列 KPI + 2×2 图表 + 表格 | 数据可视化 |
| M3 | 列表页 | 表格 + 搜索/筛选/分页 | CRUD 标准 |
| M4 | 表单页 | 分区分组, 左标签 | 必填/选填/校验 |
| M5 | 详情页 | 两栏卡片 + 全宽日志 | 信息展示 |
| M6 | 设置页 | Tab 水平导航 | 危险操作醒目 |

### 5.2 Ops 站 4 张

| ID | 名称 | 布局 | 核心元素 |
|----|------|------|---------|
| M7 | 运营仪表板 | KPI + 趋势图 + TOP 10 表 | GMV/订单/客单价 |
| M8 | 广告管理 | Tab filter + 表格 + 状态标签 | 投放管理 |
| M9 | 素材库 | 响应式网格 (5/3/2 列) | 媒体卡片 |
| M10 | 报表导出 | 表单 + 预览 + 多格式 | 数据导出 |

### 5.3 品牌色系统

| 颜色 | Hex | 用途 | 来源 |
|------|-----|------|------|
| 深海军蓝 | #1A2E5A | 侧栏/主按钮/标题 | ad-designer primary |
| 暖琥珀 | #F5A623 | CTA/高亮/激活指示 | ad-designer accent |
| 暖米白 | #FAF7F2 | 主背景/卡片底 | ad-designer background |
| 功能绿 | #10B981 | 增长/成功/达标 | data-positive |
| 功能红 | #EF4444 | 下降/错误/告警 | data-negative |
| 功能灰 | #6B7280 | 持平/禁用/辅助 | data-neutral |
| 功能琥珀 | #F59E0B | 待处理/警告 | data-pending |
| 功能蓝 | #3B82F6 | 信息/链接 | data-info |

### 5.4 字体系统

| Token | 用途 | 字体 |
|-------|------|------|
| 中文正文 | 表单/表格/正文 | PingFang SC / Microsoft YaHei |
| 中英文标题 | 页面/卡片/Modal 标题 | PingFang SC Semibold |
| 数据/数字 | KPI/图表/金额 | DIN / JetBrains Mono |
| 代码 | 日志/API | JetBrains Mono / Consolas |

### 5.5 图表色板 (12 色, 数据可视化)

blue-500 / green-500 / amber-500 / red-500 / violet-500 / pink-500 / cyan-500 / orange-500 / lime-500 / teal-500 / indigo-500 / slate-500

---

## 六、跨报告交叉引用

| UI 组件 (林染) | 设计模板 (陆流光) | Mockup (赵千影) | 共同设计规则 |
|----------------|------------------|----------------|-------------|
| Button | Banner CTA 按钮 | M1 登录按钮 | CTA ≤12 字, 琥珀色, 具体动词 |
| Card | Poster 信息卡片 | M2 KPI 卡片 | 8px 圆角, 浅阴影, 留白呼吸 |
| Input | Landing Page form | M4 表单页 | 6 态覆盖, 左标签, 字数统计 |
| Modal | — | M8 编辑弹窗 | 5 种尺寸, Esc 关闭, focus trap |
| Toast | — | M3 操作反馈 | 4 变体, 3s 自动消失 |
| — | Banner 比例 | M9 素材卡片 | 1:1 / 16:9 / 4:5 三比例 |
| — | 品牌色系统 | M1-M10 全部 | 深海军蓝 + 暖琥珀 + 暖米白 |

---

## 七、实施路线图

### Phase 1: 本周 (6/11-6/13)
- [ ] 林染: 用 UI_STANDARD 搭建组件库 (Vue 3 + Tailwind CSS)
- [ ] 陆流光: 用 DESIGN_TEMPLATES 产出首批 Banner (3 变体 × 2 比例 = 6 张)
- [ ] 赵千影: 用 MOCKUP_STANDARD 完成 admin 6 张 Figma 高保真

### Phase 2: 下周 (6/14-6/18)
- [ ] 林染: 五站接入统一组件库 (admin → ops → studio → user-portal → web)
- [ ] 陆流光: 落地页模板开发 (3 变体, 响应式)
- [ ] 赵千影: ops 4 张 mockup + 全部 10 张设计标注

### Phase 3: 月底 (6/19-6/30)
- [ ] 合并验收: 组件库 + 模板 + mockup 三线对齐
- [ ] ad-designer Self-Review 7 项 QA 全绿
- [ ] 输出最终版设计系统文档

---

## 八、关键决策记录

1. **品牌色**: 统一采用深海军蓝 (#1A2E5A) + 暖琥珀 (#F5A623) + 暖米白 (#FAF7F2)，从 ad-designer Brand Bible 直接映射
2. **CSS Token 优先**: 所有组件/模板/mockup 统一用 CSS 变量，不写死十六进制色值
3. **移动优先**: 五站响应式断点对齐 Tailwind (320/640/768/1024/1280)
4. **Draft-First**: 所有视觉产出先出 1K 草稿 → 自检 → 迭代 (≤3 次) → 交付 4K 终稿
5. **文案标准**: CTA ≤12 字, 标题 ≤30 字 (中文), 具体动词 > 模糊名词

---

## 九、文件清单

```
D:\ManhuaWorks\docs\
├── architecture\
│   └── PAIDAN_50_UI_STANDARD_2026-06-11.md    ← 本报告 (整合)
└── design\
    ├── UI_STANDARD_2026-06-11.md              ← 林染: UI 组件库
    ├── DESIGN_TEMPLATES_2026-06-11.md          ← 陆流光: 设计模板
    └── MOCKUP_STANDARD_2026-06-11.md           ← 赵千影: Mockup 规范
```

---

> **派单 50 完成。3 人 × 3 份规范, 覆盖 5 组件 + 3 模板 + 10 mockup。**  
> 总计 36,611 bytes 设计文档, 基于 ad-designer + ad-creative 双技能 26,129 bytes 源码完整研读。
