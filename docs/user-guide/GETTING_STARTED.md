# ManhuaWorks 快速入门

> 4 角色 × 4 portal × 5 步上手 — 5 分钟跑通 ManhuaWorks 全产品

---

## 0. 准备

| 项 | 值 |
|---|---|
| Node | v18+ (推荐 20 LTS) |
| pnpm | v9+ |
| Postgres | 16 (本地 5432, 凭据见 `.env`) |
| Redis | 7+ (缓存/会话) |
| 端口 | web:3000 / admin:5174 / studio:5175 / user:5180 / ops:5176 / 4 service: 8088-8091 / orchestrator:8087 |

启动一条龙：
```bash
cd D:\ManhuaWorks
# 启所有 dev (前台)
pnpm dev
# 或后台
./infrastructure/dev-start.ps1
```

启动后访问 `http://localhost:3000`，看到 Web 站首页即成功。

---

## 1. 4 角色快速入门

### 1.1 管理员 (admin)

> **适用**: 平台运营、客服、审计

#### 入口
- `http://localhost:5174` (admin-portal)
- 登录：`admin@manhuaworks.local` (DB seed 预置, 无密码可登, 仅展示用)
- 或用 `l5b-test@example.com / Test1234` (烟测自动注册)

#### 5 步上手
1. **看大盘** — 进 `/dashboard`，4 张卡 (今日新增用户、待审项目、活跃创作者、收入)
2. **审项目** — 进 `/projects`，未审 4 条，点开看缩略图
3. **审用户** — 进 `/users`，4 个 demo 用户角色徽章
4. **查流水** — 进 `/billing`，4 角色柱状图 + 充值历史
5. **查 ops 健康** — 进 `/ops`，service 健康实时刷新

#### 截图占位
- [SCREENSHOT: 登录页]
- [SCREENSHOT: dashboard]
- [SCREENSHOT: projects 列表]
- [SCREENSHOT: billing 柱状图]

---

### 1.2 创作者 (creator)

> **适用**: 画手、上色、分镜师

#### 入口
- `http://localhost:5175` (studio)
- 登录同上

#### 5 步上手
1. **建项目** — `/projects/new`，填名 (e.g. 《废墟开局我在一星替国家打工》) + 选模板
2. **建角色** — `/characters/new`，上传大头照 + 全身照 + 选年龄/性格/口癖
3. **建场景** — `/scenes/new`，选模板 (室内/室外/科幻/古风)，传参考图
4. **写脚本** — `/scripts/episode/1`，分镜表 (镜号/景别/画面/台词/时长)
5. **生成** — 调 `/api-keys` 配 deepseek/zhipu key，点"批量生成分镜" → AI 出图

#### 截图占位
- [SCREENSHOT: 项目列表]
- [SCREENSHOT: 角色编辑器]
- [SCREENSHOT: 分镜编辑]

---

### 1.3 免费用户 (free)

> **适用**: 体验、试用、低频创作者

#### 入口
- `http://localhost:5180` (user-portal)
- 登录同上

#### 5 步上手
1. **看 API-key** — `/byok`，新建 key (选 provider: deepseek/zhipu)
2. **看订阅** — `/subscriptions`，当前 free 档，0 配额
3. **看账单** — `/billing`，余额 0，可充值
4. **看团队** — `/teams`，可建团队
5. **看设置** — `/settings`，2FA / 通知 / 主题

#### 截图占位
- [SCREENSHOT: BYOK 列表]
- [SCREENSHOT: 订阅]
- [SCREENSHOT: 充值页]

---

### 1.4 商业用户 (business)

> **适用**: 工作室、MCN、IP 运营

#### 入口
- `http://localhost:5180` (user-portal)
- 登录同上

#### 5 步上手
1. **建企业** — `/teams/new`，选 business 档
2. **加成员** — `/teams/:id/members`，邀请创作者/客服
3. **看配额** — `/quotas`，月调用上限
4. **看报表** — `/reports`，本月用量趋势
5. **API 集成** — 调 `/api-keys` 拿 long-lived key，集成到自己系统

#### 截图占位
- [SCREENSHOT: 团队列表]
- [SCREENSHOT: 配额曲线]
- [SCREENSHOT: API key 管理]

---

## 2. 跨角色共性

### 2.1 鉴权
- 所有门户用同一份 `access_token` (HS256 JWT, 7d TTL)
- 登录：`POST /api/v1/auth/login` body `{email, password}` → `{access_token, refresh_token}`
- 刷新：`POST /api/v1/auth/refresh` body `{refresh_token}` → 新 access_token
- 退出：`POST /api/v1/auth/logout` 清 session

### 2.2 BYOK
- 每个用户可独立配 `deepseek/zhipu/minimax/volcengine` key
- key 明文只返一次 (`GET /:id/reveal`)，列表只返 `key_last4`
- 业务调用走 user-service → orchestrator → 用户的 key

### 2.3 充值
- ops-portal `/billing` 4 角色柱状图
- API：`POST /api/v1/billing/recharge` body `{userId, amount, currency}` → invoice + payment
- 业务规则：不能给别的 user 充 (security)

---

## 3. 排错

| 现象 | 排查 |
|---|---|
| 启动报端口占用 | `netstat -ano | findstr :3000` 杀 PID |
| Postgres 连不上 | `pg_isready -h 127.0.0.1 -p 5432` |
| Redis 连不上 | `redis-cli -p 6379 ping` 应返 PONG |
| 401 invalid token | 检查 `Authorization: Bearer` 前缀 |
| 401 audience invalid | 跨服务 token 共享，billing 已放宽 |
| Vitest 失败 | `pnpm test` 看是哪个 service |
| 集成冒烟 8 失败 | `pnpm exec tsc --noEmit` 编译错？ |

---

## 4. 进阶

- 部署：`docs/operations/DEPLOYMENT.md` (nginx + pm2)
- API 文档：`docs/user-guide/API_REFERENCE.md`
- 已知问题：`docs/operations/M2_KNOWN_ISSUES.md`
- 验收报告：`docs/operations/M2_ACCEPTANCE.md`
