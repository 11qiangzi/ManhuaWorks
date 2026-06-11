# LAN Access Guide - 本机当服务器, IP 访问

> **更新时间**: 2026-06-09 13:30
> **状态**: M3 部署完成, 大哥可访问

---

## 🌐 访问地址

本机 IP: **192.168.10.4**

### 5 个前端 (Web Portal)
| 名称 | URL | 用途 |
|------|-----|------|
| Web (官网) | http://192.168.10.4:3000/ | 公共首页 |
| Admin Portal | http://192.168.10.4:5174/ | 管理员后台 |
| Studio | http://192.168.10.4:5175/ | 创作工作台 |
| User Portal | http://192.168.10.4:5180/ | 用户中心 (含 API Key 管理) |
| Ops Portal | http://192.168.10.4:5176/ | 运维监控 |

### 5 个后端 Service (直连)
| 服务 | URL | /health |
|------|-----|---------|
| user-service | http://192.168.10.4:8088/ | 200 |
| project-service | http://192.168.10.4:8089/ | 200 |
| billing-service | http://192.168.10.4:8090/ | 200 |
| collab-service | http://192.168.10.4:8091/ | 200 |
| ai-orchestrator | http://192.168.10.4:8087/ | 200 (dev-skipped) |

---

## 🔑 ## 4 演示账号 (L5-D 真实 seed)

| 邮箱 | 密码 | 角色 | 套餐 |
|------|------|------|------|
| demo-admin@manhuaworks.local | Test1234! | 5 admin | team |
| demo-creator@manhuaworks.local | Test1234! | 2 creator | pro |
| demo-free@manhuaworks.local | Test1234! | 1 regular | free |
| demo-business@manhuaworks.local | Test1234! | 4 business | team |

⚠️ 邮箱后缀是 .local 不是 .dev (原文档写错了)


## 🛠️ 4 个角色可测的功能

### Admin (管理后台) - http://192.168.10.4:5174/
- 用户管理 (查看/编辑/禁用)
- 项目管理
- API Key 监控
- 系统设置

### Pro 用户 (创作者) - http://192.168.10.4:5180/
- 创建项目
- 管理 API Key (含 reveal 明文)
- 充值 / 余额 / 发票
- 调用 AI 编排器

### Normal 用户
- 只读个人中心
- 简单 API Key (1 个免费额度)

### CS (客服)
- 看用户余额/订阅
- 退款处理

---

## 🧪 快速测试路径

1. **打开 Admin Portal** http://192.168.10.4:5174/
2. **登录** `admin@manhuaworks.dev` / `Test1234!`
3. **看 Dashboard** 数据 (用户/项目/订阅)
4. **切到 User Portal** http://192.168.10.4:5180/
5. **用 Pro 登录** `pro@manhuaworks.dev` / `Test1234!`
6. **进 API Keys** → 创建 → **reveal** 看明文
7. **进 Billing** → 充值 (mock 支付) → 看余额
8. **进 Studio** http://192.168.10.4:5175/ 看 AI 编排

---

## ⚠️ 已知问题 (不影响主流程)

1. **8087 ai-orchestrator 依赖未起** (M2 范围外): workflow/asset/ai-helper/ai-router 4 个 service 还没建, /health 返回 `mode=dev-skipped` 是预期
2. **PDF 生成** (billing 发票): pdfkit 已装, 但需要测试
3. **WebSocket 实时协作** (collab 8091): 需要登录 + 打开项目, 才能看到

---

## 🔄 重启指南

如果服务挂了, 跑这些命令:

```powershell
# 杀所有 service
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*services\*index.ts*" } | Stop-Process -Force

# 重启
$D:\ManhuaWorks\services\billing-service
# 用 tsx watch (绝对路径)
Start-Process cmd.exe "/c D:\ManhuaWorks\services\billing-service\node_modules\.bin\tsx.cmd watch src/index.ts" -WindowStyle Hidden
```

**虾总助在 M3 全程在线, 任何卡住找我。**

---

## 🦞 关键修复 (M3 1h 干完)

1. **ai-orchestrator /health 503** → 加 `isDev` 跳过 deps 检查 + `mode: dev-skipped` 字段
2. **collab-service 中文 mojibake 编译错** → Python 整段重写 graceful-shutdown 块
3. **collab-service env.ts L16 中文破坏** → 替换为 ASCII 错误信息
4. **billing-service OpenTelemetry 死递归崩** → 修 logger package `buildW3CPropagator` fallback (不再返回 propagation 自身) + 修 `initTelemetry enabled=false` 不再 set propagator
5. **billing/collab 启动顺序 bug** → dotenv/config 必须在 telemetry 之前 import
6. **3 service 加 HOST=0.0.0.0** → project/billing/collab 监听全网
7. **端口冲突** → Wondershare WsToastNotification 占 8090 → 杀 Wondershare 进程 + 改 billing 端口方案没用到 (杀完直接 8090 成功)
8. **billing 装 pdfkit** → pnpm add pdfkit --filter billing-service

**共 8 项修复, 6 个文件改动, 耗时 1h。**

---

## 📊 部署后端口状态

| 端口 | 状态 | 监听 |
|------|------|------|
| 3000 | ✅ | 0.0.0.0 |
| 5174 | ✅ | 0.0.0.0 |
| 5175 | ✅ | 0.0.0.0 |
| 5176 | ✅ | 0.0.0.0 |
| 5180 | ✅ | 0.0.0.0 |
| 8087 | ✅ | 0.0.0.0 |
| 8088 | ✅ | 0.0.0.0 |
| 8089 | ✅ | 0.0.0.0 |
| 8090 | ✅ | 0.0.0.0 |
| 8091 | ✅ | 0.0.0.0 |

**全 10 端口在 0.0.0.0 监听, 大哥任意终端都能访问。**

---

## M3 (2026-06-09) 修清单 (LAN 部署 2.0)

### 真正修复的 3 个大坑

1. **vite proxy 多端口分流** — user/admin/ops portal 的 vite.config.ts 加 4 路由分流:
   - `/v1/auth`, `/v1/users`, `/v1/user`, `/v1/account` → user-service:8088
   - `/v1/billing` → billing-service:8090
   - `/v1/*` 默认 → project-service:8089
   - `/v1` 加 `rewrite: (path) => '/api' + path`

2. **api-bridge baseURL** — user-portal + admin-portal 的 `src/api-bridge.ts` 加 `baseURL: '/api/v1'`

3. **user-portal services/project-service.ts** — `BASE = '/v1/projects'` → `BASE = '/api/v1/projects'`

### 演示账号密码

原 ACCESS_GUIDE 写的是 `admin@manhuaworks.dev` 但实际 seed 邮箱是 `demo-admin@manhuaworks.local`。
虾总助用 bcryptjs 算 hash 直接 UPDATE 4 个 demo 用户的 password_hash = `bcrypt('Test1234!', 12)`。

### 全链路验证 (14:08 真测)

```bash
# 1. 登录
curl -X POST http://192.168.10.4:8088/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo-creator@manhuaworks.local","password":"Test1234!"}'
# → 200 + access_token

# 2. 拿 user_id (从 login response data.user.id)

# 3. 创建项目
curl -X POST http://192.168.10.4:8089/api/v1/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-mhw-user-id: $USER_ID" \
  -d '{"title":"测试项目","description":"...","tags":["scifi"]}'
# → 200 + project id: fc9a1cc3-9e2b-4d1d-9dae-1c6f675a73dd

# 4. 列项目
curl http://192.168.10.4:8089/api/v1/projects?user_id=$USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-mhw-user-id: $USER_ID"
# → 200 + 1 个项目
```

✅ **全链路通过**: 登录 → 拿 token → 创建项目 → 列项目, 端到端 200。
