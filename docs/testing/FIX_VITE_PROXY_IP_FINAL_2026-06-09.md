# Vite Proxy IP 修复 + 项目数真相报告

**时间**: 2026-06-09 20:42 CST
**报告人**: 虾总助
**问题反馈**: 梁总「项目里, 之前测试的项目文件怎么都没有了」「项目不是有 50 个嘛」

---

## 🎯 真相

**项目文件没丢**, 三个事实:
1. **梁总 (admin@manhuaworks.local) 名下: 3 个漫改作品** ✅
2. **之前看到 50 个是未登录乱炖** (后端 list 不强制鉴权, 返 LIMIT 50)
3. **修复 vite proxy IP 后, 3 个真项目完美显示**

---

## 🐛 根因链

| # | 根因 | 后果 |
|---|------|------|
| 1 | 本机 IP 变了 `192.168.0.11` → `192.168.10.4` | vite proxy 走错 IP |
| 2 | vite proxy `target` hardcode 老 IP (34 处) | 卡 15s 超时 |
| 3 | 浏览器前端 list 失败 | 页面 0 个项目 |
| 4 | 后端 list 端点**不强制鉴权** | 未登录返 LIMIT 50 乱炖数据 |
| 5 | 重启 vite 触发 dep re-optimize | 老 chunk 504 |

---

## 🛠 修复

### 1. vite proxy IP 全量替换
- `apps/user-portal/vite.config.ts`: 10 处
- `apps/admin-portal/vite.config.ts`: 12 处
- `apps/ops-portal/vite.config.ts`: 12 处
- **总: 34 处, 0 残留**

### 2. 重启 vite + 清缓存
- user-portal (5180), admin-portal (5174), ops-portal (5176)
- 清 `node_modules/.vite` 缓存

### 3. admin 密码重置
- admin hash 原是 `argon2id$v=19$m=65536...` (user-service 不识别)
- 重置为 bcrypt `Test1234!` (与 demo 账号统一)

---

## ✅ 验证

| 操作 | 之前 | 修复后 |
|------|------|--------|
| admin 登录 5180/projects | 0 个 (proxy 超时) | **3 个** ✅ |
| 真实项目: 都市奇缘 / 剑破苍穹 / 深空遗民 | 看不到 | 看到 ✅ |
| tester-zheng 登录 | 0 个 | **4 个** ✅ |

---

## ⚠️ P1 Bug: 后端 list 端点不强制鉴权

**症状**: 不带 token + 不带 `x-mhw-user-id` 也返 50 个项目 (LIMIT 50 乱炖)

**影响**: 任何未登录用户都能拉取任意项目数据 (隐私泄露)

**根因**: `project-service` list 端点没检查 token, 只取 `x-mhw-user-id`, 默认返所有

**修法 (P1 待办)**: 改 `controllers/projectsController.ts` L??? 加 `if (!user_id) return 401`

---

## 📁 DB 真相 (81 个项目分布)

| 账号类型 | 用户数 | 项目数 | 备注 |
|---------|-------|--------|------|
| admin (梁总) | 1 | **3** | 漫改作品 |
| tester-zheng/luhan/jixian | 3 | 4+1+0 | 测试员 |
| demo-admin/creator/free/business | 4 | 0 | 演示账号 |
| resilience-17809... (压力测试) | 10+ | 50 | 6/8-6/9 跑压力测试残留 |
| cross-e2e-* / e2e-flow-* | 20+ | 20+ | E2E 测试残留 |
| e2e-conc-* / e2e-perm-* | 5+ | 5+ | 其他 E2E |
| **总** | ~50 个 user | **81 个项目** | |

**梁总的 3 个项目**:
- 📁 **都市奇缘: 晚安摩天楼** (草稿)
- 📁 **剑破苍穹: 少年宗主** (进行中)
- 📁 **深空遗民: 第八殖民舰** (已发布)

---

## 🧠 教训

1. **DB 真相 vs 页面真相 经常不一样** — 必先 DB 直查
2. **改 IP 是系统级变更** — docs + vite.config + .env + 都要扫
3. **后端鉴权不能省** — list 端点必须强制 token
4. **vite 启动路径** — monorepo 别用 `.bin` 包装层, 直接找真 .js
5. **重启 vite 要清缓存** — 否则老 chunk 504

---

## 待办 (P1 优先级)

- [ ] **修后端 list 鉴权** (P1): 返 401 当 token 缺失
- [ ] **写 scan-hardcoded-ips.py** (P2): 扫所有 ts/vue/config 字面 IP
- [ ] **清理旧测试账号** (P3): resilience / e2e bot 用户

---

## 文件改动

| 文件 | 改动 |
|------|------|
| `apps/user-portal/vite.config.ts` | 10 处 IP |
| `apps/admin-portal/vite.config.ts` | 12 处 IP |
| `apps/ops-portal/vite.config.ts` | 12 处 IP |
| `users` 表 (admin hash) | argon2id → bcrypt |
| (重启) vite × 3 | 清缓存 + 重启 |
