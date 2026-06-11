# 📋 ManhuaWorks 全功能测试用例清单 (M3.5)

> **测试员**: 卫峥 (web + user-portal) / 纪弦 (admin + ops-portal) / 路寒 (studio + 后端)
> **测试账号**: 3 个独立 demo 账号 (见下)
> **测试范围**: 5 portal + 4 后端 + 42 views + ~210 用例
> **报告**: 每位测试员一份独立报告, 虾总助汇总, 按 P0/P1/P2 派工修复, 修完复测

## 🧪 测试账号

| 测试员 | 邮箱 | 密码 | 角色 | 套餐 | 余额 | 负责范围 |
|------|------|------|------|------|------|------|
| 卫峥 | tester-zheng@manhuaworks.local | Test1234! | creator (2) | pro | $100 | web + user-portal |
| 纪弦 | tester-jixian@manhuaworks.local | Test1234! | creator (2) | pro | $100 | admin + ops-portal |
| 路寒 | tester-luhan@manhuaworks.local | Test1234! | creator (2) | pro | $100 | studio + 后端 API |

> **统一规则**: 每位测试员用自己账号登录, 走遍自己负责的 view + 按钮, 一项一项测, 失败就截图 + 写复现步骤

---

## 🎯 测试用例结构 (统一)

每条用例格式:
```
TC-{portal}-{nnn} 标题
  前置: 登录态 / 数据 / URL
  步骤: 1. 点X 2. 输入Y 3. 点Z
  期望: 结果 (跳转/成功/数据正确)
  实际: 测试员填
  状态: ✅PASS / ❌FAIL / ⚠️BLOCK
  截图: 失败必传
```

**严重程度**:
- **P0** — 核心流程完全走不通 (登录/创建/支付 等)
- **P1** — 功能异常/数据错/样式崩
- **P2** — 文案/图标/小细节

---

## 📑 测试范围 (按 portal)

### 🅰️ 卫峥负责 (25 views)

#### A1. web (3000) - 13 views

| ID | View | 关键测试点 |
|----|------|---------|
| TC-WEB-001 | HomeView | 落地页渲染, 营销文案, CTA 按钮, 链接 |
| TC-WEB-002 | LoginView | 登录页表单, 登录后跳转, 错误提示 |
| TC-WEB-003 | DashboardView | 仪表盘数据展示, 卡片, 跳转链接 |
| TC-WEB-004 | studio/StudioHomeView | studio 入口 |
| TC-WEB-005 | studio/ProjectEditorView | 项目编辑器 |
| TC-WEB-006 | studio/CharacterLibraryView | 角色库 |
| TC-WEB-007 | studio/SceneLibraryView | 场景库 |
| TC-WEB-008 | studio/AssetShelfView | 素材架 |
| TC-WEB-009 | studio/ByokSettingsView | BYOK 密钥管理 |
| TC-WEB-010 | studio/ModelSelectorView | 模型选择 |
| TC-WEB-011 | studio/StoryboardEditorView | 分镜编辑 |
| TC-WEB-012 | studio/GenerationProgressView | 生成进度 |
| TC-WEB-013 | studio/ExportView | 导出 |

#### A2. user-portal (5180) - 12 views

| ID | View | 关键测试点 |
|----|------|---------|
| TC-USR-001 | HomeView | 登录后首页 |
| TC-USR-002 | DashboardView | 仪表盘 + 4 数据卡 |
| TC-USR-003 | ProjectsView | 项目列表 + 创建按钮 |
| TC-USR-004 | MyProjectsView | 我的项目 |
| TC-USR-005 | WorksView | 作品列表 |
| TC-USR-006 | MyWorksView | 我的作品 |
| TC-USR-007 | AssetsView | 素材 |
| TC-USR-008 | AssetLibraryView | 素材库 |
| TC-USR-009 | ApiKeysView | API Key 管理 |
| TC-USR-010 | AccountView | 账号设置 |
| TC-USR-011 | SettingsView | 设置 |
| TC-USR-012 | TeamView | 团队 |

---

### 🅱️ 纪弦负责 (10 views)

#### B1. admin-portal (5174) - 7 views

| ID | View | 关键测试点 |
|----|------|---------|
| TC-ADM-001 | DashboardView | 7天收入/活跃曲线 |
| TC-ADM-002 | UsersView | 用户管理 + 搜索/分页/操作 |
| TC-ADM-003 | BillingView | 财务 (充值/退款/对账) |
| TC-ADM-004 | AuditView | 审计日志 |
| TC-ADM-005 | ComplianceView | 合规 |
| TC-ADM-006 | OpsView | 运维 |
| TC-ADM-007 | SettingsView | 设置 |

#### B2. ops-portal (5176) - 3 views

| ID | View | 关键测试点 |
|----|------|---------|
| TC-OPS-001 | DashboardView | 服务状态/告警 |
| TC-OPS-002 | UsersView | 运维用户视图 |
| TC-OPS-003 | BillingView | 运维财务视图 |

---

### 🅲 路寒负责 (7 views + 4 后端)

#### C1. studio (5175) - 7 views

| ID | View | 关键测试点 |
|----|------|---------|
| TC-STD-001 | PlaceholderView | 兜底页 |
| TC-STD-002 | StudioHomeView | 创作工作台首页 |
| TC-STD-003 | ProjectEditorView | 项目编辑器 |
| TC-STD-004 | CharacterView | 角色管理 |
| TC-STD-005 | SceneView | 场景管理 |
| TC-STD-006 | ToolboxView | 工具箱 |
| TC-STD-007 | WorkflowDesignerView | 工作流设计 |
| TC-STD-008 | ExportView | 导出 |

#### C2. 后端 API 直测 (4 service)

| ID | Service | 关键 API |
|----|---------|---------|
| TC-API-001 | user-service (8088) | /api/v1/auth/login, /register, /users/me, /api-keys CRUD |
| TC-API-002 | project-service (8089) | /api/v1/projects CRUD, /assets, /scenes |
| TC-API-003 | billing-service (8090) | /api/v1/billing/balance, /recharge, /subscriptions, /invoices |
| TC-API-004 | collab-service (8091) | /api/v1/collab/comments, /annotations, /realtime |
| TC-API-005 | ai-orchestrator (8087) | /api/v1/orchestrator/jobs, /pipelines, /cost |

---

## 🛠️ 测试方法

### 1. 浏览器自动化 (Puppeteer/Playwright)

每位测试员用 `browser` 工具:
- `action=start` → `action=open targetUrl=...` → `action=snapshot` → `action=act kind=click|ref|fill|press`
- 截图: `action=screenshot`
- console 错误监控: `action=console level=error`

### 2. 后端 API 直测 (curl/python)

```bash
# 登录
curl -X POST http://192.168.0.11:8088/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tester-xxx@manhuaworks.local","password":"Test1234!"}'

# 拿 token + user_id

# 调业务 API
curl http://192.168.0.11:8089/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-mhw-user-id: $USER_ID"
```

### 3. 失败记录

每发现一个 bug:
```
BUG-{portal}-{nnn}
  复现步骤: 1. 登录 2. 点X 3. ...
  期望: ...
  实际: ...
  console 错: ...
  网络: 200/404/500/...
  截图: /path/to/screenshot.png
  严重: P0/P1/P2
```

---

## 📤 报告输出

每位测试员最后输出一份 markdown 报告:
- 文件: `D:\ManhuaWorks\docs\testing\report_{tester_name}_{date}.md`
- 模板: 见下

```markdown
# {测试员} 测试报告 (YYYY-MM-DD)

## 总览
- 测试账号: xxx
- 范围: xxx
- 通过: X / Y (%)
- 失败: Z
- 阻塞: W

## P0 (核心流程)
- BUG-001 ...
- BUG-002 ...

## P1 (功能)
- BUG-010 ...

## P2 (细节)
- BUG-020 ...

## 截图清单
- ./screenshots/001_xxx.png
- ...
```

---

## 🔁 修复 → 复测 流程

1. 虾总助汇总 3 份报告 → 按组件派工
2. 修复员 (谢擎/赵千影/林染/莫言画/陈远枢) 改完 → 在 report 末尾加 `FIXED-BY {name} {time}`
3. 虾总助把 BUG 标 `🔄 RETEST` 派回原测试员
4. 测试员再测 → ✅PASS 关单 / ❌FAIL 升级 (P0 找大哥)
5. 全部 ✅ → 出《全功能测试通过报告》

---

## ⏰ 时间表

| 阶段 | 任务 | 预计 |
|------|------|------|
| M3.5.0 | 准备 (招测试员+注册账号+写清单) | ✅ 完成 |
| M3.5.1 | 3 测试员并行测试 | 60-90 min |
| M3.5.2 | 报告汇总 + 派工修复 | 30 min |
| M3.5.3 | 修复 | 60-180 min (视 bug 数) |
| M3.5.4 | 复测 | 30-60 min |
| M3.5.5 | 最终通过报告 | 15 min |

---

**虾总助 2026-06-09 14:55 立**

---

## 🐛 已修 Bug (2026-06-09 17:50)

- **BUG-RT-01 (P2)**: user-portal `/api-keys` 路径不存在, 实际路径是 `/byok`
  - 修法: `apps/user-portal/src/router/index.ts` 加 2 个 alias (`/api-keys` 和 `/apikeys` 重定向到 `/byok`)
  - 修法: `apps/user-portal/vite.config.ts` 加 `spaApiFallback()` plugin, 拦非 /api/* /v1/* 路径走 SPA fallback
  - 验证: 浏览器实测 `/api-keys` 自动跳 `/byok`, API Key 管理页面 mount OK

- **BUG-RT-02 (P3)**: 复测 prompt 用 user_id 做 project_id 路径 404
  - 修法: 测试员改用例, 真实 project_id 从 POST /projects 返的 id 取
  - 状态: 文档已加备注
