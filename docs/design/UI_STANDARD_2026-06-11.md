# UI 组件库标准化规范

> 编制: 林染 (前端UI) | 日期: 2026-06-11 | 依据: ad-designer + ad-creative 双技能
> 适用范围: web / admin / studio / ops / user-portal 五站统一

---

## 一、设计原则（从 ad-designer + ad-creative 提取）

### 1.1 核心信条
| # | 原则 | 来源 | 说明 |
|---|------|------|------|
| P1 | **少即是多** | ad-designer Rule 1 | 短聚焦 prompt > 长描述。UI 同理：简洁组件 > 冗余装饰 |
| P2 | **情感优先** | ad-designer Rule 4 | 描述情绪和构图，而非数据。UI：传达状态 (成功/等待/错误) 而非堆砌信息 |
| P3 | **品牌色不外露** | ad-designer Rule 5 | 品牌色用描述词不加品牌名。UI：色板语义化 (primary/success/danger)，不写死品牌名 |
| P4 | **文案即钩子** | ad-creative §Headlines | 短精准 > 长模糊。UI：按钮/Toast 文案 ≤15 字，卡片标题 ≤25 字 |
| P5 | **变体不雷同** | ad-creative §Common Mistakes | 别让所有变体一个样。UI：同组件不同状态要有视觉差异 |

### 1.2 平台尺寸约束（从 ad-creative Platform Specs 反推 UI 宽度）
| 来源平台 | 可见条宽 | 对应 UI 断点 |
|----------|---------|-------------|
| Meta primary text | 125 chars ≈ 750px | sm (≥640px) |
| LinkedIn intro text | 150 chars ≈ 900px | md (≥768px) |
| Google RSA headline | 30 chars ≈ 280px | xs (≥320px) |
| TikTok ad text | 80 chars ≈ 480px | sm 下限 |

**结论**: 五站 UI 统一采用 Tailwind 断点体系 `xs(320) / sm(640) / md(768) / lg(1024) / xl(1280)`

---

## 二、5 核心组件标准化

### 2.1 Button 按钮

```
┌─────────────────────────────────────────────────┐
│ 变体系统（从 ad-creative "变体不雷同" 推导）        │
├───────────┬─────────────────────────────────────┤
│ primary   │ 品牌主色填充，白字，用于主 CTA         │
│ secondary │ 边框+主色字，hover 弱填充，次 CTA     │
│ ghost     │ 无边框无底，hover 浅灰底，辅助操作     │
│ danger    │ 红系，用于删除/不可逆操作              │
├───────────┼─────────────────────────────────────┤
│ 尺寸       │ h-8(密集) / h-10(默认) / h-12(宽松)  │
│ 圆角       │ rounded-md (默认) / rounded-full (pill)│
│ 加载态     │ spinner + disabled，文案保留不变       │
│ 禁用态     │ opacity-50 + cursor-not-allowed       │
└───────────┴─────────────────────────────────────┘
```

**文案规则**（ad-creative §Writing Quality Standards）:
- ≤12 字（中文）/ ≤30 字符（英文，Google RSA 上限）
- 动词开头: "创建项目" "保存更改" "立即体验"
- 避免模糊 CTA: 不用"提交" (太泛)，用"发布商品" (具体)

**Token 映射**:
```css
--btn-primary-bg: var(--color-brand-600);
--btn-primary-text: #FFFFFF;
--btn-radius: 6px;
--btn-h-md: 40px;
--btn-font-size: 14px;
--btn-font-weight: 500;
```

---

### 2.2 Input / Form 输入框

```
┌─────────────────────────────────────────────────┐
│ 状态系统                                          │
├───────────┬─────────────────────────────────────┤
│ default   │ border gray-300, bg white            │
│ hover     │ border gray-400                     │
│ focus     │ border brand-500 + ring-2 ring-brand-100 │
│ error     │ border red-500 + error-text below    │
│ disabled  │ bg gray-50, text gray-400, no-interact│
│ success   │ border green-500 (可选，提交后显示)    │
├───────────┼─────────────────────────────────────┤
│ 前缀/后缀  │ 图标/单位 (¥, %, @)                   │
│ 清除按钮   │ x-mark 出现在有内容时                 │
│ 字数统计   │ 右下角 当前/最大 (参考 ad-creative 字符限制) │
└───────────┴─────────────────────────────────────┘
```

**字符限制建议**（从 ad-creative platform specs 反推）:
| 输入场景 | 建议上限 | 理由 |
|---------|---------|------|
| 标题/名称 | 60 字 | Google RSA 30 字符 × 2 (中文/英文比) |
| 描述/正文 | 500 字 | Meta primary text 可见 125 chars × 4 |
| 短标签 | 15 字 | Google path 15 字符 |
| CTA 文案 | 12 字 | Button 推荐上限 |

**校验文案**（ad-creative §Headlines That Click）:
- 错误: 具体 ("密码需含至少 1 个数字") > 模糊 ("输入无效")
- 成功: 正向 ("商品已发布 ✓") > 中性 ("操作完成")

---

### 2.3 Card 卡片

```
┌─────────────────────────────────────────────────┐
│ 卡片三要素（从 ad-designer 构图公式推导）           │
│                                                 │
│  [SUBJECT]     卡片主体 (图/图标/头像)            │
│  [SETTING]     卡片背景/氛围                      │
│  [COMPOSITION] 卡片布局 (纵向/横向/网格)           │
│                                                 │
│  ┌─────────────────────────┐                    │
│  │  [IMAGE AREA]           │ ← 16:9 hero        │
│  │                         │                    │
│  ├─────────────────────────┤                    │
│  │  TITLE          [TAG]   │ ← 标题 ≤25字       │
│  │  description text...    │ ← 描述 ≤80字       │
│  │                         │                    │
│  │  [secondary] [PRIMARY]  │ ← 按钮右对齐       │
│  └─────────────────────────┘                    │
└─────────────────────────────────────────────────┘
```

**变体**（ad-creative §Vary Angles，不要全一个样）:
| 变体 | 用途 | 布局 |
|------|------|------|
| `card-default` | 列表项、商品卡 | 上图下字，纵向 |
| `card-horizontal` | 订单、消息列表 | 左图右字，横向 |
| `card-compact` | 仪表板指标卡 | 纯文字+图标，无图 |
| `card-media` | 媒体库、素材卡 | 大图+叠加层，hover 显示标题 |

**Token**:
```css
--card-padding: 16px;
--card-gap: 12px;
--card-radius: 8px;
--card-shadow: 0 1px 3px rgba(0,0,0,.08);
--card-shadow-hover: 0 4px 12px rgba(0,0,0,.12);
```

---

### 2.4 Modal 弹窗

```
┌─────────────────────────────────────────────────┐
│ 弹窗 = 放大版 Card + 遮罩层                       │
│                                                 │
│  ┌─────────────────────────────┐ ← max-w-md     │
│  │  TITLE                 [X]  │ ← 关闭按钮     │
│  ├─────────────────────────────┤               │
│  │                             │               │
│  │  CONTENT                    │ ← 可滚动      │
│  │                             │               │
│  ├─────────────────────────────┤               │
│  │      [secondary] [primary]  │ ← 按钮         │
│  └─────────────────────────────┘               │
│                                                 │
│  遮罩: bg-black/50, z-50, animate-in            │
└─────────────────────────────────────────────────┘
```

**尺寸规范**:
| 类型 | 宽度 | 用途 |
|------|------|------|
| `modal-sm` | 400px | 确认/删除/简单表单 |
| `modal-md` | 560px | 设置/详情/中等表单 |
| `modal-lg` | 720px | 复杂表单/预览 |
| `modal-xl` | 960px | 全功能编辑器 |
| `modal-full` | 100vw-32px | 沉浸式编辑 |

**行为规范** (ad-designer §Self-Review → QA 质量意识):
- Esc 关闭
- 点击遮罩关闭 (可配 `closeOnOverlay`)
- 有表单内容时确认关闭 ("你有未保存的更改")
- 打开时 body scroll lock
- focus trap (Tab 在 Modal 内循环)

**文案对齐** (ad-creative §Writing Quality):
- 标题: 动词短语 ("删除项目" 而非 "删除")，≤15 字
- 正文: 解释后果，≤80 字
- CTA: 主按钮用具体动词，次按钮永远叫"取消"

---

### 2.5 Toast / Notification 通知

```
┌─────────────────────────────────────────────────┐
│ Toast = 轻量反馈，从 ad-designer Self-Review 推导  │
│                                                 │
│  ┌──────────────────────────────┐               │
│  │ [ICON] 消息文案          [X] │ ← 4 变体      │
│  └──────────────────────────────┘               │
│                                                 │
│  位置: top-right / bottom-center                │
│  动画: slide-in + fade-out                      │
│  时长: success 3s / error 5s / warning 4s       │
│  堆叠: 最多 3 条同时显示，旧的上移                │
└─────────────────────────────────────────────────┘
```

**变体** (ad-designer Self-Review 7 项检查 → UI 状态映射):
| 变体 | 图标 | 颜色 | 用途 |
|------|------|------|------|
| `toast-success` | ✓ check-circle | green-500 | 操作成功 |
| `toast-error` | ✗ x-circle | red-500 | 操作失败 |
| `toast-warning` | ⚠ alert | amber-500 | 警告 |
| `toast-info` | ℹ info | blue-500 | 一般信息 |

**文案规则** (ad-creative §Writing Quality Standards):
- ≤25 字，单行优先
- 动词+宾语: "已保存" "删除成功" "上传失败: 文件过大"
- 不要 "操作成功" (太模糊) — 说具体 "商品'夏季T恤'已上架"
- error 类需给出下一步: "网络连接失败，点击重试"

**Token**:
```css
--toast-min-width: 288px;
--toast-max-width: 400px;
--toast-radius: 8px;
--toast-shadow: 0 4px 16px rgba(0,0,0,.15);
--toast-z: 9999;
```

---

## 三、全局设计 Token

### 3.1 色彩系统（从 ad-designer Brand Bible 6 字段推导）

```css
:root {
  /* 品牌色 — 来源: Brand Bible primary/secondary */
  --color-brand-50: #EFF6FF;
  --color-brand-100: #DBEAFE;
  --color-brand-200: #BFDBFE;
  --color-brand-300: #93C5FD;
  --color-brand-400: #60A5FA;
  --color-brand-500: #3B82F6;   /* 主色 */
  --color-brand-600: #2563EB;   /* hover/active */
  --color-brand-700: #1D4ED8;
  --color-brand-800: #1E40AF;
  --color-brand-900: #1E3A8A;

  /* 中性灰 */
  --color-gray-50: #F9FAFB;
  --color-gray-100: #F3F4F6;
  --color-gray-200: #E5E7EB;
  --color-gray-300: #D1D5DB;
  --color-gray-400: #9CA3AF;
  --color-gray-500: #6B7280;
  --color-gray-600: #4B5563;
  --color-gray-700: #374151;
  --color-gray-800: #1F2937;
  --color-gray-900: #111827;

  /* 语义色 */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --color-info: #3B82F6;
}
```

### 3.2 字体系统（从 ad-designer Font Style + ad-creative Platform Specs 推导）

```css
/* 字体栈 */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

/* 字号梯度 */
--text-xs: 12px;    /* Toast 辅助文案、字数统计 */
--text-sm: 14px;    /* 按钮、表单、辅助文字 */
--text-base: 16px;  /* 正文、卡片描述 */
--text-lg: 18px;    /* 卡片标题 */
--text-xl: 20px;    /* Modal 标题、页面标题 */
--text-2xl: 24px;   /* 页面主标题 */
--text-3xl: 30px;   /* Landing hero */

/* 行高 */
--leading-tight: 1.25;   /* 标题 */
--leading-normal: 1.5;   /* 正文 */
--leading-relaxed: 1.625;/* 长文本 */
```

### 3.3 间距系统

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;    /* 卡片 padding、表单项间距 */
--space-5: 20px;
--space-6: 24px;    /* 区域间距 */
--space-8: 32px;    /* 段落间距 */
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;   /* 页面级大间距 */
```

### 3.4 阴影系统

```css
--shadow-xs: 0 1px 2px rgba(0,0,0,.04);
--shadow-sm: 0 1px 3px rgba(0,0,0,.08);   /* 卡片 */
--shadow-md: 0 4px 12px rgba(0,0,0,.12);   /* modal */
--shadow-lg: 0 8px 24px rgba(0,0,0,.16);   /* dropdown */
--shadow-xl: 0 12px 48px rgba(0,0,0,.2);   /* drawer */
```

---

## 四、五站适配清单

| 站点 | 组件优先级 | 特殊需求 |
|------|-----------|---------|
| **web** (官网) | Card (媒体卡) + Button (CTA) | 大图 16:9, landing page 风格 |
| **admin** (后台) | Table + Form + Modal | 数据密集, 批量操作区 |
| **studio** (创作) | Card (素材网格) + Toast | 拖拽、上传进度 |
| **ops** (运营) | Card (数据指标卡) + Button | 仪表板、报表 |
| **user-portal** (用户端) | Card (商品/订单) + Toast | 移动优先 |

---

## 五、QA 自检清单（从 ad-designer Self-Review 改造）

每个组件上线前跑 7 项:

| # | 检查项 | 通过条件 | 不通过动作 |
|---|--------|---------|-----------|
| 1 | 文案准确 | 无错别字，CTA 具体不模糊 | 重写文案 |
| 2 | 无视觉幻觉 | 无异色/错位/溢出 | 修 CSS |
| 3 | 尺寸适配 | xs/sm/md/lg/xl 五断点通过 | 修响应式 |
| 4 | 状态完整 | hover/focus/active/disabled/loading 全覆盖 | 补状态样式 |
| 5 | 色彩对齐 | 使用 token 变量，不写死 hex | 替换为 var() |
| 6 | 无障碍 | 可键盘操作, focus visible, aria-label 完整 | 补 a11y |
| 7 | 整体质量 | 视觉连贯、不跳变、动效 >150ms | 调动画/间距 |

---

## 六、组件交付标准

```
组件目录结构:
components/
└── ui/
    ├── button/
    │   ├── Button.vue          ← 组件源码
    │   ├── Button.test.ts      ← 单元测试
    │   ├── Button.stories.ts   ← Storybook
    │   └── index.ts            ← 导出
    ├── input/
    ├── card/
    ├── modal/
    └── toast/
```

**每个组件必须包含:**
- [ ] 5 状态覆盖 (default/hover/focus/disabled/loading)
- [ ] 3+ 变体
- [ ] 响应式断点适配
- [ ] CSS Token 变量引用 (不允许硬编码颜色)
- [ ] Storybook 文档
- [ ] 单元测试 (渲染 + 交互)

---

> **此规范基于 ad-designer v1 (Gemini image generation + brand bible + self-review) 和 ad-creative v1.1.0 (platform specs + angle strategy + iteration) 提取精华。**
> 五站实施顺序: admin → ops → studio → user-portal → web (按组件复杂度从高到低)
