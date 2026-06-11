# 字体规范 — P0 设计系统

> **林知行审定 · 林染 (前端) · 2026-06-10**
> **生效范围**: web / studio / user-portal / admin-portal / ops-portal
> **引用**: `packages/shared/design-tokens/tokens.css`

---

## 字体栈 Font Stack

```css
/* 正文/UI */
font-family: 'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont,
             'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* 等宽/代码 */
font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono',
             'Consolas', 'Courier New', monospace;
```

### 选型理由

| 字族 | 理由 |
|------|------|
| **PingFang SC** (首选) | Apple 中文字体, macOS/iOS 内置, 字形优雅, 字重完整 |
| **Microsoft YaHei** (Windows 备选) | Windows 原生中文字体, 覆盖广 |
| **System UI** (fallback) | 西文/数字走系统原生, 不额外加载网络字体 |

### 不选 Google Fonts / 网络字体的理由

- ❌ **FOIT (Flash of Invisible Text)**: 网络字体加载阻塞中文渲染 (中文字体文件 5MB+)
- ❌ **不需 Noto Sans SC**: 文件过大 (20MB+), 无必要
- ✅ **策略**: 优先系统字体, 零网络开销, 零 FOIT

---

## 字重规范

| Token | Weight | 用途 |
|-------|--------|------|
| `--font-normal` | `400` | 正文 / 次要文字 |
| `--font-medium` | `500` | 按钮 / 导航 / 表头 |
| `--font-semibold` | `600` | 小标题 / 卡片标题 |
| `--font-bold` | `700` | 主标题 / Hero / 大数字 |

- PingFang SC 支持 400/500/600/700 → 全字重覆盖
- Microsoft YaHei 仅支持 400/700 → Windows 上 500/600 自动降级, 可接受

---

## 字号规范 (Type Scale)

| Token | Size | 用途 | 行高 |
|-------|------|------|------|
| `--text-xs` | 12px | 辅助标签 / 时间戳 / 占位符 | 1.5 |
| `--text-sm` | 14px | 表格正文 / 输入框 / 标签 | 1.5 |
| `--text-base` | 16px | 默认正文 | 1.5 |
| `--text-lg` | 18px | 小标题 / 卡片副标题 | 1.25 |
| `--text-xl` | 20px | 模块副标题 | 1.25 |
| `--text-2xl` | 24px | 模块标题 / 弹窗标题 | 1.25 |
| `--text-3xl` | 30px | Hero 副标题 | 1.25 |
| `--text-4xl` | 48px | Hero 主标题 | 1.25 |
| `--text-5xl` | 60px | 超大屏 Hero | 1.25 |

### 移动端缩放

| Desktop | Mobile (<768px) | 说明 |
|---------|-----------------|------|
| 48px | 32px | Hero 主标题 |
| 30px | 20px | Hero 副标题 |
| 24px | 18px | 模块标题 |
| 16px | 14px | 正文 |

---

## 加载策略 (消除 FOIT)

```css
/* 系统字体栈 — 无需网络加载, 零 FOIT */
body {
  font-family: var(--font-sans);
  font-display: optional; /* 对任何 @font-face 声明 */
}
```

**原则**: 不计较「完美的 PingFang SC」, 接受「系统可用中文字体」即可。对于中文内容平台, 字体不应成为性能瓶颈。

---

## 特殊场景

| 场景 | 字体 | 大小 | 说明 |
|------|------|------|------|
| 代码块 / API 文档 | `--font-mono` | 14px | dev/admin 后台 |
| 数据仪表盘数字 | `--font-sans` | 24-48px | 用 sans, mono 风格不友好 |
| 版权/备案信息 | `--font-sans` | 12px | 页脚 |
| 空状态文案 | `--font-sans` | 14px | 引导性文字 |

---

## 5 站字体统一检查清单

- [ ] web (3000) — body 用 `--font-sans`
- [ ] studio (5175) — 全站系统字体, 编辑器区域可考虑等宽
- [ ] user-portal (5180) — 浅色主题文字色
- [ ] admin-portal (5174) — 深色主题, 文字用 `--color-text-inverse`
- [ ] ops-portal (5176) — 浅色主题, 大数字用 bold
