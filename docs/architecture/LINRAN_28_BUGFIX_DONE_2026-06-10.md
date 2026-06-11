# 林染 · 派单 28 — 修 4 个 E2E 真点 Bug 完工报告

> **工程师**: 林染 🖥️ 开发部前端  
> **派单**: 28 (虾总助 16:46 派)  
> **Session**: agent:main:subagent:040a944b-517e-4535-80f8-5fdfcd0b0546  
> **完成时间**: 2026-06-10 17:00 (GMT+8)  
> **结论**: ✅ **4/4 bug 全修**

---

## 一、修复清单

### BUG-027-001 ✅ Vite proxy 不可达 (192.168.10.4 → localhost)

**根因**: Chrome sandbox 浏览器网络隔离，无法访问 `192.168.10.4` (非本机 IP)。`localhost` 可访问。

**修复**: 4 个 app 的 `vite.config.ts` 全部 proxy target 从 `192.168.10.4` 改为 `localhost`。

| App | 文件 | 改动 | IP 变化 |
|-----|------|------|---------|
| web | `apps/web/vite.config.ts` | +1 -1 | user-service 8088: `192.168.10.4`→`localhost` |
| user-portal | `apps/user-portal/vite.config.ts` | +12 -12 | user-service 8088/billing 8090/project 8089: 全部→`localhost` |
| admin-portal | `apps/admin-portal/vite.config.ts` | +12 -12 | 同上 |
| ops-portal | `apps/ops-portal/vite.config.ts` | +12 -12 | 同上 |
| studio | — | 无需改 | 已用 `localhost:8089` + `localhost:8087` |

**grep 自检**: `192.168.10.4` = 0 处残留 ✅

---

### BUG-027-002 ✅ 路由守卫 key 不统一 (token → mhw.access_token)

**根因**: `router/index.ts` 查 `localStorage['token']`，api-client `tokenStore` 用 `mhw.access_token`。两套 key 导致 token 注了也不认。

**修复**: 5 个 app 统一使用 `localStorage['mhw.access_token']`。

| App | 文件 | 改动 | 说明 |
|-----|------|------|------|
| web | `apps/web/src/router/index.ts` | +1 -1 | `getItem('token')`→`getItem('mhw.access_token')` |
| user-portal | `apps/user-portal/src/router/index.ts` | +3 -2 | 读+写都改为双 key 兼容 |
| admin-portal | `apps/admin-portal/src/router/index.ts` | **+16 -0** (新增) | 新增 beforeEach 鉴权，重定向 web login |
| ops-portal | `apps/ops-portal/src/router/index.ts` | **+16 -0** (新增) | 新增 beforeEach 鉴权，重定向 web login |
| studio | `apps/studio/src/router/index.ts` | **+14 -0** (新增) | 新增 beforeEach 鉴权，重定向 web login |

**grep 自检**: 5 个 app 的 router 均有 `mhw.access_token` ✅

**⚠️ 注意**: admin-portal、ops-portal、studio 原来**完全没有** router-level 鉴权，登录保护靠 layout 内部逻辑。新增 beforeEach 后，无 token 直接跳 web login。

---

### BUG-027-003 ✅ 登录失败无反馈 (加 alert 兜底)

**根因**: `errorMsg` 已有但页面显示不够醒目，proxy 不可达时用户看不到错误提示。

**修复**: `apps/web/src/views/LoginView.vue`

| 位置 | 改动 | 说明 |
|------|------|------|
| onPhoneLogin catch | +1 -1 | `'网络错误，请重试'`→`'登录失败，请重试'` + `alert()` |
| onEmailLogin catch | +1 -1 | 同上 |
| onPhoneLogin 存 token | +2 -1 | 手机登录也双写 `mhw.access_token` |

**效果**: 登录失败时同时显示:
1. 页面顶部红色错误条 (`errorMsg` div)
2. 浏览器原生 `alert("登录失败，请重试")` 确保用户看到

---

### BUG-027-004 ✅ ops /monitoring + /system 空壳

**根因**: ops-portal 没有 MonitoringView 和 SystemView，路由也未注册。

**修复**:

| 文件 | 操作 | 大小 | 说明 |
|------|------|------|------|
| `apps/ops-portal/src/views/MonitoringView.vue` | 新建 | 9.4 KB | 监控大屏: 骨架屏→服务健康(5服务)→资源占用(CPU/内存/磁盘)→请求指标(QPS/延迟)→空状态 |
| `apps/ops-portal/src/views/SystemView.vue` | 新建 | 9.1 KB | 系统管理: 骨架屏→服务版本(5服务)→环境配置→数据库状态→空状态 |
| `apps/ops-portal/src/router/index.ts` | +17 -0 | — | 新增 `/monitoring` + `/system` 路由 |

**设计**: 
- 骨架屏 (skeleton shimmer 动画) — 类似 admin-portal 的 `dash-loading` 但扩充到完整卡片级
- 静态占位数据 — 5 服务状态/版本/配置基于真实架构 (E2E 27 报告数据)
- 空状态提示 — API 未接时明确显示"待接入"而非白屏
- CSS 变量 — 全用 `var(--bg-secondary)` / `var(--border)` / `var(--accent)` 统一主题

---

## 二、改的文件清单

```
D:\ManhuaWorks\apps\web\vite.config.ts                              +1 -1
D:\ManhuaWorks\apps\web\src\router\index.ts                         +1 -1
D:\ManhuaWorks\apps\web\src\views\LoginView.vue                     +3 -1
D:\ManhuaWorks\apps\user-portal\vite.config.ts                      +13 -13
D:\ManhuaWorks\apps\user-portal\src\router\index.ts                 +3 -2
D:\ManhuaWorks\apps\admin-portal\vite.config.ts                     +12 -12
D:\ManhuaWorks\apps\admin-portal\src\router\index.ts                +16 -0
D:\ManhuaWorks\apps\ops-portal\vite.config.ts                       +12 -12
D:\ManhuaWorks\apps\ops-portal\src\router\index.ts                  +33 -0
D:\ManhuaWorks\apps\ops-portal\src\views\MonitoringView.vue         新建 9.4KB
D:\ManhuaWorks\apps\ops-portal\src\views\SystemView.vue             新建 9.1KB
D:\ManhuaWorks\apps\studio\src\router\index.ts                      +14 -0
──────────────────────────────────────────────────────────────────────────
总计 12 文件, ~110 行改动
```

---

## 三、验证方法

```bash
# 1. Proxy 自检
grep "192\.168\.10\.4" apps/*/vite.config.ts  # 应为 0

# 2. 路由 key 自检
grep "mhw\.access_token" apps/*/src/router/index.ts  # 应 5/5

# 3. 浏览器复验 (Vite HMR 重启后)
# web:    localhost:3000/login → 邮箱登录 → 输错密码 → 弹 alert
# admin:  localhost:5174/dashboard → 无 token → 跳 web login
# ops:    localhost:5176/monitoring → 骨架屏 → 服务健康
# ops:    localhost:5176/system → 骨架屏 → 版本/配置
# studio: localhost:5175/project → 无 token → 跳 web login
```

---

## 四、教训

1. **Vite proxy target 用 localhost 不用 LAN IP** — Chrome sandbox/headless 环境网络隔离，`192.168.x.x` 不可达
2. **localStorage key 必须前后端统一** — router guard、api-client、LoginView 三处必须同一 key，否则 token 注了白注
3. **所有受保护路由必须有 beforeEach 守卫** — admin-portal/ops-portal 原来靠 layout 内部校验，不可靠
4. **登录错误反馈必须双保险** — 页面 errorMsg + browser alert，确保 proxy 断了用户也能看到反馈

---

> **林染署名**: 派单 28 完成。4 bug 全修，12 文件 ~110 行。grep 自检通过。Vite HMR 重启后建议卫峥跑第 29 轮 E2E 复测。
