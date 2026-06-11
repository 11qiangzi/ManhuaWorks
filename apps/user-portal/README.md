# ManhuaWorks · user-portal

> 用户后台前端 · Vue3 +TypeScript +Tailwind +Vite
>
>配套创作者工作台 `studio`（端口5170），提供账号、项目、作品、素材、订阅、BYOK 等管理能力。

---

##启动

```bash
# 进入目录
cd D:\ManhuaWorks\apps\user-portal

# 安装依赖（pnpm 推荐）
pnpm install
# 或 npm install / yarn install

# 开发模式
pnpm dev # 默认端口5180
# 或自定义端口
pnpm dev --port5181

# 生产构建
pnpm build

#预览构建产物
pnpm preview
```

启动后浏览器访问 <http://localhost:5180>

> ⚠ 若端口被占用，Vite 会自动顺延（如5181、5182）。注意同时启动 studio（5170）和其他子应用时避免冲突。

---

##端口约定

| 应用 |端口 | 说明 |
|------|------|------|
| **user-portal（本应用）** | **5180** | 用户后台 /账号中心 |
| studio |5170 |创作者工作台（深度编辑） |
| admin-portal |5190 | 管理后台（预留） |
| api-gateway |8080 | 后端API网关 |

跨应用跳转示例：

```ts
// 从 user-portal打开 studio 编辑器
window.open('http://localhost:5170/studio/project/' + projectId, '_blank')

// 从 studio回到 user-portal
window.location.href = 'http://localhost:5180/dashboard'
```

---

##主题切换

本应用内置 **5套主题**，全部通过 CSS变量驱动，**零硬编码颜色**：

|主题 ID |名称 |风格 |
|---------|------|------|
| `creator-orange` | 🎨创作橙 | 默认 ·温暖明亮 |
| `dark-workshop` | 🌙 工坊夜 |暗色 ·护眼 |
| `minimal-light` | ☁极简白 |干净 ·清爽 |
| `national-ink` | 🏮 国风水墨 |古典 ·意境 |
| `neon-cyber` | ⚡赛博霓虹 |未来 ·炫彩 |

###切换方式

**方式 A ·顶栏切换器（推荐）**
点击右上角调色板图标，弹出主题菜单。

**方式 B ·代码切换**
```ts
import { useTheme } from '@/composables/useTheme'

const { themeId, setTheme } = useTheme()
setTheme('dark-workshop')
```

**方式 C ·URL 参数**
```
http://localhost:5180/dashboard?theme=neon-cyber
```

主题选择持久化到 `localStorage`，刷新后保留。

### CSS变量约定

新写组件时**直接使用变量**，禁止写死颜色：

```vue
<style scoped>
.my-box {
 background: var(--mw-bg); /* 主背景 */
 color: var(--mw-text); /* 主文字 */
 border:1px solid var(--mw-border); /*描边 */
 padding:1rem;
 border-radius:8px;
}
.my-btn {
 background: var(--mw-primary); /* 主色 */
 color: var(--mw-primary-contrast); /* 主色文字 */
}
.my-btn:hover {
 background: var(--mw-primary-hover, var(--mw-primary));
}
.my-tag {
 background: var(--mw-bg-soft); /*浅色块 */
 color: var(--mw-text-muted); /* 次要文字 */
}
</style>
```

**完整变量清单：**

|变量 |用途 |
|------|------|
| `--mw-bg` |页面主背景 |
| `--mw-bg-soft` |浅色块背景 |
| `--mw-surface` |卡片 /面板背景 |
| `--mw-text` | 主文字 |
| `--mw-text-muted` | 次要文字 |
| `--mw-border` |描边 |
| `--mw-primary` | 主色（按钮 /链接 /高亮） |
| `--mw-primary-hover` | 主色悬停 |
| `--mw-primary-soft` | 主色浅色块 |
| `--mw-primary-contrast` | 主色上的文字色 |
| `--mw-danger` |错误 /危险 |
| `--mw-success` |成功 |
| `--mw-warning` |警告 |
| `--mw-font` |字体栈 |

---

##目录结构

```
apps/user-portal/
├── public/ #静态资源
├── src/
│ ├── api/ # API客户端
│ │ ├── user-service.ts # 用户 /认证
│ │ ├── project-service.ts # 项目 CRUD
│ │ ├── asset-service.ts #素材库
│ │ └── work-service.ts #作品
│ ├── assets/ # 图片 /字体等
│ ├── components/ #通用组件
│ │ ├── UserCard.vue
│ │ ├── ProjectCard.vue
│ │ ├── PlanBadge.vue
│ │ └── ThemeSwitcher.vue
│ ├── composables/ #业务逻辑（hook风格）
│ │ ├── useUser.ts
│ │ ├── useProjects.ts
│ │ ├── useWorks.ts
│ │ ├── useAssetLibrary.ts
│ │ └── useTheme.ts
│ ├── router/ # Vue Router 配置
│ ├── stores/ # Pinia stores
│ ├── styles/ # 全局样式 +主题入口
│ │ ├── main.css
│ │ └── themes.css
│ ├── themes/ #5套主题 CSS变量
│ │ ├── creator-orange.css # 默认
│ │ ├── dark-workshop.css
│ │ ├── minimal-light.css
│ │ ├── national-ink.css
│ │ └── neon-cyber.css
│ ├── views/ #路由页面
│ │ ├── HomeView.vue # 首页
│ │ ├── MyProjectsView.vue # 我的项目
│ │ ├── MyWorksView.vue # 我的作品
│ │ ├── AssetLibraryView.vue #素材库
│ │ └── SettingsView.vue # 设置
│ ├── App.vue
│ └── main.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md（本文件）
```

---

##路由

|路径 |页面 | 说明 |
|------|------|------|
| `/` | HomeView | 首页（推荐 +统计） |
| `/projects` | MyProjectsView | 我的项目（CRUD） |
| `/works` | MyWorksView | 我的作品（导出 /分享） |
| `/assets` | AssetLibraryView |素材库（5 类） |
| `/settings` | SettingsView | 设置（4标签） |
| `/login` | — |登录页（待接入） |

---

##集成说明

### 与 studio（创作者工作台）的关系

```
user-portal (5180) studio (5170)
┌────────────────┐ ┌────────────────┐
│ HomeView │ │ StudioEditor │
│ MyProjectsView │ ─打开→ │ ProjectDetail │
│ MyWorksView │ │ AssetPicker │
│ AssetLibrary │ │ RenderQueue │
│ Settings │ ←回调─ │ PublishDialog │
└────────────────┘ └────────────────┘
```

- **门户层（本应用）**：账号、订阅、列表、设置、统计
- **工作层（studio）**：深度编辑、画布、时间线、渲染

两者通过 **同源 session +共享 API gateway（8080）**通信，登录态通过 cookie共享。

### 与 api-gateway 的对接

所有 API 调用走 `@/api/*` 模块，自动附带 `Authorization: Bearer <token>`：

```ts
// src/api/user-service.ts（示意）
const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api'

export async function fetchProfile() {
 const res = await fetch(`${BASE}/users/me`, {
 headers: { Authorization: `Bearer ${getToken()}` }
 })
 return res.json()
}
```

环境变量（`.env.local`）：

```
VITE_API_BASE=http://localhost:8080/api
VITE_STUDIO_URL=http://localhost:5170
```

###鉴权

-登录态存于 `localStorage['mw_token']` + HttpOnly Cookie（生产）
-路由守卫在 `router/index.ts` 配置，`/login`之外均需登录
-401响应 →自动跳 `/login`

###主题在多应用间的同步

主题选择通过 `localStorage['mw_theme']` +`storage`事件广播：

```ts
// studio监听 user-portal 的主题变化
window.addEventListener('storage', (e) => {
 if (e.key === 'mw_theme') applyTheme(e.newValue)
})
```

---

## 开发约定

###写新组件

1. **复用主题变量** ·不用硬编码颜色
2. **scoped样式** ·`<style scoped>`
3. **TypeScript strict** ·所有 props /state 都标类型
4. **Composables优先** ·业务逻辑放 `composables/`，组件只管展示
5. **零 AI味文案** ·面向用户的文案简洁直接，不用「很高兴为您服务」式填充语

###提交前自检

```bash
pnpm type-check # tsc --noEmit
pnpm lint # eslint .
pnpm build #验证构建通过
```

---

##故障排查

|现象 |排查 |
|------|------|
|主题不生效 | 检查 `styles/main.css` 是否在 `themes.css` **之前**导入；检查 `useTheme()` 是否在 setup阶段调用 |
| API401 | 检查 `localStorage.mw_token` 是否过期；检查 `VITE_API_BASE` 是否正确 |
|跨应用跳转404 |确认目标应用已启动；确认 URL路径拼写 |
|端口冲突 | `pnpm dev --port5181` 指定端口；同步更新其他应用跳转配置 |

---

##路线图

- [x] 首页 /项目 /作品 /素材 /设置（5 view）
- [x] 5套主题
- [x] 4套组件 +5套 composables +4套 API
- [] 接入真实 auth（OAuth +邮箱）
- [] 接入 BYOK真实加密存储
- [] i18n（中 /英 /日）
- [] PWA离线缓存
- [] 移动端适配（已有基础响应式）

---

**ManhuaWorks ©2026** · 林染 ·接力自 W4任务1
