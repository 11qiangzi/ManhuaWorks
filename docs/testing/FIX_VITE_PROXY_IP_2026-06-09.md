# Vite Proxy IP 修复报告

**时间**: 2026-06-09 20:25 CST
**报告人**: 虾总助
**问题反馈**: 梁总「项目里, 之前测试的项目文件怎么都没有了」

---

## 🐛 真相

**项目文件没丢** (DB 81 个项目, 4 个属于 tester-zheng), 是**前端拿不到数据**!

# 根因链

1. **本机 IP 变了**: `192.168.0.11` → `192.168.10.4`
2. **vite proxy 全 hardcode 老 IP**:
   - `apps/user-portal/vite.config.ts` 10 处 `192.168.0.11`
   - `apps/admin-portal/vite.config.ts` 12 处
   - `apps/ops-portal/vite.config.ts` 12 处
   - `apps/studio/vite.config.ts` 0 处 (studio 一直指 8087/8089, 实际后端 listen 0.0.0.0 不受影响)
3. **结果**: 浏览器 → vite proxy → 走老 IP → 路由找不到 → 卡 15s 超时 → 前端 list 失败 → 页面 0 个
4. **更糟**: 重启 vite 触发 dep re-optimize, 老 chunk hash 失效, 浏览器 504 反复

---

## 📁 改动的文件

| 文件 | 改动 |
|------|------|
| `apps/user-portal/vite.config.ts` | 10 处 `192.168.0.11` → `192.168.10.4` |
| `apps/admin-portal/vite.config.ts` | 12 处 |
| `apps/ops-portal/vite.config.ts` | 12 处 |
| **重启 vite + 清缓存**: user-portal (5180), admin-portal (5174), ops-portal (5176) |

**总: 34 处替换, 0 残留**

---

## ✅ 验证

- 浏览器实测: `http://192.168.10.4:5180/projects` (登录 tester-zheng)
  - 修复前: **0 个** (proxy 超时)
  - 修复后: **4 个** (你好 / 梁总的项目-B / 虾总助验 / 复测项目-卫峥) ✅
- DB 实测: 81 个项目, tester-zheng 名下 4 个 ✅

---

## 🧠 教训

1. **vite proxy 写死 IP = 隐藏的 IP 硬依赖** — 改 IP 必须同时改所有 proxy 块, 容易漏
2. **重启 vite 触发 dep re-optimize, 老 chunk 504** — 清 `node_modules/.vite` 缓存
3. **vite 启动要找真 .js 路径**, 别用 `.bin` 包装层 (monorepo 路径错)
4. **DB 真相 vs 页面真相 经常不一样** — 必查 DB + 后端 API, 区分 "数据丢失" vs "前端拿不到"
5. **改 vite.config 要重启 vite, HMR 不会热更 proxy 配置** — 老教训, 又踩一次

---

## 反思 (虾总助)

- 之前修 IP 问题时**只改了文档**, 没全局扫 vite.config.ts → 现在又踩坑
- 改完 vite.config 后**没立刻重启** → 浏览器继续走老 proxy, 浪费排查时间
- **应该有 hooks**: 改 IP → 全局脚本扫所有 hardcode IP 的文件 → 一次性提示改

**下一步**: 写个脚本 `tools/scan-hardcoded-ips.py` 扫所有 ts/vue/config 文件的 `192.168.x.x` 字面量, 出报告
