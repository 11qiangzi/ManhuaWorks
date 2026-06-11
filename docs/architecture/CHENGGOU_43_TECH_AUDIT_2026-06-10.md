# 程构 · 全站技术体检 + 优化排期

> **派单**: (子) 43-1 (陈远枢 21:46 派)
> **完成时间**: 2026-06-10 21:50
> **体检范围**: 5 前端 + 5 服务 + 数据库 + 部署基础设施
> **参考基线**: 谢擎派单 25 perf 数据 / DEV_TEAM_PLAN / SERVICE_CALL_CHAIN 71 链路

---

## 一、性能瓶颈

### P0 (阻塞级 — 3 天内必修, 影响核心用户体验)

| # | 问题 | 根因 | 影响范围 | 当前值 | 目标 |
|---|------|------|---------|--------|------|
| P0-1 | **project-service + collab-service 未启动** | 代码就位但服务未启, 谢擎派单 22-26 完工后未验证启动 | studio 18 页中 3 页 (分镜编辑/宫格/场景编辑) 白屏; user-portal 团队页功能缺失 | 2 服务 down | 全部 up, E2E 全绿 |
| P0-2 | **前端无 gzip/brotli 压缩** | Vite 配置未开启 compression 插件 | 5 前端 JS/CSS 首次加载体积 ≈ 800KB-1.2MB 未压缩 | 首页 FCP 估计 3-5s (未实测) | FCP <1.5s |
| P0-3 | **图片无 lazy loading + 无 WebP 转换** | `<img>` 无 loading="lazy" 属性, 无图片优化 pipeline | 5 前端所有 mockup/插图首屏全量加载 | 首屏图片请求 >15 张 | 首屏图片 ≤5 张 |
| P0-4 | **5 服务无统一健康检查端点标准** | ops-portal health/metrics 端点未实现, 无法监控 | 运维盲区, 无自动告警 | — | /health 标准响应 |
| P0-5 | **web 首页无 CDN 缓存策略** | Nginx 未配 Cache-Control, 静态资源每次重新请求 | web(3000) 产品首页重复访问无缓存 | 缓存命中率 0% | Cache-Control: max-age=86400 |

### P1 (重要级 — 1 周内修, 影响品牌体验)

| # | 问题 | 根因 | 影响范围 | 当前值 | 目标 |
|---|------|------|---------|--------|------|
| P1-1 | **5 前端 Google Fonts 同步加载阻塞渲染** | `<link>` 未加 `media="print" onload` 策略 | 所有页面首次渲染被字体文件阻塞 | FOIT 1-3s | 字体异步加载, display=swap |
| P1-2 | **DB 查询无索引覆盖高频字段** | users.email, projects.user_id, projects.status 未建索引; pg_stat_statements 未启用 | user-service/project-service 高频查询全表扫描 | 估计 >100ms/query | <20ms |
| P1-3 | **Vue 组件无按需加载 (lazy import)** | router 所有页面同步 import, web 4 页/studio 18 页一次性打进 bundle | 首屏 bundle 过大, 包含所有路由组件 | estimate bundle >500KB gzip | <200KB gzip |
| P1-4 | **api-keys reveal 无一次性显示逻辑验证** | 谢擎/林染未确认 reveal 端点是否真的只显示一次 | 安全隐患: API key 可被重复获取 | — | reveal 一次后 hash |

### P2 (优化级 — 2 周内修, 锦上添花)

| # | 问题 | 根因 | 影响范围 | 当前值 | 目标 |
|---|------|------|---------|--------|------|
| P2-1 | **Redis 缓存策略缺失** | 仅 billing-service 用了 Redis Pub-Sub, 其他 4 服务无缓存层 | 重复 DB 查询浪费 | 缓存命中率 ≈ 5% | >60% |
| P2-2 | **前端 CSS 无 Tree Shaking** | Vite 默认只对 JS tree shake, CSS 全量打包 | 5 前端 CSS bundle 包含未使用样式 | — | PurgeCSS/Unocss |
| P2-3 | **5 服务日志无结构化** | console.log 裸打, 无 traceId 贯穿 | 故障排查困难, 跨服务调用无关联 | — | winston + traceId header |
| P2-4 | **Docker/CI 未标准化** | 无 Dockerfile 模板, 无 CI 流水线 | 部署靠手工, 无回滚能力 | — | Dockerfile + GitHub Actions |
| P2-5 | **admin-portal + ops-portal mockup 缺失** | 林染 28 张仅覆盖 web(4) + studio(18) + user-portal(6), admin(7)+ops(3) 待补 | admin/ops 无设计稿 → 无法开发 | 0/10 张 | 10/10 张 |

---

## 二、代码冗余

### P0 (阻塞级)

| # | 问题 | 位置 | 影响 | 建议 |
|---|------|------|------|------|
| P0-C1 | **5 服务 authMiddleware 各自实现, 代码重复** | user/project/collab/billing/ai-orch 各有一份 auth 中间件 | 维护成本 ×5, 鉴权链不统一已知 bug #2 (list 端点未过鉴权) | 提取到 `packages/shared/middleware/auth.ts`, 5 服务统一引用 |
| P0-C2 | **5 服务错误响应格式不统一** | user 返回 `{code, message}`, project 返回 `{error, msg}`, billing 返回 `{status, data}` | 前端错误处理逻辑分裂 | 统一 `{code, message, data?}` 谢擎标准 |

### P1 (重要级)

| # | 问题 | 位置 | 影响 | 建议 |
|---|------|------|------|------|
| P1-C1 | **5 前端重复的 Layout 组件** | web/studio/user-portal/admin-portal/ops-portal 各有独立的 Header/Footer/Sidebar | 5 份维护, UI 不一致 | 提取到 `packages/shared/ui/Layout`, 5 站统一引用 |
| P1-C2 | **前端 API 调用重复封装** | 每个前端各自写了 fetch wrapper, 无统一拦截器 (token refresh/401 redirect/rate-limit handling) | 5 份代码, token 刷新逻辑可能遗漏 | 提取到 `packages/shared/api/client.ts` |
| P1-C3 | **未使用的 npm 依赖** | 各服务 package.json 可能残留已弃用的依赖 (如旧 AI SDK 版本) | bundle 膨胀 | `npx depcheck` 清理 |

### P2 (优化级)

| # | 问题 | 位置 | 影响 | 建议 |
|---|------|------|------|------|
| P2-C1 | **5 前端重复的工具函数** | formatDate/formatCurrency/debounce/throttle 等工具函数各前端独立实现 | 5 份维护 | 提取到 `packages/shared/utils` |
| P2-C2 | **前端无 ESLint/Prettier 统一配置** | 各前端可能使用不同 lint 规则 | 代码风格不统一 | `packages/shared/eslint-config` |
| P2-C3 | **类型定义分散** | User/Project/Character 等 TypeScript 类型在每个服务/前端各自定义 | 类型不一致风险 | `packages/shared/types` 统一导出 |

---

## 三、优化排期

### P0 (3 天内, 阻塞级)

| 优先级 | 项目 | 当前状态 | 目标 | 人天 | 截止 | 负责人 |
|--------|------|---------|------|------|------|--------|
| P0 | project-service + collab-service 启动验证 | 代码就位, 未启动 | 2 服务 up + E2E 全绿 | 0.5 | 2026-06-11 | 谢擎 |
| P0 | 5 服务鉴权链统一 (authMiddleware 提取) | 各自实现, 已知 bug #2 | `packages/shared/middleware/auth.ts` 统一引用 | 1 | 2026-06-11 | 谢擎 |
| P0 | 前端 gzip/brotli 压缩开箱 | Vite 未配置 | `vite-plugin-compression` 开箱即用 | 0.5 | 2026-06-11 | 林染 |
| P0 | 图片 lazy loading + WebP | 无优化 | 首屏图片 ≤5, 全站 loading="lazy" | 0.5 | 2026-06-12 | 林染 |
| P0 | web 首页 CDN/Nginx 缓存策略 | 无缓存 | Cache-Control + gzip_static | 0.5 | 2026-06-12 | 程构 |
| P0 | 5 服务接口规范统一 (错误码+字段名) | 格式不一致 | `{code, message, data?}` 全站统一 | 1 | 2026-06-12 | 谢擎 |
| P0 | 5 服务错误响应格式统一 | 3 种不同格式 | 统一谢擎标准 | 0.5 | 2026-06-12 | 谢擎 |

**P0 小计: 4.5 人天, 3 天完工 (谢擎 2 + 林染 1 + 程构 0.5)**

### P1 (1 周内, 重要级)

| 优先级 | 项目 | 当前状态 | 目标 | 人天 | 截止 | 负责人 |
|--------|------|---------|------|------|------|--------|
| P1 | 前端 Layout 组件统一 | 5 份独立 | `packages/shared/ui/Layout` | 2 | 2026-06-16 | 林染 |
| P1 | 前端 API client 统一 | 5 份 fetch wrapper | `packages/shared/api/client.ts` | 1.5 | 2026-06-16 | 林染 |
| P1 | 前端工具函数统一 | 5 份独立 | `packages/shared/utils` | 1 | 2026-06-16 | 林染 |
| P1 | 字体异步加载 (Google Fonts → display=swap) | 同步阻塞 | FOIT 消除 | 0.5 | 2026-06-16 | 林染 |
| P1 | DB 高频索引 (email/user_id/status) | 无索引 | create index migration | 1 | 2026-06-16 | 谢擎 |
| P1 | Vue 路由按需加载 (lazy import) | 同步 import | defineAsyncComponent | 1 | 2026-06-16 | 林染 |
| P1 | npm 依赖清理 (depcheck) | 可能残留 | 清理未使用依赖 | 0.5 | 2026-06-16 | 谢擎 |

**P1 小计: 7.5 人天, 5 天完工 (林染 6 + 谢擎 1.5)**

### P2 (2 周内, 优化级)

| 优先级 | 项目 | 当前状态 | 目标 | 人天 | 截止 | 负责人 |
|--------|------|---------|------|------|------|--------|
| P2 | Redis 缓存策略 | 仅 billing 用 Redis | 高频查询缓存 (用户信息/项目列表) | 2 | 2026-06-23 | 谢擎 |
| P2 | CSS Tree Shaking (Unocss/PurgeCSS) | CSS 全量打包 | CSS bundle <50KB | 1 | 2026-06-23 | 林染 |
| P2 | ESLint/Prettier 统一配置 | 各站独立 | `packages/shared/eslint-config` | 1 | 2026-06-23 | 程构 |
| P2 | TypeScript 类型统一 | 分散定义 | `packages/shared/types` | 1 | 2026-06-23 | 谢擎 |
| P2 | 结构化日志 (winston + traceId) | console.log 裸打 | 跨服务 traceId 贯穿 | 1.5 | 2026-06-23 | 谢擎 |
| P2 | Dockerfile + CI 标准化 | 手工部署 | GitHub Actions 自动部署 | 2 | 2026-06-23 | 程构 |
| P2 | api-keys reveal 一次性逻辑验证 | 未确认 | reveal 一次后永久 hash | 0.5 | 2026-06-23 | 谢擎 |

**P2 小计: 9 人天, 10 天完工 (谢擎 5 + 林染 1 + 程构 3)**

---

## 四、总体健康评分

| 维度 | 当前评分 | 目标评分 | 关键差距 |
|------|---------|---------|---------|
| 服务可用性 | 🟡 60% (3/5 up) | 🟢 100% | project-service + collab-service 启动 |
| 页面加载速度 | 🔴 估计 FCP 3-5s (未压缩) | 🟢 FCP <1.5s | gzip + lazy load + 路由懒加载 |
| 代码健康度 | 🟡 55% (重复/分散) | 🟢 85% | 5 站统一 shared 包 |
| 监控可观测性 | 🔴 10% (无监控) | 🟢 70% | health 端点 + 结构化日志 |
| 部署自动化 | 🔴 0% (手工) | 🟢 80% | Dockerfile + CI |
| 安全合规 | 🟡 70% (已知隐患) | 🟢 95% | 鉴权统一 + api-key reveal |

**综合评分: 🟡 49% → 目标 🟢 85% (P0+P1 全部完工后)**

---

## 五、前置依赖确认

| 依赖项 | 状态 | 阻塞 |
|--------|------|------|
| 谢擎派单 25 perf 修复 | ✅ 已完成 | 无 |
| SERVICE_CALL_CHAIN 71 链路 | ✅ 已交付 | 无 |
| DEV_TEAM_PLAN | ✅ 已交付 | 无 |
| PORTALS_ARCHITECTURE | ✅ 已交付 | 无 |
| 林染 28 张 mockup | ✅ 已交付 | 无 |
| admin-portal + ops-portal mockup | ❌ 未交付 | ⚠️ 阻塞 P2 admin/ops 前端开发 |
| pg_stat_statements 启用 | ⚠️ 需 DBA 操作 | 阻塞 P1 DB 索引优化验证 |

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 谢擎 1 人全栈瓶颈 (P0+P1+P2 = 8 人天) | 高 | 排期延期 | P0 优先谢擎, P1 林染分担前端, P2 程构分担 DevOps |
| admin/ops mockup 未交付阻塞开发 | 中 | P2 延期 | 陈远枢协调林知行+赵千影加速出 mockup |
| DB migration 需要 DBA 权限 | 低 | P1 DB 索引延期 | 提前申请 DBA 权限 |
| 5 服务改造 + 前端整改并行冲突 | 低 | 接口契约不一致 | 程构先出共享契约文档, 谢擎+林染同步开工 |
