# ManhuaWorks 本地全流程图跑通 —— 条件清单（老板准备单）

> 背景：WorkBuddy 沙箱**无外网出口 + 无 Postgres/Redis/Node 基建**，无法在这里实跑"出图/视频/存库"那段。
> 要完成 UI 之外的全流程（建项目→AI 出图→一致性→出视频→合成→配音→导出），**必须在你本地有网的 Windows 开发机上跑整套**。
> 本清单按"主线：本地开发机跑"组织；末尾附"支线：想让沙箱代跑"的条件（不推荐）。

---

## 一、主线：本地开发机跑全流程

### A. 基础设施（一次性准备）

- [ ] **Git Bash**：`start-all.sh` 是 bash 脚本，Windows 必须用 Git Bash 跑（不要用 cmd/PowerShell）。
- [ ] **Node.js 22**：各微服务用 `npm run dev`（tsx）。⚠️ 注意 `start-all.sh` 第 14 行把 PATH 写死成 `C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2`，**换机器要改成你自己的 Node 22 路径**，或确保 `node` 已在 PATH。
- [ ] **PostgreSQL 16**（真依赖，脚本没起！）：
  - 安装后建库：`createdb manhuaworks`（或 `CREATE DATABASE manhuaworks;`）
  - 建用户/密码：`mhw` / `mhw_dev_only`（与默认 `DATABASE_URL` 一致），或改各服务的 `DATABASE_URL` / `.env`
  - 确认 `localhost:5432` 在监听
  - ⚠️ **`start-all.sh` 只起 Redis，不起 Postgres**——PG 必须你自己先手动起好，否则 user-service / asset-service 等会连库失败。
- [ ] **Redis**（多个服务用 ioredis）：
  - 安装：`winget install Redis`（或手动装 redis-server）
  - ⚠️ `start-all.sh` 第 15 行 redis 路径写死成 `C:/Users/Administrator/AppData/Local/Microsoft/WinGet/Links/redis-server.exe`（当前沙箱用户名）。**换机器/换用户名要改这一行**到你本机的 redis-server 路径。
  - 确认 `localhost:6379` 在监听（`redis-cli ping` 返回 PONG）。
- [ ] **外网出口**：你本地本来就有网，能连通 `https://apihub.agnes-ai.com` 即可（沙箱不通是因为隔离容器没路由，不是你电脑没网）。

### B. 代码依赖（一次性）

- [ ] 各微服务装依赖：`services/*` 下分别 `npm install`（user-service / ai-router / ai-orchestrator / project-service / billing-service / collab-service / ai-helper / asset-service / workflow-engine / api-gateway / monitor）。
- [ ] 前端装依赖：`apps/web` 下 `npm install`。
- [ ] **ai-router 需要先 build**：脚本用 `node --env-file=.env dist/index.js` 跑它，所以要先 `cd services/ai-router && npm run build` 出 `dist/`。（其他服务是 `npm run dev` 跑源码，不用 build。）

### C. 配置（已基本就绪）

- [x] **新 Agnes Key**：已写入 `services/ai-router/.env` 第 18 行（`AGNES_API_KEY=cpk-HF6...`）。✅
- [ ] **Replicate BYOK（可选）**：若走 `flux-kontext-pro` + face-swap 一致性链路，需在 UI `/settings/byok` 或 `.env` 填 Replicate token。
  - ⚠️ 注意：我之前 UI 冒烟发现 **`/settings/byok` 路由返回 404**（疑似 chunk 未打进 dist 或 import 路径问题），配 Replicate Key 的入口可能打不开——此问题待修。

### D. 启动 & 验证（顺序）

1. [ ] 手动起 PostgreSQL（确保 5432 通）。
2. [ ] Git Bash 里 `bash start-all.sh` → 脚本起 Redis + 全套微服务 + 前端 Vite(3000)，等端口就绪（脚本自检 11 个端口）。
3. [ ] 验余额+生图：`node scripts/agnes_smoke.mjs` → 看到 `HTTP 200` + 打印 `image URLs`，说明新 Key 有效、余额足。
4. [ ] 浏览器开 `http://localhost:3000`，注册/登录 → 走 10 步：项目设置→上传小说→角色设定→场景→分镜编排→镜头生图→镜头视频→合成→画质提升→AI 配音→导出。
5. [ ] 把任一环节报错/截图发我，我据此判断 P2–P4 一致性效果与遗留 blocker。

---

## 二、已知坑（提前告知，省得你跑的时候懵）

| 坑 | 说明 | 影响 |
|---|---|---|
| `start-all.sh` 不起 Postgres | 脚本只起 Redis；PG 依赖存在于 asset-service 等 | PG 未起 → 多个服务连库失败，**必须手动先起 PG** |
| node 路径写死 | 第 14 行 PATH 指向沙箱 managed node 22 | 换机器需改 PATH 或保证 `node` 在 PATH |
| redis 路径写死 | 第 15 行指向 `C:/Users/Administrator/...WinGet/Links/redis-server.exe` | 换用户名/未用 WinGet 装 → 需改路径 |
| ai-keys-service 端口冲突 | 脚本注释说它疑似与 ai-router(8083) 冲突，已跳过 | 不影响核心创作流 |
| BYOK 页 404 | 路由匹配到兜底 404，chunk 疑似未进 dist | 配 Replicate Key 入口打不开（待修） |
| 素材中心 API 缺 `/v1/` | 请求 `/api/projects` 而非 `/api/v1/projects` | 生产若只代理 `/api/v1/*` 会 404（dev 模式 vite proxy 有兜底能通） |

> 以上两个 UI 问题（BYOK 404、素材中心路径）不影响"出图/视频"核心流，但建议我**先修了再让你跑**，省一轮排查。要我现在就修吗？

---

## 三、支线：想让 WorkBuddy 沙箱代跑（不推荐）

若你坚持想让我在这里代跑（而不是你本地跑），需补齐：
- [ ] **给 Bash 沙箱本身开外网路由**（不是宿主机网——之前你开电脑网没覆盖到这个隔离容器，Google/Cloudflare/Agnes 全 TCP 超时）。
- [ ] 在沙箱里装 **PostgreSQL + Redis + Node 22 + Git**（当前沙箱是精简环境，这些全无）。
- [ ] 把项目依赖在沙箱里 `npm install`（沙箱可能也限制 npm registry 访问）。

这套比本地跑更麻烦，且沙箱网络隔离是硬墙，**强烈建议走主线（你本地跑）**。

---

## 四、我已交付的相关资产

- `scripts/agnes_smoke.mjs` —— 按 `AgnesProvider` 真实调用，验余额+出图（Key 脱敏）。
- `scripts/serve-dist.mjs` + `scripts/ui-e2e.mjs` —— UI 层 Playwright 冒烟（已跑过，17 路由截图见 `e2e-smoke-report.md`）。
- `e2e-smoke-report.md` —— UI 冒烟报告（公共页 5/5、受保护页 11/12，分镜编辑器 0 错误）。
- `p2-p4-code-verification.md` —— P0–P6 提示词逻辑静态验证（带行号）。
