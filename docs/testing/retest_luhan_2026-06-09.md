# 复测报告 — tester-luhan (2026-06-09)

**测试员**: 路寒 (tester-luhan, 开发部测试组)
**范围**: studio 7 view 静态文件 + 5 后端 service API (user/project/billing/collab/orchestrator)
**账号**: tester-luhan@manhuaworks.local / Test1234!

## 结果总览

| 测试 | 状态码 | 备注 |
|------|--------|------|
| P0 /users/me | 200 | ✅ |
| P1 /api-keys | 200 | ✅ |
| collab GET comments | 200 | ✅ |
| collab GET annotations | 200 | ✅ |
| collab GET notifications | 200 | ✅ |
| collab GET activities | 200 | ✅ |
| project GET /projects | 200 | ✅ |
| billing /balance | 200 | ✅ |
| orch /health | 0 | ❌ 连接拒绝 (192.168.0.11:8087) |
| studio/PlaceholderView.vue | 200 | ✅ |
| studio/StudioHomeView.vue | 404 | ❌ 文件缺失 |
| studio/ProjectEditorView.vue | 200 | ✅ |
| studio/CharacterView.vue | 200 | ✅ |
| studio/SceneView.vue | 200 | ✅ |
| studio/ToolboxView.vue | 200 | ✅ |
| studio/WorkflowDesignerView.vue | 200 | ✅ |
| studio/ExportView.vue | 200 | ✅ |
| studio 硬编码数 | 0 | ✅ |

## 通过: 15 / 18

## ❌ 失败项

### 1. orch /health — ai-orchestrator 8087 连接拒绝
- 现象: `[WinError 10061] 由于目标计算机积极拒绝，无法连接。`
- 其他 4 service 全部 200, 仅 8087 不可达
- 建议: 检查 ai-orchestrator 容器/进程是否启动,确认 8087 端口监听

### 2. studio/StudioHomeView.vue — 文件缺失
- 路径: `D:\ManhuaWorks\apps\studio\src\views\StudioHomeView.vue`
- views/ 目录现有 7 个文件,无 StudioHomeView
- 建议: 确认路由指向,补齐入口 view 或移除相关路由配置

## ✅ 通过项

- 4 个 service 全部 API 200 (user/project/billing/collab)
- studio 7/8 view 文件存在 (除 StudioHomeView)
- studio 硬编码 localhost:80xx = **0** (符合规范)