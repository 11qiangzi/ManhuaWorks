# FIX_USERPORTAL_NAV_LAN_2026-06-09

> **修时间**: 2026-06-09 21:07  
> **修作者**: 虾总助  
> **影响**: user-portal 所有跨 app 跳转  
> **触发**: 梁总反馈「在普通用户的工作台里面怎么都不能点击跳转」

---

## 🐛 Bug 现象

梁总在 192.168.10.4 局域网访问 user-portal，点击 "打开" / "创作者工作台" 等按钮：
- 按钮**有** click handler、**有** @click 事件
- 弹出新窗口，但**跳转到 `http://localhost:5175/...`**
- 梁总的设备**没有 localhost 服务** → 404
- 表现就是"点了没反应"

**根因**：user-portal 9 处 `http://localhost:5175` / `http://localhost:3000` 硬编码，**写死**了 localhost，不跟随当前访问 host。

## 🔍 根因

```vue
<!-- ❌ 旧代码：硬编码 localhost -->
function openInStudio(id: string) {
  window.open(`http://localhost:5175/project/${id}`, '_blank')
}
```

`localhost` 在：
- 本机浏览器打开 → 能用（就是本机）
- LAN 设备 / 移动端打开 → 404（指向设备自己）

虾总助前面修 vite proxy IP 时漏掉了 .vue 业务代码里的硬编码 URL。vite proxy 是代理服务器侧硬编码，**业务代码里**的 URL 是浏览器侧硬编码，是**两个不同的隐患**。

## 🔧 修法

把所有 localhost 改成 `window.location.hostname`（跟随当前访问 host）：

```vue
<!-- ✅ 新代码 -->
function openInStudio(id: string) {
  const host = window.location.hostname
  window.open(`http://${host}:5175/project/${id}`, '_blank')
}
```

如果是 template 里（`href`），用 `computed`：

```ts
const studioHref = computed(() => `http://${window.location.hostname}:5175`)
```

```vue
<a :href="studioHref" target="_blank">创作者工作台</a>
```

## 📁 改的文件 (9 处)

| # | 文件 | 行 | 旧 | 新 |
|---|------|----|----|----|
| 1 | `apps/user-portal/src/views/MyProjectsView.vue` | 80-83 | `localhost:5175/project/${id}` | `window.location.hostname:5175/project/${id}` |
| 2 | `apps/user-portal/src/views/MyProjectsView.vue` | 156 | `href="http://localhost:5175"` | `:href="studioHref"` |
| 3 | `apps/user-portal/src/views/MyProjectsView.vue` | 80 后 | (无) | 新增 `const studioHref = computed(...)` |
| 4 | `apps/user-portal/src/views/HomeView.vue` | 49 | `route: 'http://localhost:5175/workflow'` | `` route: `${STUDIO_HOST}/workflow` `` |
| 5 | `apps/user-portal/src/views/HomeView.vue` | 53 | `route: 'http://localhost:5175/byok'` | `` route: `${STUDIO_HOST}/byok` `` |
| 6 | `apps/user-portal/src/views/HomeView.vue` | 78 | (无) | 新增 `const STUDIO_HOST = ...` |
| 7 | `apps/user-portal/src/views/AssetLibraryView.vue` | 162 | `href="http://localhost:5175"` | `:href="studioHref"` |
| 8 | `apps/user-portal/src/views/AssetLibraryView.vue` | 132 | (无) | 新增 `const studioHref = ...` |
| 9 | `apps/user-portal/src/router/index.ts` | 33, 81 | `localhost:5175` / `localhost:3000` | `window.location.hostname:5175` / `:3000` |

## ✅ 验证 (浏览器实测 21:07)

### 测 1: "创作者工作台" 链接
- 点击 user-portal HomeView → MyProjectsView 的"创作者工作台"链接
- 新 tab 打开 → `http://192.168.10.4:5175/workflow` ✅
- 之前是 `http://localhost:5175/workflow` ❌

### 测 2: "打开" 按钮
- 点击 MyProjectsView 项目卡片的"打开"按钮
- 新 tab 打开 → `http://192.168.10.4:5175/project/27fde728-8259-4594-a3db-4d99bbb608bb` ✅
- 之前是 `http://localhost:5175/project/...` ❌

### 测 3: admin-portal / ops-portal / web 扫描
```bash
grep -r "localhost:5175\|localhost:3000\|localhost:5180" apps/{admin,ops,web}/src
# 无输出
```

这些 app 没硬编码，因为它们自己就是 vite proxy 的客户端，跨 app 跳转少。

## 📚 教训（也写进 ERRORS.md）

1. **业务代码 URL 硬编码 = 隐形 LAN 杀手**
   - vite.config 代理 IP 错 → 看不到
   - 业务代码 `localhost:XXXX` → 跨设备 404
   - 修 IP 时**两个地方都要扫**

2. **动态 host 是 LAN 多设备唯一解**
   - `import.meta.env.VITE_HOST` 不行（构建时固化）
   - `window.location.hostname` 才是 runtime 跟着浏览器走
   - C 端 demo 必备

3. **灰测真机不可省**
   - 虾总助一直在 `192.168.10.4:5180` 用 LAN IP 测，理论上应该能发现
   - 但因为点 "打开" 弹新窗口后 vite 自动重定向到 LAN IP (HMR?)，看似"能用"
   - 只有**梁总在另一台设备**才会暴露

## 🎯 后续 P2

- [ ] 写 `scripts/scan-hardcoded-ips.py` — 扫所有 .ts/.vue/.js 的 `localhost:XXXX` + `127.0.0.1:XXXX` + `192.168.X.X`
- [ ] user-portal `vite.config.ts` 加 build 时 `grep` 守门：发现 localhost:5175 报错

---

**M3.5+ 第 7 修复完结 (项目创建 5 + 创作者 3 + studio 4 + LAN IP + 项目丢失 + 官网首页 + 跨 app 跳转)**

**耗时**: 18 分钟
