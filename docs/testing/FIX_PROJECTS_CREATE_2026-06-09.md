# 创建项目 bug 修复报告

**时间**: 2026-06-09 18:33 CST
**报告人**: 虾总助
**问题反馈**: 梁总「创建项目怎么不行」

---

## 🐛 4 个 bug 串成 1 个故障

### Bug 1: BaseURL 路径缺 `/api`
- 现象: POST `/v1/projects/` → 400
- 后端实际: `POST /api/v1/projects` → 201 OK
- 修: `BASE = '/v1/projects'` → `BASE = '/api/v1/projects'`

### Bug 2: 缺 x-mhw-user-id header
- 现象: list 返 `error: 无效的类型 uuid 输入语法: "undefined"`
- 后端要求: `x-mhw-user-id` header (project-service 直接读 DB 时用)
- 修: `authHeaders()` 加 `tokenStore.getUser<{id}>()` → `h['x-mhw-user-id'] = u.id`

### Bug 3: 字段名 snake ↔ camel
- 现象: 创建返 201, 但页面 0
- 前端发 `name`, 后端要 `title`
- 后端返 `title`/`cover_url`/`status: 0` (snake + 数字), 前端用 `name`/`cover`/`status: 'active'`
- 修: `list()` 加 mapper, snake→camel + 数字→字符串 status 映射

### Bug 4: 响应字段名不匹配
- 现象: 后端返 `data.count`, 前端 `data.total` → total=0
- 修: `total: d.total ?? d.count ?? items.length`

### Bug 5: cleanFilter 重复导致 TS 编译失败 (sed 误伤)
- 现象: `[hmr] Failed to reload /src/api/project-service.ts` + 列表仍 0
- 修: 删 L97-111 重复的 cleanFilter + 删 list 函数尾多余 `}`

---

## 📊 修复前后对比

| 测试 | 修复前 | 修复后 |
|------|--------|--------|
| 浏览器点新建 | 弹 `Request failed 400` | 跳转 `/projects/{id}` ✅ |
| 列表显示 | 0 个 (后端有 2 个) | 3 个 ✅ |
| 计数 | 0/2 | 3/3 ✅ |
| 新建后立即 | 没建 | 自动跳转详情页 ✅ |
| HMR 编译 | 500 失败 | OK ✅ |

---

## 📁 改动的文件

- `D:\ManhuaWorks\apps\user-portal\src\api\project-service.ts`
  - L85: `BASE = '/api/v1/projects'`
  - L92-99: `authHeaders()` 加 x-mhw-user-id
  - L107-148: `list()` 加 mapper (snake→camel, 数字→字符串 status, total ?? count)

---

## 🧠 教训

1. **多 bug 串联**: 一个症状往往是 3-5 个问题叠在一起, 修一个会暴露下一个, 必须**逐个排查**而不是一次改完
2. **不要用 sed 大改**: sed 抓 `try/catch` 边界容易多抓/少抓 `}`, 改 3 次出问题
3. **响应字段一定要看 console 实际响应体**: 拿真后端响应用 Python 看, 别只信前端
4. **HMR 编译失败时 console 没明显错**: 必须看 network 拉 ts 源, 看 esbuild 报错
5. **mapper 必做**: 前后端字段不统一 (snake vs camel) 是网最痛点, 应在 service 层统一

---

**状态**: ✅ 修复完成, 通过实测验证
