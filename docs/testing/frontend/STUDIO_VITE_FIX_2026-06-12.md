# Studio Vite 报错修复报告

**日期**: 2026-06-11 (派单 63.1)  
**执行人**: 林染 🖥️开发部前端  
**审核人**: 虾总助

---

## 原始报错

```
[vite] Internal server error: Cannot find package 'vue'
```

Vite dev server 启动失败，找不到 `vue` 包。路径指向 `.pnpm` 虚拟存储。

---

## 诊断

### 根因 1: `vue` 及相关依赖未在 `apps/studio/package.json` 声明

检查 `apps/studio/package.json` 的 `dependencies`：
- ✅ `@manhuaworks/api-client` — 有
- ✅ `@manhuaworks/shared-types` — 有
- ✅ `@manhuaworks/ui` — 有
- ❌ `vue` — **缺失**
- ❌ `vue-router` — **缺失**
- ❌ `pinia` — **缺失**
- ❌ `axios` — **缺失**
- ❌ `@vueuse/core` — **缺失**

但以下文件实际 import 了这些包：
- `src/main.ts`: `vue`, `pinia`, `vue-router`
- `src/router/index.ts`: `vue-router`
- `vite.config.ts`: `manualChunks` 引用 `vue`, `vue-router`, `pinia`, `axios`, `@vueuse/core`

由于 pnpm 的严格依赖隔离，workspace 协议不会自动提升 peer deps，导致 Vite 找不到这些包。

### 根因 2 (次要): `useTheme.ts` 重复 import

`packages/ui/src/composables/useTheme.ts` 第 8 行和第 175 行各有一个 `import from 'vue'`，导致 `ref`、`watch`、`onMounted`、`Ref` 被重复声明，Vite 依赖扫描报 4 个 PARSE_ERROR。

---

## 修复操作

### 1. 补充缺失依赖 (apps/studio/package.json)

```json
"dependencies": {
  "@manhuaworks/api-client": "workspace:^",
  "@manhuaworks/shared-types": "workspace:^",
  "@manhuaworks/ui": "workspace:^",
  "@vueuse/core": "^13.9.0",
  "axios": "^1.11.0",
  "pinia": "^3.0.3",
  "vue": "^3.5.26",
  "vue-router": "^4.6.3"
}
```

### 2. 合并 useTheme.ts 重复 import

将两处 `import from 'vue'` 合并为一处，在第一处补充 `computed`：

```typescript
// 修复前: 第 8 行
import { ref, watch, onMounted, onBeforeUnmount, type Ref } from 'vue'
// 第 175 行 (重复!)
import { computed, ref, watch, onMounted, type Ref } from 'vue'

// 修复后: 只保留第 8 行
import { computed, ref, watch, onMounted, onBeforeUnmount, type Ref } from 'vue'
```

### 3. 安装依赖 & 清理缓存

```bash
pnpm install     # 成功安装 vue 3.5.35 + 19 个包
rm -rf node_modules/.vite
```

---

## 验证结果

### Vite 启动

```
VITE v8.0.16  ready in 316 ms
✨ new dependencies optimized: pinia, vue-router, vue
```

**零错误启动**。不再有 "Cannot find package 'vue'"。

### 浏览器验证 (http://localhost:5175)

| 检查项 | 结果 |
|--------|------|
| 页面正常加载 | ✅ |
| 导航栏 6 项 | ✅ 首页/项目编辑器/素材库/工作流/工具箱/导出 |
| 主标题 "欢迎使用 ManhuaWorks" | ✅ |
| 创作方式卡片 | ✅ 自动流程 + 自主配置 |
| 创作全链路 6 步 | ✅ |
| 更新公告 | ✅ |
| 素材案例 | ✅ |
| 新手指南 | ✅ |
| 页脚 | ✅ |
| Console 报错 | ✅ 0 条 |
| Dialog/弹窗 | ✅ 无 |

### 截图

保存路径: `docs/testing/frontend/studio_fix_screenshots/studio-homepage-fixed.png`

---

## 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/studio/package.json` | 修改 | 新增 5 个 dependencies |
| `packages/ui/src/composables/useTheme.ts` | 修改 | 合并重复 import，补充 computed |

---

## 技术总结

1. **pnpm workspace 依赖可见性**: pnpm 默认严格隔离。即使 `@manhuaworks/ui` peer-deps 了 `vue`，项目自己的代码也需要显式声明 `vue` 为 dependency
2. **Vite 8 + rolldown**: 新版 Vite 使用 rolldown 做依赖扫描，对重复 import 声明零容忍（旧版 esbuild 可能容错）
3. **manualChunks 引用**: `rollupOptions.output.manualChunks` 中引用的包名也必须存在于 `dependencies` 中

---

**状态**: ✅ 修复完成  
**耗时**: ~15 分钟  
**修复时间**: 2026-06-11 21:38
