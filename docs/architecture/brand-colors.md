# 品牌色规范 — P0 设计系统

> **林知行审定 · 陆流光设计 · 2026-06-10**
> **生效范围**: web / studio / user-portal / admin-portal / ops-portal
> **引用**: `packages/shared/design-tokens/tokens.css`

---

## 色板 Palette

### 品牌主色 Brand Primary

| Token | Hex | Tailwind | 用途 |
|-------|-----|----------|------|
| `--color-brand-primary` | `#7C3AED` | violet-600 | CTA 按钮 / 重点强调 / 链接 |
| `--color-brand-primary-hover` | `#6D28D9` | violet-700 | hover/active 态 |
| `--color-brand-primary-light` | `#EDE9FE` | violet-100 | 浅色主题标签/卡片背景 |

- **色相**: 紫罗兰紫 (H: 262°, S: 83%, L: 58%)
- **灵感来源**: Notion 紫 / Linear 紫 → AI + 创作平台
- **禁止**: 各站自定义主色, 必须以 `var(--color-brand-primary)` 引用

### 品牌辅色 Brand Secondary

| Token | Hex | Tailwind | 用途 |
|-------|-----|----------|------|
| `--color-brand-secondary` | `#06B6D4` | cyan-500 | 次要强调 / 信息徽章 / 新功能标识 |
| `--color-brand-secondary-hover` | `#0891B2` | cyan-600 | hover 态 |
| `--color-brand-secondary-light` | `#CFFAFE` | cyan-100 | 浅色徽章背景 |

- **色相**: 青色 (H: 189°, S: 94%, L: 43%)
- **用途**: 与主紫形成互补色对, 用于数据可视化/进度条/徽章

### 背景 Background

| Token | Hex | 用途 |
|-------|-----|------|
| `--color-bg-deep` | `#0F0F23` | 深色主题基准 — Hero 区 / studio/admin-portal |
| `--color-bg-deep-elevated` | `#1A1A3E` | 深色主题高出层 (卡片/弹窗) |
| `--color-bg-surface` | `#F8FAFC` | 浅色主题页面背景 |
| `--color-bg-card` | `#FFFFFF` | 浅色卡片背景 |

### 语义色 Semantic

| Token | Hex | 用途 |
|-------|-----|------|
| `--color-success` | `#10B981` | 成功 / 已完成 / 审核通过 |
| `--color-warning` | `#F59E0B` | 警告 / 待审核 |
| `--color-error` | `#EF4444` | 错误 / 拒绝 / 封禁 |
| `--color-info` | `#3B82F6` | 信息 / 提示 |

---

## 各站点配色策略

| 站点 | 主题 | 主背景 | 强调色 | 氛围 |
|------|------|--------|--------|------|
| **web** | 深色暗调 | `#0F0F23` | 紫紫渐变 (Hero) | 科技感 / 创作者平台 |
| **studio** | 深色 | `#0F0F23` | 紫主+青辅 | 沉浸式创作 |
| **user-portal** | 浅色 | `#F8FAFC` | 紫主+白卡 | 清爽 / 亲和 |
| **admin-portal** | 深色 | `#0F0F23` | 紫蓝渐变 | 专业后台 / 数据密集 |
| **ops-portal** | 浅色 | `#F8FAFC` | 紫主+青色数据 | 运营面板 / 大数字 |

---

## 配色禁忌

1. ❌ 禁止各站独立使用 `#xxxxxx` 硬编码色值 → 必须用 CSS 变量
2. ❌ 禁止使用非品牌色作为 CTA 主色 (如 #3B82F6 蓝色)
3. ❌ 禁止深色/浅色混用导致对比度不足 (最低 4.5:1)
4. ❌ 禁止 admin-portal 使用浅色主题 (数据密集型后台用深色)

---

## Gradients 渐变

```css
/* Hero 渐变 — 深色背景上 */
--gradient-hero: linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%);

/* 卡片 hover 渐变上浮 */
--gradient-card-hover: linear-gradient(180deg, transparent 0%, rgb(124 58 237 / 0.08) 100%);

/* 仪表盘数据卡片渐变 */
--gradient-metric: linear-gradient(135deg, #1A1A3E 0%, #2D2D5E 100%);
```
