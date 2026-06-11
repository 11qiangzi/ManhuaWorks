# 陈远枢 · 派单 52 第二阶段精细化打磨计划

> **派单人**: 虾总助 (梁总 23:39 钦定)
> **执行人**: 陈远枢 📊 运营总监
> **完工时间**: 2026-06-10 23:55
> **梁总原话**: "要么不改, 要改就一次性改到位"

---

## 🩺 第一阶段验收结论

经过对派单 44-49 六份完工报告的逐行审查，第一阶段 P0 整改 **表面上看全部完工**：

| 派单 | 任务 | 报告状态 | 实际状态 |
|------|------|---------|---------|
| 44 | P0 技术整改 (程构) | ✅ 7/7 完工 | ⚠️ 含手动补丁 (rateLimit 路径) |
| 45 | P0 内容整改 (林知行) | ✅ 25/25 完工 | ✅ 真完工 |
| 46 | Admin/Ops mockup (赵千影) | ✅ 10/10 完工 | ✅ 真完工，但前端未接入 |
| 47 | 5站前端性能 (林染) | ✅ 5项全完 | ⚠️ 3站 build 产物未生成 |
| 48 | 后端统一化 (谢擎) | ✅ 30/30 完工 | ⚠️ billing/collab 未完全迁移 |
| 49 | UserLayout 修复 (林染) | ✅ 已完成 | ⚠️ 发现 admin-portal 零布局 |

**结论**: 第一阶段"及格"——P0 核心功能已就位，但**有 4 类遗留问题需要第二阶段打磨**。

---

## 🔴 P0 遗留清单 (第二阶段必须清零)

### 问题 1: admin-portal 零布局 (P0 · 林染域 · 影响: 平台后台完全不可用)

**证据链**:
- 林染派单 49 (01:10): "admin-portal ⚠️: 当前仅 `<router-view />`，无任何布局包裹。建议单独派单补充 admin 侧边栏"
- 林染派单 47: admin-portal 路由已配好 11 个 (含 AdminLayout 懒加载)，但 **AdminLayout.vue 模板为空或路由未正确嵌套**
- 赵千影派单 46: admin mockup 7 张已出图 (仪表盘/用户/项目/计费/设置/日志/分析)，但前端零接入
- 谢擎派单 48: admin 20 API 端点已就绪，**后端数据等着前端来消费**

**影响**: admin-portal (5174) 当前打开后 = 白屏/404，平台管理后台完全不可用

**根因**: 前端 Layout 组件与路由嵌套未联调。AdminLayout 存在但未正确包裹 `<router-view />`

**责任人**: 林染 (开发部前端)
**预计人天**: 1 人天
**签收**: ⬜ 林染

---

### 问题 2: monorepo vite-plugin-webp 依赖解析 bug (P0 · 程构域 · 影响: 3站生产构建失败)

**证据链**:
- 林染派单 49: "Vite 构建失败于 `@manhuaworks/vite-plugin-webp` 包解析 (monorepo 依赖链接问题，预存 bug)"
- 林染派单 49: "`pnpm install` 报错 + `vite-plugin-webp` 无法解析，需排查 pnpm workspace 链接配置"
- 林染派单 47: "admin-portal / ops-portal / user-portal 的 gzip/brotli 产物需执行 `pnpm build` 后生成。当前仅 dev server 验证通过"

**影响**: 
- admin-portal / ops-portal / user-portal 三站 **生产构建 (pnpm build) 失败**
- gzip/brotli 压缩产物无法生成 → CDN 无法部署 → 用户实际体验无改善
- P0 声称的 "5 站 gzip/WebP/CDN" 实际只有 web + studio 两站真生效

**根因**: pnpm workspace 配置中 `@manhuaworks/vite-plugin-webp` 包的软链接/别名不正确，导致 Vite 在 build 模式无法解析该插件

**责任人**: 程构 (开发部长/架构) + 林染 (验证)
**预计人天**: 1 人天 (程构 0.5 + 林染 0.5)
**签收**: ⬜ 程构

---

### 问题 3: shared 包 rateLimit 导出路径虚假 (P0-C1 · 谢擎域 · 影响: shared 包完整性不可信)

**证据链**:
- 程构派单 44: "`@manhuaworks/shared` 的 `rateLimit` 导出路径不一致 (`src/middleware/rate-limit.ts` 文件缺失)。已从 `packages/shared/middleware/rate-limit.ts` 复制到 `src/middleware/`"
- 这暴露了一个**架构层面的问题**: shared 包的 `package.json` exports 字段声明了实际不存在的文件路径
- 说明 shared 包的构建脚本或文件清单有误——可能存在其他类似虚假导出

**影响**: 
- shared 包的可靠性存疑——如果 rateLimit 是虚假导出，其他导出是否也有问题？
- 任何新服务接入 shared 时可能踩同样的坑

**根因**: shared 包的 `package.json` exports 与 src 文件树不一致。可能原因: git 未追踪 `src/middleware/rate-limit.ts`，或文件被误删

**责任人**: 程构 (架构) + 谢擎 (验证)
**预计人天**: 0.5 人天
**签收**: ⬜ 程构

---

### 问题 4: 派单 47 context lost — 3 站构建 & 跨站联调 (P0 · 林染+谢擎联合域 · 影响: P0 声称的优化实际未对用户生效)

**证据链**:
- 林染派单 47: "admin-portal / ops-portal / user-portal 的 gzip/brotli 产物需执行 `pnpm build` 后生成。当前仅 dev server 验证通过"
- 林染派单 47 报告从未提过 `pnpm build` 失败——这说明验收时只验了 dev server，没验 build
- 但派单 49 才暴露 "Vite 构建失败于 vite-plugin-webp 包解析"
- **时序矛盾**: 派单 47 说"✅ 已完成"但根本没跑过 build → 属于验收不严

**影响**: 
- P0 性能优化对 3/5 站点 (admin/ops/user) **实际未生效**
- CDN 缓存策略依赖 hash 文件名，build 失败 = hash 文件未生成 = CDN 配置无效
- 这是**最大的验收漏洞**——报告说完了但产物不存在

**责任人**: 程构 (修 pnpm workspace) → 林染 (跑 build 验证) → 谢擎 (Nginx 对接)
**预计人天**: 1 人天
**签收**: ⬜ 程构 → ⬜ 林染 → ⬜ 谢擎

---

## 🟡 P1 遗留清单 (第二阶段同步清)

| # | 问题 | 位置 | 责任人 | 人天 | 签收 |
|---|------|------|--------|------|------|
| 5 | billing-service 健康检查格式未统一 (本地 healthController，未用 shared healthRouter) | billing-service | 谢擎 | 0.5 | ⬜ |
| 6 | collab-service 本地 authRequired 未替换为 shared requireAuth() | collab-service | 谢擎 | 0.5 | ⬜ |
| 7 | 共享组件库 20+ MVP 未启动 | packages/shared/ui | 林染 + 陆流光 | 3 | ⬜ |
| 8 | 主题切换 (深色/浅色) 未实现 | 5 站 CSS 变量 | 林染 | 1 | ⬜ |
| 9 | admin-portal 前端未接入赵千影 mockup (7 张已出图但 0 接入) | admin-portal | 林染 | 1.5 | ⬜ |
| 10 | ops-portal build 失败 (同问题 2) | ops-portal | 程构→林染 | (含问题2) | ⬜ |
| 11 | user-portal build 失败 (同问题 2) | user-portal | 程构→林染 | (含问题2) | ⬜ |

---

## 🔀 交叉排查: 林染 ↔ 谢擎 跨部门联调测试

### 测试范围 (2 小时, 林染主持, 谢擎配合)

按大哥要求: **"找出是不是接口对接导致的体验割裂"**

| # | 测试场景 | 前端 (林染) | 后端 (谢擎) | 预期 | 实际 | 割裂? |
|---|---------|-----------|-----------|------|------|------|
| T1 | admin-portal dashboard 加载 | AdminLayout 渲染 + API 调用 | GET /api/v1/admin/dashboard/overview | 数据面板正常显示 | ⬜ 待测 | ⬜ |
| T2 | admin-portal 用户列表分页 | 表格渲染 + 分页器 | GET /api/v1/admin/users?offset=&limit= | 分页正常, 列对齐 | ⬜ 待测 | ⬜ |
| T3 | ops-portal 实时监控 | 仪表盘渲染 + polling | GET /api/v1/ops/metrics/live | 5s 轮询正常, 数据格式匹配 | ⬜ 待测 | ⬜ |
| T4 | 5 站鉴权链统一测试 | 未登录→跳转/login, 已登录→正常访问 | requireAuth() 5站生效 | 5站鉴权行为一致 | ⬜ 待测 | ⬜ |
| T5 | 5 站错误响应格式 | 前端 error toast 文案 | 统一 {error: {code, message}} | 错误提示中文、格式统一 | ⬜ 待测 | ⬜ |
| T6 | admin-portal 跨服务数据聚合 | 前端表格数据源 | admin/overview 聚合 users+projects+invoices | 聚合数据正确 | ⬜ 待测 | ⬜ |
| T7 | 5 站侧边栏 + 导航跳转 | 侧边栏点击 → 路由跳转 | (无后端) | 5站侧边栏统一240px, 跳转正确 | ⬜ 待测 | ⬜ |
| T8 | studio → user-portal 跨站跳转 | `/projects/:id` → studio:5175 编辑 | (无后端) | 跨站跳转正确 | ⬜ 待测 | ⬜ |

### 联调交付物

| 交付物 | 负责人 | 格式 |
|--------|--------|------|
| 跨部门联调测试报告 | 林染 + 谢擎 | `docs/testing/CROSS_DEPT_INTEGRATION_TEST_2026-06-11.md` |
| 割裂问题清单 (如有) | 林染 | 同上文件 |
| 修复 patch (如 ≤2 文件) | 谢擎/林染 | PR 到对应仓库 |

---

## 📅 第二阶段微调排期表

### 总体时间线

```
6/10 23:59 — 本计划交付
6/11 00:00-02:00 — P0 4 项齐修 (程构 + 林染 + 谢擎 并行)
6/11 02:00-04:00 — 交叉联调测试 (林染 + 谢擎)
6/11 10:00 — P0 验证 + 产出交付
6/11-13 — P1 7 项清尾 (并行)
```

### P0 清零排期 (今晚通宵)

| 序号 | 问题 | 负责人 | 开始 | 截止 | 人天 | 验收标准 |
|------|------|--------|------|------|------|---------|
| P0-1 | admin-portal 零布局 → 接入 AdminLayout + 赵千影 mockup | 林染 | 00:00 | 02:00 | 1 | admin-portal(5174) 7 页可访问, 侧边栏+数据面板正常 |
| P0-2 | vite-plugin-webp monorepo 依赖解析 | 程构 | 00:00 | 01:00 | 0.5 | 5 站 `pnpm build` 全部通过, .gz/.br 产物生成 |
| P0-3 | shared 包 rateLimit 导出清理 + 全量 exports 自检 | 程构 | 01:00 | 01:30 | 0.5 | `package.json` exports 与 src/ 树 100% 一致 |
| P0-4 | 3 站 production build + gzip/CDN 端到端验证 | 林染 (build) + 谢擎 (Nginx) | 01:30 | 02:00 | 0.5 | admin/ops/user 三站 build 通过 + CDN hash 生效 |

**P0 总人天: 2.5**

### 交叉联调排期

| 序号 | 测试项 | 负责人 | 开始 | 截止 | 交付物 |
|------|--------|--------|------|------|--------|
| X1 | admin-portal 7 页 API 联调 | 林染+谢擎 | 02:00 | 03:00 | 测试报告 |
| X2 | ops-portal 3 页 API 联调 | 林染+谢擎 | 02:30 | 03:30 | 测试报告 |
| X3 | 5 站鉴权链 + 错误格式统一测试 | 林染+谢擎 | 03:00 | 03:30 | 测试报告 |
| X4 | 整理联调报告 + 割裂问题清单 | 林染 | 03:30 | 04:00 | `CROSS_DEPT_INTEGRATION_TEST_2026-06-11.md` |

**联调总时间: 2 小时**

### P1 清尾排期 (6/11-13)

| 序号 | 问题 | 负责人 | 人天 | 截止 |
|------|------|--------|------|------|
| P1-1 | billing-service 切 shared healthRouter | 谢擎 | 0.5 | 6/11 18:00 |
| P1-2 | collab-service auth → shared requireAuth() | 谢擎 | 0.5 | 6/11 18:00 |
| P1-3 | 共享组件库 20+ MVP 启动 | 林染 + 陆流光 | 3 | 6/13 18:00 |
| P1-4 | 5 站深色/浅色主题切换 | 林染 | 1 | 6/12 18:00 |
| P1-5 | admin-portal 赵千影 mockup 全量接入 (7 页) | 林染 | 1.5 | 6/12 18:00 |
| P1-6 | 校验 shared 包全量 5 服务引用一致性 | 程构 | 0.5 | 6/11 18:00 |

**P1 总人天: 7**

---

## 📊 资源分配

| 员工 | P0 任务 | 联调 | P1 任务 | 总人天 |
|------|---------|------|---------|--------|
| **程构** (架构) | P0-2 + P0-3 (1) | — | P1-6 (0.5) | **1.5** |
| **林染** (前端) | P0-1 + P0-4-build (1.5) | X1-X4 (2h) | P1-3 + P1-4 + P1-5 (5.5) | **7.0** |
| **谢擎** (后端) | P0-4-nginx (0.5)  | X1-X3 (1.5h) | P1-1 + P1-2 (1) | **1.5** |
| **陆流光** (设计) | — | — | P1-3 (2) | **2.0** |
| **林知行** (内容) | 验收 P1-3/P1-4/P1-5 | — | 审定共享组件库设计规范 | **0.5** |

---

## ⚠️ 风险评估

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| vite-plugin-webp 修复涉及深层 pnpm 配置 | 中 | P0-2 延期 30min | 程构备选方案: 降级为手动 WebP 转换脚本 |
| admin-portal Layout 与 mockup 差异大 | 低 | P0-1 UI 返工 | 赵千影 mockup 已有具体布局参考, 直接套用 |
| 联调发现大量割裂 | 中 | 产出超出2小时 | 割裂问题分级: 🔴现修 / 🟡P1排 / 🟢P2排 |
| 深夜通宵疲劳导致质量下降 | 高 | bug 率上升 | 每完成 1 项自检 + 程构交叉 review |

---

## 📂 交付物

| 文件 | 内容 | 负责人 | 路径 |
|------|------|--------|------|
| 本计划 | P0/P1 清单 + 联调方案 + 排期表 | 陈远枢 | `CHENYUANSHU_52_PHASE2_PLAN_2026-06-10.md` |
| 微调计划表 (简版) | 可追踪的任务排期 | 陈远枢 | `PHASE2_MICRO_ADJUST_PLAN_2026-06-11.md` |
| 跨部门联调测试报告 | 8 项测试结果 + 割裂清单 | 林染 + 谢擎 | `docs/testing/CROSS_DEPT_INTEGRATION_TEST_2026-06-11.md` |

---

## ✅ 签收区

| 角色 | 签收内容 | 签字 | 时间 |
|------|---------|------|------|
| 程构 (开发部长) | P0-2 vite-plugin-webp + P0-3 shared 清理 | ⬜ | |
| 林染 (前端) | P0-1 admin布局 + P0-4 build验证 | ⬜ | |
| 谢擎 (后端) | P0-4 Nginx对接 + P1-1/2 billing/collab迁移 | ⬜ | |
| 林知行 (内容部长) | P1-3~5 审定 | ⬜ | |
| 陆流光 (设计) | P1-3 共享组件库视觉规范 | ⬜ | |
| 陈远枢 (运营总监) | 本计划交付 + 全程监督 + 异常熔断 | ✅ | 23:55 |

---

> **陈远枢 · 运营总监**
> **2026-06-10 23:55**
> **标准: 要么不改, 要改就一次性改到位**
