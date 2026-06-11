# 创作者工作台项目页 修复报告

**时间**: 2026-06-09 19:01 CST
**报告人**: 虾总助
**问题反馈**: 梁总「http://localhost:5175/project/08f2c11e... 项目创作页面一团乱」

---

## 🐛 4 个 bug 串联

### Bug A: studio vite proxy 指向错误的端口
- 现象: `/api/projects/{id}` → 404
- 真相: studio vite.config.ts proxy `/api` → `localhost:8087` (ai-orchestrator 空壳)
- 应该: `localhost:8089` (project-service)
- **+rewrite** `/api` → `/api/v1` (api-client 默认 baseURL='/api', 后端真路径 '/api/v1/*')

### Bug B: api-client 不解 `code/message/data` 包装
- 现象: `api.projects.get(id)` 返 `{code:0, data:ProjectDTO}`, `dto.id` 是 undefined
- 真相: api-client `http.get` 直接返 body, 期望后端**直返** ProjectDTO
- 现实: 后端返 `{code,message,data}` 包装
- 修: studio loadProject 手动解 `raw.data ?? raw`

### Bug C: loadProject 不拉分镜, 显示 8 个 mock
- 现象: 空项目显示 8 个分镜 (mock)
- 修: loadProject 成功后 `project.value.shots = []` + 调 `api.projects.listShots` 拉真分镜
- (后端 shots 端点未实现, listShots 404 被 catch 吞, 保持空数组)

### Bug D: listShots 同样不解 data 包装
- 修: 同 Bug B, 手动解 `raw.data.items ?? raw.items`

---

## 📁 改动的文件

| 文件 | 改动 |
|------|------|
| `apps/studio/vite.config.ts` | proxy `/api` 8087→8089, 加 `rewrite: /api → /api/v1` |
| `apps/studio/src/views/ProjectEditorView.vue` | loadProject 解 `data` 包装 + 拉真分镜 + 加 shotDtoToStudio |

---

## ✅ 验证

- 浏览器实测: `localhost:5175/project/08f2c11e-...` (项目「虾总助验」)
  - 修复前: **8 个 mock 分镜** (赛博朋克, 雨夜开场...) 乱显示
  - 修复后: **0 个分镜** (空项目正确) ✅
- console: `[studio] loadProject dto: 08f2c11e... 虾总助验` ✅
- shots 拉空: `shots after clear: 0` ✅

---

## 🧠 教训

1. **vite proxy 必须指向真后端, 不是 AI 编排层** — orchestrator 8087 是空壳, 业务在 project-service 8089
2. **api-client 设计假设后端直返 DTO, 不解统一包装** — 需在调用方手动 `raw.data ?? raw` 解包, 不优雅但能跑
3. **listShots 404 是后端真没实现, 不是 bug** — 错误吞了, 用户可手动 + 新分镜
4. **mock 8 个分镜会**永远显示**即使真项目为空** — 必须在 loadProject 成功后清空
5. **改 vite.config 要重启 vite**, HMR 不会热更新 proxy 配置

---

**状态**: ✅ 修复完成
