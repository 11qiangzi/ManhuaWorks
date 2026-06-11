# 路寒 studio 测试报告 (2026-06-09 15:15 GMT+8)

测试员: 路寒 (tester-luhan) | 范围: studio (5175) 静态 + 路由 + vite serve + 控制台扫描

---

## 1. 路由 HTTP 状态 (SPA, 全走 history)

| 路径 | HTTP | 说明 |
|------|------|------|
| `/` | 200 | redirect 到 `/workflow` |
| `/workflow` | 200 | SPA fallback HTML 486b |
| `/project` | 200 | ⚠️ 任务文档说 `/editor` / `/projects` 不存在, 实际是 `/project` |
| `/characters` | 200 | |
| `/scenes` | 200 | |
| `/tools` | 200 | |
| `/export` | 200 | |
| `/:pathMatch(.*)*` | fallback → PlaceholderView | |

> ⚠️ **路由表与任务文档不一致**: 任务里写的 `/projects` `/editor` 实际不存在, 真实路径是 `/project` `/workflow`。

---

## 2. View 文件 vite serve

| View | HTTP | 文件大小 | 备注 |
|------|------|----------|------|
| PlaceholderView.vue | 200 | 6459b | ✅ |
| StudioHomeView.vue | ❌ **404** | 486b (SPA fallback) | ⚠️ **文件根本不存在**, vite 返回 SPA HTML 而不是 404 |
| ProjectEditorView.vue | 200 | 74457b | ✅ |
| CharacterView.vue | 200 | 78575b | ✅ |
| SceneView.vue | 200 | 82752b | ✅ |
| ToolboxView.vue | 200 | 53800b | ✅ |
| WorkflowDesignerView.vue | 200 | 87846b | ✅ |
| ExportView.vue | 200 | 60662b | ✅ |

> ⚠️ **StudioHomeView.vue 不存在** (P2): views/ 目录下只有 7 个文件, 没有 StudioHomeView。如果其他 view 引用它会编译失败。检查 router 未引用 → 当前无害, 但任务文档列了它, 说明文档/实际不同步。

---

## 3. 静态代码问题清单

| View | 问题 | 等级 |
|------|------|------|
| WorkflowDesignerView.vue | **L42 硬编码 `http://localhost:8087` 作 fallback**, 绕过 vite proxy → CORS / 端口不可达 | **P1** |
| WorkflowDesignerView.vue | **L198 / L268 / L343 直接 fetch 绝对 URL**, 不走 `/api` `/v1` proxy | **P1** |
| orchestrator.ts (被引用) | **BASE_URL 硬编码 `http://localhost:8087`**, 同上 | **P1** |
| WorkflowDesignerView.vue | 控制台有 6 处 `console.warn/error` (L105/128/220/274/295/349), 未做生产环境剥离 | P3 |
| ProjectEditorView.vue | 用 `makeMockProject(1)` 全 mock, 未接 api/projects | P2 (预期, mock 阶段) |
| CharacterView.vue | ✅ 接真 API (api-bridge → projects.listMembers), fallback mock, 2.5s 超时, loading/error UI 全 | OK |
| SceneView.vue | ✅ 接真 API (api-bridge → projects.listTags), fallback mock, 同上 | OK |
| ToolboxView.vue | 全本地 mock (24 工具), 注释明确说"后端无 tools 端点", 合理 | OK |
| ExportView.vue | 全本地 mock + localStorage 持久化, 注释说"后端无此端点", 合理 | OK |
| PlaceholderView.vue | 干净占位页, redirect `/workflow` | OK |
| 全部 7 view | 引入的组件 / store / composable 全部存在 (cross-check: components/、stores/、composables/ 目录齐) | OK |

---

## 4. Vite proxy 验证

```
/api/v1/projects/proj_default_001/members  →  HTTP 404 (proxy 生效, 后端无此 endpoint)
/v1/workflows                              →  HTTP 401 (proxy 生效, 需要鉴权)
```

Proxy 配置 (`vite.config.ts`):
```
'/api'  → http://localhost:8087
'/v1'   → http://localhost:8087
```

> ⚠️ **Proxy 缺口**: 任务文档说后端还有 8089 (project) / 8088 (user) / 8091 (collab), **vite proxy 没配置这三端口**。当前仅 8087 (orchestrator) 走代理, 其他服务调用若走绝对 URL 也会撞 CORS。

---

## 5. 控制台日志扫描

WorkflowDesignerView 有 6 处 console 输出, 都是 warn/error fallback 提示, 不算 bug 但生产环境应该 silent 化。

其他 view 没有 console.log/warn/error 直接调用。

---

## 6. 总览

| 项 | 结果 |
|----|------|
| 7 view 文件 vite serve | **6 ✅ / 1 ❌** (StudioHomeView 不存在) |
| 路由 HTTP 200 | ✅ 全部 |
| 真 API 接入 | CharacterView ✅ / SceneView ✅ / WorkflowDesignerView ⚠️ 混用 (proxy + 硬编码) |
| 硬编码 URL 绕过 proxy | **WorkflowDesignerView + orchestrator.ts 4 处** (P1) |
| 静态代码问题数 | **4 个** (P1×3, P2×1, P3×1) |
| 组件/Store 引用一致性 | ✅ 全部存在 |

---

## 7. 修复建议 (按优先级)

1. **P1**: WorkflowDesignerView.vue L42、L198、L268、L343 改用 `/api/...` `/v1/...` 相对路径, 走 vite proxy
2. **P1**: orchestrator.ts BASE_URL 同上, 或保留绝对 URL 但部署时改用 ENV 注入 + 后端配 CORS
3. **P2**: ProjectEditorView 接 api/projects 替代 mock
4. **P2**: 删除/补充 StudioHomeView.vue (文档与代码不一致)
5. **P3**: 控制台日志加 `if (import.meta.env.DEV)` 包裹
6. **调研**: vite proxy 补 8088/8089/8091 端口 (确认 project/user/collab 服务调用路径)

---

> **结论**: studio 静态层整体健康, 7 view 编译/路由都通。核心阻塞是 **WorkflowDesignerView 硬编码 URL 绕过 vite proxy**, 这是连接后端必踩的坑, 优先修。其他 view 都 OK。
---

## 8. 浏览器动态测试 (路寒 1/2, 2026-06-09 15:20 GMT+8)

测试员: 路寒 (tester-luhan-1/2) | 范围: 真实浏览器 (CDP) 打开 5175, 截图, console, 交互
浏览器: CDP target t9/t11/t13/t15/t16/t18/t19 (测试期间因并行 agent 切换多次重连)

---

### TC 结果

| TC | View | 路径 | 状态 | 严重 | 实测简述 |
|----|------|------|------|------|----------|
| TC-STD-001 | WorkflowDesignerView | `/` `/workflow` | ⚠️ | P2 | 页面渲染正常, 工具栏 (新建/加载/保存/运行/调试) + 节点面板 (18 节点) 都在, **但 console 持续刷 E5001 ResizeObserver loop** (10s 内 >50 条) |
| TC-STD-002 | ProjectEditorView | `/project` | ✅ | | 正常渲染, 进度条/总时长/分镜列表/Shot 1+2 全显示, 任务文档给的 `/projects` `/editor` 路径不存在 |
| TC-STD-003 | CharacterView | `/characters` | ⚠️ | P1 | 页面渲染 (5 角色 + 4 项目成员), **顶部红条: 真 API 拉取失败 (not_found), 已回退本地数据** — `/api/projects/proj_default_001/members` 返回 404, 走 mock fallback |
| TC-STD-004 | SceneView | `/scenes` | ❌ | **P0** | **页面纯白, 无任何 UI 渲染**, console 报 fatal: `SyntaxError: The requested module '/src/stores/sceneStore.ts' does not provide an export named 'SCENE_TYPE_META'` |
| TC-STD-005 | ToolboxView | `/tools` | ✅ | | 6 大类 24 工具, 全部渲染, 搜索框+标签筛选可用, 全部本地 mock (代码注释确认) |
| TC-STD-006 | ExportView | `/export` | ✅ | | 4 大类 13 格式, 4 标签 (剧集/角色/项目/资产), 全部本地 mock+localStorage 持久化 |
| TC-STD-007 | PlaceholderView | `*` (catch-all) | ✅ | | `/this-route-does-not-exist` → 渲染 `页面不存在 / W3 待补 / [↩去工作流设计面板]`, 正常占位 |
| TC-STD-008 | StudioHomeView | `/home` (或任何路径) | ❌ | **P0** | **`views/StudioHomeView.vue` 文件根本不存在**, router 无 `/home` 路由, 访问 `/home` 落到 PlaceholderView, 任务文档与代码不同步 |

---

### BUG 清单

- **BUG-STD-001 (P0)**: SceneView 启动即空白 — `apps/studio/src/views/SceneView.vue:20` `import { useSceneStore, SCENE_TYPE_META, type SceneType } from '../stores/sceneStore'`, 但 `apps/studio/src/stores/sceneStore.ts` **只 export 了 `SceneType` 和 `useSceneStore`, 缺少 `SCENE_TYPE_META` 常量**。Vite 运行时抛 SyntaxError, 整个 view 渲染失败。**修复**: 在 sceneStore.ts 增加 `export const SCENE_TYPE_META: Record<SceneType, { label, icon, keywords }> = { ... }`。

- **BUG-STD-002 (P0)**: StudioHomeView 文件缺失 — 任务清单第 2 项要求测 `StudioHomeView`, 但 `apps/studio/src/views/` 目录下不存在该文件, router/index.ts 也没有对应路由。**任一文档/任务引用了它即视为 P0 缺口**。**修复**: 要么补 `StudioHomeView.vue` + 在 router 加 `/home` 路由, 要么从任务清单里删除 (与现状保持一致)。

- **BUG-STD-003 (P2)**: 路由与任务文档不一致 — 任务说 `/projects` `/editor`, 实际是 `/project` `/workflow`。**修复**: 更新任务文档或代码注释, 统一命名。

- **BUG-STD-004 (P2)**: WorkflowDesignerView 控制台 E5001 ResizeObserver loop 风暴 — 页面打开 10 秒内 console error >50 条, 全部从 `packages/ui/src/composables/useErrorHandler.ts:22` → `errors/index.ts:33 fromUnknown` 抛出。该错误是浏览器 `ResizeObserver` 的已知良性警告 (loop completed with undelivered notifications), 但当前 useErrorHandler 把它当 AppError 抛到 console, 污染日志。**修复**: 在 `useErrorHandler.ts` 的 `fromUnknown` 里白名单 `ResizeObserver loop completed with undelivered notifications`, 直接 swallow 不上报。

- **BUG-STD-005 (P1)**: CharacterView API 拉取失败 — `/api/projects/proj_default_001/members` 返回 404 (vite proxy 转发到 8087 orchestrator, 但该 endpoint 应在 project-service 8089)。fallback 到本地数据, 顶部红条提示用户。功能可降级, 但**真实数据加载路径不通**, 角色/项目管理无法与后端同步。**修复**: 确认成员列表 endpoint 归属 (project-service?), 在 vite.config.ts 加 8089 proxy 或修正调用路径。

- **BUG-STD-006 (P2)**: 登录 API 不可用 — `POST /api/v1/auth/login` 对 `tester-luhan@manhuaworks.local` 返回 `{"code":"internal_error","message":"internal server error"}`。Health endpoint ok, service up, db up, uptime 58240s, 但 login 走不通。**本次测试全程无法取得 token**, 所有依赖鉴权的 API 调用都没带 token。**修复**: 检查 user-service 8088 的 auth/login 路由, 看 server 端日志。

---

### 总览

- 通过: **4/8** (ProjectEditorView, ToolboxView, ExportView, PlaceholderView)
- 失败: **2/8** (SceneView P0 空白, StudioHomeView P0 文件缺失)
- 警告: **2/8** (WorkflowDesignerView console 噪声, CharacterView API 降级)
- 阻塞: **登录 API 500, 全程无 token**

> **结论 (动态测试)**: studio 前端在浏览器里**整体可加载**, 6/8 view 渲染正常。但 **SceneView 因 P0 编译错误完全空白**, **StudioHomeView 文件不存在**, **CharacterView 真 API 不可达** 三个问题需在 W5 阶段 1 修补版前解决。其余 view 内容、路由、交互无致命问题。
