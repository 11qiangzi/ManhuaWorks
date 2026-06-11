# 创作者工作台 + 项目详情 修复报告

**时间**: 2026-06-09 18:45 CST
**报告人**: 虾总助
**问题反馈**: 梁总「项目点击进去是 404 页面, 后面的功能好像都没有, 还有创作者工作台也进不去」

---

## 🐛 3 个 bug 串联

### Bug A: 创作者工作台链接端口错 (5170 → 5175)
- 现象: 4 处链接 `http://localhost:5170/studio/...` 都打不开
- 真相: studio 实际跑 **5175** (vite.config.ts 配的), 5170 是规划但未启
- 修: 4 个文件 4 处替换 5170→5175

### Bug B: studio router 缺 `/project/:id` 路由
- 现象: 点「打开」跳 `localhost:5175/project/{id}` 还是 404
- 真相: studio router 只配了 `/project` (无 :id), 即使 ProjectEditorView 内部已读 `route.params.id`
- 修: studio router 加 `/project/:id` 路由复用 ProjectEditorView

### Bug C: 创作者工作台卡片没标 external
- 现象: 点首页「创作者工作台」跳到 `5180/studio` (user-portal 没这路由, 兜底到 dashboard)
- 真相: HomeView L50 卡片 `route: '/studio'`, **没** `external: true`, 走内部 router.push
- 修: `route: 'http://localhost:5175/workflow'`, `external: true`, 走 window.open 新 tab

### Bug D: user-portal `/projects/:id` 用列表页 (顺带修)
- 现象: 直接访问 `/projects/{id}` 看到列表 (空)
- 真相: router 配的 `component: () => import('@/views/MyProjectsView.vue')` — 是列表, 不是详情
- 修: 改 redirect 跳到 `http://localhost:5175/project/{id}` (studio 才是真项目编辑器)

---

## 📁 改动的文件

| 文件 | 改动 |
|------|------|
| `apps/user-portal/src/views/AssetLibraryView.vue` | L160 链接 5170→5175 |
| `apps/user-portal/src/views/HomeView.vue` | L50 加 external+正确 URL |
| `apps/user-portal/src/views/MyProjectsView.vue` | L85/L127 链接 5170→5175 |
| `apps/user-portal/src/router/index.ts` | `/projects/:id` 改 redirect 到 studio |
| `apps/studio/src/router/index.ts` | 加 `/project/:id` 路由 |

---

## ✅ 验证

- ✅ 浏览器实测点项目「打开」 → 跳 `http://localhost:5175/project/{id}` → **创作者工作台完整打开** (8 个分镜, 赛博朋克主题, 可编辑)
- ✅ 首页「创作者工作台」卡片 → 跳 `http://localhost:5175/workflow` (新 tab, external)
- ✅ `/projects/{id}` URL → 跳 studio `/project/{id}` (不再 404)

---

## 🧠 教训

1. **跨 portal 链接必须有 `external: true`** — Vue router 默认 `router.push` 内部, 不识别 http URL
2. **vite.config 端口是真理, 文档是参考** — 文档说 5170, 实际跑 5175, 必须 netstat 验
3. **router 路由要完备, view 不会替你兜底** — studio 路由是 `/project` 没 `:id`, 即使 view 支持 :id 也 404
4. **redirect + window.open 双写** — 保留 URL 在 user-portal, 同时打开新 tab 进 studio, 不丢上下文
