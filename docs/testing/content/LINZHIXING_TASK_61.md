# 林知行 📝 派单 61-3 — 内容审查补完

> **派发**: 陈远枢 @ 派单 61 | **时间**: 2026-06-11 16:32 CST
> **截止**: 今晚 22:00
> **前置**: v1 报告已交 (12/34页, 15 Bug) | 矩阵 41 Bug 已入表

---

## 🚨 铁律

- **逐页实测** — 每页真读文字，不许跳，不许编
- **有截图才算** — 每页 ≥1 张截图证据，P1 问题 ≥1 录屏
- **不瞎填** — 没测到的写"未测"，不许编数据
- **跟 v1 对齐** — v2 在 v1 基础上追加，不要重复

---

## 📋 任务: 补完 22 页内容审查

### 已测 (v1): 12 页

Web首页/showcase/login/dashboard | Admin仪表盘/用户/计费 | Ops看板/用户/监控 | User工作台/项目 | Studio素材库

### 待补 (v2): 22 页

#### Studio 工作台 (10页 — 全部未审)
| # | 路由 | 页面 | 文字量 |
|---|------|------|:---:|
| 1 | / | 首页 | 中等 |
| 2 | /materials | 素材库 | 中等 |
| 3 | /workflow | 工作流 | 少量 |
| 4 | /project | 项目编辑器 | 大量 |
| 5 | /tools | 工具箱 | 中等 |
| 6 | /export | 导出 | 少量 |
| 7 | /project/:id/shots | 分镜网格 | 少量 |
| 8 | /project/:id/shots/:sid | 分镜编辑器 | 中等 |
| 9 | /workflow/batch | 批量生成 | 少量 |
| 10 | /characters/:id/edit | 角色编辑 | 中等 |

#### Web 主站子路由 (6页)
| # | 路由 | 页面 |
|---|------|------|
| 11 | /studio/project/:id | 项目编辑器 |
| 12 | /studio/models | 模型选择器 |
| 13 | /studio/byok | BYOK设置 |
| 14 | /studio/progress | 生成进度 |
| 15 | /studio/storyboard/:pid | 分镜编辑器 |
| 16 | /studio/characters | 角色库 |

#### Admin/Ops/User 深层 (6页)
| # | 站点 | 路由 | 页面 |
|---|------|------|------|
| 17 | Admin | /settings | 系统设置 |
| 18 | Admin | /ops | 业务运营 |
| 19 | Admin | /projects | 项目审核 |
| 20 | Ops | /system | 系统管理 |
| 21 | Ops | /billing | 计费充值 |
| 22 | User | /settings | 设置 |

---

## 📄 每页检查项 (全量)

1. 错别字/别字/多字/漏字
2. 断句错误 (标点反常)
3. 中英混杂 (不必要的英文)
4. 图片加载 + Alt 文本
5. 链接有效性 (全部可点)
6. 统一用语 (对照术语表)
7. 弃读评分 (1-5, ≤3 = P1 Bug)
8. 截图 (png, 每页≥1)

---

## 📄 输出

**文件**: `D:\ManhuaWorks\docs\testing\content\LINZHIXING_BLIND_CONTENT_2026-06-11_v2.md`

在 v1 基础上追加 22 页逐页审查结果。格式与 v1 一致。

---

> ⏰ 今晚 22:00 截止。遇到 P0 阻断立刻报。
