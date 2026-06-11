# 林知行 派单 62.3 — 5 P3 文案修复报告

> **修复人**: 林知行 📝 内容部主编
> **时间**: 2026-06-11 18:00 CST
> **状态**: ✅ 全部完成
> **交叉复测人**: 赵千影

---

## 修复总览

| Bug ID | 问题 | 站点/页面 | 状态 | 验证方式 |
|--------|------|-----------|------|----------|
| C-013 | 监控提示可简化 | Ops/monitoring | ✅ | 实时DOM验证 + 截图 |
| C-014 | CTA用词可优化 | Web首页 | ✅ | 源码验证（Web未启动） |
| C-015 | 在线用户缺单位 | Admin/dashboard | ✅ | 实时DOM验证 + 截图 |
| C-028 | 成员名中英混杂 | User/team | ✅ | 实时DOM验证 + 截图 |
| C-029 | 下拉框单字母前缀 | User/byok | ✅ | 实时DOM验证 + 截图 |

---

## 逐项修复详情

### ✅ C-013 — 监控提示简化

**文件**: `apps/ops-portal/src/views/MonitoringView.vue` (L164)

**修改**:
```
- <p class="empty-hint">后端监控端点就绪后将自动填充实时数据</p>
+ <p class="empty-hint">监控端点就绪后自动填充实时数据</p>
```

**验证**: 浏览器 DOM 检查确认文本已变更为"监控端点就绪后自动填充实时数据"。

**截图**: `docs/testing/content/fix_screenshots/C-013_ops-monitoring.png`

---

### ✅ C-014 — Web首页CTA用词优化

**文件**: `apps/web/src/views/HomeView.vue` (L70)

**修改**:
```
- <RouterLink to="/login" class="btn-primary">免费开始创作</RouterLink>
+ <RouterLink to="/login" class="btn-primary">立即开始</RouterLink>
```

**说明**: Web主站 (5173) 当前未运行，源码已修改。启动后 HMR 自动生效。邻行"看看作品"保持不变，两个CTA按钮形成"立即开始 + 看看作品"的简洁组合。

---

### ✅ C-015 — 在线用户加单位

**文件**: `apps/admin-portal/src/views/DashboardView.vue` (L43)

**修改**:
```
- <KpiCard label="当前在线" :value="k?.activeNow ?? 0" icon="🟢" />
+ <KpiCard label="当前在线" :value="k?.activeNow ?? 0" unit="人" icon="🟢" />
```

**验证**: 浏览器 DOM 检查确认显示为"87人"（原为"87"）。

**截图**: `docs/testing/content/fix_screenshots/C-015_admin-dashboard.png`

---

### ✅ C-028 — 成员名中英混杂修复

**文件**: `apps/user-portal/src/views/TeamView.vue` (L74-75)

**修改**:
```
- { id: 'm6', name: '设计师 Alice', ... }
- { id: 'm7', name: '前成员 Bob', ... }
+ { id: 'm6', name: '设计师 阿丽', ... }
+ { id: 'm7', name: '前成员 鲍勃', ... }
```

**验证**: 浏览器 DOM 检查确认成员列表显示"设计师 阿丽"和"前成员 鲍勃"。

**截图**: `docs/testing/content/fix_screenshots/C-028_user-team.png`

---

### ✅ C-029 — 下拉框去掉单字母前缀

**文件**: `apps/user-portal/src/api/api-keys.ts` (L79-113)

**问题**: Provider 下拉框显示 "O OpenAI / A Anthropic / G Google Gemini / D DeepSeek / M MiniMax"，单字母前缀怪异。

**修改**: 将 logo 从单字母替换为语义化 emoji：

| Provider | 原来 | 改为 |
|----------|------|------|
| OpenAI | O | 🤖 |
| Anthropic | A | 🧠 |
| Google Gemini | G | 🔍 |
| DeepSeek | D | 💡 |
| MiniMax | M | ⚡ |

**验证**: 浏览器 DOM 检查确认下拉框选项显示为"🤖 OpenAI / 🧠 Anthropic / 🔍 Google Gemini / 💡 DeepSeek / ⚡ MiniMax M-Series"。

**截图**: `docs/testing/content/fix_screenshots/C-029_user-byok.png`

---

## 验证汇总

### 实时DOM验证（4/4）

| Bug ID | 页面 | 检查项 | 结果 |
|--------|------|--------|------|
| C-013 | Ops/monitoring | `.empty-hint` textContent | ✅ "监控端点就绪后自动填充实时数据" |
| C-015 | Admin/dashboard | `.kpi-value` 含"在线"的卡片 | ✅ "87人" |
| C-028 | User/team | `.mb__name` 含"阿丽""鲍勃" | ✅ "设计师 阿丽"、"前成员 鲍勃" |
| C-029 | User/byok | Provider select options | ✅ "🤖 OpenAI" 等 (无单字母) |

### 截图（4/4）

| Bug ID | 截图 | 大小 |
|--------|------|------|
| C-013 | C-013_ops-monitoring.png | 94 KB |
| C-015 | C-015_admin-dashboard.png | 118 KB |
| C-028 | C-028_user-team.png | 147 KB |
| C-029 | C-029_user-byok.png | 106 KB |

### Console检查

所有4个已验证页面的 DevTools Console 均无新增报错。

---

## 待交叉复测

请赵千影按以下清单复测：

| # | 检查项 | 涉及页面 |
|---|--------|----------|
| 1 | Ops 监控页空状态文案是否简洁 | /monitoring |
| 2 | Web 首页 CTA 按钮文案（需启动 Web: `pnpm dev`） | / |
| 3 | Admin 仪表盘在线用户是否显示"XX 人" | /dashboard |
| 4 | User 团队成员名是否全中文（无 Alice/Bob） | /team |
| 5 | User BYOK 下拉框服务商名是否无单字母前缀 | /byok |
| 6 | 修复是否引入新 Bug | 全部相关页 |
| 7 | Console 无新增报错 | DevTools |

---

## 备注

- C-014 的 Web 主站 (port 5173) 当前未运行，源码已修改。如需验证，运行 `cd apps/web && pnpm dev` 即可。
- 所有 5 个 P3 文案修复均不涉及 API 变更、路由变更或依赖变更，风险极低。
- 修改文件共 5 个，每项仅改 1 处，改动最小化。

---

**林知行 📝** | 2026-06-11 18:00 | 待赵千影交叉复测
